/* eslint-disable @typescript-eslint/no-explicit-any */
// ---------------------------------------------------------------------------
// 端到端测试用的 PostgREST 兼容层。
//
// 生产环境连的是 Supabase（PostgREST + GoTrue）。测试容器没有外网，所以这里
// 用本地 Postgres 直连，把应用实际用到的那部分 PostgREST 语义实现出来：
// 查询构造、过滤器、count、single/maybeSingle、rpc、以及错误对象的形状。
//
// 关键点：**应用代码一行都不改**。next.config.ts 只在 E2E_MOCK_SUPABASE=1 时
// 把 @supabase/supabase-js 与 @supabase/ssr 指到这里，所以被测的是真实的
// 页面、Server Action、触发器和 SQL —— 只是换掉了网络传输层。
// ---------------------------------------------------------------------------

import { Pool, types as pgTypes } from "pg";

// ---- 类型保真 -------------------------------------------------------------
// PostgREST 返回的是 JSON，日期/时间戳是**字符串**；node-pg 默认把它们解析成
// JS Date 对象。应用里有大量 `row.stat_date >= "2026-08-22"` 这类字符串比较，
// 拿到 Date 对象会静默全部失配。所以这里把解析行为对齐到 PostgREST。
const T_DATE = 1082, T_TIMESTAMP = 1114, T_TIMESTAMPTZ = 1184, T_INT8 = 20;
pgTypes.setTypeParser(T_DATE, (v: string) => v);                    // "2026-08-22"
pgTypes.setTypeParser(T_TIMESTAMP, (v: string) => v.replace(" ", "T"));
pgTypes.setTypeParser(T_TIMESTAMPTZ, (v: string) => {
  // "2026-08-22 02:12:48.049163+00" → "2026-08-22T02:12:48.049163+00:00"
  let s = v.replace(" ", "T");
  const m = s.match(/([+-])(\d{2})$/);
  if (m) s = s + ":00";
  return s;
});
pgTypes.setTypeParser(T_INT8, (v: string) => Number(v));            // PostgREST 给数字
// numeric(1700) 保持 pg 默认的字符串 —— 与 PostgREST 一样需要调用方自己 num()


let pool: Pool | null = null;
function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.E2E_DATABASE_URL ??
        "postgresql://postgres@localhost:5433/e2e?host=/tmp",
      max: 8,
    });
  }
  return pool;
}

