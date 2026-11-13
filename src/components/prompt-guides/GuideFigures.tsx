// The per-guide graphics, all rendered from src/lib/prompt-guides.ts:
//   G1 GuideIconPanel     — the industry icon in a large branded panel
//   G3 RefinementDiagram  — vague prompt → four additions → specific prompt
//   G4 MeasurementFunnel  — Mentioned → Recommended → Cited → Accurate, labels only
//   G5 RolloutTimeline    — the four-week plan
// G2 (the prompt-mix bars) lives in PromptMix.tsx beside the hub chart.

import {
  GUIDE_COPY,
  MEASUREMENT_STAGES,
  PROMPT_GUIDE_ICONS,
  ROLLOUT_PLAN,
  type PromptGuide,
} from "@/lib/prompt-guides";
import { IconShapes } from "./GuideIcon";
import { INK } from "./use-colors";
import { Figure, Responsive, TextLines, charsFor, wrapText } from "./svg";
import pg from "./prompt-guides.module.css";

const quote = (s: string) => `“${s}”`;

export function GuideIconPanel({ id, guide, index, count }: { id: string; guide: PromptGuide; index: number; count: number }) {
  return (
    <div className={pg.iconPanel}>
      <Figure
        id={id}
        title={`${guide.name} guide icon`}
        desc={`The ${guide.name} icon, guide ${index + 1} of ${count} in the industry prompt setup guides.`}
        width={220}
        height={220}
        className={pg.figPanel}
      >
        <rect x={0.5} y={0.5} width={219} height={219} rx={28} className={pg.svgBg} />
        <circle cx={110} cy={110} r={62} className={pg.svgGoldFill} fillOpacity={0.08} />
        {[92, 70, 48].map((r) => (
          <circle key={r} cx={110} cy={110} r={r} className={pg.svgLine} strokeOpacity={0.7} />
        ))}
        {/* No caption: the panel shrinks to 120px on phones, where any label
            here would print at ~6px. "Guide n of N" is in the <desc>. */}
        <g
          transform="translate(50 50) scale(5)"
          className={pg.svgGoldStroke}
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <IconShapes shapes={PROMPT_GUIDE_ICONS[guide.icon]} />
        </g>
      </Figure>
    </div>
  );
}

