import Link from "next/link";
import { subHref, type NavItem } from "@/lib/nav";

// Second-level navigation rendered inside a module page. Each tab deep-links to
// `?view=` so it stays in sync with the sidebar's active sub-item.
export function SubTabs({ item, active }: { item: NavItem; active: string }) {
  if (!item.children?.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {item.children.map((sub) => {
        const on = sub.key === active;
        return (
          <Link
            key={sub.key}
            href={subHref(item, sub)}
            scroll={false}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 600,
              background: on ? "var(--accent)" : "var(--card)",
              color: on ? "#fff" : "#4a514c",
              border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
              transition: "background .14s, color .14s, border-color .14s",
            }}
          >
            {sub.label}
          </Link>
        );
      })}
    </div>
  );
}
