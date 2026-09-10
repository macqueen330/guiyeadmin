import "server-only";

import { cache } from "react";
import { getDb, getServiceDb, DataReadError, recordReadFailure } from "./db";
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type Settings,
} from "@/lib/settings";
import type { AppSetting } from "@/lib/types";

// app_settings 的读写。`cache` 让同一次请求里的多个组件只查一次库。

type Mutable = { [K in keyof Settings]: Record<string, unknown> };

function applyRow(target: Mutable, key: string, value: unknown) {
  const path = SETTING_KEYS[key];
  if (!path) return;
  const [group, field] = path;
  target[group][field] = value;
}

async function build(client: Awaited<ReturnType<typeof getDb>>): Promise<Settings> {
  const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Mutable;
  if (!client) return merged as unknown as Settings;
  const { data, error } = await client.from("app_settings").select("key,value");
  // 配置读不到时回落到 DEFAULT_SETTINGS —— 这是有意的：阈值和标签缺失不该让
  // 整个控制台打不开。但失败要登记，否则「配置表读不到」会被当成「用的是默认值」。
  if (error) recordReadFailure("app_settings", error.message);
  if (error || !data) return merged as unknown as Settings;
  for (const row of data as { key: string; value: unknown }[]) {
    applyRow(merged, row.key, row.value);
  }
  return merged as unknown as Settings;
}

/** 已登录管理员上下文中的配置读取。 */
export const loadSettings = cache(async (): Promise<Settings> => build(await getDb()));

/** 无会话上下文（webhook / 采集端点）中的配置读取。 */
export const loadSettingsUnauthenticated = cache(async (): Promise<Settings> =>
  build(getServiceDb()),
);

/** 系统设置页要展示的原始行（含 label / description / 校验范围）。 */
export async function listSettingRows(category?: string): Promise<AppSetting[]> {
  const sb = await getDb();
  if (!sb) return [];
  let q = sb.from("app_settings").select("*").order("category").order("key");
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  // 系统设置页要展示的原始行：这里读不到必须报错。显示成「没有配置项」
  // 会让管理员以为要从头建一遍。
  if (error) throw new DataReadError("app_settings", error.message);
  if (!data) return [];
  return data as AppSetting[];
}

/** 批量写入。调用方负责鉴权与审计。 */
export async function writeSettings(
  updates: Record<string, unknown>,
  updatedBy: string | null,
): Promise<void> {
  const sb = await getDb();
  if (!sb) throw new Error("数据库未配置");
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  for (const [key, value] of entries) {
    const { error } = await sb
      .from("app_settings")
      .update({ value, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) throw new Error(`保存配置 ${key} 失败：${error.message}`);
  }
}
