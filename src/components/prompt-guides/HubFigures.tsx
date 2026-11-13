// H1 — the hub hero: buyer questions → an AI answer → the four signals reviewed.
// H2 — the four-step method as a connected flow.
// Both carry their full text in <desc>, and every label is drawn as text.

import { METHOD_STEPS, PROMPT_MODES } from "@/lib/prompt-guides";
import { INK } from "./use-colors";
import { Figure, Responsive, TextLines, charsFor, wrapText } from "./svg";
import pg from "./prompt-guides.module.css";

/** The four review signals the hero names. Labels only. */
const SIGNALS = ["Mention", "Recommendation", "Citation", "Accuracy"] as const;

function Check({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} l4 4 8-9`} className={pg.svgGreen} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
}

function AnswerLines({ x, y, widths }: { x: number; y: number; widths: readonly number[] }) {
  return (
    <g>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * 16} width={w} height={7} rx={3.5} className={pg.svgFaint} fillOpacity={0.35} />
      ))}
    </g>
  );
}

export function HubHero({ id }: { id: string }) {
  const questions = PROMPT_MODES.map((m) => m.title);
  const title = "From buyer questions to measured AI answers";
  const desc = `Buyer questions (${questions.join(", ")}) go to an AI assistant. Its answer is reviewed for four signals: ${SIGNALS.join(", ")}.`;

  // Wide: three columns.
  const bubbleY = [36, 108, 180];
  const chipY = [36, 88, 140, 192];
  const mid = 134;
  const wide = (
    <Figure id={`${id}-w`} title={title} desc={desc} width={560} height={240} className={pg.figHero}>
      <text x={0} y={18} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>BUYER QUESTIONS</text>
      <text x={215} y={18} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>AI ANSWER</text>
      <text x={390} y={18} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>WHAT YOU MEASURE</text>
      {questions.map((q, i) => {
        const y = bubbleY[i];
        return (
          <g key={q}>
            <rect x={0.5} y={y} width={169} height={52} rx={14} className={pg.svgBg} />
            <circle cx={25} cy={y + 26} r={11} className={pg.svgGoldFill} />
            <text x={25} y={y + 31} fontSize={14} fontWeight={700} fill={INK} textAnchor="middle">?</text>
            <text x={46} y={y + 32} fontSize={17} className={pg.svgText}>{q}</text>
            <path d={`M170 ${y + 26} C 192 ${y + 26}, 192 ${mid}, 212 ${mid}`} className={pg.svgGoldStroke} strokeWidth={1.5} />
          </g>
        );
      })}
      <rect x={215} y={36} width={130} height={196} rx={16} className={pg.svgEmph} />
      <path d="M241 66l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className={pg.svgGoldFill} />
      <AnswerLines x={233} y={102} widths={[94, 72, 90, 60, 84, 70]} />
      {SIGNALS.map((s, i) => {
        const y = chipY[i];
        return (
          <g key={s}>
            <path d={`M345 ${mid} C 368 ${mid}, 368 ${y + 20}, 388 ${y + 20}`} className={pg.svgGoldStroke} strokeWidth={1.5} />
            <rect x={390.5} y={y} width={169} height={40} rx={12} className={pg.svgBg} />
            <Check x={405} y={y + 20} />
            <text x={427} y={y + 25.5} fontSize={15} className={pg.svgText}>{s}</text>
          </g>
        );
      })}
    </Figure>
  );

  // Narrow: stacked.
  const narrow = (
    <Figure id={`${id}-n`} title={title} desc={desc} width={340} height={306} className={pg.figHero}>
      <text x={0} y={14} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>BUYER QUESTIONS</text>
      {questions.map((q, i) => (
        <g key={q}>
          <rect x={i * 118 + 0.5} y={24} width={103} height={44} rx={12} className={pg.svgBg} />
          <text x={i * 118 + 52} y={51} fontSize={14} className={pg.svgText} textAnchor="middle">{q}</text>
        </g>
      ))}
      <path d="M170 72v22" className={pg.svgGoldStroke} strokeWidth={1.5} />
      <circle cx={170} cy={96} r={3} className={pg.svgGoldFill} />
      <rect x={0.5} y={100} width={339} height={64} rx={14} className={pg.svgEmph} />
      <text x={16} y={122} fontSize={11} className={`${pg.svgGold} ${pg.svgMono}`}>AI ANSWER</text>
      <AnswerLines x={16} y={134} widths={[240, 180]} />
      <path d="M170 168v22" className={pg.svgGoldStroke} strokeWidth={1.5} />
      <circle cx={170} cy={192} r={3} className={pg.svgGoldFill} />
      <text x={0} y={212} fontSize={11} className={`${pg.svgFaint} ${pg.svgMono}`}>WHAT YOU MEASURE</text>
      {SIGNALS.map((s, i) => {
        const x = (i % 2) * 176;
        const y = 222 + Math.floor(i / 2) * 44;
        return (
          <g key={s}>
            <rect x={x + 0.5} y={y} width={163} height={38} rx={10} className={pg.svgBg} />
            <Check x={x + 13} y={y + 19} />
            <text x={x + 34} y={y + 24} fontSize={14} className={pg.svgText}>{s}</text>
          </g>
        );
      })}
    </Figure>
  );

  return <Responsive wide={wide} narrow={narrow} />;
}

export function MethodFlow({ id }: { id: string }) {
  const title = "The four-step method";
  const desc = METHOD_STEPS.map((s) => `${s.num} ${s.verb}: ${s.title}. ${s.body}`).join(" ");

  // Wide: four nodes in a row, arrows between them.
  const nodeW = 204, gap = 48, bodyFs = 13, lh = 18;
  const wideLines = METHOD_STEPS.map((s) => wrapText(s.body, charsFor(nodeW - 36, bodyFs)));
  const nodeH = 86 + (Math.max(...wideLines.map((l) => l.length)) - 1) * lh + 22;
  const wide = (
    <Figure id={`${id}-w`} title={title} desc={desc} width={4 * nodeW + 3 * gap} height={nodeH + 2} className={pg.figFlow}>
      {METHOD_STEPS.map((s, i) => {
        const x = i * (nodeW + gap);
        return (
          <g key={s.num}>
            <rect x={x + 0.5} y={1} width={nodeW - 1} height={nodeH} rx={14} className={pg.svgBg} />
            <text x={x + 18} y={32} fontSize={12} className={`${pg.svgGold} ${pg.svgMono}`}>{`${s.num} / ${s.verb.toUpperCase()}`}</text>
            <text x={x + 18} y={60} fontSize={17} fontWeight={650} className={pg.svgText}>{s.title}</text>
            <TextLines x={x + 18} y={86} lines={wideLines[i]} lineHeight={lh} fontSize={bodyFs} className={pg.svgMuted} />
            {i < METHOD_STEPS.length - 1 && (
              <g>
                <path d={`M${x + nodeW + 8} ${nodeH / 2} h${gap - 22}`} className={pg.svgGoldStroke} strokeWidth={1.6} />
                <path d={`M${x + nodeW + gap - 14} ${nodeH / 2 - 5} l7 5 -7 5z`} className={pg.svgGoldFill} />
              </g>
            )}
          </g>
        );
      })}
    </Figure>
  );

  // Narrow: the same nodes stacked, arrows pointing down.
  const NW = 340, nGap = 30;
  const narrowLines = METHOD_STEPS.map((s) => wrapText(s.body, charsFor(NW - 36, bodyFs)));
  const heights = narrowLines.map((l) => 78 + (l.length - 1) * lh + 18);
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, h) => a + h + nGap, 0));
  const narrowH = tops[tops.length - 1] + heights[heights.length - 1] + 2;
  const narrow = (
    <Figure id={`${id}-n`} title={title} desc={desc} width={NW} height={narrowH} className={pg.figFlow}>
      {METHOD_STEPS.map((s, i) => {
        const y = tops[i] + 1;
        return (
          <g key={s.num}>
            <rect x={0.5} y={y} width={NW - 1} height={heights[i]} rx={14} className={pg.svgBg} />
            <text x={18} y={y + 28} fontSize={12} className={`${pg.svgGold} ${pg.svgMono}`}>{`${s.num} / ${s.verb.toUpperCase()}`}</text>
            <text x={18} y={y + 54} fontSize={16} fontWeight={650} className={pg.svgText}>{s.title}</text>
            <TextLines x={18} y={y + 78} lines={narrowLines[i]} lineHeight={lh} fontSize={bodyFs} className={pg.svgMuted} />
            {i < METHOD_STEPS.length - 1 && (
              <g>
                <path d={`M${NW / 2} ${y + heights[i] + 5} v${nGap - 16}`} className={pg.svgGoldStroke} strokeWidth={1.6} />
                <path d={`M${NW / 2 - 5} ${y + heights[i] + nGap - 11} l5 7 5-7z`} className={pg.svgGoldFill} />
              </g>
            )}
          </g>
        );
      })}
    </Figure>
  );

  return <Responsive wide={wide} narrow={narrow} />;
}
