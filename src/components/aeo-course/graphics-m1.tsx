// Module 1 graphics: the results page vs the AI answer (lesson 1), the
// fan-out tree (lesson 2) and the engine matrix with its switcher (lesson 3).
// Server components; the switcher is the only client piece.

import { aeoLessonBySlug } from "@/lib/aeo-course";
import { A, delay } from "./anim";
import { EngineSwitcher, Glyph, type EnginePanel } from "./EngineSwitcher";
import { Figure, Lines, wrap } from "./Figure";
import css from "./aeo.module.css";

/** Lesson 1. Ten links collapse into one answer with three source chips. */
export function SerpVsAnswer() {
  const rows = Array.from({ length: 10 }, (_, i) => 68 + i * 20);
  const cardMid = 136;
  return (
    <Figure
      id="g-serp-vs-answer"
      title="A results page next to an AI answer"
      desc="Left: a classic results page, ten links for the searcher to choose from. Right: an AI answer, which reads sources on the searcher's behalf and returns one answer with three source links."
      width={400}
      height={280}
    >
      <text x={0} y={14} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>RESULTS PAGE</text>
      <text x={212} y={14} fontSize={12} className={`${css.svgGold} ${css.svgMono}`}>AI ANSWER</text>
      <rect x={0.5} y={24} width={187} height={252} rx={12} className={css.svgBg} />
      <rect x={12} y={36} width={164} height={20} rx={10} className={css.svgBg2} />
      {rows.map((y, i) => (
        <g key={y}>
          <rect x={14} y={y} width={130 - (i % 3) * 18} height={6} rx={3} className={css.svgGoldFill} fillOpacity={0.6} />
          <rect x={14} y={y + 9} width={100 - (i % 2) * 22} height={4} rx={2} className={css.svgLineFill} />
        </g>
      ))}
      <rect x={212.5} y={24} width={187} height={252} rx={12} className={css.svgBg} />
      <rect x={226} y={36} width={160} height={24} rx={12} className={css.svgBg2} />
      <text x={240} y={52.5} fontSize={12.5} className={css.svgMuted}>Your question</text>
      {/* The ghost rows: the ten links, collapsing into the answer. Invisible at rest. */}
      {rows.map((y, i) => (
        <g key={`g${y}`} className={`${css.ghostRow} ${A.collapse}`} style={delay(0.15 + i * 0.03, { "--to": `${cardMid - y}px` })}>
          <rect x={228} y={y} width={120 - (i % 3) * 16} height={6} rx={3} className={css.svgGoldFill} />
        </g>
      ))}
      <g className={A.fade} style={delay(0.9)}>
        <rect x={224} y={72} width={164} height={128} rx={10} className={css.svgEmph} />
        <text x={236} y={92} fontSize={12} className={`${css.svgGold} ${css.svgMono}`}>ANSWER</text>
        {[136, 120, 140, 96, 124].map((w, i) => (
          <rect key={i} x={236} y={104 + i * 16} width={w} height={6} rx={3} className={css.svgLineFill} />
        ))}
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className={A.pop} style={delay(1.3 + i * 0.15)}>
          <rect x={228 + i * 54} y={214} width={46} height={26} rx={13} className={css.svgBg2} stroke="var(--gold)" />
          <text x={251 + i * 54} y={231.5} fontSize={13} fontWeight={650} className={css.svgText} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      <text x={228} y={262} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>SOURCES</text>
    </Figure>
  );
}

