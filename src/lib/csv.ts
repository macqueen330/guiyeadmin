// 导出用的 CSV 构造器。
//
// 各模块原来各写一遍这段：
//   header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
// 有两个问题：
//
// 1) 公式注入。客户姓名、备注、异常说明这些都是用户可写的自由文本。以
//    = + - @ 或制表符开头的单元格，Excel / WPS / Google Sheets 打开时会
//    当成公式执行 —— 经典的 CSV injection。端到端测试里建了一个名叫
//    `=1+1+cmd|' /C calc'!A0` 的客户，导出后原样落在单元格里。
//    这里统一在前面补一个单引号，Excel 会按纯文本显示。
//
// 2) 表头是数据库列名（order_no / settle_status / amount_received…）。
//    这些文件是给运营和财务用的，交过去还要人工对照字段表。
//    现在由调用方给出中文列名。

export interface CsvColumn<T> {
  /** 数据里的字段名 */
  key: string;
  /** 表头显示的中文名 */
  label: string;
  /** 可选的取值 / 格式化 */
  value?: (row: T) => unknown;
}

const RISKY_PREFIX = /^[=+\-@\t\r]/;

/** 单元格转义：先防公式注入，再做 CSV 引号转义。 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // 纯数字（含负数）是合法数据，不该被当成公式；只有真正的文本才加前缀。
  const isPlainNumber = /^-?\d+(\.\d+)?$/.test(s);
  if (!isPlainNumber && RISKY_PREFIX.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** 生成带中文表头的 CSV 文本（BOM 由前端下载时补，见 ui/Form.tsx 的 ExportForm）。 */
export function buildCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const head = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => csvCell(c.value ? c.value(r) : r[c.key])).join(","),
  );
  return [head, ...body].join("\n");
}

/** 文件名统一带日期后缀。 */
export function csvFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

// ---------------------------------------------------------------------------
// 统一的导出取数
//
// 审计查出两个问题，都在这里一次性堵住：
//
//  1) 导出审批策略只在 2/7 个导出里真的生效。安全策略页给「单次导出超过 N 行
//     需审批」打绿色「已生效」标，但发货单、库存、支付流水、退款、结算单
//     五个导出（含最敏感的财务数据）压根没有阈值判定。
//  2) 每个导出各自写死 5000–10000 行上限，超出的行被静默丢掉，
//     CSV 里看不出少了东西，用户以为导全了。
//
// 所以导出必须走这个函数，不要再各自 .limit() + 各自判审批。
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import { canActDirectly } from "@/lib/data/approvals";
import { loadSettings } from "@/lib/data/settings";
import type { AdminLevel } from "@/lib/types";

/** 单次导出的硬上限。到顶会报错，而不是悄悄少给几行。 */
const EXPORT_HARD_CAP = 100_000;
const EXPORT_PAGE = 1000;

export interface ExportQueryOptions {
  /** 在基础查询上追加过滤 / 排序。分页由本函数负责，不要自己写 range/limit。 */
  refine?: <T>(q: T) => T;
}

/**
 * 取全量导出数据 + 按阈值判定审批。
 *
 * @param actionKey approval_rules 里的动作键，如 "export_payments"
 */
export async function fetchForExport<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  actorLevel: AdminLevel,
  actionKey: string,
  refine?: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => unknown,
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page * EXPORT_PAGE < EXPORT_HARD_CAP; page++) {
    let q = sb.from(table).select(columns) as unknown as {
      range: (a: number, b: number) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    if (refine) {
      q = refine(sb.from(table).select(columns)) as typeof q;
    }
    const { data, error } = await q.range(page * EXPORT_PAGE, page * EXPORT_PAGE + EXPORT_PAGE - 1);
    if (error) throw new Error(`导出失败：${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < EXPORT_PAGE) break;
    if (rows.length >= EXPORT_HARD_CAP) {
      throw new Error(
        `符合条件的数据超过 ${EXPORT_HARD_CAP.toLocaleString("zh-CN")} 行，超出单次导出上限。` +
          `请先用筛选条件缩小范围 —— 截断后导出会让人以为拿到了全量。`,
      );
    }
  }

  await assertExportAllowed(actorLevel, actionKey, rows.length);
  return rows;
}

/**
 * 导出审批阈值判定。所有导出动作都必须调用它 ——
 * 安全策略页承诺了「单次导出超过 N 行需审批」，那七个导出就都得真的判。
 */
export async function assertExportAllowed(
  actorLevel: AdminLevel,
  actionKey: string,
  rowCount: number,
): Promise<void> {
  const settings = await loadSettings();
  if (rowCount <= settings.security.exportApprovalRows) return;
  const gate = await canActDirectly(actorLevel, actionKey, rowCount);
  if (!gate.allowed) {
    throw new Error(
      gate.reason ??
        `本次导出 ${rowCount} 行，超过阈值 ${settings.security.exportApprovalRows} 行，需要审批`,
    );
  }
}


/** 单次导出的行数上限。到顶报错，绝不静默少给几行。 */
export const EXPORT_CAP = 50_000;

/**
 * 导出到顶时直接报错。
 *
 * 以前每个导出各自写死 .limit(10000)，超出的行被 PostgREST 悄悄丢掉，
 * CSV 里看不出少了东西 —— 用户以为导全了。宁可让人换个筛选条件重来，
 * 也不能给一份看起来完整的残缺文件。
 */
export function assertNotTruncated(rowCount: number): void {
  if (rowCount > EXPORT_CAP) {
    throw new Error(
      `符合条件的数据超过 ${EXPORT_CAP.toLocaleString("zh-CN")} 行，超出单次导出上限。` +
        `请先用筛选条件缩小范围 —— 截断后导出会让人以为拿到了全量。`,
    );
  }
}
