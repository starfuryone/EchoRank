// Content Explorer: a magnifier over a web of pages -> three result cards, the
// middle one carrying a positive-sentiment badge.
//
// The web on the left is the point of the left half: we are searching an index of
// pages, not your site, so the nodes are unrelated documents with links between
// them rather than a site tree. The badge on one card is the sentiment signal —
// deliberately on ONE of three, because a mixed result set is the normal case and
// an illustration showing three green badges would promise something the tool
// does not deliver.
//
// Locale-neutral by rule: the only text is a bare numeral.
import {
  ACCENT,
  ACCENT_SOFT,
  Bar,
  Connector,
  GOOD,
  HelpArt,
  LABEL,
  MUTED,
  Panel,
  STROKE,
  Tick,
} from "./shared";

/** Web-of-pages node positions. Shape only — not a real link graph. */
const NODES = [
  { x: 30, y: 40 },
  { x: 72, y: 26 },
  { x: 100, y: 62 },
  { x: 40, y: 84 },
  { x: 84, y: 108 },
  { x: 22, y: 116 },
];

/** Which nodes are joined, by index into NODES. */
const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 2],
  [0, 3],
  [2, 4],
  [3, 4],
  [3, 5],
];

/** Three result cards; the middle one is the positive-sentiment example. */
const CARDS = [
  { y: 26, positive: false },
  { y: 62, positive: true },
  { y: 98, positive: false },
];

export function ContentExplorerArt() {
  return (
    <HelpArt>
      {/* 1. The web of pages being searched */}
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke={STROKE}
          strokeWidth={2}
        />
      ))}
      {NODES.map((n, i) => (
        <g key={i}>
          {/* each node is a little document */}
          <rect
            x={n.x - 8}
            y={n.y - 10}
            width={16}
            height={20}
            rx={3}
            fill="#ffffff"
            stroke={STROKE}
            strokeWidth={2}
          />
          <Bar x={n.x - 5} y={n.y - 6} w={10} h={2.5} fill={MUTED} />
          <Bar x={n.x - 5} y={n.y - 1} w={10} h={2.5} fill={MUTED} />
          <Bar x={n.x - 5} y={n.y + 4} w={6} h={2.5} fill={MUTED} />
        </g>
      ))}

      {/* The magnifier, over the web rather than beside it */}
      <circle cx={74} cy={70} r={30} fill={ACCENT_SOFT} fillOpacity={0.55} />
      <circle cx={74} cy={70} r={30} fill="none" stroke={ACCENT} strokeWidth={3} />
      <line
        x1={96}
        y1={92}
        x2={116}
        y2={112}
        stroke={ACCENT}
        strokeWidth={4}
        strokeLinecap="round"
      />

      <Connector x={132} y={70} len={24} />

      {/* 2. Three result cards */}
      {CARDS.map((c) => (
        <g key={c.y}>
          <Panel x={172} y={c.y} w={296} h={30} fill="#ffffff" />
          {/* favicon-ish domain dot + title line + url line */}
          <circle cx={188} cy={c.y + 15} r={5} fill={c.positive ? GOOD : MUTED} />
          <Bar x={202} y={c.y + 8} w={c.positive ? 150 : 178} h={5} fill={MUTED} />
          <Bar x={202} y={c.y + 19} w={104} h={4} fill={STROKE} />
          {/* the sentiment badge, on exactly one card */}
          {c.positive && (
            <>
              <rect
                x={362}
                y={c.y + 7}
                width={46}
                height={16}
                rx={8}
                fill="#dcfce7"
                stroke={GOOD}
                strokeWidth={1.5}
              />
              <path
                d={`M370 ${c.y + 15}l3 3 5 -6`}
                fill="none"
                stroke={GOOD}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={392} cy={c.y + 15} r={2} fill={GOOD} />
              <circle cx={399} cy={c.y + 15} r={2} fill={GOOD} />
            </>
          )}
          {/* authority rank chip on the right edge */}
          <Tick x={452} y={c.y + 19} anchor="end" fill={LABEL} size={10}>
            {c.positive ? 682 : 431}
          </Tick>
        </g>
      ))}
    </HelpArt>
  );
}