// ---- 列类型缓存 -----------------------------------------------------------
// PostgREST 的请求体是 JSON，写入 json/jsonb 列时字符串会被当作 JSON 字符串。
// 直连 Postgres 时必须自己做这件事，否则 value='L2' 会报
// invalid input syntax for type json。
const jsonCols = new Map<string, Set<string>>();
async function jsonColumnsOf(table: string): Promise<Set<string>> {
  const hit = jsonCols.get(table);
  if (hit) return hit;
  const { rows } = await db().query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name=$1 and data_type in ('json','jsonb')`,
    [table],
  );
  const set = new Set<string>(rows.map((r: { column_name: string }) => r.column_name));
  jsonCols.set(table, set);
  return set;
}

export interface PgrestError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

function toError(e: unknown): PgrestError {
  const err = e as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: err?.message ?? String(e),
    code: err?.code ?? "XXTEST",
    details: err?.detail ?? null,
    hint: err?.hint ?? null,
  };
}

const quote = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
/**
 * 标识符。支持 PostgREST 的限定列名：嵌套资源上的过滤器写成 "orders.created_at"，
 * 要展开成 "orders"."created_at"，不能整个当成一个列名去引。
 */
const ident = (s: string) => String(s).split(".").map(quote).join(".");

/**
 * 从 select 字符串里拆出嵌套资源：
 *   "qty,price,orders!inner(created_at,pay_status)"
 *     → [{ table: "orders", inner: true, cols: ["created_at","pay_status"] }]
 *
 * 以前这里直接把带 "(" 的列丢掉，注释写着「本项目未使用」——
 * 但 web.ts 的单品销售额恰恰用了 orders!inner(...)，
 * 于是那段唯一的销售额取数从来没被任何测试跑过。
 */
function parseEmbeds(cols: string): { table: string; inner: boolean; cols: string[] }[] {
  const out: { table: string; inner: boolean; cols: string[] }[] = [];
  const re = /([A-Za-z_][\w]*)(!inner|!left)?\(([^()]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cols)) !== null) {
    out.push({
      table: m[1],
      inner: m[2] === "!inner",
      cols: m[3].split(",").map((c) => c.trim()).filter(Boolean),
    });
  }
  return out;
}

/** 去掉嵌套资源片段，只留本表自己的列。 */
function stripEmbeds(cols: string): string {
  const rest = cols
    .replace(/([A-Za-z_][\w]*)(!inner|!left)?\([^()]*\)/g, "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return rest.length ? rest.join(",") : "*";
}

type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "is" | "in" | "like" | "ilike" | "cs";

interface Cond {
  sql: string;
  params: unknown[];
}


/** PostgREST 的 in 过滤器既可以传数组，也可以传 "(a,b,c)" 字符串 */
function asList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const s = String(v).trim();
  if (s.startsWith("(") && s.endsWith(")")) {
    return s.slice(1, -1).split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter((x) => x !== "");
  }
  return [v];
}

class Builder implements PromiseLike<{ data: any; error: PgrestError | null; count: number | null }> {
  private table: string;
  private verb: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private payload: any = null;
  private conds: Cond[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private wantCount = false;
  private headOnly = false;
  private returning = false;
  private singleMode: "one" | "maybe" | null = null;
  /** 嵌套资源：select("qty,orders!inner(created_at,pay_status)") */
  private embeds: { table: string; inner: boolean; cols: string[] }[] = [];

  constructor(table: string) {
    this.table = table;
  }

  // -- 过滤器 -------------------------------------------------------------
  private push(col: string, op: Op, value: unknown) {
    const c = ident(col);
    switch (op) {
      case "is":
        this.conds.push({
          sql: value === null ? `${c} is null` : `${c} is ${value ? "true" : "false"}`,
          params: [],
        });
        break;
      case "in":
        this.conds.push({ sql: `${c} = any($$)`, params: [asList(value)] });
        break;
      case "cs":
        this.conds.push({ sql: `${c} @> $$`, params: [value] });
        break;
      case "like":
      case "ilike":
        this.conds.push({ sql: `${c} ${op} $$`, params: [value] });
        break;
      default: {
        const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op];
        this.conds.push({ sql: `${c} ${sym} $$`, params: [value] });
      }
    }
    return this;
  }

  eq(c: string, v: unknown) { return this.push(c, "eq", v); }
  neq(c: string, v: unknown) { return this.push(c, "neq", v); }
  gt(c: string, v: unknown) { return this.push(c, "gt", v); }
  gte(c: string, v: unknown) { return this.push(c, "gte", v); }
  lt(c: string, v: unknown) { return this.push(c, "lt", v); }
  lte(c: string, v: unknown) { return this.push(c, "lte", v); }
  is(c: string, v: unknown) { return this.push(c, "is", v); }
  in(c: string, v: unknown[]) { return this.push(c, "in", v); }
  like(c: string, v: string) { return this.push(c, "like", v); }
  ilike(c: string, v: string) { return this.push(c, "ilike", v); }
  contains(c: string, v: unknown) { return this.push(c, "cs", v); }

  not(col: string, op: string, value: unknown) {
    const c = ident(col);
    if (op === "is") {
      this.conds.push({ sql: value === null ? `${c} is not null` : `${c} is not ${value ? "true" : "false"}`, params: [] });
    } else if (op === "in") {
      this.conds.push({ sql: `(${c} is null or not (${c} = any($$)))`, params: [asList(value)] });
    } else {
      const sym = { eq: "=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" }[op] ?? "=";
      this.conds.push({ sql: `not (${c} ${sym} $$)`, params: [value] });
    }
    return this;
  }

  /** `or("a.ilike.%x%,b.eq.1")` —— PostgREST 的 or 语法 */
  or(expr: string) {
    const parts: Cond[] = [];
    for (const raw of expr.split(",")) {
      const m = raw.match(/^\s*([a-zA-Z0-9_]+)\.([a-z]+)\.([\s\S]*)$/);
      if (!m) continue;
      const [, col, op, val] = m;
      const c = ident(col);
      if (op === "is") {
        parts.push({ sql: val === "null" ? `${c} is null` : `${c} is ${val}`, params: [] });
      } else if (op === "ilike" || op === "like") {
        parts.push({ sql: `${c} ${op} $$`, params: [val] });
      } else {
        const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op] ?? "=";
        parts.push({ sql: `${c} ${sym} $$`, params: [val] });
      }
    }
    if (parts.length) {
      this.conds.push({
        sql: "(" + parts.map((p) => p.sql).join(" or ") + ")",
        params: parts.flatMap((p) => p.params),
      });
    }
    return this;
  }

  // -- 排序 / 分页 ---------------------------------------------------------
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? "desc" : "asc";
    const nulls = opts?.nullsFirst ? "nulls first" : "nulls last";
    this.orders.push(`${ident(col)} ${dir} ${nulls}`);
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }

  // -- 动词 ---------------------------------------------------------------
  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    const raw = cols && cols.trim() ? cols : "*";
    this.embeds = parseEmbeds(raw);
    const plain = stripEmbeds(raw);
    if (this.verb === "select") {
      this.cols = plain;
    } else {
      this.returning = true;
      this.cols = plain;
    }
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(rows: any) { this.verb = "insert"; this.payload = rows; return this; }
  update(row: any, opts?: { count?: string }) {
    this.verb = "update"; this.payload = row;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  delete() { this.verb = "delete"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }

  // -- SQL 生成 ------------------------------------------------------------
  private bind(fragments: Cond[], start: number): { sql: string; params: unknown[] } {
    let i = start;
    const params: unknown[] = [];
    const sql = fragments
      .map((f) => {
        let s = f.sql;
        for (const p of f.params) {
          s = s.replace("$$", `$${i++}`);
          params.push(p);
        }
        return s;
      })
      .join(" and ");
    return { sql, params };
  }

  private projection(): string {
    const base = ident(this.table);
    const own =
      this.cols === "*"
        ? [`${base}.*`]
        : this.cols
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => `${base}.${ident(c.split(":").pop()!.trim())}`);
    // 嵌套资源按 PostgREST 的形状返回：外层多一个以关联表命名的对象字段。
    const embedded = this.embeds.map((e) => {
      const t = ident(e.table);
      const obj = e.cols
        .map((c) => `'${c.replace(/'/g, "''")}', ${t}.${ident(c)}`)
        .join(", ");
      return `json_build_object(${obj}) as ${ident(e.table)}`;
    });
    const all = [...own, ...embedded];
    return all.length ? all.join(", ") : "*";
  }

  /**
   * 嵌套资源的 JOIN。
   *
   * 真的 PostgREST 走外键元数据；这里按本项目的命名约定推断即可：
   * 关联表 orders 的单数形式 + "_id" 就是本表上的外键列（order_items.order_id）。
   */
  private joins(): string {
    return this.embeds
      .map((e) => {
        const t = ident(e.table);
        const fk = ident(`${e.table.replace(/s$/, "")}_id`);
        const kind = e.inner ? "join" : "left join";
        return `${kind} ${t} on ${t}."id" = ${ident(this.table)}.${fk}`;
      })
      .join(" ");
  }

  private build(jsonSet: Set<string>): { text: string; values: unknown[] } {
    const t = ident(this.table);
    if (this.verb === "select") {
      const w = this.bind(this.conds, 1);
      let text = `select ${this.headOnly ? "1" : this.projection()} from ${t}`;
      const j = this.joins();
      if (j) text += ` ${j}`;
      if (w.sql) text += ` where ${w.sql}`;
      if (this.orders.length) text += ` order by ${this.orders.join(", ")}`;
      const values = [...w.params];
      if (this.limitN != null) { text += ` limit $${values.length + 1}`; values.push(this.limitN); }
      if (this.rangeFrom != null && this.rangeTo != null) {
        text += ` limit $${values.length + 1} offset $${values.length + 2}`;
        values.push(this.rangeTo - this.rangeFrom + 1, this.rangeFrom);
      }
      return { text, values };
    }

    if (this.verb === "insert") {
      const rows: any[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (rows.length === 0) return { text: `select 1 where false`, values: [] };
      const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      const values: unknown[] = [];
      const tuples = rows.map((r) => {
        const slots = keys.map((k) => {
          if (!(k in r) || r[k] === undefined) return "default";
          values.push(normalize(r[k], jsonSet.has(k)));
          return `$${values.length}`;
        });
        return `(${slots.join(", ")})`;
      });
      let text = `insert into ${t} (${keys.map(ident).join(", ")}) values ${tuples.join(", ")}`;
      if (this.returning) text += ` returning ${this.projection()}`;
      return { text, values };
    }

    if (this.verb === "update") {
      const keys = Object.keys(this.payload).filter((k) => this.payload[k] !== undefined);
      const values: unknown[] = [];
      const sets = keys.map((k) => { values.push(normalize(this.payload[k], jsonSet.has(k))); return `${ident(k)} = $${values.length}`; });
      const w = this.bind(this.conds, values.length + 1);
      let text = `update ${t} set ${sets.join(", ")}`;
      if (w.sql) text += ` where ${w.sql}`;
      const all = [...values, ...w.params];
      if (this.returning) text += ` returning ${this.projection()}`;
      return { text, values: all };
    }

    // delete
    const w = this.bind(this.conds, 1);
    let text = `delete from ${t}`;
    if (w.sql) text += ` where ${w.sql}`;
    if (this.returning) text += ` returning ${this.projection()}`;
    return { text, values: w.params };
  }

  async run(): Promise<{ data: any; error: PgrestError | null; count: number | null }> {
    try {
      const jsonSet = this.verb === "select" || this.verb === "delete" ? new Set<string>() : await jsonColumnsOf(this.table);
      const { text, values } = this.build(jsonSet);
      const res = await db().query(text, values as any[]);
      let count: number | null = null;

      if (this.wantCount) {
        if (this.verb === "select") {
          const w = this.bind(this.conds, 1);
          const c = await db().query(
            `select count(*)::int as n from ${ident(this.table)}${w.sql ? ` where ${w.sql}` : ""}`,
            w.params as any[],
          );
          count = c.rows[0]?.n ?? 0;
        } else {
          count = res.rowCount ?? 0;
        }
      }

      if (this.headOnly) return { data: null, error: null, count };

      const rows = res.rows ?? [];
      if (this.singleMode === "one") {
        if (rows.length !== 1) {
          return {
            data: null,
            count,
            error: {
              message: `JSON object requested, multiple (or no) rows returned`,
              code: "PGRST116",
              details: `Results contain ${rows.length} rows`,
              hint: null,
            },
          };
        }
        return { data: rows[0], error: null, count };
      }
      if (this.singleMode === "maybe") {
        return { data: rows[0] ?? null, error: null, count };
      }
      if (this.verb !== "select" && !this.returning) {
        return { data: null, error: null, count };
      }
      return { data: rows, error: null, count };
    } catch (e) {
      return { data: null, error: toError(e), count: null };
    }
  }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((v: { data: any; error: PgrestError | null; count: number | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

function normalize(v: unknown, isJsonCol = false): unknown {
  if (isJsonCol) return v === null ? null : JSON.stringify(v);
  if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  return v;
}

export function makeQueryClient() {
  return {
    from(table: string) {
      return new Builder(table) as any;
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      try {
        const keys = Object.keys(args ?? {});
        const values = keys.map((k) => normalize((args as any)[k]));
        const named = keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ");
        // `select * from fn(...)` 对标量函数和 returns table 的函数都成立。
        // PostgREST 对标量返回标量、对 table 返回对象数组，这里对齐这个行为：
        // 只有一行一列且列名就是函数名时，才拆成标量。
        const res = await db().query(`select * from ${ident(fn)}(${named})`, values as any[]);
        const rows = res.rows ?? [];
        if (rows.length === 1) {
          const cols = Object.keys(rows[0]);
          if (cols.length === 1 && cols[0] === fn) return { data: rows[0][cols[0]], error: null };
        }
        if (rows.length === 0) return { data: null, error: null };
        return { data: rows, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
    _pool: db,
  };
}

export { db as e2ePool };
