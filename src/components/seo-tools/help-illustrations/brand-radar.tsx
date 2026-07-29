// Brand Radar: your brand at the centre, each AI assistant a ring around it ->
// one measured mention rate per assistant, with the alert that moved at the
// bottom. Every bar here corresponds to a stored prompt run, which is the point
// the copy makes: nothing on this page is modelled.
import {
  ACCENT,
  ACCENT_SOFT,
  BAD,
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

/** Bar fill and the percentage beside it. Shape only — not anyone's numbers. */
const ENGINES = [
  { y: 46, pct: 78 },
  { y: 70, pct: 54 },
  { y: 94, pct: 31 },
];

export function BrandRadarArt() {
  return (
    <HelpArt>
      {/* 1. The radar */}
      <circle cx={76} cy={76} r={50} fill="none" stroke={STROKE} strokeWidth={2} />
      <circle cx={76} cy={76} r={33} fill="none" stroke={STROKE} strokeWidth={2} />
      <circle cx={76} cy={76} r={16} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <circle cx={76} cy={76} r={5} fill={ACCENT} />
      {/* Mentioned / mentioned / not mentioned */}
      <circle cx={109} cy={54} r={4.5} fill={GOOD} />
      <circle cx={44} cy={104} r={4.5} fill={GOOD} />
      <circle cx={116} cy={98} r={4.5} fill={MUTED} />

      <Connector x={140} y={76} len={24} />

      {/* 2. Mention rate per assistant */}
      <Panel x={184} w={288} />
      {ENGINES.map((r) => (
        <g key={r.y}>
          <Bar x={200} y={r.y - 4} w={64} h={8} />
          <rect x={276} y={r.y - 5} width={132} height={10} rx={5} fill="#f3f4f6" />
          <rect x={276} y={r.y - 5} width={(132 * r.pct) / 100} height={10} rx={5} fill={ACCENT} />
          <Tick x={456} y={r.y + 4} fill={LABEL} anchor="end">
            {r.pct}%
          </Tick>
        </g>
      ))}

      {/* 3. The alert — the one row that asks for a reaction */}
      <circle cx={206} cy={116} r={4.5} fill={BAD} />
      <Bar x={220} y={112} w={180} h={7} fill="#fecaca" />
    </HelpArt>
  );
}
