// SERP Checker: a keyword plus its targeting -> one queued check -> the results
// page, SERP features on top of the ranked organic rows (which is exactly where
// they sit in the real thing, and why position 1 is not always position 1).
import { ACCENT, Bar, Chip, Connector, HelpArt, MUTED, Panel, STROKE, Tick } from "./shared";

export function SerpCheckerArt() {
  return (
    <HelpArt>
      {/* 1. The keyword */}
      <rect x={10} y={46} width={146} height={28} rx={14} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      <circle cx={30} cy={58} r={5} fill="none" stroke={MUTED} strokeWidth={2} />
      <path d="M34 62l5 5" stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
      <Bar x={48} y={56} w={92} h={7} />

      {/* 2. Location, language, device — three settings, three different answers */}
      <Chip x={10} y={86} w={44} />
      <Chip x={60} y={86} w={40} />
      <Chip x={106} y={86} w={50} />

      <Connector x={168} y={76} len={26} />

      {/* 3. Features first, then the ranked organic list */}
      <Panel x={212} w={260} />
      <Chip x={226} y={34} w={46} h={14} />
      <Chip x={278} y={34} w={38} h={14} />
      <Chip x={322} y={34} w={52} h={14} />
      {[66, 90, 114].map((y, i) => (
        <g key={y}>
          <Tick x={234} y={y + 4} fill={ACCENT} weight={600}>
            {i + 1}
          </Tick>
          <Bar x={248} y={y - 6} w={190 - i * 26} h={7} fill={MUTED} />
          <Bar x={248} y={y + 4} w={122 - i * 18} h={5} fill={STROKE} />
        </g>
      ))}
    </HelpArt>
  );
}
