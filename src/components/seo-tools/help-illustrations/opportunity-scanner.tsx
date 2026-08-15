// Opportunity Scanner: a pasted list on the left, graded rows in the middle,
// a white-labeled report out the right. The three things the tool does, in the
// order it does them.
import { ACCENT, ACCENT_SOFT, BAD, Bar, HelpArt, LABEL, MUTED, Panel, STROKE, WARN } from "./shared";

export function OpportunityScannerArt() {
  return (
    <HelpArt>
      {/* The pasted list. Bars, not text — a list of domains reads the same in
          every locale only if it is not words. */}
      <rect x={10} y={22} width={104} height={106} rx={8} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
      {[36, 52, 68, 84, 100, 116].map((y, i) => (
        <Bar key={y} x={22} y={y} w={i % 3 === 0 ? 76 : 62} h={5} fill={MUTED} />
      ))}

      {/* Feeding the scan */}
      <path
        d="M120 75 H 168"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
        className="er-help-flow"
      />

      {/* Graded rows, worst first — the whole point of the table.
          NO LETTERS. The grade is carried by the severity dot's colour and the
          bar's length, because this directory's convention forbids translatable
          text in an illustration and a bare "F" is a glyph a reader could take
          for a word. The numbered steps beside the graphic say "A to F" in
          their own locale, which is where that belongs. */}
      <Panel x={176} w={168} />
      {[
        { y: 40, fill: BAD, w: 84 },
        { y: 64, fill: BAD, w: 70 },
        { y: 88, fill: WARN, w: 56 },
        { y: 112, fill: MUTED, w: 34 },
      ].map((row) => (
        <g key={row.y}>
          <circle
            cx={198}
            cy={row.y}
            r={7}
            fill={row.fill === MUTED ? "#ffffff" : row.fill}
            stroke={row.fill}
            strokeWidth={2}
          />
          <Bar x={214} y={row.y - 3} w={row.w} h={6} fill={row.fill === MUTED ? MUTED : ACCENT} />
        </g>
      ))}

      {/* Into the report */}
      <path
        d="M350 75 H 392"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
        className="er-help-flow"
      />

      {/* The outreach PDF. The header bar is ACCENT rather than grey to stand
          for the agency's own branding — the one thing that makes this document
          different from every other report the product renders. */}
      <rect x={400} y={26} width={70} height={98} rx={6} fill="#ffffff" stroke={ACCENT} strokeWidth={2.5} />
      <Bar x={410} y={38} w={34} h={7} fill={ACCENT} />
      <circle cx={435} cy={72} r={16} fill="none" stroke={ACCENT_SOFT} strokeWidth={5} />
      <path d="M435 56 A 16 16 0 0 1 449 80" fill="none" stroke={ACCENT} strokeWidth={5} strokeLinecap="round" />
      {[98, 108, 118].map((y, i) => (
        <Bar key={y} x={410} y={y} w={i === 2 ? 30 : 50} h={4} fill={LABEL} />
      ))}
    </HelpArt>
  );
}
