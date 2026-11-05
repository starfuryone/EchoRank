// The crawler brand's emblem in an icon slot (the sidebar row, SEO_TOOL_GROUPS):
// lucide's shape, a component taking a className. The file is the emblem with
// fill="currentColor", which an <img> cannot pass the page's colour into, so it
// is painted through a CSS mask filled with currentColor: the icon takes the
// item's text colour (gray, white on hover / active) exactly like the lucide
// icons beside it, and the SVG is used as-is. Size comes from the className
// (h-5 w-5 in the sidebar). Decorative — the row's label sits beside it.
import type { CSSProperties } from "react";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

const MASK = `url("${CRAWLER_BRAND.mark}") center / contain no-repeat`;
const STYLE: CSSProperties = { display: "inline-block", backgroundColor: "currentColor", mask: MASK, WebkitMask: MASK };

export function NosyBatIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={className} style={{ ...STYLE, ...style }} data-nb-emblem="" />;
}
