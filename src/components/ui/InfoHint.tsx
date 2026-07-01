// A small "?" with a native tooltip, used to pin down每个指标的口径 so different
// staff read the same number the same way.
export function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "1px solid #c9cdc6",
        color: "#9a9f9a",
        fontSize: 9,
        fontWeight: 700,
        cursor: "help",
        marginLeft: 4,
        flex: "none",
        verticalAlign: "middle",
      }}
    >
      ?
    </span>
  );
}