/** Lesson 2. A prompt fans out into five sub-queries; sources light up; lines converge into the answer. */
export function FanOut() {
  const subs = ["Features", "Pricing", "Reviews", "Compare", "Near me"];
  const xs = subs.map((_, i) => 40 + i * 80);
  return (
    <Figure
      id="g-fan-out"
      title="One question fans out into several searches"
      desc={`A question branches into five narrower searches: ${subs.join(", ")}. Each search reads a few sources, and the results converge into one answer. A page only needs to win one branch to be part of the answer.`}
      width={400}
      height={300}
    >
      <rect x={100} y={8} width={200} height={34} rx={17} className={css.svgEmph} />
      <text x={200} y={30} fontSize={14} fontWeight={650} className={css.svgText} textAnchor="middle">Your question</text>
      {xs.map((x, i) => (
        <path key={`l${i}`} d={`M200 42 C 200 70, ${x} 70, ${x} 96`} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={1.5} style={delay(0.1 + i * 0.12)} />
      ))}
      <text x={0} y={92} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>SUB-QUESTIONS</text>
      {subs.map((s, i) => (
        <g key={s} className={A.fade} style={delay(0.5 + i * 0.1)}>
          <rect x={xs[i] - 36} y={98} width={72} height={30} rx={8} className={css.svgBg2} />
          <text x={xs[i]} y={117.5} fontSize={12.5} className={css.svgText} textAnchor="middle">{s}</text>
        </g>
      ))}
      <text x={0} y={160} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>SOURCES READ</text>
      {xs.map((x, i) =>
        [-11, 11].map((dx, j) => (
          <g key={`s${i}${j}`} className={A.pop} style={delay(1.0 + i * 0.08 + j * 0.04)}>
            <path d={`M${x} 128 L${x + dx} 166`} className={css.svgLine} />
            <rect x={x + dx - 8} y={166} width={16} height={20} rx={3} className={css.svgGoldFill} fillOpacity={0.85} />
            <path d={`M${x + dx - 4} ${173}h8M${x + dx - 4} ${178}h6`} stroke="#181A20" strokeWidth={1.2} />
          </g>
        )),
      )}
      {xs.map((x, i) => (
        <path key={`c${i}`} d={`M${x} 188 C ${x} 220, 200 214, 200 244`} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={1.5} style={delay(1.6 + i * 0.08)} />
      ))}
      <g className={A.pop} style={delay(2.2)}>
        <rect x={90} y={244} width={220} height={36} rx={10} className={css.svgEmph} />
        <text x={200} y={267} fontSize={14} fontWeight={650} className={css.svgText} textAnchor="middle">One answer</text>
      </g>
    </Figure>
  );
}

/** Lesson 3's table, read from the config so the matrix and the table cannot disagree. */
function engineRows(): string[][] {
  const t = aeoLessonBySlug("engines-compared")?.body.find((b) => b.k === "table");
  return t && t.k === "table" ? t.rows : [];
}

/** "Yes…" is a full mark; anything conditional is a half mark. Text says it too. */
const full = (v: string) => /^yes/i.test(v);

export function EngineMatrix() {
  const rows = engineRows();
  const rowH = 40;
  const top = 34;
  const H = top + rows.length * rowH + 30;
  const panels: EnginePanel[] = rows.map((r, i) => ({
    name: r[0],
    glyph: i,
    rows: [
      { label: "Shows citations?", value: r[1] },
      { label: "Typical use", value: r[2] },
      { label: "What to check first", value: r[3] },
    ],
  }));
  return (
    <>
      <Figure
        id="g-engine-matrix"
        title="Answer engines and how they show sources"
        desc={`${rows.map((r) => `${r[0]}: ${r[1]}`).join(". ")}. Qualitative, at the time of writing; check each engine yourself.`}
        width={400}
        height={H}
      >
        <text x={44} y={18} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>ENGINE</text>
        <text x={250} y={18} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`}>SHOWS SOURCES?</text>
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const name = wrap(r[0], 26);
          return (
            <g key={r[0]} className={A.fade} style={delay(0.1 + i * 0.12)}>
              <rect x={0.5} y={y} width={399} height={rowH - 6} rx={8} className={css.svgBg} />
              <g transform={`translate(10 ${y + 5})`} className={css.svgGold} style={{ color: "var(--goldText)" }}>
                <Glyph i={i} size={24} />
              </g>
              <Lines x={44} y={name.length > 1 ? y + 14 : y + 22} lines={name} lh={14} size={13} className={css.svgText} />
              <circle cx={258} cy={y + 17} r={7} className={css.svgGoldStroke} strokeWidth={1.6} />
              {full(r[1]) ? (
                <circle cx={258} cy={y + 17} r={7} className={css.svgGoldFill} />
              ) : (
                <path d={`M258 ${y + 10} a7 7 0 0 0 0 14z`} className={css.svgGoldFill} />
              )}
              {(() => {
                const v = wrap(r[1], 19);
                return <Lines x={272} y={v.length > 1 ? y + 14 : y + 21.5} lines={v} lh={13} size={12} className={css.svgMuted} />;
              })()}
            </g>
          );
        })}
        <circle cx={10} cy={H - 12} r={6} className={css.svgGoldFill} />
        <text x={22} y={H - 8} fontSize={12} className={css.svgMuted}>shows sources</text>
        <circle cx={130} cy={H - 12} r={6} className={css.svgGoldStroke} strokeWidth={1.6} />
        <path d={`M130 ${H - 18} a6 6 0 0 0 0 12z`} className={css.svgGoldFill} />
        <text x={142} y={H - 8} fontSize={12} className={css.svgMuted}>sometimes, or under conditions</text>
      </Figure>
      <EngineSwitcher panels={panels} label="Answer engines" />
    </>
  );
}
