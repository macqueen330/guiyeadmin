"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  DEFAULT_DICT_BUNDLE,
  dictFilterOptions,
  dictLabel,
  dictOptions,
  dictTone,
  type Dict,
  type DictGroup,
  type DictOption,
} from "@/lib/dict";
import type { Tone } from "@/lib/tokens";
import type { Settings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

// 运行时业务字典 + 业务配置的客户端上下文。
//
// 状态中文名、配色、排序来自 Supabase 的 dictionaries 表；阈值（安全库存、
// 跳出率告警线、未跟进天数…）来自 app_settings。两者都在 (app)/layout.tsx
// 里读一次，然后通过这个 Provider 交给所有客户端视图 —— 组件不再直接
// `ORDER_STATUS[value]` 索引写死的常量。

interface DictContextValue {
  dict: Dict;
  settings: Settings;
}

const DictContext = createContext<DictContextValue | null>(null);

export function DictProvider({
  dict,
  settings,
  children,
}: {
  dict: Dict;
  settings: Settings;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ dict, settings }), [dict, settings]);
  return <DictContext.Provider value={value}>{children}</DictContext.Provider>;
}

export interface DictHelpers {
  /** 取一个取值的中文名 + 配色（未知取值返回安全的兜底，不会抛错）。 */
  tone: (group: DictGroup | string, code: string | null | undefined) => Tone;
  label: (group: DictGroup | string, code: string | null | undefined, fallback?: string) => string;
  options: (group: DictGroup | string) => DictOption[];
  /** 给 FilterableTable 用的「全部 + 各取值」下拉项 */
  filterOptions: (group: DictGroup | string, allLabel?: string) => { value: string; label: string }[];
  settings: Settings;
  raw: Dict;
}

export function useDict(): DictHelpers {
  const ctx = useContext(DictContext);
  const dict = ctx?.dict ?? DEFAULT_DICT_BUNDLE;
  const settings = ctx?.settings ?? DEFAULT_SETTINGS;
  return useMemo(
    () => ({
      tone: (group, code) => dictTone(dict, group, code),
      label: (group, code, fallback) => dictLabel(dict, group, code, fallback),
      options: (group) => dictOptions(dict, group),
      filterOptions: (group, allLabel) => dictFilterOptions(dict, group, allLabel),
      settings,
      raw: dict,
    }),
    [dict, settings],
  );
}
