import "server-only";

import { cache } from "react";
import { getDb, DataReadError, recordReadFailure } from "./db";
import { DEFAULT_DICT, DEFAULT_DICT_BUNDLE, mergeDict, type Dict } from "@/lib/dict";
import type { DictEntry } from "@/lib/types";

/** 合并后的运行时字典（每次请求只查一次库）。 */
export const loadDict = cache(async (): Promise<Dict> => {
  const sb = await getDb();
  if (!sb) return DEFAULT_DICT_BUNDLE;
  const { data, error } = await sb
    .from("dictionaries")
    .select("group_key,code,label,color,bg,sort,is_active")
    .order("sort");
  // 同 loadSettings：字典是标签，读不到就用内置默认值，不拦住整个控制台。
  if (error) recordReadFailure("dictionaries", error.message);
  if (error || !data || data.length === 0) return DEFAULT_DICT_BUNDLE;
  return mergeDict(DEFAULT_DICT, data as DictEntry[]);
});

/** 系统设置 → 字典管理用的原始行。 */
export async function listDictEntries(group?: string): Promise<DictEntry[]> {
  const sb = await getDb();
  if (!sb) return [];
  let q = sb.from("dictionaries").select("*").order("group_key").order("sort");
  if (group) q = q.eq("group_key", group);
  const { data, error } = await q;
  if (error) throw new DataReadError("dictionaries", error.message);
  if (!data) return [];
  return data as DictEntry[];
}

export async function updateDictEntry(
  id: string,
  patch: Partial<Pick<DictEntry, "label" | "color" | "bg" | "sort" | "is_active">>,
  updatedBy: string | null,
): Promise<void> {
  const sb = await getDb();
  if (!sb) throw new Error("数据库未配置");
  const { error } = await sb
    .from("dictionaries")
    .update({ ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`保存字典失败：${error.message}`);
}
