// Rank Tracker: project card -> scheduled checks -> position history.
// Migrated from components/help/rank-tracker-help-art.tsx onto the shared
// primitives; same picture, a fifth of the code.
import { CalendarClock, TrendingUp } from "lucide-react";
import { ACCENT, Bar, Connector, HelpArt, Panel, Tick } from "./shared";

export function RankTrackerArt() {
  return (
    <HelpArt>
      {/* 1. Project: a domain and its tracked keywords */}
      <Panel x={6} />
      <Bar x={22} y={44} w={68} h={11} fill={ACCENT} />
      <Bar x={22} y={68} w={96} />
      <Bar x={22} y={84} w={80} />
      <Bar x={22} y={100} w={88} />

      <Connector x={140} />

      {/* 2. Scheduled checks against the top 100 */}
      <Panel x={174} />
      <g transform="translate(190, 40)">
        <CalendarClock width={26} height={26} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
      <Bar x={224} y={44} w={64} />
      <Bar x={224} y={57} w={52} />
      <Bar x={190} y={80} w={98} />
      <Bar x={190} y={93} w={74} fill={ACCENT} />
      <Bar x={190} y={106} w={86} />

      <Connector x={308} />

      {/* 3. Position history climbing toward #1 */}
      <Panel x={342} />
      <g transform="translate(354, 34)">
        <TrendingUp width={20} height={20} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
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
      <Tick x={366} y={128}>#8</Tick>
      <Tick x={404} y={112}>#5</Tick>
      <Tick x={442} y={62} fill={ACCENT} weight={600}>#3</Tick>
    </HelpArt>
  );
}
