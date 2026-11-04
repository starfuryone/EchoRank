// Guide 2 — xml-sitemap-generator. Diagrams 2a, 2b, 2c (NOSY-BAT-GUIDES.md).
// The index file is drawn as sitemap_index.xml: the name the generator
// actually writes (src/lib/site-crawler/sitemap-generator.ts).

import { Arrow, Box, Chip, artStyles as a, type ArtBase, type ArtSpec } from "./frame";

const n = (v: number, b: ArtBase) => new Intl.NumberFormat(b === "fr" ? "fr-CA" : "en-US").format(v);

/** 2a — crawled → indexable → in the sitemap. */
export const crawlToSitemap: ArtSpec = {
  title: { en: "From crawl to sitemap", fr: "De l'exploration au plan de site" },
  caption: {
    en: "Of 1,240 crawled URLs, 980 are indexable — and those 980, no more, go in the sitemap. Redirects, noindexed and canonicalised pages and non-HTML files drop out.",
    fr: "Sur 1 240 URL explorées, 980 sont indexables — et ces 980, pas une de plus, vont dans le plan de site. Redirections, pages noindex ou canonisées ailleurs et fichiers non HTML sont écartés.",
  },
  draw: (b: ArtBase) => {
    const t =
      b === "fr"
        ? { crawled: `Explorées : ${n(1240, b)} pages`, indexable: `Indexables : ${n(980, b)}`, sitemap: `Dans le plan de site : ${n(980, b)}`, out: "Écartées", drops: ["redirections", "noindex", "canonisées ailleurs", "non HTML"] }
        : { crawled: `Crawled: ${n(1240, b)} pages`, indexable: `Indexable: ${n(980, b)}`, sitemap: `In the sitemap: ${n(980, b)}`, out: "Drops out", drops: ["redirects", "noindex", "canonicalised", "non-HTML"] };
    return (
      <g>
        <polygon points="30,40 410,40 380,120 60,120" className={a.card} />
        <text x={220} y={86} textAnchor="middle" className={a.tLg}>{t.crawled}</text>
        <polygon points="66,132 374,132 344,212 96,212" className={a.card} />
        <text x={220} y={178} textAnchor="middle" className={a.tLg}>{t.indexable}</text>
        <polygon points="102,224 338,224 318,304 122,304" className={a.accent} />
        <text x={220} y={270} textAnchor="middle" className={a.tLg}>{t.sitemap}</text>
        {/* What drops out between band 1 and band 2 */}
        <Arrow x1={392} y1={126} x2={446} y2={126} tone="red" />
        <Box x={452} y={60} w={160} h={150} r={12} cls={a.red} />
        <text x={470} y={88} className={`${a.tB} ${a.tRed}`}>{t.out}</text>
        {t.drops.map((d, i) => (
          <text key={d} x={470} y={116 + i * 24} className={a.tSm}>
            − {d}
          </text>
        ))}
      </g>
    );
  },
};

/** 2b — a sitemap index over three files. */
export const largeSites: ArtSpec = {
  title: { en: "Large sites", fr: "Grands sites" },
  caption: {
    en: "Past 50,000 URLs the generator splits the sitemap into numbered files and adds an index that points at each one. You submit the index.",
    fr: "Au-delà de 50 000 URL, le générateur découpe le plan de site en fichiers numérotés et ajoute un index qui pointe vers chacun. C'est l'index que vous soumettez.",
  },
  draw: (b: ArtBase) => {
    const urls = b === "fr" ? "URL" : "URLs";
    const kids = [
      { x: 30, name: "sitemap-1.xml", count: 50000 },
      { x: 235, name: "sitemap-2.xml", count: 50000 },
      { x: 440, name: "sitemap-3.xml", count: 12400 },
    ];
    return (
      <g>
        <Box x={205} y={44} w={230} h={56} r={12} cls={a.accent} />
        <text x={320} y={78} textAnchor="middle" className={`${a.tB} ${a.mono}`}>sitemap_index.xml</text>
        <path className={a.line} d="M320 100V150M115 150H525M115 150V196M320 150V196M525 150V196" />
        {kids.map((k) => (
          <g key={k.name}>
            <Box x={k.x} y={196} w={170} h={84} r={12} />
            <text x={k.x + 85} y={230} textAnchor="middle" className={`${a.tB} ${a.mono}`}>{k.name}</text>
            <text x={k.x + 85} y={256} textAnchor="middle" className={a.tMuted}>
              {n(k.count, b)} {urls}
            </text>
          </g>
        ))}
      </g>
    );
  },
};

/** 2c — the URL, the robots.txt line, Search Console. */
export const whereItGoes: ArtSpec = {
  title: { en: "Where it goes", fr: "Où le mettre" },
  caption: {
    en: "The file sits at the site root, robots.txt names it on a Sitemap: line, and Search Console has it submitted.",
    fr: "Le fichier est à la racine du site, le robots.txt le nomme sur une ligne Sitemap:, et la Search Console l'a reçu.",
  },
  draw: (b: ArtBase) => {
    const t = b === "fr" ? { sitemaps: "Plans de site", submitted: "Envoyé" } : { sitemaps: "Sitemaps", submitted: "Submitted" };
    return (
      <g>
        {/* Address bar */}
        <Box x={30} y={26} w={580} h={46} r={23} cls={a.card} />
        <circle cx={58} cy={49} r={7} className={a.accent} />
        <text x={78} y={54} className={`${a.t} ${a.mono}`}>your-site.com/</text>
        <text x={204} y={54} className={`${a.t} ${a.mono} ${a.tAccent}`}>sitemap.xml</text>

        {/* robots.txt */}
        <Box x={30} y={102} w={350} h={220} r={12} />
        <text x={50} y={132} className={`${a.tB} ${a.mono}`}>robots.txt</text>
        <path className={a.line} d="M30 146H380" />
        <text x={50} y={176} className={`${a.tSm} ${a.mono}`}>User-agent: *</text>
        <text x={50} y={202} className={`${a.tSm} ${a.mono}`}>Disallow: /admin/</text>
        <rect x={42} y={236} width={326} height={34} rx={6} className={a.accent} />
        <text x={52} y={258} className={`${a.mono} ${a.tSm}`}>
          Sitemap: https://your-site.com/sitemap.xml
        </text>

        {/* Search Console */}
        <Box x={410} y={102} w={200} h={220} r={12} />
        <text x={430} y={132} className={a.tB}>Search Console</text>
        <path className={a.line} d="M410 146H610" />
        <text x={430} y={176} className={a.tMuted}>{t.sitemaps}</text>
        <text x={430} y={216} className={`${a.tSm} ${a.mono}`}>/sitemap.xml</text>
        <Chip x={430} y={238} w={110} text={t.submitted} />
      </g>
    );
  },
};
