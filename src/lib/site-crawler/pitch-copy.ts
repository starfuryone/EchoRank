// src/lib/site-crawler/pitch-copy.ts
//
// The crawler's sales pitch on /[locale]/site-crawler: the hero (H1, sub-line,
// two buttons), six short blocks under it, and the closing band. en and fr;
// the page has no German version yet, so de-CH folds to en like the rest of it.
//
// No number is written here. Every count, cap, price and plan name comes from
// nosybatFacts (plan-config, plan-access, the crawl-rules registry, the free
// crawl's limits); a block or a clause whose feature is not live is dropped,
// never softened into "coming soon". pitchCopy() reports what it dropped.

import { flag as flagOn, FLAGS, type FlagName, type Flags } from "@/lib/flags";
import { planAllowsArea, type AccessArea } from "@/lib/plan-access";
import { CRAWLER_BRAND } from "./brand";
import { nbList, nbNum, nbUsd, shows, type NosybatFacts } from "./nosybat-facts";

export type PitchBase = "en" | "fr";

export type PitchBlockId = "proof" | "checks" | "ai-view" | "rendering" | "room" | "team";

export interface PitchBlock {
  id: PitchBlockId;
  heading: string;
  body: string;
}

export interface PitchCopy {
  h1: string;
  sub: string;
  /** The free crawl button; null while the free crawler is off. */
  freeButton: string | null;
  plansButton: string;
  blocks: PitchBlock[];
  closing: string;
  /** Blocks left out because their feature is not live, with the reason. */
  dropped: { id: PitchBlockId; reason: string }[];
}

const NB = CRAWLER_BRAND.name;

/** The checks block's examples, each shown while its rule family is in the public registry. */
const CHECK_EXAMPLES: readonly { family: string; en: string; fr: string }[] = [
  { family: "response_codes", en: "broken links", fr: "liens brisés" },
  { family: "response_codes", en: "redirects", fr: "redirections" },
  { family: "page_titles", en: "titles", fr: "titres" },
  { family: "canonicals", en: "canonicals", fr: "canoniques" },
  { family: "hreflang", en: "hreflang", fr: "hreflang" },
  { family: "security", en: "HTTPS", fr: "HTTPS" },
  { family: "accessibility", en: "accessibility", fr: "accessibilité" },
  { family: "spelling", en: "spelling", fr: "orthographe" },
];

