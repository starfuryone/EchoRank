// Module 5 graphics: an illustrative monthly report (lesson 11) and the
// 90-day roadmap (lesson 12), plus the hub's MRCA loop.

import { MRCA_STAGES, aeoLessonBySlug } from "@/lib/aeo-course";
import { A, delay } from "./anim";
import { Figure, Lines, wrap } from "./Figure";
import css from "./aeo.module.css";

/**
 * Lesson 11. The SHAPE of a monthly report. Every bar and line is a
 * placeholder: there are no axis values and no numbers, and the figure says so
 * in its own heading. Nothing here may be read as data.
 */
export function DashboardMock() {
  const bars = [92, 66, 38, 74];
  const spark = "M206 128 L230 120 L254 124 L278 108 L302 112 L326 96 L350 100 L374 86";
  return (
    <Figure
      id="g-dashboard-mock"
      title="The shape of a monthly AEO report (illustrative)"
      desc="An illustrative report layout with placeholder shapes and no data: bars for the four MRCA stages, a line for share of answers over time, and small bars for AI referral visits labelled as a floor. No axis has values."
      width={400}
      height={262}
    >
      <rect x={0.5} y={0.5} width={399} height={261} rx={12} className={css.svgBg} />
      <text x={16} y={24} fontSize={12} className={`${css.svgGold} ${css.svgMono}`}>MONTHLY AEO REPORT</text>
      <rect x={266} y={10} width={120} height={20} rx={10} className={css.svgBg2} />
      <text x={326} y={24} fontSize={12} className={`${css.svgText} ${css.svgMono}`} textAnchor="middle">ILLUSTRATIVE</text>
      <rect x={14} y={40} width={176} height={150} rx={10} className={css.svgBg2} />
      <text x={26} y={60} fontSize={12.5} className={css.svgText}>MRCA by stage</text>
      {bars.map((h, i) => (
        <g key={i}>
          <rect x={34 + i * 38} y={170 - h} width={24} height={h} rx={4} className={`${css.svgGoldFill} ${A.growY}`} fillOpacity={0.85} style={delay(0.2 + i * 0.15)} />
          <text x={46 + i * 38} y={184} fontSize={12} fontWeight={700} className={css.svgMuted} textAnchor="middle">{MRCA_STAGES[i].key}</text>
        </g>
      ))}
      <rect x={198} y={40} width={188} height={110} rx={10} className={css.svgBg2} />
      <text x={210} y={60} fontSize={12.5} className={css.svgText}>Share of answers</text>
      <path d={spark} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={delay(0.8)} />
      <rect x={198} y={158} width={188} height={92} rx={10} className={css.svgBg2} />
      <text x={210} y={178} fontSize={12.5} className={css.svgText}>AI referrals (a floor)</text>
      {[30, 42, 36, 50, 46, 58].map((h, i) => (
        <rect key={i} x={214 + i * 26} y={240 - h * 0.85} width={16} height={h * 0.85} rx={3} className={`${css.svgGreenFill} ${A.growY}`} fillOpacity={0.8} style={delay(1.2 + i * 0.08)} />
      ))}
      <text x={16} y={212} fontSize={12} className={css.svgMuted}>Placeholder shapes,</text>
      <text x={16} y={228} fontSize={12} className={css.svgMuted}>not data: your own</text>
      <text x={16} y={244} fontSize={12} className={css.svgMuted}>numbers go here.</text>
    </Figure>
  );
}

/** Lesson 12. The 90-day roadmap from the lesson's own table: the line advances, milestones pop. */
export function Roadmap90() {
  const t = aeoLessonBySlug("your-90-day-aeo-plan")?.body.find((b) => b.k === "table");
  const phases = t && t.k === "table" ? t.rows.map((r) => ({ phase: r[0], focus: r[1] })) : [];
  // Four 100-unit columns: the dot at +16, the text from the column's left edge.
  const xs = phases.map((_, i) => 20 + i * 100);
  const focus = phases.map((p) => wrap(p.focus, 13));
  const H = 96 + Math.max(...focus.map((f) => f.length)) * 16 + 10;
  return (
    <Figure
      id="g-roadmap-90"
      title="A 90-day AEO roadmap"
      desc={phases.map((p) => `${p.phase}: ${p.focus}.`).join(" ")}
      width={400}
      height={H}
    >
      <path d={`M${xs[0]} 34H${xs[xs.length - 1]}`} className={css.svgLine} strokeWidth={3} strokeLinecap="round" />
      <rect x={xs[0]} y={32.5} width={xs[xs.length - 1] - xs[0]} height={3} rx={1.5} className={`${css.svgGoldFill} ${A.growX}`} style={delay(0.2)} />
      {phases.map((p, i) => (
        <g key={p.phase}>
          <g className={A.pop} style={delay(0.2 + i * 0.5)}>
            <circle cx={xs[i]} cy={34} r={12} className={css.svgGoldFill} />
            <text x={xs[i]} y={38.5} fontSize={12} fontWeight={700} fill="#181A20" textAnchor="middle">{i + 1}</text>
          </g>
          <g className={A.fade} style={delay(0.35 + i * 0.5)}>
            <text x={xs[i] - 16} y={72} fontSize={13} fontWeight={650} className={css.svgGold}>{p.phase}</text>
            <Lines x={xs[i] - 16} y={92} lines={focus[i]} lh={16} size={12.5} className={css.svgMuted} />
          </g>
        </g>
      ))}
    </Figure>
  );
}

/**
 * The hub hero: the MRCA loop. Four stages around a cycle, drawn once in about
 * four seconds (no infinite loop), with "measure, fix, re-measure" at the centre.
 */
export function MrcaLoop() {
  const pos = [
    { x: 200, y: 46 },
    { x: 334, y: 152 },
    { x: 200, y: 258 },
    { x: 66, y: 152 },
  ];
  const arcs = ["M248 60 Q 318 76 326 116", "M326 188 Q 318 230 248 244", "M152 244 Q 82 230 74 188", "M74 116 Q 82 76 152 60"];
  return (
    <Figure
      id="g-mrca-loop"
      title="The MRCA loop"
      desc={`Four stages scored on every AI answer, in a loop: ${MRCA_STAGES.map((s) => s.name).join(", then ")}, then back to measuring. Measure, fix the stage where you drop out, and measure again.`}
      width={400}
      height={304}
      hero
    >
      {arcs.map((d, i) => (
        <path key={d} d={d} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={2} strokeLinecap="round" style={delay(0.5 + i * 0.6)} />
      ))}
      {MRCA_STAGES.map((s, i) => (
        <g key={s.key} className={A.pop} style={delay(0.2 + i * 0.6)}>
          <rect x={pos[i].x - 56} y={pos[i].y - 30} width={112} height={60} rx={14} className={i === 0 ? css.svgEmph : css.svgBg2} />
          <text x={pos[i].x} y={pos[i].y - 4} fontSize={20} fontWeight={750} className={css.svgGold} textAnchor="middle">{s.key}</text>
          <text x={pos[i].x} y={pos[i].y + 16} fontSize={13.5} className={css.svgText} textAnchor="middle">{s.name}</text>
        </g>
      ))}
      <g className={A.fade} style={delay(3.0)}>
        <text x={200} y={146} fontSize={13} className={`${css.svgFaint} ${css.svgMono}`} textAnchor="middle">MEASURE</text>
        <text x={200} y={164} fontSize={13} className={`${css.svgFaint} ${css.svgMono}`} textAnchor="middle">FIX · REPEAT</text>
      </g>
    </Figure>
  );
}
