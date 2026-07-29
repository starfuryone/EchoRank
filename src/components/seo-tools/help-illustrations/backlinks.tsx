// Backlinks: a central site with inbound links (one strong, one lost) and the
// growth line that follows from them.
import { ACCENT, BAD, Bar, HelpArt, MUTED, Panel, STROKE, Tick } from "./shared";

export function BacklinksArt() {
  return (
    <HelpArt>
      {/* Referring domains on the left, feeding the target */}
      {[38, 68, 98].map((y, i) => (
        <g key={y}>
          <rect x={10} y={y - 11} width={64} height={22} rx={6} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
          <Bar x={20} y={y - 3} w={i === 0 ? 44 : 34} h={6} fill={i === 0 ? ACCENT : MUTED} />
        </g>
      ))}

      {/* Links in. The first is bold (a strong dofollow domain); the last is
          dashed and red — a link that was lost. */}
      <path d="M78 38 C 130 38, 150 68, 196 72" fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M78 68 C 130 68, 150 72, 196 76" fill="none" stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
      <path d="M78 98 C 130 98, 150 84, 196 80" fill="none" stroke={BAD} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />

      {/* The analyzed target */}
      <circle cx={224} cy={76} r={28} fill="#ffffff" stroke={ACCENT} strokeWidth={2.5} />
      <Bar x={208} y={68} w={32} h={6} fill={ACCENT} />
      <Bar x={212} y={80} w={24} h={5} />

      {/* Growth over time */}
      <Panel x={296} w={176} />
      <polyline
        points="312,110 350,100 388,86 426,66 456,52"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={456} cy={52} r={4} fill={ACCENT} />
      <Tick x={312} y={128} anchor="start">0</Tick>
      <Tick x={456} y={44} weight={600} fill={ACCENT}>↑</Tick>
    </HelpArt>
  );
}
