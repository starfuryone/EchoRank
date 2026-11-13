// H3 (hub) and G2 (guide): how example prompts split by use. Every number is
// computed from src/lib/prompt-guides.ts at render time; nothing is typed.

import { PROMPT_USES, type PromptUse } from "@/lib/prompt-guides";
import { CountPill, Figure, Responsive, UsePatterns, UseSwatch, patternId } from "./svg";
import pg from "./prompt-guides.module.css";

export interface MixRow {
  name: string;
  counts: Record<PromptUse, number>;
}

const total = (c: Record<PromptUse, number>) => PROMPT_USES.reduce((n, u) => n + c[u], 0);

function describe(rows: readonly MixRow[]): string {
  return rows
    .map((r) => `${r.name}: ${PROMPT_USES.filter((u) => r.counts[u] > 0).map((u) => `${u} ${r.counts[u]}`).join(", ")}.`)
    .join(" ");
}

/** One bar's segments, left to right in PROMPT_USES order. */
function Segments({ x, y, h, unit, counts, prefix }: { x: number; y: number; h: number; unit: number; counts: Record<PromptUse, number>; prefix: string }) {
  const segs: { u: PromptUse; x: number; w: number }[] = [];
  for (const u of PROMPT_USES) {
    if (counts[u] === 0) continue;
    const prev = segs[segs.length - 1];
    segs.push({ u, x: prev ? prev.x + prev.w : x, w: counts[u] * unit });
  }
  return (
    <g>
      {segs.map(({ u, x: sx, w }) => (
        <g key={u}>
          <rect x={sx} y={y} width={w} height={h} fill={`url(#${patternId(prefix, u)})`} className={pg.svgSeg} />
          {w >= 18 && <CountPill x={sx + w / 2} y={y} h={h} use={u} value={counts[u]} />}
        </g>
      ))}
    </g>
  );
}

/** H3 — a stacked bar per industry. */
export function PromptMixChart({ id, rows }: { id: string; rows: readonly MixRow[] }) {
  const max = Math.max(...rows.map((r) => total(r.counts)));
  const title = "Prompt mix by industry";
  const desc = `Stacked bars, one per industry guide, splitting its example prompts by use. ${describe(rows)}`;

  // Wide: label column on the left.
  const W = 760, labelW = 206, barX = 216, barW = W - barX - 4, rowH = 32, barH = 20;
  const wideH = rows.length * rowH + 4;
  const wide = (
    <Figure id={`${id}-w`} title={title} desc={desc} width={W} height={wideH} className={pg.figMix}>
      <UsePatterns prefix={`${id}-w`} />
      {rows.map((r, i) => {
        const y = 4 + i * rowH;
        return (
          <g key={r.name}>
            <text x={labelW} y={y + barH / 2 + 4.5} fontSize={13} className={pg.svgText} textAnchor="end">
              {r.name}
            </text>
            <Segments x={barX} y={y} h={barH} unit={barW / max} counts={r.counts} prefix={`${id}-w`} />
          </g>
        );
      })}
    </Figure>
  );

  // Narrow: the name above its bar, bar at full width.
  const NW = 340, nRowH = 46, nBarH = 20;
  const narrowH = rows.length * nRowH + 2;
  const narrow = (
    <Figure id={`${id}-n`} title={title} desc={desc} width={NW} height={narrowH} className={pg.figMix}>
      <UsePatterns prefix={`${id}-n`} />
      {rows.map((r, i) => {
        const y = i * nRowH;
        return (
          <g key={r.name}>
            <text x={0} y={y + 14} fontSize={13} className={pg.svgText}>
              {r.name}
            </text>
            <Segments x={0} y={y + 20} h={nBarH} unit={NW / max} counts={r.counts} prefix={`${id}-n`} />
          </g>
        );
      })}
    </Figure>
  );

  return (
    <div className={pg.figBlock}>
      <Responsive wide={wide} narrow={narrow} />
      <MixLegend prefix={`${id}-lg`} />
    </div>
  );
}

/** The legend shared by H3 and the H5 table: swatch + name, in PROMPT_USES order. */
export function MixLegend({ prefix }: { prefix: string }) {
  return (
    <ul className={pg.legend} aria-label="Prompt uses">
      {PROMPT_USES.map((u, i) => (
        <li key={u}>
          <UseSwatch use={u} prefix={`${prefix}-${i}`} />
          {u}
        </li>
      ))}
    </ul>
  );
}

/** G2 — one guide's prompts by use: a bar per use, every count printed. */
export function GuideMixBars({ id, name, counts }: { id: string; name: string; counts: Record<PromptUse, number> }) {
  const W = 360, labelW = 94, barX = 102, rowH = 28, barH = 18;
  const max = Math.max(1, ...PROMPT_USES.map((u) => counts[u]));
  const unit = (W - barX - 30) / max;
  const H = PROMPT_USES.length * rowH;
  const n = total(counts);
  const desc = `${name}: ${n} example prompts by use. ${PROMPT_USES.map((u) => `${u} ${counts[u]}`).join(", ")}.`;
  return (
    <div className={pg.figBlock}>
      <Figure id={id} title={`${name} prompt mix`} desc={desc} width={W} height={H} className={pg.figBars}>
        <UsePatterns prefix={id} />
        {PROMPT_USES.map((u, i) => {
          const y = i * rowH + 4;
          const w = counts[u] * unit;
          return (
            <g key={u}>
              <text x={labelW} y={y + barH / 2 + 4.5} fontSize={13} className={pg.svgText} textAnchor="end">
                {u}
              </text>
              {w > 0 && <rect x={barX} y={y} width={w} height={barH} rx={3} fill={`url(#${patternId(id, u)})`} className={pg.svgSeg} />}
              <text x={barX + w + 7} y={y + barH / 2 + 4.5} fontSize={13} fontWeight={650} className={w > 0 ? pg.svgText : pg.svgFaint}>
                {counts[u]}
              </text>
            </g>
          );
        })}
      </Figure>
    </div>
  );
}
