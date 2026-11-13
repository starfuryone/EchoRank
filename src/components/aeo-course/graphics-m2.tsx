// Module 2 graphics: the prompt panel grid (lesson 4) and the MRCA funnel
// (lesson 5). Server components.

import { MRCA_STAGES, aeoLessonBySlug } from "@/lib/aeo-course";
import { A, delay } from "./anim";
import { Figure, Lines, wrap } from "./Figure";
import css from "./aeo.module.css";

const STAGES = ["Problem", "Solutions", "Compare", "Verify"];

/**
 * Where each prompt type belongs in the journey: 2 = write prompts here,
 * 1 = sometimes, 0 = rarely. Guidance from lesson 4, drawn as marks with a
 * text legend, never as numbers.
 */
const FIT: number[][] = [
  [2, 0, 0, 0],
  [2, 1, 0, 0],
  [1, 2, 1, 0],
  [0, 1, 2, 2],
];

/** Lesson 4. Journey stage × prompt type; cells fill in as rows are "added". */
export function PromptPanel() {
  const t = aeoLessonBySlug("build-your-prompt-panel")?.body.find((b) => b.k === "table");
  const types = t && t.k === "table" ? t.rows.map((r) => r[0]) : [];
  const x0 = 96, colW = 76, top = 40, rowH = 44;
  const H = top + STAGES.length * rowH + 34;
  return (
    <Figure
      id="g-prompt-panel"
      title="A prompt panel: journey stage by prompt type"
      desc={`Rows are journey stages (${STAGES.join(", ")}); columns are prompt types (${types.join(", ")}). Early stages are mostly unbranded prompts; verification is mostly branded and fact-check prompts.`}
      width={400}
      height={H}
    >
      {types.map((ty, c) => (
        <text key={ty} x={x0 + c * colW + colW / 2} y={24} fontSize={12} className={css.svgMuted} textAnchor="middle">{ty}</text>
      ))}
      {STAGES.map((st, r) => {
        const y = top + r * rowH;
        return (
          <g key={st}>
            <text x={0} y={y + 24} fontSize={13} fontWeight={600} className={`${css.svgText} ${A.fade}`} style={delay(r * 0.4)}>{st}</text>
            {types.map((ty, c) => {
              const fit = FIT[r][c] ?? 0;
              const cx = x0 + c * colW;
              return (
                <g key={ty} className={A.pop} style={delay(r * 0.4 + c * 0.08 + 0.1)}>
                  <rect x={cx + 4} y={y + 4} width={colW - 8} height={rowH - 8} rx={8} className={fit === 2 ? css.svgEmph : css.svgBg} />
                  {fit === 2 && <rect x={cx + colW / 2 - 7} y={y + rowH / 2 - 7} width={14} height={14} rx={3} className={css.svgGoldFill} />}
                  {fit === 1 && <rect x={cx + colW / 2 - 7} y={y + rowH / 2 - 7} width={14} height={14} rx={3} className={css.svgGoldStroke} strokeWidth={1.6} />}
                  {fit === 0 && <path d={`M${cx + colW / 2 - 6} ${y + rowH / 2}h12`} className={css.svgLine} strokeWidth={1.6} />}
                </g>
              );
            })}
          </g>
        );
      })}
      <rect x={0} y={H - 22} width={12} height={12} rx={3} className={css.svgGoldFill} />
      <text x={18} y={H - 12} fontSize={12} className={css.svgMuted}>write prompts here</text>
      <rect x={148} y={H - 22} width={12} height={12} rx={3} className={css.svgGoldStroke} strokeWidth={1.6} />
      <text x={166} y={H - 12} fontSize={12} className={css.svgMuted}>sometimes</text>
      <path d={`M246 ${H - 16}h12`} className={css.svgLine} strokeWidth={1.6} />
      <text x={264} y={H - 12} fontSize={12} className={css.svgMuted}>rarely</text>
    </Figure>
  );
}

/** Lesson 5. The four stages reveal in turn; a sample answer passes M and R and stops at Cited. */
export function MrcaFunnel() {
  // The funnel on the left; a column of pass/fail marks at markX, clear of the
  // stage names; the note beside the stage where the sample answer stops.
  const step = 54, h = 46, cx = 118, top = 230, shrink = 34, markX = 250;
  const failAt = 2;
  const H = MRCA_STAGES.length * step + 6;
  const note = wrap("Sample answer: mentioned and recommended, but no page of yours is cited. The fix is a page that wins a sub-question.", 17);
  const midY = (i: number) => i * step + 2 + h / 2;
  return (
    <Figure
      id="g-mrca-funnel"
      title="The MRCA funnel"
      desc={`Four stages, each a stricter test: ${MRCA_STAGES.map((s) => `${s.name} (${s.line})`).join(", ")}. A sample answer passes Mentioned and Recommended and stops at Cited.`}
      width={400}
      height={H}
    >
      {MRCA_STAGES.map((s, i) => {
        const a = top - i * shrink;
        const b = top - (i + 1) * shrink;
        const y = i * step + 2;
        return (
          <g key={s.key} className={A.fade} style={delay(i * 0.3)}>
            <path d={`M${cx - a / 2} ${y}H${cx + a / 2}L${cx + b / 2} ${y + h}H${cx - b / 2}Z`} className={i < failAt ? css.svgEmph : css.svgBg} strokeLinejoin="round" />
            <text x={cx - 48} y={y + 28} fontSize={16} fontWeight={700} className={css.svgGold}>{s.key}</text>
            <text x={cx - 28} y={y + 28} fontSize={14} fontWeight={620} className={css.svgText}>{s.name}</text>
          </g>
        );
      })}
      {/* The sample answer: travels from M down to C and stops there. */}
      <path d={`M${markX} ${midY(0)}V${midY(MRCA_STAGES.length - 1)}`} className={css.svgLine} strokeDasharray="2 4" />
      {[0, 1].map((i) => (
        <g key={i} className={A.pop} style={delay(1.4 + i * 0.5)}>
          <circle cx={markX} cy={midY(i)} r={10} className={css.svgGreenFill} />
          <path d={`M${markX - 4.5} ${midY(i)}l3.5 3.5 6-7`} stroke="#181A20" strokeWidth={2} fill="none" strokeLinecap="round" />
        </g>
      ))}
      <g className={A.travel} style={delay(1.2, { "--fy": `${-failAt * step}px` })}>
        <circle cx={markX} cy={midY(failAt)} r={10} className={css.svgRedFill} />
      </g>
      <g className={A.pop} style={delay(2.5)}>
        <path d={`M${markX - 4} ${midY(failAt) - 4}l8 8m0-8l-8 8`} stroke="#181A20" strokeWidth={2} strokeLinecap="round" />
      </g>
      <g className={A.fade} style={delay(2.7)}>
        <Lines x={272} y={midY(failAt) - 44} lines={note} lh={15} size={12} className={css.svgMuted} />
      </g>
    </Figure>
  );
}
