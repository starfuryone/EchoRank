// Lighthouse: a URL bar -> four score arcs in the standard bands -> one arc
// filling toward green.
import { ACCENT, Bar, GOOD, HelpArt, Panel, STROKE, Tick, WARN, BAD, MUTED } from "./shared";

/** One score ring. `filled` is 0-1 of the circumference. */
function Arc({ cx, filled, color }: { cx: number; filled: number; color: string }) {
  const r = 21;
  const c = 2 * Math.PI * r;
  return (
    <g transform={`rotate(-90 ${cx} 84)`}>
      <circle cx={cx} cy={84} r={r} fill="none" stroke="#f3f4f6" strokeWidth={6} />
      <circle
        cx={cx}
        cy={84}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${(c * filled).toFixed(1)} ${c.toFixed(1)}`}
      />
    </g>
  );
}

export function LighthouseArt() {
  return (
    <HelpArt>
      {/* URL bar */}
      <rect x={10} y={62} width={150} height={28} rx={14} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      <circle cx={30} cy={76} r={5} fill={MUTED} />
      <Bar x={44} y={72} w={92} h={7} />

      <path d="M170 76h20" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeDasharray="5 5" className="er-help-flow" />
      <path d="M190 70l7 6-7 6" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Four category scores in Lighthouse's own bands */}
      <Panel x={208} y={34} w={264} h={84} />
      <Arc cx={252} filled={0.42} color={BAD} />
      <Arc cx={312} filled={0.71} color={WARN} />
      <Arc cx={372} filled={0.94} color={GOOD} />
      {/* The fourth is mid-fill in green — the "improving" one. */}
      <Arc cx={432} filled={0.88} color={GOOD} />
      <Tick x={252} y={88} fill={BAD} weight={600}>42</Tick>
      <Tick x={312} y={88} fill={WARN} weight={600}>71</Tick>
      <Tick x={372} y={88} fill={GOOD} weight={600}>94</Tick>
      <Tick x={432} y={88} fill={GOOD} weight={600}>88</Tick>
    </HelpArt>
  );
}
