// Module 3 graphics: what you see vs what a crawler gets (lesson 6), the
// crawler gate (lesson 7) and the anatomy of an answer-ready page (lesson 8).

import { aeoLessonBySlug } from "@/lib/aeo-course";
import { A, delay } from "./anim";
import { Figure, Lines, wrap } from "./Figure";
import { WipeSlider } from "./WipeSlider";
import css from "./aeo.module.css";

const W = 400, H = 250;

/** The page as a browser renders it: plans, a hero image, hours in a picture. */
function RenderedPage() {
  return (
    <svg className={css.fig} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} className={css.svgBg} />
      <rect x={16} y={16} width={150} height={14} rx={4} className={css.svgText} fillOpacity={0.9} />
      <text x={16} y={52} fontSize={13} className={css.svgMuted}>Plans for small sales teams</text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={16 + i * 124} y={64} width={114} height={92} rx={10} className={i === 1 ? css.svgEmph : css.svgBg2} />
          <text x={28 + i * 124} y={86} fontSize={13} fontWeight={650} className={css.svgText}>{["Starter", "Team", "Scale"][i]}</text>
          {[0, 1, 2].map((j) => (
            <rect key={j} x={28 + i * 124} y={100 + j * 14} width={80 - j * 12} height={6} rx={3} className={css.svgLineFill} />
          ))}
        </g>
      ))}
      <rect x={16} y={170} width={180} height={64} rx={10} className={css.svgBg2} />
      <path d="M30 222l26-26 18 16 14-10 26 20z" className={css.svgGoldFill} fillOpacity={0.6} />
      <text x={212} y={190} fontSize={12.5} className={css.svgMuted}>Opening hours (image)</text>
      {[0, 1, 2].map((j) => (
        <rect key={j} x={212} y={202 + j * 12} width={150 - j * 30} height={6} rx={3} className={css.svgLineFill} />
      ))}
    </svg>
  );
}

/** The same URL's raw HTML: a heading, an empty app container, a script, an image tag. */
function RawHtml() {
  const lines = [
    { t: "<h1>Pricing</h1>", c: css.svgText },
    { t: '<div id="app"></div>', c: css.svgRed },
    { t: '<script src="app.js"></script>', c: css.svgMuted },
    { t: '<img src="hours.png">', c: css.svgRed },
  ];
  return (
    <svg className={css.fig} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="g-crawler-view-t g-crawler-view-d" focusable="false">
      <title id="g-crawler-view-t">What you see, and what a crawler gets</title>
      <desc id="g-crawler-view-d">
        In the browser, the pricing page shows three plans and an image of the opening hours. The raw HTML a non-rendering crawler receives contains only the heading, an empty app container, a script tag and an image tag: no plans, no prices, no hours.
      </desc>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} className={css.svgBg2} />
      {lines.map((l, i) => (
        <text key={l.t} x={20} y={46 + i * 34} fontSize={14} className={`${l.c} ${css.svgMono}`}>{l.t}</text>
      ))}
      <text x={20} y={214} fontSize={12.5} className={css.svgFaint}>No plans, no prices, no hours</text>
    </svg>
  );
}

/** Lesson 6. The wipe: drag to compare the rendered page with the raw HTML. */
export function CrawlerView() {
  return (
    <figure className={css.figure} data-graphic="g-crawler-view">
      <WipeSlider
        under={<RawHtml />}
        over={<RenderedPage />}
        label="Drag to compare what you see with what a crawler gets"
        leftLabel="WHAT YOU SEE"
        rightLabel="WHAT A CRAWLER GETS"
      />
    </figure>
  );
}

/** Lesson 7's table, read from the config: the bots are the user agents the lesson names. */
function agents(): { name: string; purpose: string }[] {
  const t = aeoLessonBySlug("crawler-access")?.body.find((b) => b.k === "table");
  return t && t.k === "table" ? t.rows.filter((r) => r[0] !== "Google-Extended").map((r) => ({ name: r[0], purpose: r[2] })) : [];
}

