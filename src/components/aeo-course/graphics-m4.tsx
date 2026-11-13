// Module 4 graphics: the reputation evidence map (lesson 9) and the three
// rings of earned evidence (lesson 10).

import { A, delay } from "./anim";
import { Figure } from "./Figure";
import css from "./aeo.module.css";

const NODES = [
  { label: "Map profile", x: 200, y: 34 },
  { label: "Review site", x: 336, y: 92 },
  { label: "Directory", x: 336, y: 196, inconsistent: true },
  { label: "Your site", x: 200, y: 252 },
  { label: "Social profile", x: 64, y: 196 },
  { label: "Industry listing", x: 64, y: 92 },
];

/**
 * Lesson 9. The brand at the centre, the places evidence lives around it. Lines
 * draw in and nodes pulse once; the directory with the wrong hours shows a
 * warning, which then resolves to a check. The warning's resting opacity is 0
 * and the check's is 1, so the final (and no-JS) state is the resolved one.
 */
export function EvidenceMap() {
  const c = { x: 200, y: 144 };
  return (
    <Figure
      id="g-evidence-map"
      title="Your brand's evidence map"
      desc={`Your brand in the centre, linked to the places evidence about it lives: ${NODES.map((n) => n.label).join(", ")}. One directory lists outdated hours; once corrected, every profile matches the source-of-truth record.`}
      width={400}
      height={280}
    >
      {NODES.map((n, i) => (
        <path key={`l${n.label}`} d={`M${c.x} ${c.y}L${n.x} ${n.y}`} pathLength={1} className={`${css.svgGoldStroke} ${A.draw}`} strokeWidth={1.4} style={delay(0.1 + i * 0.12)} />
      ))}
      <g className={A.pop} style={delay(0)}>
        <circle cx={c.x} cy={c.y} r={38} className={css.svgEmph} />
        <text x={c.x} y={c.y - 2} fontSize={13.5} fontWeight={650} className={css.svgText} textAnchor="middle">Your</text>
        <text x={c.x} y={c.y + 15} fontSize={13.5} fontWeight={650} className={css.svgText} textAnchor="middle">brand</text>
      </g>
      {NODES.map((n, i) => (
        <g key={n.label}>
          <g className={A.pulse} style={delay(0.9 + i * 0.1)}>
            <rect x={n.x - 60} y={n.y - 15} width={120} height={30} rx={15} className={css.svgBg2} />
            <text x={n.x} y={n.y + 4.5} fontSize={12.5} className={css.svgText} textAnchor="middle">{n.label}</text>
          </g>
          {n.inconsistent && (
            <>
              <g className={A.warn} style={delay(1.6)} opacity={0}>
                <rect x={n.x - 63} y={n.y - 18} width={126} height={36} rx={18} className={css.svgRedStroke} strokeWidth={2} />
                <circle cx={n.x + 62} cy={n.y - 16} r={9} className={css.svgRedFill} />
                <text x={n.x + 62} y={n.y - 12} fontSize={12} fontWeight={800} fill="#181A20" textAnchor="middle">!</text>
                <text x={n.x} y={n.y + 34} fontSize={12} className={css.svgRed} textAnchor="middle">old hours</text>
              </g>
              <g className={A.pop} style={delay(4.0)}>
                <circle cx={n.x + 62} cy={n.y - 16} r={9} className={css.svgGreenFill} />
                <path d={`M${n.x + 57.5} ${n.y - 16}l3 3 6-6.5`} stroke="#181A20" strokeWidth={2} fill="none" strokeLinecap="round" />
                <text x={n.x} y={n.y + 34} fontSize={12} className={css.svgGreen} textAnchor="middle">hours fixed</text>
              </g>
            </>
          )}
        </g>
      ))}
    </Figure>
  );
}

const RINGS = [
  { r: 52, name: "OWNED", items: [{ t: "Site", a: -90 }, { t: "Profiles", a: 90 }] },
  { r: 94, name: "EARNED", items: [{ t: "Press", a: -40 }, { t: "Comparisons", a: 20 }, { t: "Partners", a: 160 }] },
  { r: 134, name: "COMMUNITY", items: [{ t: "Forums", a: -20 }, { t: "Q&A", a: 62 }, { t: "Video", a: 200 }] },
];

/** Lesson 10. Owned, earned and community evidence as three rings, drawn outward. */
export function EarnedRings() {
  const c = { x: 200, y: 148 };
  const rad = (d: number) => (d * Math.PI) / 180;
  return (
    <Figure
      id="g-earned-rings"
      title="Three rings of evidence"
      desc={`Owned evidence at the centre (${RINGS[0].items.map((i) => i.t).join(", ")}), earned evidence around it (${RINGS[1].items.map((i) => i.t).join(", ")}) and community evidence on the outside (${RINGS[2].items.map((i) => i.t).join(", ")}). Assistants look for agreement across all three.`}
      width={400}
      height={296}
    >
      {RINGS.map((ring, i) => (
        <g key={ring.name}>
          <circle cx={c.x} cy={c.y} r={ring.r} pathLength={1} className={`${i === 0 ? css.svgGoldStroke : css.svgGoldStroke} ${A.draw}`} strokeWidth={i === 0 ? 2.4 : 1.6} strokeOpacity={1 - i * 0.25} style={delay(i * 0.45)} />
          <text x={c.x} y={c.y - ring.r + 16} fontSize={12} className={`${css.svgGold} ${css.svgMono} ${A.fade}`} textAnchor="middle" style={delay(0.3 + i * 0.45)}>{ring.name}</text>
          {ring.items.map((it, j) => {
            const x = c.x + ring.r * Math.cos(rad(it.a));
            const y = c.y + ring.r * Math.sin(rad(it.a));
            const w = it.t.length * 7.2 + 18;
            return (
              <g key={it.t} className={A.pop} style={delay(0.5 + i * 0.45 + j * 0.1)}>
                <rect x={x - w / 2} y={y - 12} width={w} height={24} rx={12} className={css.svgBg2} />
                <text x={x} y={y + 4.5} fontSize={12.5} className={css.svgText} textAnchor="middle">{it.t}</text>
              </g>
            );
          })}
        </g>
      ))}
    </Figure>
  );
}
