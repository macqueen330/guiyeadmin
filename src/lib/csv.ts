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
