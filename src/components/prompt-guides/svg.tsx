// Shared pieces for the prompt-guide graphics. Server components only: no
// hooks, no browser APIs — every chart is plain inline SVG rendered from
// src/lib/prompt-guides.ts at request time.
//
// Accessibility contract for every figure (tests/prompt-guides.test.ts checks it):
// role="img", a <title> and a <desc> that carries the figure's text, a viewBox
// so it scales, and real text labels rather than colour alone.

import type { ReactNode } from "react";
import { PROMPT_USES, type PromptUse } from "@/lib/prompt-guides";
import { INK, USE_STYLES, patternSlug, type UsePattern } from "./use-colors";
import pg from "./prompt-guides.module.css";

/** Average glyph advance of the UI sans at 1em, used to wrap SVG text. Conservative. */
const EM_ADVANCE = 0.55;

/** How many characters fit in `width` user units at `fontSize`. */
export function charsFor(width: number, fontSize: number): number {
  return Math.max(8, Math.floor(width / (fontSize * EM_ADVANCE)));
}

/** Greedy word wrap. SVG <text> does not wrap, so the charts do it here. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function Figure({
  id,
  title,
  desc,
  width,
  height,
  className,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={className ? `${pg.fig} ${className}` : pg.fig}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      focusable="false"
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{desc}</desc>
      {children}
    </svg>
  );
}

export function TextLines({
  x,
  y,
  lines,
  lineHeight,
  fontSize,
  className,
  anchor,
  weight,
}: {
  x: number;
  y: number;
  lines: readonly string[];
  lineHeight: number;
  fontSize: number;
  className: string;
  anchor?: "start" | "middle" | "end";
  weight?: number;
}) {
  return (
    <text x={x} y={y} fontSize={fontSize} className={className} textAnchor={anchor} fontWeight={weight}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/**
 * A wide layout and a narrow one, switched by CSS at 640px. Only one is
 * displayed (display:none removes the other from the accessibility tree), so a
 * figure is legible at 360px without shrinking a desktop drawing to 7px text.
 * Print always takes the wide one.
 */
export function Responsive({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  return (
    <div>
      <div className={pg.dualWide}>{wide}</div>
      <div className={pg.dualNarrow}>{narrow}</div>
    </div>
  );
}

export function patternId(prefix: string, use: PromptUse): string {
  return `${prefix}-${patternSlug(use)}`;
}

/** Stripe/dot overlays, drawn in INK at low opacity over the use's fill. */
function marks(p: UsePattern): { transform?: string; node: ReactNode } {
  const stripe = <rect x={0} y={0} width={1.6} height={6} fill={INK} fillOpacity={0.32} />;
  switch (p) {
    case "solid":
      return { node: null };
    case "diagUp":
      return { transform: "rotate(45)", node: stripe };
    case "diagDown":
      return { transform: "rotate(-45)", node: stripe };
    case "vertical":
      return { node: stripe };
    case "horizontal":
      return { node: <rect x={0} y={0} width={6} height={1.6} fill={INK} fillOpacity={0.32} /> };
    case "cross":
      return {
        transform: "rotate(45)",
        node: (
          <>
            {stripe}
            <rect x={0} y={0} width={6} height={1.6} fill={INK} fillOpacity={0.32} />
          </>
        ),
      };
    case "dots":
      return { node: <circle cx={3} cy={3} r={1.15} fill={INK} fillOpacity={0.4} /> };
  }
}

/** One <pattern> per use, ids prefixed so several figures can share a page. */
export function UsePatterns({ prefix }: { prefix: string }) {
  return (
    <defs>
      {PROMPT_USES.map((u) => {
        const { fill, pattern } = USE_STYLES[u];
        const m = marks(pattern);
        return (
          <pattern
            key={u}
            id={patternId(prefix, u)}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform={m.transform}
          >
            <rect width={6} height={6} fill={fill} />
            {m.node}
          </pattern>
        );
      })}
    </defs>
  );
}

/** A 14px legend swatch: the use's fill and pattern. Decorative — the label sits beside it. */
export function UseSwatch({ use, prefix }: { use: PromptUse; prefix: string }) {
  const id = `${prefix}-sw`;
  const { fill, pattern } = USE_STYLES[use];
  const m = marks(pattern);
  return (
    <svg className={pg.swatch} width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform={m.transform}>
          <rect width={6} height={6} fill={fill} />
          {m.node}
        </pattern>
      </defs>
      <rect x={0.5} y={0.5} width={13} height={13} rx={3} fill={`url(#${id})`} className={pg.svgSeg} />
    </svg>
  );
}

/** A count printed on a fill: a solid pill of the use's colour so the pattern never sits under the digits. */
export function CountPill({ x, y, h, use, value }: { x: number; y: number; h: number; use: PromptUse; value: number }) {
  const w = value >= 10 ? 22 : 16;
  return (
    <g>
      <rect x={x - w / 2} y={y + (h - 15) / 2} width={w} height={15} rx={4} fill={USE_STYLES[use].fill} />
      <text x={x} y={y + h / 2 + 4} fontSize={11} fontWeight={700} fill={INK} textAnchor="middle">
        {value}
      </text>
    </g>
  );
}
