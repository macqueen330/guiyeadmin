import { readFailures } from "@/lib/data/db";

// 「读不到」和「没有」必须长得不一样。
//
// 大部分读取失败会直接抛 DataReadError，由 (app)/error.tsx 接住并整页报错。
// 但有几处是**故意**降级的：配置和字典读不到时回落到内置默认值（缺个标签
// 不该让整个控制台打不开）、全局搜索里某一类结果查挂了不该带走整次搜索、
// 官网去重函数拿不到时回落到每日相加。
//
// 这些降级过的失败登记在请求级的 readFailures() 里，由这个组件负责说出来 ——
// 不说的话，它们又会退化成「暂无数据」，正是审计里第 1 条问题。

export function ReadFailureList() {
  const failures = readFailures();
  if (failures.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "12px 14px",
        background: "var(--red-soft)",
        border: "1px solid var(--red)",
        borderRadius: 10,
        fontSize: 12.5,
        lineHeight: 1.7,
        color: "var(--red)",
      }}
    >
      <b style={{ fontWeight: 650 }}>
        有 {failures.length} 个数据源读取失败 —— 下面的结果不完整，不是「没有数据」。
      </b>
      {failures.map((f) => (
        <span key={f.source}>
          <code style={{ fontSize: 11.5 }}>{f.source}</code>：{f.reason}
        </span>
      ))}
    </div>
  );
}
