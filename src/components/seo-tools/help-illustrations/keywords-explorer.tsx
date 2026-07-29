// Keywords Explorer: it reads YOUR page (left) and returns keywords grounded in
// it (right). Solid rows are suggestions ranked by difficulty; the two dashed
// chips are the missing terms — things the page does not say yet.
import {
  ACCENT,
  ACCENT_SOFT,
  BAD,
  Bar,
  Connector,
  GOOD,
  HelpArt,
  MUTED,
  Panel,
  STROKE,
  WARN,
} from "./shared";

export function KeywordsExplorerArt() {
  return (
    <HelpArt>
      {/* 1. The page being crawled */}
      <rect x={14} y={22} width={112} height={106} rx={8} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      <Bar x={28} y={38} w={64} h={9} fill={ACCENT} />
      {[58, 72, 86, 100, 114].map((y, i) => (
        <Bar key={y} x={28} y={y} w={i % 2 ? 70 : 84} h={6} />
      ))}

      <Connector x={138} y={76} len={24} />

      {/* 2. Suggestions, easiest first — then the terms the page is missing */}
      <Panel x={182} w={290} />
      {[
        { y: 44, c: GOOD, w: 150 },
        { y: 68, c: WARN, w: 186 },
        { y: 92, c: BAD, w: 128 },
      ].map((r) => (
        <g key={r.y}>
          <circle cx={202} cy={r.y} r={5} fill={r.c} />
          <Bar x={216} y={r.y - 4} w={r.w} h={8} fill={MUTED} />
        </g>
      ))}
      <rect
        x={196}
        y={108}
        width={110}
        height={16}
        rx={8}
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <rect
        x={314}
        y={108}
        width={82}
        height={16}
        rx={8}
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    </HelpArt>
  );
}
