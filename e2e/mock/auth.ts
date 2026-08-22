// GoTrue 的最小可用替身：真实校验密码、真实签发/校验会话、真实通过 Cookie 适配器
// 读写（@supabase/ssr 的行为），这样 proxy.ts 的 getUser() 门禁和登录/登出流程
// 走的都是与生产一致的代码路径。
//
// 用户存在本地 Postgres 的 auth.users 表里，密码用 pgcrypto 的 bcrypt 存储 ——
// 不是明文比较。会话存 auth.sessions，getUser() 每次回查数据库（对应真实
// getUser() 会去 auth 服务校验 JWT，而不是只读 Cookie）。

import { e2ePool } from "./pgrest";

const COOKIE = "sb-e2e-auth-token";

export interface CookieItem {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}
export interface CookieAdapter {
  getAll(): { name: string; value: string }[] | Promise<{ name: string; value: string }[]>;
  setAll(items: CookieItem[]): void | Promise<void>;
}

export async function ensureAuthSchema() {
  const pool = e2ePool();
  await pool.query(`create schema if not exists auth`);
  await pool.query(`create extension if not exists pgcrypto`);
  await pool.query(`
    create table if not exists auth.users (
      id text primary key default gen_random_uuid()::text,
      email text unique not null,
      encrypted_password text not null,
      created_at timestamptz not null default now()
    )`);
  await pool.query(`
    create table if not exists auth.sessions (
      token text primary key,
      user_id text not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '12 hours'
    )`);
}

function randomToken(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
}

async function readToken(cookies: CookieAdapter | null): Promise<string | null> {
  if (!cookies) return null;
  const all = await cookies.getAll();
  return all.find((c) => c.name === COOKIE)?.value ?? null;
}

export function makeAuth(cookies: CookieAdapter | null) {
  const pool = e2ePool;

  return {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      await ensureAuthSchema();
      const { rows } = await pool().query(
        `select id, email from auth.users
          where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)`,
        [email, password],
      );
      if (rows.length === 0) {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials", status: 400 } };
      }
      const token = randomToken();
      await pool().query(`insert into auth.sessions (token, user_id) values ($1, $2)`, [token, rows[0].id]);
      await cookies?.setAll([
        { name: COOKIE, value: token, options: { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 12 } },
      ]);
      return { data: { user: { id: rows[0].id, email: rows[0].email }, session: { access_token: token } }, error: null };
    },

    async getUser() {
      const token = await readToken(cookies);
      if (!token) return { data: { user: null }, error: { message: "Auth session missing!" } };
      await ensureAuthSchema();
      const { rows } = await pool().query(
        `select u.id, u.email from auth.sessions s join auth.users u on u.id = s.user_id
          where s.token = $1 and s.expires_at > now()`,
        [token],
      );
      if (rows.length === 0) return { data: { user: null }, error: { message: "Invalid session" } };
      return { data: { user: { id: rows[0].id, email: rows[0].email } }, error: null };
    },

    async signOut() {
      const token = await readToken(cookies);
      if (token) await pool().query(`delete from auth.sessions where token = $1`, [token]);
      await cookies?.setAll([{ name: COOKIE, value: "", options: { path: "/", maxAge: 0 } }]);
      return { error: null };
    },

    admin: {
      async createUser({ email, password }: { email: string; password: string; email_confirm?: boolean }) {
        await ensureAuthSchema();
        try {
          const { rows } = await pool().query(
            `insert into auth.users (email, encrypted_password) values ($1, crypt($2, gen_salt('bf')))
             returning id, email`,
            [email, password],
          );
          return { data: { user: rows[0] }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: (e as Error).message } };
        }
      },
      async updateUserById(id: string, attrs: { password?: string }) {
        await ensureAuthSchema();
        if (attrs.password) {
          await pool().query(
            `update auth.users set encrypted_password = crypt($2, gen_salt('bf')) where id = $1`,
            [id, attrs.password],
          );
        }
        return { data: { user: { id } }, error: null };
      },
      async listUsers() {
        await ensureAuthSchema();
        const { rows } = await pool().query(`select id, email from auth.users order by created_at`);
        return { data: { users: rows }, error: null };
      },
    },
  };
}
