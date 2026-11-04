// Guide 4 — how-to-audit-a-site-migration. Diagrams 4a, 4b, 4c
// (NOSY-BAT-GUIDES.md).
//
// 4c DRAWS THE MAPPING THE WAY THE PRODUCT APPLIES IT. Compare rewrites the
// OTHER crawl's URLs (src/lib/site-crawler/compare.ts: "B's URLs mapped
// first"), so on the staging crawl, with the production baseline under
// "Compare with", the rule turns www. into staging. — the reverse of the
// spec's chip. Drawn the spec's way, the rule would match nothing.

import { Arrow, Box, Chip, artStyles as a, type ArtBase, type ArtSpec } from "./frame";

/** 4a — before, launch, after. */
export const migrationTimeline: ArtSpec = {
  title: { en: "The timeline", fr: "Le calendrier" },
  caption: {
    en: "Before launch: baseline crawl, URL list, staging compare. Launch day: list-mode check, full crawl and compare. After: a scheduled crawl for the first month.",
    fr: "Avant le lancement : exploration de référence, liste d'URL, comparaison avec la préproduction. Le jour J : vérification en mode liste, exploration complète et comparaison. Après : une exploration planifiée pendant le premier mois.",
  },
  draw: (b: ArtBase) => {
    const t =
      b === "fr"
        ? [
            { x: 110, h: "Avant", items: ["exploration de référence", "liste d'URL", "comparer la préprod"] },
            { x: 320, h: "Lancement", items: ["vérification en liste", "exploration complète", "+ comparaison"] },
            { x: 530, h: "Après", items: ["exploration planifiée", "référence épinglée"] },
          ]
        : [
            { x: 110, h: "Before", items: ["baseline crawl", "URL list", "staging compare"] },
            { x: 320, h: "Launch", items: ["list-mode check", "full crawl", "+ compare"] },
            { x: 530, h: "After", items: ["scheduled crawl", "baseline pinned"] },
          ];
    return (
      <g>
        <path className={a.line} style={{ strokeWidth: 4 }} d="M30 130H596" />
        <Arrow x1={590} y1={130} x2={614} y2={130} />
        {t.map((m, i) => (
          <g key={m.h}>
            <text x={m.x} y={92} textAnchor="middle" className={a.tLg}>{m.h}</text>
            <circle cx={m.x} cy={130} r={i === 1 ? 18 : 13} className={i === 1 ? a.accent : a.card} />
            {i === 1 && <path className={a.accentLine} d={`M${m.x - 8} 130l6 6 11-12`} />}
            <Box x={m.x - 92} y={168} w={184} h={30 + m.items.length * 26} r={12} cls={i === 1 ? a.accent : a.card} />
            {m.items.map((it, j) => (
              <text key={it} x={m.x} y={196 + j * 26} textAnchor="middle" className={a.tSm}>
                {it}
              </text>
            ))}
          </g>
        ))}
      </g>
    );
  },
};

/** 4b — three hops collapsed to one. */
export const collapseChain: ArtSpec = {
  title: { en: "Collapse the chain", fr: "Raccourcir la chaîne" },
  caption: {
    en: "Before: /old redirects to /interim, which redirects to /new — two hops. After: /old goes straight to /new with a single 301.",
    fr: "Avant : /old redirige vers /interim, qui redirige vers /new — deux sauts. Après : /old mène directement à /new par une seule 301.",
  },
  draw: (b: ArtBase) => {
    const t = b === "fr" ? { before: "avant", after: "après" } : { before: "before", after: "after" };
    const node = (x: number, y: number, label: string, cls: string) => (
      <g>
        <Box x={x} y={y} w={120} h={48} r={10} cls={cls} />
        <text x={x + 60} y={y + 30} textAnchor="middle" className={`${a.tB} ${a.mono}`}>{label}</text>
      </g>
    );
    return (
      <g>
        <text x={30} y={60} className={`${a.tMuted}`}>{t.before}</text>
        {node(60, 76, "/old", a.amber)}
        <Arrow x1={182} y1={100} x2={252} y2={100} tone="amber" />
        <text x={217} y={90} textAnchor="middle" className={`${a.tSm} ${a.tAmber}`}>301</text>
        {node(256, 76, "/interim", a.amber)}
        <Arrow x1={378} y1={100} x2={448} y2={100} tone="amber" />
        <text x={413} y={90} textAnchor="middle" className={`${a.tSm} ${a.tAmber}`}>301</text>
        {node(452, 76, "/new", a.card)}

        <path className={`${a.line} ${a.dash}`} d="M30 178H610" />

        <text x={30} y={220} className={`${a.tMuted}`}>{t.after}</text>
        {node(60, 236, "/old", a.accent)}
        <Arrow x1={182} y1={260} x2={448} y2={260} tone="accent" />
        <text x={315} y={250} textAnchor="middle" className={`${a.tSm} ${a.tAccent}`}>301</text>
        {node(452, 236, "/new", a.accent)}
      </g>
    );
  },
};

/** 4c — the baseline's URLs rewritten onto the staging host before matching. */
export const urlMapping: ArtSpec = {
  title: { en: "URL mapping", fr: "Correspondance d'URL" },
  caption: {
    en: "Compare rewrites the baseline's URLs before matching. On the staging crawl, ^https://www\\. → https://staging. lines each production page up with its staging twin.",
    fr: "Comparer réécrit les URL de la référence avant de les apparier. Sur l'exploration de préproduction, ^https://www\\. → https://staging. aligne chaque page de production sur sa jumelle en préproduction.",
  },
  draw: (b: ArtBase) => {
    const t =
      b === "fr"
        ? { left: "Référence (production)", right: "Cette exploration (préprod)" }
        : { left: "Baseline (production)", right: "This crawl (staging)" };
    const paths = ["/about", "/pricing", "/blog"];
    return (
      <g>
        <Chip x={170} y={24} w={300} h={34} text="^https://www\.  →  https://staging." textCls={`${a.tSm} ${a.mono}`} mono />
        <text x={40} y={96} className={a.tB}>{t.left}</text>
        <text x={360} y={96} className={a.tB}>{t.right}</text>
        {paths.map((p, i) => {
          const y = 116 + i * 70;
          return (
            <g key={p}>
              <Box x={30} y={y} w={250} h={46} r={10} />
              <text x={46} y={y + 29} className={`${a.tSm} ${a.mono}`}>www.site.com{p}</text>
              <Arrow x1={282} y1={y + 23} x2={346} y2={y + 23} tone="accent" />
              <Box x={350} y={y} w={260} h={46} r={10} cls={a.accent} />
              <text x={366} y={y + 29} className={`${a.tSm} ${a.mono}`}>staging.site.com{p}</text>
            </g>
          );
        })}
      </g>
    );
  },
};