export function RefinementDiagram({ id, guide }: { id: string; guide: PromptGuide }) {
  const R = GUIDE_COPY.refinement;
  const adds = R.additions;
  const title = "From a broad prompt to a decision-ready one";
  const desc = `Before: ${quote(guide.refinement.before)} Add ${adds.map((a) => `${a.label} (${a.question})`).join(", ")}. After: ${quote(guide.refinement.after)}`;

  // ── wide: three columns ──
  const colW = 250, midX = 300, midW = 360, afterX = 710, top = 26;
  const afterLines = wrapText(quote(guide.refinement.after), charsFor(colW - 32, 14));
  const beforeLines = wrapText(quote(guide.refinement.before), charsFor(colW - 32, 16));
  const chipsH = adds.length * 46 + (adds.length - 1) * 10;
  const boxH = Math.max(chipsH, 34 + afterLines.length * 20, 40 + beforeLines.length * 22);
  const cy = top + boxH / 2;
  const chip0 = top + (boxH - chipsH) / 2;
  const wide = (
    <Figure id={`${id}-w`} title={title} desc={desc} width={960} height={top + boxH + 2}>
      <text x={0} y={14} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>{R.beforeLabel.toUpperCase()}</text>
      <text x={midX} y={14} fontSize={11} className={`${pg.svgGold} ${pg.svgMono}`}>{R.arrow.toUpperCase()}</text>
      <text x={afterX} y={14} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>{R.afterLabel.toUpperCase()}</text>
      <rect x={0.5} y={top} width={colW - 1} height={boxH} rx={14} className={pg.svgBg} />
      <TextLines
        x={colW / 2}
        y={cy - ((beforeLines.length - 1) * 22) / 2 + 6}
        lines={beforeLines}
        lineHeight={22}
        fontSize={16}
        className={pg.svgMuted}
        anchor="middle"
      />
      <path d={`M${colW + 6} ${cy} h${midX - colW - 22}`} className={pg.svgGoldStroke} strokeWidth={1.6} />
      <path d={`M${midX - 14} ${cy - 5} l7 5 -7 5z`} className={pg.svgGoldFill} />
      {adds.map((a, i) => {
        const y = chip0 + i * 56;
        return (
          <g key={a.label}>
            <rect x={midX + 0.5} y={y} width={midW - 1} height={46} rx={10} className={pg.svgBg2} />
            <text x={midX + 16} y={y + 28} fontSize={12} className={`${pg.svgGold} ${pg.svgMono}`}>{`0${i + 1}`}</text>
            <text x={midX + 48} y={y + 28.5} fontSize={15} fontWeight={650} className={pg.svgText}>{a.label}</text>
            <text x={midX + 150} y={y + 28} fontSize={13} className={pg.svgMuted}>{a.question}</text>
          </g>
        );
      })}
      <path d={`M${midX + midW + 6} ${cy} h${afterX - midX - midW - 22}`} className={pg.svgGoldStroke} strokeWidth={1.6} />
      <path d={`M${afterX - 14} ${cy - 5} l7 5 -7 5z`} className={pg.svgGoldFill} />
      <rect x={afterX + 0.5} y={top} width={colW - 1} height={boxH} rx={14} className={pg.svgEmph} />
      <TextLines x={afterX + 16} y={top + 28} lines={afterLines} lineHeight={20} fontSize={14} className={pg.svgText} />
    </Figure>
  );

  // ── narrow: stacked ──
  const NW = 340;
  const nBefore = wrapText(quote(guide.refinement.before), charsFor(NW - 32, 15));
  const nAfter = wrapText(quote(guide.refinement.after), charsFor(NW - 32, 14));
  const beforeTop = 22;
  const beforeH = 22 + nBefore.length * 22;
  const addLabelY = beforeTop + beforeH + 34;
  const chipTop = addLabelY + 12;
  const nChipsH = adds.length * 40 + (adds.length - 1) * 8;
  const afterLabelY = chipTop + nChipsH + 36;
  const afterTop = afterLabelY + 10;
  const afterH = 24 + nAfter.length * 20;
  const narrow = (
    <Figure id={`${id}-n`} title={title} desc={desc} width={NW} height={afterTop + afterH + 2}>
      <text x={0} y={12} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>{R.beforeLabel.toUpperCase()}</text>
      <rect x={0.5} y={beforeTop} width={NW - 1} height={beforeH} rx={12} className={pg.svgBg} />
      <TextLines x={16} y={beforeTop + 26} lines={nBefore} lineHeight={22} fontSize={15} className={pg.svgMuted} />
      <path d={`M${NW / 2} ${beforeTop + beforeH + 4} v12`} className={pg.svgGoldStroke} strokeWidth={1.6} />
      <text x={0} y={addLabelY} fontSize={11} className={`${pg.svgGold} ${pg.svgMono}`}>{R.arrow.toUpperCase()}</text>
      {adds.map((a, i) => {
        const y = chipTop + i * 48;
        return (
          <g key={a.label}>
            <rect x={0.5} y={y} width={NW - 1} height={40} rx={10} className={pg.svgBg2} />
            <text x={12} y={y + 25} fontSize={11.5} className={`${pg.svgGold} ${pg.svgMono}`}>{`0${i + 1}`}</text>
            <text x={38} y={y + 25.5} fontSize={14} fontWeight={650} className={pg.svgText}>{a.label}</text>
            <text x={130} y={y + 25} fontSize={12.5} className={pg.svgMuted}>{a.question}</text>
          </g>
        );
      })}
      <path d={`M${NW / 2} ${chipTop + nChipsH + 4} v12`} className={pg.svgGoldStroke} strokeWidth={1.6} />
      <text x={0} y={afterLabelY} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>{R.afterLabel.toUpperCase()}</text>
      <rect x={0.5} y={afterTop} width={NW - 1} height={afterH} rx={12} className={pg.svgEmph} />
      <TextLines x={16} y={afterTop + 26} lines={nAfter} lineHeight={20} fontSize={14} className={pg.svgText} />
    </Figure>
  );

  return (
    <div className={pg.figBlock}>
      <Responsive wide={wide} narrow={narrow} />
    </div>
  );
}

/** G4. Stage names only: there is no data behind this, and it must not look as if there were. */
export function MeasurementFunnel({ id }: { id: string }) {
  const W = 360, h = 46, step = 52, top = 340, shrink = 44;
  const stages = MEASUREMENT_STAGES;
  return (
    <div className={pg.figBlock}>
      <Figure
        id={id}
        title="What the scorecard separates"
        desc={`Four review stages, each a stricter test than the last: ${stages.join(", then ")}. Stage names only — no measured values.`}
        width={W}
        height={stages.length * step}
        className={pg.figFunnel}
      >
        {stages.map((s, i) => {
          const a = top - i * shrink;
          const b = top - (i + 1) * shrink;
          const y = i * step + 1;
          const c = W / 2;
          return (
            <g key={s}>
              <path d={`M${c - a / 2} ${y}H${c + a / 2}L${c + b / 2} ${y + h}H${c - b / 2}Z`} className={pg.svgEmph} strokeLinejoin="round" />
              <text x={c} y={y + h / 2 + 5} fontSize={15} fontWeight={620} className={pg.svgText} textAnchor="middle">
                {s}
              </text>
            </g>
          );
        })}
      </Figure>
    </div>
  );
}

