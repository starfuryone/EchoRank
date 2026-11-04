// Guide 1 — how-to-find-broken-links. Diagrams 1a, 1b, 1c (NOSY-BAT-GUIDES.md).

import { Arrow, Bar, Box, Chip, artStyles as a, type ArtBase, type ArtSpec } from "./frame";

const L = {
  en: { home: "Home", services: "Services", pricing: "Pricing", anchor: "see pricing", foundOn: "Found on: /services — anchor ‘see pricing’" },
  fr: { home: "Accueil", services: "Services", pricing: "Tarifs", anchor: "voir les tarifs", foundOn: "Trouvé sur : /services — ancre « voir les tarifs »" },
} as const;

/** 1a — three page cards, the broken hop in red, the Found-on callout. */
export const whereBrokenLinkLives: ArtSpec = {
  title: { en: "Where a broken link lives", fr: "Où se trouve un lien brisé" },
  caption: {
    en: "The 404 is on /pricing, but the link to fix is on /services. Found on names that page and the anchor text.",
    fr: "Le 404 est sur /pricing, mais le lien à corriger est sur /services. « Trouvé sur » nomme cette page et le texte d'ancre.",
  },
  draw: (b: ArtBase) => {
    const t = L[b];
    const cards = [
      { x: 30, name: t.home, path: "/" },
      { x: 245, name: t.services, path: "/services" },
      { x: 460, name: t.pricing, path: "/pricing" },
    ];
    return (
      <g>
        {cards.map((c, i) => (
          <g key={c.path}>
            <Box x={c.x} y={56} w={150} h={132} cls={i === 2 ? `${a.card} ${a.dash}` : a.card} />
            <text x={c.x + 16} y={84} className={a.tB}>{c.name}</text>
            <text x={c.x + 16} y={104} className={`${a.tXs} ${a.mono}`}>{c.path}</text>
            <Bar x={c.x + 16} y={128} w={96} />
            <Bar x={c.x + 16} y={146} w={118} />
            {i !== 1 && <Bar x={c.x + 16} y={164} w={70} />}
          </g>
        ))}
        {/* The link on /services, underlined in emerald: this is what gets fixed. */}
        <text x={261} y={168} className={`${a.tSm} ${a.tAccent}`}>{t.anchor}</text>
        <path className={a.accentLine} d="M261 173h100" />
        <Arrow x1={180} y1={122} x2={243} y2={122} />
        <Arrow x1={395} y1={122} x2={458} y2={122} tone="red" />
        <Chip x={548} y={40} w={64} h={30} text="404" cls={a.red} textCls={`${a.tB} ${a.tRed}`} />
        {/* Callout */}
        <path className={`${a.accentLine} ${a.dash}`} d="M311 178V246" />
        <Box x={110} y={246} w={420} h={52} r={12} cls={a.accent} />
        <text x={320} y={278} textAnchor="middle" className={a.t}>{t.foundOn}</text>
      </g>
    );
  },
};

const ROWS = [
  { src: "/services", url: "/pricing-old", anchor: { en: "see pricing", fr: "voir les tarifs" }, status: "404", tone: "red" },
  { src: "/blog/guide", url: "partner.example/tool", anchor: { en: "this tool", fr: "cet outil" }, status: "503", tone: "red" },
  { src: "/about", url: "/team", anchor: { en: "our team", fr: "l'équipe" }, status: "301", tone: "amber" },
] as const;

