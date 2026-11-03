// The crawler brand mark in an icon slot. SEO_TOOL_GROUPS icons are components that
// take a className (lucide's shape), so the mark is an <img> of the SVG file
// rather than inlined paths: one asset in public/nosy-bat/, no copy to drift.
// Decorative — the card's name sits beside it.
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";

export function NosyBatIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG; next/image adds nothing
  return <img src={CRAWLER_BRAND.mark} alt="" aria-hidden="true" className={className} />;
}
