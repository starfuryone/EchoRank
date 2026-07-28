/**
 * Decorative flow illustration for the Rank Tracker help modal:
 * project -> scheduled checks -> position history.
 *
 * Pure inline SVG, no new deps and no external image. Colours are the light
 * dashboard palette already in use (gray-200 strokes, gray-50 fills, blue-600
 * accents) at lucide's 2px stroke weight, so it sits beside the tool-hub cards
 * without looking imported.
 *
 * The two lucide icons are nested <svg> elements inside <g transform>, which is
 * valid SVG and keeps them as real icon components rather than paths copied by
 * hand (which would silently drift when lucide updates).
 *
 * ACCESSIBILITY: the whole graphic is aria-hidden. The numbered steps beneath
 * it in the modal carry exactly the same information as text, so a screen
 * reader loses nothing. The only glyphs inside are "#8 / #5 / #3" — Arabic
 * numerals that read the same in every locale we ship, so nothing here needs
 * translating.
 */

import { CalendarClock, TrendingUp } from "lucide-react";

const STROKE = "#e5e7eb"; // gray-200
const FILL = "#f9fafb"; // gray-50
const ACCENT = "#2563eb"; // blue-600
const MUTED = "#d1d5db"; // gray-300
const LABEL = "#9ca3af"; // gray-400

/** Dashed connector with an arrowhead. The dash march is decorative only. */
function Connector({ x }: { x: number }) {
  return (
    <g>
      <line
        x1={x}
        y1={76}
        x2={x + 26}
        y2={76}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="5 5"
        className="er-rt-flow"
      />
      <path
        d={`M${x + 26} 70l7 6-7 6`}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Card({ x }: { x: number }) {
  return <rect x={x} y={24} width={128} height={104} rx={10} fill={FILL} stroke={STROKE} strokeWidth={2} />;
}

export function RankTrackerFlowArt() {
  return (
    <svg
      viewBox="0 0 480 152"
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {/* Scoped so the keyframes cannot collide with anything global, and so
          reduced-motion is honoured without touching globals.css. */}
      <style>{`
        @keyframes erRtFlow { to { stroke-dashoffset: -20; } }
        .er-rt-flow { animation: erRtFlow 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .er-rt-flow { animation: none; } }
      `}</style>

      {/* ── 1. Project: a domain and its keyword lines ──────────────────── */}
      <Card x={6} />
      <rect x={22} y={44} width={68} height={11} rx={5.5} fill={ACCENT} />
      <rect x={22} y={68} width={96} height={8} rx={4} fill={MUTED} />
      <rect x={22} y={84} width={80} height={8} rx={4} fill={MUTED} />
      <rect x={22} y={100} width={88} height={8} rx={4} fill={MUTED} />

      <Connector x={140} />

      {/* ── 2. Scheduled checks against the top 100 ─────────────────────── */}
      <Card x={174} />
      <g transform="translate(190, 40)">
        <CalendarClock width={26} height={26} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
      {/* Result rows; the third is "your" result, hence the accent. */}
      <rect x={224} y={44} width={64} height={7} rx={3.5} fill={MUTED} />
      <rect x={224} y={57} width={52} height={7} rx={3.5} fill={MUTED} />
      <rect x={190} y={80} width={98} height={7} rx={3.5} fill={MUTED} />
      <rect x={190} y={93} width={74} height={7} rx={3.5} fill={ACCENT} />
      <rect x={190} y={106} width={86} height={7} rx={3.5} fill={MUTED} />

      <Connector x={308} />

      {/* ── 3. Position history trending toward #1 ──────────────────────── */}
      <Card x={342} />
      <g transform="translate(354, 34)">
        <TrendingUp width={20} height={20} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
      {/* Rising line: y falls as the position number improves. */}
      <polyline
        points="366,112 404,96 442,72"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={366} cy={112} r={4} fill="#ffffff" stroke={ACCENT} strokeWidth={2} />
      <circle cx={404} cy={96} r={4} fill="#ffffff" stroke={ACCENT} strokeWidth={2} />
      <circle cx={442} cy={72} r={4} fill={ACCENT} stroke={ACCENT} strokeWidth={2} />
      <text x={366} y={128} textAnchor="middle" fontSize={11} fill={LABEL}>
        #8
      </text>
      <text x={404} y={112} textAnchor="middle" fontSize={11} fill={LABEL}>
        #5
      </text>
      <text x={442} y={62} textAnchor="middle" fontSize={11} fill={ACCENT} fontWeight={600}>
        #3
      </text>
    </svg>
  );
}
