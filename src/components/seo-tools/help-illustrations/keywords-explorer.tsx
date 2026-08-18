// Keyword Explorer: it reads YOUR pages (left) and returns a scannable table
// grounded in them (right).
//
// REDRAWN FOR THE REFACTORED PAGE. The previous version showed dot-and-bar rows
// ending in two dashed chips — the "missing terms" of the content tab, which is
// a different tab entirely — and had nothing for the two columns the table
// gained. It now depicts what the customer actually sees: a header row, then
// per row a difficulty dot, the keyword, a relevance meter, and a source chip.
//
// The stack on the left is three offset sheets rather than one, because the
// scan reads several pages and the old single sheet quietly said otherwise.
//
// Convention (see ./shared.tsx): 480x150, aria-hidden, no translatable text —
// which is why the relevance meter is a partly-filled bar and the source is a
// blank chip rather than the words "Relevance" and "Title".
import {
  ACCENT,
  ACCENT_SOFT,
  BAD,
  Bar,
  Chip,
  Connector,
  FILL,
  GOOD,
  HelpArt,
  LABEL,
  MUTED,
  Panel,
  STROKE,
  WARN,
} from "./shared";

/** Difficulty dot, keyword, relevance meter, source chip — one table row. */
function Row({ y, dot, kw, fill }: { y: number; dot: string; kw: number; fill: number }) {
  return (
    <g>
      <circle cx={202} cy={y} r={4.5} fill={dot} />
      <Bar x={213} y={y - 4} w={kw} h={8} fill={MUTED} />
      {/* Relevance: a track with the measured portion filled. */}
      <rect x={330} y={y - 3} width={46} height={6} rx={3} fill={STROKE} />
      <rect x={330} y={y - 3} width={fill} height={6} rx={3} fill={ACCENT} />
      {/* Source: which element the phrase came from. */}
      <Chip x={390} y={y - 7} w={44} h={14} fill={ACCENT_SOFT} stroke={ACCENT} />
    </g>
  );
}

export function KeywordsExplorerArt() {
  return (
    <HelpArt>
      {/* 1. The pages being scanned — a stack, not a single sheet. */}
      <rect x={26} y={30} width={100} height={94} rx={8} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <rect x={20} y={26} width={100} height={94} rx={8} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <rect x={14} y={22} width={100} height={94} rx={8} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      {/* Title line accented, then body copy — the fields the scan weighs. */}
      <Bar x={26} y={34} w={56} h={8} fill={ACCENT} />
      {[50, 62, 74, 86, 98].map((y, i) => (
        <Bar key={y} x={26} y={y} w={i % 2 ? 60 : 74} h={5} />
      ))}

      <Connector x={126} y={70} len={26} />

      {/* 2. The results table. */}
      <Panel x={172} w={300} />
      {/* Header row + rule, so the rows below read as a table rather than a list. */}
      {[
        { x: 213, w: 40 },
        { x: 330, w: 30 },
        { x: 390, w: 26 },
      ].map((h) => (
        <Bar key={h.x} x={h.x} y={40} w={h.w} h={4} fill={LABEL} />
      ))}
      <line x1={190} y1={52} x2={454} y2={52} stroke={STROKE} strokeWidth={1.5} />

      {/* Easy / medium / hard, with relevance falling as difficulty rises. */}
      <Row y={68} dot={GOOD} kw={96} fill={40} />
      <Row y={92} dot={WARN} kw={78} fill={26} />
      <Row y={116} dot={BAD} kw={110} fill={13} />
    </HelpArt>
  );
}
