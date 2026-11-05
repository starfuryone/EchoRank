// One hero per guide, above the title: the crawler brand's logo (160 px wide)
// centred above a motif from that guide (a broken chain link, a sitemap tree,
// a selector bracket, a timeline). Decorative — the h1 says what the page is —
// so aria-hidden, and no translatable text (the wordmark is the brand), which
// is what lets every locale share them. The logo is the 480 px PNG drawn at
// 160 x 89 (735:410), never scaled up.

import type { ReactNode } from "react";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { Arrow, artStyles as a } from "./frame";

const LOGO_W = 160;
const LOGO_H = (LOGO_W * CRAWLER_BRAND.logo.height) / CRAWLER_BRAND.logo.width;
const LOGO_SRC = CRAWLER_BRAND.logo.sizes.find((x) => x.w === 480)!.src;

function Hero({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg
      className={`${a.hero} ${a.figure}`}
      viewBox="0 0 640 320"
      width={640}
      height={320}
      aria-hidden="true"
      focusable="false"
      data-nb-hero={id}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={1} y={1} width={638} height={318} rx={18} className={a.card2} />
      <image href={LOGO_SRC} x={(640 - LOGO_W) / 2} y={18} width={LOGO_W} height={LOGO_H} data-nb-hero-logo="" />
      {/* Dotted ground under the motif. */}
      <path className={`${a.line} ${a.dash}`} d="M24 300H616" />
      {/* The motifs are drawn in a 360 x 200 box; centred under the logo. */}
      <g transform="translate(140 112)">{children}</g>
    </svg>
  );
}

/** Guide 1: a chain link, snapped, with the 404 spark at the break. */
function BrokenChain() {
  return (
    <Hero id="broken-links">
      <g transform="rotate(-14 160 100)">
        <rect x={20} y={78} width={130} height={46} rx={23} className={a.card} style={{ strokeWidth: 6 }} />
        <rect x={196} y={78} width={130} height={46} rx={23} className={a.card} style={{ strokeWidth: 6 }} />
        <path className={a.redLine} style={{ strokeWidth: 6 }} d="M150 101h12" />
        <path className={a.redLine} style={{ strokeWidth: 6 }} d="M184 101h12" />
      </g>
      <g className={a.redLine} style={{ strokeWidth: 4 }}>
        <path className={a.redLine} d="M170 52l-6 -18" />
        <path className={a.redLine} d="M188 58l10 -16" />
        <path className={a.redLine} d="M152 62l-16 -10" />
        <path className={a.redLine} d="M172 150l-4 18" />
        <path className={a.redLine} d="M192 142l14 10" />
      </g>
    </Hero>
  );
}

/** Guide 2: a sitemap tree — index, three files, their URLs. */
function SitemapTree() {
  const kids = [40, 150, 260];
  return (
    <Hero id="sitemap">
      <rect x={130} y={22} width={100} height={40} rx={8} className={a.accent} />
      <path className={a.accentLine} d="M150 36h60M150 48h40" />
      {kids.map((x) => (
        <g key={x}>
          <path className={a.line} d={`M180 62V82H${x + 30}V100`} />
          <rect x={x} y={100} width={60} height={44} rx={6} className={a.card} />
          <path className={a.line} d={`M${x + 12} 114h36M${x + 12} 124h28M${x + 12} 134h32`} />
        </g>
      ))}
    </Hero>
  );
}

/** Guide 3: a selector bracket closing around one highlighted element. */
function SelectorBracket() {
  return (
    <Hero id="extraction">
      <path className={a.accentLine} style={{ strokeWidth: 7 }} d="M70 30c-26 0-26 14-26 34s-8 36-22 36c14 0 22 16 22 36s0 34 26 34" />
      <path className={a.accentLine} style={{ strokeWidth: 7 }} d="M290 30c26 0 26 14 26 34s8 36 22 36c-14 0-22 16-22 36s0 34-26 34" />
      <rect x={92} y={44} width={176} height={26} rx={6} className={a.card} />
      <rect x={92} y={86} width={176} height={30} rx={6} className={a.accent} />
      <path className={a.accentLine} d="M108 101h80" />
      <rect x={92} y={132} width={176} height={26} rx={6} className={a.card} />
      <path className={a.line} d="M108 57h110M108 145h90" />
    </Hero>
  );
}

/** Guide 4: a timeline — before, launch, after. */
function Timeline() {
  return (
    <Hero id="migration">
      <path className={a.line} style={{ strokeWidth: 4 }} d="M20 100H330" />
      <Arrow x1={300} y1={100} x2={340} y2={100} />
      <circle cx={60} cy={100} r={14} className={a.card} />
      <circle cx={180} cy={100} r={22} className={a.accent} />
      <path className={a.accentLine} d="M170 100l7 7 13-14" />
      <circle cx={290} cy={100} r={14} className={a.card} />
      <path className={a.line} d="M60 64v22M290 64v22M60 114v22M290 114v22" />
      <path className={a.accentLine} d="M180 46v32M180 122v32" />
    </Hero>
  );
}

export const HEROES: Record<string, () => React.JSX.Element> = {
  "broken-links": BrokenChain,
  sitemap: SitemapTree,
  extraction: SelectorBracket,
  migration: Timeline,
};
