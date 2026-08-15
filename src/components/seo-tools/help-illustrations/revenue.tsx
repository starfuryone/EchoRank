// AI Revenue: visitors on the left, a share-of-voice split in the middle, two
// money figures on the right. The three inputs and the two outputs, in the
// order the arithmetic runs.
import { ACCENT, ACCENT_SOFT, BAD, Bar, GOOD, HelpArt, LABEL, MUTED, Panel, STROKE } from "./shared";

export function RevenueArt() {
  return (
    <HelpArt>
      {/* Visitors from assistants. Dots rather than a bar chart: the leads
          count is a headcount, and five circles say that without a scale. */}
      <Panel x={10} w={104} />
      {[
        { cx: 34, cy: 48 },
        { cx: 58, cy: 48 },
        { cx: 82, cy: 48 },
        { cx: 34, cy: 74 },
        { cx: 58, cy: 74 },
      ].map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={8} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      ))}
      {[100, 112].map((y, i) => (
        <Bar key={y} x={26} y={y} w={i === 0 ? 72 : 48} h={5} fill={MUTED} />
      ))}

      <path
        d="M120 75 H 164"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
        className="er-help-flow"
      />

      {/* Share of the answers: the tenant's slice against the top rival's. The
          gap between the two bars IS the lost-revenue input, so they are drawn
          on a shared baseline where the difference is the thing you see.
          NO LABELS — this directory forbids translatable text, and the steps
          beside the graphic name both bars in the reader's own locale. */}
      <Panel x={172} w={136} />
      <rect x={186} y={96} width={44} height={20} rx={3} fill={ACCENT} />
      <rect x={186} y={44} width={44} height={52} rx={3} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} strokeDasharray="3 3" />
      <rect x={250} y={44} width={44} height={72} rx={3} fill={LABEL} />
      <path d="M186 116 H 294" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />

      <path
        d="M314 75 H 356"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
        className="er-help-flow"
      />

      {/* The two figures. Green rising for what was won, red falling for what
          the gap costs — the only two numbers the page leads with. */}
      <rect x={364} y={26} width={106} height={46} rx={6} fill="#ffffff" stroke={GOOD} strokeWidth={2.5} />
      <path d="M378 58 L 392 44 L 404 52 L 420 34" fill="none" stroke={GOOD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M414 34 H 422 V 42" fill="none" stroke={GOOD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Bar x={434} y={44} w={24} h={6} fill={GOOD} />

      <rect x={364} y={80} width={106} height={46} rx={6} fill="#ffffff" stroke={BAD} strokeWidth={2.5} />
      <path d="M378 92 L 392 106 L 404 98 L 420 116" fill="none" stroke={BAD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M414 116 H 422 V 108" fill="none" stroke={BAD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Bar x={434} y={100} w={24} h={6} fill={BAD} />
    </HelpArt>
  );
}
