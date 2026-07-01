import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  width?: string | number;
}

const th = (align: "left" | "right" | "center"): React.CSSProperties => ({
  textAlign: align,
  fontSize: 11,
  fontWeight: 600,
  color: "#9a9f9a",
  padding: "10px 8px",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
});

const td = (align: "left" | "right" | "center"): React.CSSProperties => ({
  textAlign: align,
  padding: "11px 8px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
});

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty = "暂无数据",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ ...th(c.align ?? "left"), width: c.width }}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              style={{
                textAlign: "center",
                padding: "40px 8px",
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="row-hover">
              {columns.map((c) => (
                <td key={c.key} style={td(c.align ?? "left")}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
