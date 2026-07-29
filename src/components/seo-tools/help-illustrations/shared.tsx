// Shared building blocks for the tool help illustrations.
//
// CONVENTION (every illustration in this directory follows it):
//   - aria-hidden, focusable="false". The numbered steps beside the graphic
//     carry the same information as text, so a screen reader loses nothing.
//   - NO translatable text. Bare numerals and metric abbreviations only, which
//     read the same in every locale we ship.
//   - gray-200 strokes, gray-50 fills, blue-600 accents, 2px strokes to match
//     lucide's weight and the tool-hub cards.
//   - viewBox 0 0 480 150, rendered full modal width; stays crisp at 320px.
//   - the dashed connector animation is disabled under prefers-reduced-motion.
//
// Keeping these primitives here is what holds ten separate SVGs to one look
// and keeps each file a few hundred bytes rather than a few kilobytes.

import type { ReactNode } from "react";

export const STROKE = "#e5e7eb"; // gray-200
export const FILL = "#f9fafb"; // gray-50
export const ACCENT = "#2563eb"; // blue-600
export const ACCENT_SOFT = "#dbeafe"; // blue-100
export const MUTED = "#d1d5db"; // gray-300
export const LABEL = "#9ca3af"; // gray-400
export const GOOD = "#16a34a"; // green-600
export const WARN = "#d97706"; // amber-600
export const BAD = "#dc2626"; // red-600

/** Standard canvas. 480x150 keeps every illustration the same height. */
export const VIEWBOX = "0 0 480 150";

/**
 * Root <svg> for an illustration, carrying the scoped keyframes.
 *
 * The <style> lives inside the SVG rather than in globals.css so the animation
 * ships with the graphic and reduced-motion is honoured without a global rule.
 * The class name is prefixed to make a collision impossible.
 */
export function HelpArt({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox={VIEWBOX}
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <style>{`
        @keyframes erHelpFlow { to { stroke-dashoffset: -20; } }
        .er-help-flow { animation: erHelpFlow 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .er-help-flow { animation: none; } }
      `}</style>
      {children}
    </svg>
  );
}

/** Rounded panel — the base of most stages. */
export function Panel({
  x,
  y = 24,
  w = 128,
  h = 104,
  fill = FILL,
}: {
  x: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={STROKE} strokeWidth={2} />;
}

/** Dashed connector with an arrowhead, marching left to right. */
export function Connector({ x, y = 76, len = 26 }: { x: number; y?: number; len?: number }) {
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + len}
        y2={y}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="5 5"
        className="er-help-flow"
      />
      <path
        d={`M${x + len} ${y - 6}l7 6-7 6`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A text/skeleton line inside a panel. */
export function Bar({
  x,
  y,
  w,
  h = 7,
  fill = MUTED,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;
}

/** Rounded "chip" — a keyword, a question, a tag. */
export function Chip({
  x,
  y,
  w,
  h = 18,
  fill = ACCENT_SOFT,
  stroke = ACCENT,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  stroke?: string;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={1.5} />;
}

/** Small decorative numeral/label. Locale-neutral by rule — digits only. */
export function Tick({
  x,
  y,
  children,
  fill = LABEL,
  anchor = "middle",
  size = 11,
  weight,
}: {
  x: number;
  y: number;
  children: ReactNode;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} fontWeight={weight}>
      {children}
    </text>
  );
}