export function RolloutTimeline({ id }: { id: string }) {
  const plan = ROLLOUT_PLAN;
  const [focusL, delivL] = ["Focus", "Deliverable"].map((s) => s.toUpperCase());
  const title = "A 30-day rollout, week by week";
  const desc = plan.map((p) => `${p.when}: ${p.focus} Deliverable: ${p.deliverable}`).join(" ");

  // ── wide: a horizontal line with four nodes ──
  const W = 960, colW = 216, lh = 18, fs = 13;
  const cx = (i: number) => 120 + i * 240;
  const focus = plan.map((p) => wrapText(p.focus, charsFor(colW, fs)));
  const deliv = plan.map((p) => wrapText(p.deliverable, charsFor(colW, fs)));
  const yD = 106 + (Math.max(...focus.map((l) => l.length)) - 1) * lh + 30;
  const wideH = yD + 18 + (Math.max(...deliv.map((l) => l.length)) - 1) * lh + 12;
  const wide = (
    <Figure id={`${id}-w`} title={title} desc={desc} width={W} height={wideH}>
      <path d={`M${cx(0)} 24H${cx(plan.length - 1)}`} className={pg.svgGoldStroke} strokeWidth={2} />
      {plan.map((p, i) => {
        const x0 = cx(i) - colW / 2;
        return (
          <g key={p.when}>
            <circle cx={cx(i)} cy={24} r={12} className={pg.svgGoldFill} />
            <text x={cx(i)} y={28.5} fontSize={12} fontWeight={700} fill={INK} textAnchor="middle">{i + 1}</text>
            <text x={x0} y={64} fontSize={15} fontWeight={650} className={pg.svgGold}>{p.when}</text>
            <text x={x0} y={88} fontSize={10.5} className={`${pg.svgFaint} ${pg.svgMono}`}>{focusL}</text>
            <TextLines x={x0} y={106} lines={focus[i]} lineHeight={lh} fontSize={fs} className={pg.svgMuted} />
            <text x={x0} y={yD} fontSize={10.5} className={`${pg.svgFaint} ${pg.svgMono}`}>{delivL}</text>
            <TextLines x={x0} y={yD + 18} lines={deliv[i]} lineHeight={lh} fontSize={fs} className={pg.svgText} weight={600} />
          </g>
        );
      })}
    </Figure>
  );

  // ── narrow: a vertical line, one block per week ──
  const NW = 340, tx = 38, gap = 20;
  const nFocus = plan.map((p) => wrapText(p.focus, charsFor(NW - tx, fs)));
  const nDeliv = plan.map((p) => wrapText(p.deliverable, charsFor(NW - tx, fs)));
  const blockH = plan.map((_, i) => 56 + (nFocus[i].length - 1) * lh + 28 + nDeliv[i].length * lh);
  const tops = blockH.map((_, i) => blockH.slice(0, i).reduce((a, h) => a + h + gap, 0));
  const narrowH = tops[tops.length - 1] + blockH[blockH.length - 1] + 4;
  const narrow = (
    <Figure id={`${id}-n`} title={title} desc={desc} width={NW} height={narrowH}>
      <path d={`M12 12V${tops[tops.length - 1] + 12}`} className={pg.svgGoldStroke} strokeWidth={2} />
      {plan.map((p, i) => {
        const y = tops[i];
        const dY = y + 56 + (nFocus[i].length - 1) * lh + 26;
        return (
          <g key={p.when}>
            <circle cx={12} cy={y + 12} r={11} className={pg.svgGoldFill} />
            <text x={12} y={y + 16.5} fontSize={11.5} fontWeight={700} fill={INK} textAnchor="middle">{i + 1}</text>
            <text x={tx} y={y + 17} fontSize={15} fontWeight={650} className={pg.svgGold}>{p.when}</text>
            <text x={tx} y={y + 38} fontSize={10.5} className={`${pg.svgFaint} ${pg.svgMono}`}>{focusL}</text>
            <TextLines x={tx} y={y + 56} lines={nFocus[i]} lineHeight={lh} fontSize={fs} className={pg.svgMuted} />
            <text x={tx} y={dY} fontSize={10.5} className={`${pg.svgFaint} ${pg.svgMono}`}>{delivL}</text>
            <TextLines x={tx} y={dY + 18} lines={nDeliv[i]} lineHeight={lh} fontSize={fs} className={pg.svgText} weight={600} />
          </g>
        );
      })}
    </Figure>
  );

  return (
    <div className={pg.figBlock}>
      <Responsive wide={wide} narrow={narrow} />
    </div>
  );
}
