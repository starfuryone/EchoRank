// AI Lens: one page splitting two ways — the sparse copy a crawler receives and
// the full copy a browser renders — with the difference called out as a band.
//
// The left document is deliberately the short one: the whole point of the tool
// is that the crawler's version is the impoverished one, and reversing that
// would teach the wrong thing at a glance.
import {
  ACCENT,
  Bar,
  BAD,
  FILL,
  GOOD,
  HelpArt,
  MUTED,
  STROKE,
  Tick,
} from "./shared";

/** A page sketch: outline plus content lines. */
function Doc({
  x,
  lines,
  accentTop,
}: {
  x: number;
  lines: number[];
  accentTop: boolean;
}) {
  return (
    <g>
      <rect x={x} y={20} width={116} height={112} rx={8} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      <Bar x={x + 14} y={34} w={62} h={9} fill={accentTop ? ACCENT : MUTED} />
      {lines.map((w, i) => (
        <Bar key={i} x={x + 14} y={54 + i * 13} w={w} h={6} />
      ))}
    </g>
  );
}

export function AiLensArt() {
  return (
    <HelpArt>
      {/* The one page, before it is fetched */}
      <rect x={8} y={52} width={74} height={48} rx={8} fill={FILL} stroke={ACCENT} strokeWidth={2} />
      <Bar x={20} y={64} w={44} h={7} fill={ACCENT} />
      <Bar x={20} y={78} w={32} h={5} />

      {/* Two fetches of the same URL */}
      <path
        d="M84 70 C 104 70, 106 44, 126 44"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="5 5"
        className="er-help-flow"
      />
      <path
        d="M84 82 C 104 82, 106 108, 126 108"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="5 5"
        className="er-help-flow"
      />

      {/* Raw fetch — three lines, nothing below the fold */}
      <Doc x={132} lines={[80, 66, 48]} accentTop={false} />
      {/* Rendered — the same head plus everything JavaScript added */}
      <Doc x={272} lines={[80, 66, 74, 70, 58, 44]} accentTop />

      {/* The gap: what only the browser got */}
      <rect x={266} y={98} width={128} height={38} rx={6} fill="#fef2f2" stroke={BAD} strokeWidth={1.5} strokeDasharray="4 3" />

      {/* Verdict marks: crawler short, browser complete */}
      <circle cx={190} cy={140} r={6} fill="#fee2e2" stroke={BAD} strokeWidth={1.5} />
      <path d="M187 140h6" stroke={BAD} strokeWidth={2} strokeLinecap="round" />
      <circle cx={330} cy={140} r={6} fill="#dcfce7" stroke={GOOD} strokeWidth={1.5} />
      <path d="M327 140l2.5 2.5 4-4.5" fill="none" stroke={GOOD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* The measurement itself */}
      <Tick x={438} y={64} fill={BAD} size={22} weight={700}>
        32%
      </Tick>
      <Bar x={404} y={78} w={68} h={5} fill={STROKE} />
      <Bar x={404} y={78} w={22} h={5} fill={BAD} />
    </HelpArt>
  );
}
