// src/lib/site-crawler/nosybat-pillars.ts
//
// The crawler's pitch as seven pillars, in order (ECHORANK-NOSYBAT-COPY-REFRESH.md
// Phase 2), for the surfaces that tell the whole story in a few lines: the
// homepage two-crawlers card and the /enterprise crawler section. (The
// /site-crawler hero and its six blocks are pitch-copy.ts; the /pricing cards'
// crawler line is pricing-page/headlines.ts, which must stay client-safe.)
//
// No number is written here: every one comes from nosybatFacts. A pillar, or a
// clause of one, whose feature is not live is left out, never softened into
// "coming soon". Each pillar has a title, a body and a short form for a bullet.

import { flag as flagOn, FLAGS, type FlagName, type Flags } from "@/lib/flags";
import { planAllowsArea } from "@/lib/plan-access";
import { nbList, nbNum, shows, type CheckArea, type NosybatFacts } from "./nosybat-facts";

export type PillarBase = "en" | "fr";

export type PillarId = "checks" | "ai-view" | "rendering" | "room" | "recurring" | "search-console" | "free";

export interface Pillar {
  id: PillarId;
  title: string;
  body: string;
  /** One line, for a bullet list. */
  short: string;
}

const AREA_WORDS: Readonly<Record<CheckArea, Record<PillarBase, string>>> = {
  onPage: { en: "on-page", fr: "on-page" },
  technical: { en: "technical", fr: "technique" },
  hreflang: { en: "hreflang", fr: "hreflang" },
  https: { en: "HTTPS", fr: "HTTPS" },
  accessibility: { en: "accessibility", fr: "accessibilité" },
  spelling: { en: "spelling", fr: "orthographe" },
  performance: { en: "performance", fr: "performance" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function nosybatPillars(f: NosybatFacts, b: PillarBase, flags: Flags = FLAGS): Pillar[] {
  const on = (x: FlagName) => flagOn(x, flags);
  const fr = b === "fr";
  const first = f.firstPlan;
  const top = f.topPlan;
  const out: Pillar[] = [];

  // 1. Checks every page, with the evidence.
  if (f.rules.count > 0) {
    const areas = nbList(f.rules.areas.map((a) => AREA_WORDS[a][b]), b);
    const rules = f.rules.label;
    out.push({
      id: "checks",
      title: fr ? "Vérifie chaque page, preuves à l'appui." : "Checks every page, with the evidence.",
      body: fr
        ? `${rules} vérifications : ${areas}. Chaque constat nomme la page, la règle, la valeur relevée et une correction en une ligne. Une vérification illisible est marquée « non évaluable », jamais comptée comme un échec.`
        : `${rules} checks across ${areas}. Every finding names the page, the rule, the value it saw and a one-line fix. A check that can't be read is marked "not assessable", never counted as a failure.`,
      short: fr ? `${rules} vérifications, avec la preuve sur chaque constat` : `${rules} checks, with the evidence on every finding`,
    });
  }

  // 2. Sees your site the way AI does: the raw-vs-rendered comparison needs rendering and the javascript rules.
  if (on("crawl.render") && f.rules.families.has("javascript")) {
    out.push({
      id: "ai-view",
      title: fr ? "Voit votre site comme l'IA le voit." : "Sees your site the way AI does.",
      body: fr
        ? "HTML brut ou page rendue : vous savez ce que ChatGPT et les autres robots d'IA peuvent vraiment lire."
        : "Raw HTML vs rendered page, so you know what ChatGPT and other AI crawlers can actually read.",
      short: fr ? "HTML brut ou rendu : ce que les robots d'IA peuvent lire" : "Raw HTML vs rendered: what AI crawlers can read",
    });
  }

  // 3. JavaScript rendering on every plan from the first crawl plan.
  if (on("crawl.render") && f.everyPlan.render) {
    const t = fr ? `Rendu JavaScript dans chaque forfait à partir de ${first.name}.` : `JavaScript rendering on every plan from ${first.name}.`;
    out.push({
      id: "rendering",
      title: t,
      body: fr ? "Pas besoin d'un palier supérieur juste pour rendre vos pages." : "No upgrade tier just to render pages.",
      short: t.replace(/\.$/, ""),
    });
  }

  // 4. Room to work: the top plan's caps, the gated ones only while enforced.
  const urls = nbNum(top.urlsPerCrawl, b);
  const pages = shows(f, "pagesPerMonth") && top.pagesPerMonth !== null ? nbNum(top.pagesPerMonth, b) : null;
  const atOnce = shows(f, "crawlsAtOnce") ? nbNum(top.crawlsAtOnce, b) : null;
  const caps = [
    fr ? `jusqu'à ${urls} URL par exploration` : `up to ${urls} URLs per crawl`,
    pages && (fr ? `${pages} pages par mois` : `${pages} pages a month`),
    atOnce && (fr ? `${atOnce} explorations simultanées par espace de travail` : `${atOnce} crawls at once per workspace`),
  ].filter((x): x is string => Boolean(x));
  // "In parallel" only when crawls can overlap at all and schedules exist.
  const parallel = shows(f, "crawlsAtOnce") && top.crawlsAtOnce > 1 && on("crawl.schedule");
  out.push({
    id: "room",
    title: fr ? "De la marge pour travailler." : "Room to work.",
    body:
      (fr ? `${cap(nbList(caps, b))} avec ${top.name}.` : `${cap(nbList(caps, b))} on ${top.name}.`) +
      (parallel ? (fr ? " Les explorations planifiées tournent en parallèle, pas l'une après l'autre." : " Scheduled crawls run in parallel, not one after another.") : ""),
    short: fr
      ? `Jusqu'à ${urls} URL par exploration${atOnce ? `, ${atOnce} explorations simultanées` : ""} avec ${top.name}`
      : `Up to ${urls} URLs per crawl${atOnce ? `, ${atOnce} crawls at once` : ""} on ${top.name}`,
  });

  // 5. Built for recurring work. The API is named with the plans that have it (api_access), never "every plan".
  const apiPlans = [...f.crawlPlans, f.plans.ENTERPRISE].filter((p) => p.api).map((p) => p.name);
  const work = [
    on("crawl.schedule") && (fr ? "explorations planifiées" : "scheduled crawls"),
    on("crawl.compare") && (fr ? "comparaison d'une exploration à l'autre" : "crawl-to-crawl comparison"),
    on("crawl.compare") && on("crawl.config") && (fr ? "préproduction contre production" : "staging vs production"),
    on("crawl.schedule") && on("crawl.reports") && (fr ? "résultats par courriel" : "results by email"),
    on("crawl.reports") && (fr ? "un PDF par exploration" : "a PDF per crawl"),
    fr ? "du CSV sur chaque tableau" : "CSV on every table",
    on("crawl.api") && apiPlans.length > 0 && (fr ? `une API avec MCP (${nbList(apiPlans, b)})` : `an API with MCP on ${nbList(apiPlans, b)}`),
  ].filter((x): x is string => Boolean(x));
  // The team claim names the first crawl plan with a team (plan-access
  // "team"): the crawler-only plan is one user.
  const teamPlan = f.crawlPlans.find((p) => planAllowsArea(p.id, "team")) ?? first;
  const teamFrom = teamPlan.id === first.id ? "" : fr ? ` à partir de ${teamPlan.name}` : ` from ${teamPlan.name}`;
  out.push({
    id: "recurring",
    title: fr ? "Conçu pour le travail récurrent." : "Built for recurring work.",
    body:
      `${cap(nbList(work, b))}. ` +
      (fr
        ? `Un seul forfait couvre toute l'équipe${teamFrom} : aucune licence par utilisateur.`
        : `One plan covers the whole team${teamFrom}: no per-seat licence.`),
    short: fr ? `Planifiez, comparez, exportez ; aucune licence par utilisateur${teamFrom}` : `Schedule, compare, export; no per-seat licence${teamFrom}`,
  });

  // 6. Works with Search Console.
  if (on("crawl.gsc")) {
    out.push({
      id: "search-console",
      title: fr ? "Travaille avec Search Console, pas à sa place." : "Works with Search Console, not instead of it.",
      body: fr ? "Vos données Search Console s'affichent à côté des constats de l'exploration." : "Your Search Console data shows next to the crawl findings.",
      short: fr ? "Vos données Search Console à côté des constats" : "Your Search Console data next to the findings",
    });
  }

  // 7. Try it free.
  if (on("crawl.free")) {
    const n = nbNum(f.free.pages, b);
    out.push({
      id: "free",
      title: fr ? "Essayez gratuitement." : "Try it free.",
      body: fr ? `${n} pages, sans compte.` : `${n} pages, no account.`,
      short: fr ? `Essai gratuit : ${n} pages, sans compte` : `Try it free: ${n} pages, no account`,
    });
  }

  return out;
}