/** What the first crawl plan also includes, each named only while that plan opens the area. */
const ALSO_INCLUDED: readonly { area: AccessArea; en: string; fr: string }[] = [
  { area: "ai_visibility", en: "AI answer tracking", fr: "suivi des réponses IA" },
  { area: "reputation", en: "reviews", fr: "avis" },
  { area: "seo_tools", en: "SEO tools", fr: "outils SEO" },
  { area: "link_authority", en: "the Link Authority Checker", fr: "le Link Authority Checker" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function pitchCopy(f: NosybatFacts, b: PitchBase, flags: Flags = FLAGS): PitchCopy {
  const on = (x: FlagName) => flagOn(x, flags);
  const fr = b === "fr";
  const first = f.firstPlan;
  const top = f.topPlan;
  const price = nbUsd(first.monthlyPrice, b);
  const freePages = nbNum(f.free.pages, b);
  const hasRules = f.rules.count > 0;
  const rules = f.rules.label;
  const freeOn = on("crawl.free");
  // Rendering is claimed only while it is on and every crawl plan renders pages.
  const renderEveryPlan = on("crawl.render") && f.everyPlan.render;
  const aiView = on("crawl.render") && f.rules.families.has("javascript");

  // ── Hero ──
  const h1 = fr
    ? "Le robot d'exploration SEO qui vérifie chaque page et montre ses preuves."
    : "The SEO crawler that checks every page and shows its evidence.";
  const lead = [
    hasRules && (fr ? `${rules} vérifications` : `${rules} checks`),
    renderEveryPlan && (fr ? `rendu JavaScript dans chaque forfait à partir de ${first.name}` : `JavaScript rendering on every plan from ${first.name}`),
    fr ? `dès ${price} par mois` : `from ${price}/month`,
  ].filter((x): x is string => Boolean(x));
  const free = fr ? `Explorez ${freePages} pages gratuitement, sans compte.` : `Crawl ${freePages} pages free, no account.`;
  const sub = `${cap(lead.join(", "))}.${freeOn ? ` ${free}` : ""}`;

  // ── Blocks ──
  const blocks: PitchBlock[] = [];
  const dropped: PitchCopy["dropped"] = [];

  blocks.push({
    id: "proof",
    heading: fr ? "Des preuves, pas une note." : "Proof, not a score.",
    body: fr
      ? "Chaque constat nomme la page, la règle, la valeur relevée et une correction en une ligne. Votre développeur n'a à croire personne sur parole."
      : "Every finding names the page, the rule, the value it saw and a one-line fix, so your developer doesn't have to take anyone's word for it.",
  });

  const examples = CHECK_EXAMPLES.filter((e) => f.rules.families.has(e.family)).map((e) => e[b]);
  if (hasRules && examples.length > 0) {
    blocks.push({
      id: "checks",
      heading: fr ? `${rules} vérifications sur chaque page.` : `${rules} checks on every page.`,
      body: fr ? `${cap(examples.join(", "))} et plus encore.` : `${cap(examples.join(", "))} and more.`,
    });
  } else {
    dropped.push({ id: "checks", reason: "no public rule family in the registry" });
  }

  if (aiView) {
    blocks.push({
      id: "ai-view",
      heading: fr ? "Voyez votre site comme les robots d'IA le voient." : "See your site the way AI crawlers do.",
      body: fr
        ? `${NB} compare le HTML brut avec la page rendue : vous savez ce que ChatGPT peut réellement lire.`
        : `${NB} compares the raw HTML with the rendered page, so you know what ChatGPT can actually read.`,
    });
  } else {
    dropped.push({ id: "ai-view", reason: "rendering (crawl.render) or the javascript rule family is off" });
  }

  if (renderEveryPlan) {
    blocks.push({
      id: "rendering",
      heading: fr ? "Rendu JavaScript inclus." : "JavaScript rendering included.",
      body: fr
        ? `Dans chaque forfait à partir de ${first.name}, pas réservé à un palier supérieur.`
        : `On every plan from ${first.name}, not saved for a higher tier.`,
    });
  } else {
    dropped.push({ id: "rendering", reason: "rendering is off, or a crawl plan renders no pages" });
  }

  const urls = nbNum(top.urlsPerCrawl, b);
  const pages = shows(f, "pagesPerMonth") && top.pagesPerMonth !== null ? nbNum(top.pagesPerMonth, b) : null;
  const room = fr
    ? `Jusqu'à ${urls} URL par exploration${pages ? ` et ${pages} pages par mois` : ""} avec ${top.name}.`
    : `Up to ${urls} URLs per crawl${pages ? ` and ${pages} pages a month` : ""} on ${top.name}.`;
  const work = [
    on("crawl.schedule") && f.everyPlan.schedules && (fr ? "planifiez vos explorations" : "schedule crawls"),
    on("crawl.compare") && (fr ? "comparez chacune avec la précédente" : "compare one crawl with the last"),
    // Staging: a crawl with its own headers or basic auth, compared with production by URL mapping.
    on("crawl.compare") && on("crawl.config") && (fr ? "vérifiez un site de préproduction avant son lancement" : "check a staging site before launch"),
  ].filter((x): x is string => Boolean(x));
  blocks.push({
    id: "room",
    heading: fr ? "De la marge pour travailler." : "Room to work.",
    body: work.length > 0 ? `${room} ${cap(nbList(work, b))}.` : room,
  });

  // The first crawl plan with a team (plan-access "team"): the crawler-only
  // plan is one user, so once it is on sale the claim names Starter.
  const teamPlan = f.crawlPlans.find((p) => planAllowsArea(p.id, "team")) ?? first;
  const teamFrom = teamPlan.id === first.id ? "" : fr ? ` à partir de ${teamPlan.name}` : ` from ${teamPlan.name}`;
  const also = ALSO_INCLUDED.filter((a) => planAllowsArea(teamPlan.id, a.area)).map((a) => a[b]);
  blocks.push({
    id: "team",
    heading: fr ? "Toute votre équipe, un seul forfait." : "Your whole team, one plan.",
    body:
      (fr ? `Aucuns frais par utilisateur${teamFrom}.` : `No per-seat charge${teamFrom}.`) +
      (also.length > 0 ? (fr ? ` Avec tout le reste d'Echorank : ${nbList(also, b)}.` : ` Comes with the rest of Echorank: ${nbList(also, b)}.`) : ""),
  });

  // ── Closing band ──
  const plans = fr
    ? `Forfaits dès ${price} par mois, avec ${nbNum(f.trialDays, b)} jours d'essai.`
    : `Plans from ${price}/month with a ${nbNum(f.trialDays, b)}-day trial.`;
  const closingFree = fr ? `Explorez ${freePages} pages gratuitement.` : `Crawl ${freePages} pages free.`;

  return {
    h1,
    sub,
    freeButton: freeOn ? (fr ? `Explorer ${freePages} pages gratuitement` : `Crawl ${freePages} pages free`) : null,
    plansButton: fr ? "Voir les forfaits" : "See plans",
    blocks,
    closing: freeOn ? `${closingFree} ${plans}` : plans,
    dropped,
  };
}
