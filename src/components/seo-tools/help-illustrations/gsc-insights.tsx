// GSC Insights: 28 days of clicks under impressions, then the daily query rows
// the sync stores for Rank Tracker.
//
// The greyed band at the right edge of the chart is Google's reporting lag —
// the most recent days do not exist yet, for anyone. It is drawn rather than
// described because "why does the chart stop before today" is the question the
// timing section of the modal answers.
import { ACCENT, ACCENT_SOFT, Bar, Connector, HelpArt, MUTED, Panel } from "./shared";

const IMPRESSIONS = "M24 88 L60 74 L96 80 L132 58 L168 64 L204 44 L238 50";
const CLICKS = "M24 108 L60 98 L96 102 L132 84 L168 90 L204 72 L238 78";

export function GscInsightsArt() {
  return (
    <HelpArt>
      {/* 1. Two scales on one canvas, exactly as the page draws them */}
      <Panel x={10} w={262} />
      <path
        d={IMPRESSIONS}
        fill="none"
        stroke="#93c5fd"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={CLICKS}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* The reporting lag: no data exists here yet */}
      <rect x={240} y={26} width={30} height={100} rx={6} fill="#f3f4f6" />
      <line x1={240} y1={28} x2={240} y2={124} stroke={MUTED} strokeWidth={2} strokeDasharray="4 4" />

      <Connector x={280} y={76} len={22} />

      {/* 2. The stored query rows: the term, and what it earned */}
      <Panel x={318} w={154} />
      {[44, 68, 92, 116].map((y, i) => (
        <g key={y}>
          <Bar x={332} y={y - 4} w={78 - i * 8} h={7} />
          <Bar x={422} y={y - 4} w={36 - i * 6} h={7} fill={ACCENT_SOFT} />
        </g>
      ))}
    </HelpArt>
  );
}
