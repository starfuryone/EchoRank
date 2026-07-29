// Site Explorer: one domain -> its ranked keywords bucketed by position. The
// 4-10 bucket is the accented one because that is the bucket the copy tells
// you to work on first.
import {
  ACCENT,
  ACCENT_SOFT,
  Bar,
  Connector,
  HelpArt,
  LABEL,
  MUTED,
  Panel,
  STROKE,
  Tick,
} from "./shared";

/** Bar height and the count above it. Shape only — no domain has these numbers. */
const BUCKETS = [
  { h: 26, n: 12 },
  { h: 40, n: 28 },
  { h: 62, n: 74 },
  { h: 48, n: 51 },
  { h: 34, n: 33 },
];

export function SiteExplorerArt() {
  return (
    <HelpArt>
      {/* 1. The domain under analysis */}
      <Panel x={10} y={38} w={120} h={76} />
      <circle cx={44} cy={64} r={12} fill="none" stroke={ACCENT} strokeWidth={2} />
      <path
        d="M32 64h24M44 52c6 6 6 18 0 24M44 52c-6 6-6 18 0 24"
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
      />
      <Bar x={64} y={60} w={52} h={7} />
      <Bar x={22} y={88} w={96} h={6} />
      <Bar x={22} y={100} w={64} h={6} />

      <Connector x={142} y={76} len={24} />

      {/* 2. Keywords by position: 1 / 2-3 / 4-10 / 11-20 / 21-100 */}
      <Panel x={186} w={286} />
      {BUCKETS.map((b, i) => {
        const x = 206 + i * 54;
        return (
          <g key={x}>
            <rect
              x={x}
              y={112 - b.h}
              width={34}
              height={b.h}
              rx={4}
              fill={i === 2 ? ACCENT : ACCENT_SOFT}
              stroke={i === 2 ? ACCENT : STROKE}
              strokeWidth={1.5}
            />
            <Tick x={x + 17} y={106 - b.h} fill={LABEL}>
              {b.n}
            </Tick>
          </g>
        );
      })}
      <line x1={196} y1={116} x2={462} y2={116} stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
    </HelpArt>
  );
}