/** Lesson 7. Bots arrive at the gate; search crawlers pass, training crawlers stop (the worked example's decision). */
export function CrawlerGate() {
  const bots = agents();
  const allowed = (name: string) => !/^(GPTBot|ClaudeBot)$/.test(name);
  const top = 50, rowH = 40, start = 104, gate = 236, inside = 330;
  const Hg = top + bots.length * rowH + 36;
  return (
    <Figure
      id="g-crawler-gate"
      title="AI crawlers at the gate"
      desc={`Each crawler arrives at the gate formed by robots.txt and the CDN. In the worked example, ${bots.filter((b) => allowed(b.name)).map((b) => b.name).join(", ")} are allowed through to the pages; ${bots.filter((b) => !allowed(b.name)).map((b) => b.name).join(" and ")} are stopped at the gate.`}
      width={400}
      height={Hg}
    >
      <rect x={gate - 6} y={top - 12} width={12} height={bots.length * rowH + 4} rx={4} className={css.svgBg2} />
      <text x={gate} y={14} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`} textAnchor="middle">ROBOTS.TXT</text>
      <text x={gate} y={29} fontSize={12} className={`${css.svgFaint} ${css.svgMono}`} textAnchor="middle">+ CDN</text>
      <rect x={300.5} y={top - 12} width={99} height={bots.length * rowH + 4} rx={10} className={css.svgEmph} />
      <text x={350} y={29} fontSize={12} className={`${css.svgGold} ${css.svgMono}`} textAnchor="middle">YOUR PAGES</text>
      {bots.map((b, i) => {
        const y = top + i * rowH + 8;
        const ok = allowed(b.name);
        const end = ok ? inside : gate - 22;
        return (
          <g key={b.name}>
            <text x={0} y={y + 4.5} fontSize={12.5} className={css.svgText}>{b.name}</text>
            <path d={`M${start} ${y}H${ok ? 384 : gate - 8}`} className={css.svgLine} strokeDasharray="3 4" />
            <g className={A.slide} style={delay(0.2 + i * 0.2, { "--from": `${start - end + 8}px` })}>
              <circle cx={end} cy={y} r={10} className={ok ? css.svgGreenFill : css.svgRedFill} />
              {ok ? (
                <path d={`M${end - 4.5} ${y}l3 3 6-6.5`} stroke="#181A20" strokeWidth={2} fill="none" strokeLinecap="round" />
              ) : (
                <path d={`M${end - 4} ${y - 4}l8 8m0-8l-8 8`} stroke="#181A20" strokeWidth={2} strokeLinecap="round" />
              )}
            </g>
          </g>
        );
      })}
      <circle cx={8} cy={Hg - 14} r={7} className={css.svgGreenFill} />
      <text x={20} y={Hg - 9.5} fontSize={12} className={css.svgMuted}>allowed (search)</text>
      <circle cx={146} cy={Hg - 14} r={7} className={css.svgRedFill} />
      <text x={158} y={Hg - 9.5} fontSize={12} className={css.svgMuted}>blocked (training)</text>
    </Figure>
  );
}

const PINS = [
  { y: 56, label: "Answer first", target: 56 },
  { y: 108, label: "Self-contained passages", target: 104 },
  { y: 160, label: "Real table, not an image", target: 160 },
  { y: 212, label: "FAQ that answers", target: 214 },
  { y: 262, label: "Dated facts", target: 266 },
];

/** Lesson 8. A page with its answer-ready parts pinned on in sequence. */
export function PageAnatomy() {
  return (
    <Figure
      id="g-page-anatomy"
      title="The anatomy of an answer-ready page"
      desc={`An answer-ready page, top to bottom: ${PINS.map((p) => p.label).join(", ")}.`}
      width={400}
      height={290}
    >
      <rect x={0.5} y={8} width={232} height={276} rx={12} className={css.svgBg} />
      <rect x={16} y={24} width={150} height={12} rx={4} className={css.svgText} fillOpacity={0.9} />
      <rect x={14} y={44} width={204} height={26} rx={6} className={css.svgEmph} />
      <rect x={24} y={53} width={170} height={7} rx={3.5} className={css.svgGoldFill} fillOpacity={0.8} />
      {[0, 1].map((k) => (
        <g key={k}>
          {[0, 1, 2].map((j) => (
            <rect key={j} x={16} y={84 + k * 26 + j * 7} width={196 - j * 30} height={4} rx={2} className={css.svgLineFill} />
          ))}
        </g>
      ))}
      <rect x={14} y={140} width={204} height={42} rx={4} className={css.svgBg2} />
      {[1, 2].map((r) => <path key={r} d={`M14 ${140 + r * 14}h204`} className={css.svgLine} />)}
      {[1, 2].map((c) => <path key={c} d={`M${14 + c * 68} 140v42`} className={css.svgLine} />)}
      {[0, 1].map((k) => (
        <g key={k}>
          <rect x={16} y={196 + k * 18} width={120} height={5} rx={2.5} className={css.svgText} fillOpacity={0.7} />
          <rect x={16} y={204 + k * 18} width={170} height={4} rx={2} className={css.svgLineFill} />
        </g>
      ))}
      <rect x={16} y={256} width={118} height={20} rx={10} className={css.svgBg2} />
      <text x={24} y={270} fontSize={12} className={`${css.svgMuted} ${css.svgMono}`}>Reviewed: Mar</text>
      {PINS.map((p, i) => {
        const lines = wrap(p.label, 17);
        return (
          <g key={p.label}>
            <path d={`M222 ${p.target}H252`} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={1.4} style={delay(0.2 + i * 0.35)} />
            <g className={A.pop} style={delay(0.35 + i * 0.35)}>
              <circle cx={222} cy={p.target} r={4} className={css.svgGoldFill} />
              <rect x={254} y={p.y - 16} width={146} height={lines.length > 1 ? 36 : 26} rx={8} className={css.svgBg2} />
              <Lines x={264} y={p.y + (lines.length > 1 ? -3 : 1)} lines={lines} lh={15} size={12.5} className={css.svgText} />
            </g>
          </g>
        );
      })}
    </Figure>
  );
}