/** 1b — the CSV, one row per link. */
export const exportOneRowPerLink: ArtSpec = {
  title: { en: "The export, one row per link", fr: "L'export, une ligne par lien" },
  caption: {
    en: "Every row is one link: the page it sits on, where it points, its anchor text and the status that URL returned.",
    fr: "Chaque ligne est un lien : la page où il se trouve, sa destination, son texte d'ancre et le statut renvoyé.",
  },
  draw: (b: ArtBase) => {
    const head = b === "fr" ? ["Page source", "URL brisée", "Ancre", "Statut"] : ["Source page", "Broken URL", "Anchor", "Status"];
    const cols = [30, 180, 370, 510, 610];
    const top = 64;
    const rh = 52;
    return (
      <g>
        <Box x={30} y={top} w={580} h={rh * 4} r={10} />
        <rect x={31} y={top + 1} width={578} height={rh - 1} rx={9} className={a.card2} style={{ stroke: "none" }} />
        {[1, 2, 3].map((r) => (
          <path key={r} className={a.line} d={`M30 ${top + rh * r}h580`} />
        ))}
        {cols.slice(1, 4).map((x) => (
          <path key={x} className={a.line} d={`M${x} ${top}v${rh * 4}`} />
        ))}
        {head.map((h, i) => (
          <text key={h} x={cols[i] + 14} y={top + 32} className={a.tB}>{h}</text>
        ))}
        {ROWS.map((r, i) => {
          const y = top + rh * (i + 1);
          return (
            <g key={r.src}>
              <text x={cols[0] + 14} y={y + 32} className={`${a.tSm} ${a.mono}`}>{r.src}</text>
              <text x={cols[1] + 14} y={y + 32} className={`${a.tSm} ${a.mono}`}>{r.url}</text>
              <text x={cols[2] + 14} y={y + 32} className={a.tSm}>{r.anchor[b]}</text>
              <Chip
                x={cols[3] + 22}
                y={y + 12}
                w={56}
                text={r.status}
                cls={r.tone === "red" ? a.red : a.amber}
                textCls={`${a.tB} ${r.tone === "red" ? a.tRed : a.tAmber}`}
              />
            </g>
          );
        })}
        <text x={30} y={320} className={`${a.tXs} ${a.mono}`}>broken-links.csv</text>
      </g>
    );
  },
};

/** 1c — which fix: a three-leaf decision tree. */
export const whichFix: ArtSpec = {
  title: { en: "Which fix", fr: "Quelle correction" },
  caption: {
    en: "A moved page gets a 301 and an updated link; a page gone for good loses the link; a typo is just corrected.",
    fr: "Une page déplacée reçoit une 301 et un lien mis à jour ; une page disparue perd le lien ; une coquille se corrige, tout simplement.",
  },
  draw: (b: ArtBase) => {
    const t =
      b === "fr"
        ? { moved: "Page déplacée ?", gone: "Disparue pour de bon ?", redirect: "301 + corriger le lien", remove: "Retirer le lien, 410", typo: "Corriger la coquille", yes: "oui", no: "non" }
        : { moved: "Page moved?", gone: "Gone for good?", redirect: "301 + update link", remove: "Remove link, 410", typo: "Fix the typo", yes: "yes", no: "no" };
    return (
      <g>
        <Box x={220} y={28} w={200} h={48} r={24} cls={a.card2} />
        <text x={320} y={58} textAnchor="middle" className={a.tB}>{t.moved}</text>

        <Arrow x1={270} y1={76} x2={150} y2={146} />
        <text x={190} y={104} className={a.tMuted}>{t.yes}</text>
        <Box x={40} y={148} w={220} h={50} r={12} cls={a.accent} />
        <text x={150} y={179} textAnchor="middle" className={a.tB}>{t.redirect}</text>

        <Arrow x1={370} y1={76} x2={490} y2={146} />
        <text x={438} y={104} className={a.tMuted}>{t.no}</text>
        <Box x={380} y={148} w={220} h={48} r={24} cls={a.card2} />
        <text x={490} y={178} textAnchor="middle" className={a.tB}>{t.gone}</text>

        <Arrow x1={450} y1={196} x2={380} y2={266} />
        <text x={392} y={232} className={a.tMuted}>{t.yes}</text>
        <Box x={290} y={268} w={180} h={50} r={12} cls={a.accent} />
        <text x={380} y={299} textAnchor="middle" className={a.tB}>{t.remove}</text>

        <Arrow x1={530} y1={196} x2={560} y2={266} />
        <text x={554} y={232} className={a.tMuted}>{t.no}</text>
        <Box x={486} y={268} w={140} h={50} r={12} cls={a.accent} />
        <text x={556} y={299} textAnchor="middle" className={a.tB}>{t.typo}</text>
      </g>
    );
  },
};
