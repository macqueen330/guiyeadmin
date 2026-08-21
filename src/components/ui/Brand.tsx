import Image from "next/image";
import type { CSSProperties } from "react";

// Brand assets lifted from the 瑰野 GUIYE website (macqueen330/guiye · public/),
// so the console and guiyecy.com share one identity:
//   mark — the red 「瑰」 seal, printed on the site's paper cream
//   logo — the full 瑰野 · GUIYE-JIU ROSE FIELD wordmark (transparent, dark ink)
const MARK_SRC = "/brand/guiye-mark.png";
const LOGO_SRC = "/brand/guiye-logo.png";

/** The seal artwork's own background — matches the website's `--bg`. */
export const BRAND_PAPER = "#f7f2e8";

const LOGO_RATIO = 1000 / 561;

/**
 * Square seal tile. The artwork ships with its paper background baked in, so the
 * tile is tinted to the same cream — the rounded corners then read as one piece
 * rather than a pasted-on square. Decorative by default: every place we use it
 * the brand name is spelled out next to it.
 */
export function BrandMark({
  size = 36,
  radius = 10,
  shadow,
  alt = "",
}: {
  size?: number;
  radius?: number;
  shadow?: string;
  alt?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: BRAND_PAPER,
    overflow: "hidden",
    display: "flex",
    flex: "none",
    boxShadow: shadow,
  };

  return (
    <span style={style}>
      <Image
        src={MARK_SRC}
        alt={alt}
        width={size}
        height={size}
        loading="eager"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </span>
  );
}

/**
 * Full wordmark. Dark ink on transparent — for light surfaces only (the sidebar
 * is near-black, so it uses `BrandMark` next to the text lockup instead).
 */
export function BrandLogo({
  width = 208,
  alt = "瑰野 GUIYE · Rose Field",
}: {
  width?: number;
  alt?: string;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={width}
      height={Math.round(width / LOGO_RATIO)}
      loading="eager"
      style={{ display: "block", height: "auto" }}
    />
  );
}
