// src/lib/learn-nosy-bat.ts
//
// The four crawler guides (NOSY-BAT-GUIDES.md), spliced into LEARN_GUIDES by
// src/lib/learn-content.ts. Kept in their own module because they differ from
// the other guides in three ways, all deliberate:
//
//  1. THE BODY IS LOCALIZED. en + fr (French-Canadian register); de-CH and
//     en-CA fold to en. So these pages canonical to their own base locale, not
//     to the en URL — see the guide route.
//  2. THEY NAME THE UI, AND THE UI IS THE SOURCE. Every bold label below is the
//     string the crawler actually renders (dashboard.ts, site-crawler-ux.ts,
//     site-crawler-4c.ts), in the same language as the body. Where the spec
//     described something the product does not do (a 302→301 rule, sitemap
//     options remembered by schedules, anchor text on the Issues view), the
//     text says what the product DOES do instead. Rename a label in the UI and
//     this file is the second place to change.
//  3. PLAN NUMBERS ARE READ, NOT WRITTEN. Extractor and search caps, the
//     largest crawl and the schedule cadences come from PLAN_CONFIGS, so a
//     plan change reaches the prose without anyone editing it.
//
// The brand is CRAWLER_BRAND.name, never spelled (tests/nosy-bat-brand.test.ts).
// Diagrams are {k:"figure"} markers resolved by Blocks against
// src/components/learn/nosy-bat-art; CTAs are {k:"guideCta"} markers whose copy
// lives in marketing-copy.ts (guideCtas). No React here: the proxy imports
// learn-content, and through it this file.

import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import type { LearnBlock, LearnGuide } from "./learn-content";

const NB = CRAWLER_BRAND.name;

/** Where the four are listed together: an anchored section of the guides index. */
export const NOSY_BAT_GUIDES_ANCHOR = "nosy-bat";

type Base = "en" | "fr";
const fmt = (n: number, b: Base) => new Intl.NumberFormat(b === "fr" ? "fr-CA" : "en-US").format(n);

const STARTER = PLAN_CONFIGS.STARTER;
const GROWTH = PLAN_CONFIGS.GROWTH;
const AGENCY = PLAN_CONFIGS.AGENCY;
const TIERS = [STARTER, GROWTH, AGENCY] as const;

/** The first tier whose schedules may run weekly, e.g. "Growth". */
const WEEKLY_FROM = TIERS.find((p) => p.crawlScheduleCadences.includes("weekly"))?.name ?? AGENCY.name;
/** Starter's only cadence, if it has exactly one. */
const STARTER_CADENCE = STARTER.crawlScheduleCadences.length === 1 ? STARTER.crawlScheduleCadences[0] : null;

const CADENCE: Record<Base, Record<string, string>> = {
  en: { daily: "daily", weekly: "weekly", monthly: "monthly" },
  fr: { daily: "chaque jour", weekly: "chaque semaine", monthly: "chaque mois" },
};

/** "weekly from Growth up, monthly on Starter" — from the plan config. */
export function scheduleCadenceLine(b: Base): string {
  const starter = STARTER_CADENCE ? CADENCE[b][STARTER_CADENCE] : null;
  if (b === "fr") {
    return starter
      ? `chaque semaine à partir du forfait ${WEEKLY_FROM}, ${starter} sur ${STARTER.name}`
      : `chaque semaine à partir du forfait ${WEEKLY_FROM}`;
  }
  return starter ? `weekly from ${WEEKLY_FROM} up, ${starter} on ${STARTER.name}` : `weekly from ${WEEKLY_FROM} up`;
}

/** Facts the CTA copy and the tests read. */
export const NOSY_BAT_GUIDE_FACTS = {
  largestCrawl: Math.max(...TIERS.map((p) => p.crawlUrlCap)),
  extractors: { starter: STARTER.crawlExtractors, growth: GROWTH.crawlExtractors, agency: AGENCY.crawlExtractors },
  searches: { starter: STARTER.crawlSearches, top: Math.max(...TIERS.map((p) => p.crawlSearches)) },
  names: { starter: STARTER.name, growth: GROWTH.name, agency: AGENCY.name },
  weeklyFrom: WEEKLY_FROM,
  fmt,
} as const;

// ─── Guide 1 — how-to-find-broken-links ─────────────────────────────────────

const brokenLinksEn: LearnBlock[] = [
  { k: "h2", t: "Why broken links matter" },
  {
    k: "p",
    t: "A broken link wastes a click. For a visitor it's a dead end; for a search engine it's a signal that the site isn't maintained, and the link equity flowing into that URL goes nowhere. Internal broken links are entirely yours to fix. External ones — links you make to other sites — can't be fixed at the source, but they can be updated or removed.",
  },
  {
    k: "p",
    t: `${NB} finds both kinds in one crawl and, unlike a single-page checker, tells you **where** each broken link lives, so you don't have to search for it.`,
  },
  { k: "h2", t: "1. Start a crawl" },
  {
    k: "p",
    t: `Open ${NB} and go to **New crawl**. Paste your homepage URL, keep **Mode** on **Spider (follow links)**, leave **JavaScript rendering** on **Off (raw HTML)** unless your site builds its links with JavaScript, and start. A few hundred pages take a couple of minutes; ${NB} obeys robots.txt and never sends more than two requests a second.`,
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Open the Issues view" },
  { k: "p", t: "When the crawl completes, open **Issues**. Broken links sit in the **Response codes** family:" },
  {
    k: "ul",
    items: [
      "**Internal client error (4xx)** — pages on your site that return 404, 410 or similar",
      "**Internal server error (5xx)** — pages your server failed to deliver",
      "**Broken external link (4xx)** and **External link server error (5xx)** — links from your site to other sites that no longer work",
      "**No response** — timeouts and refused connections",
    ],
  },
  {
    k: "p",
    t: "Each row shows how many pages are affected. Open it to see the URLs; under each one, **Found on** names the page that links to it. For the anchor text — and every other page linking to the same URL — open that URL on **Pages** and read its **Inlinks** panel.",
  },
  { k: "figure", art: "broken-links-where" },
  { k: "h2", t: "3. Export the list" },
  {
    k: "p",
    t: "Use **Exports → Broken links (CSV)**. Every row is one internal link: the source URL, the broken URL, the anchor text and the status code. This is the file you hand to a developer or a content editor; it needs no further explanation. Links to other sites have a file of their own, **External links (CSV)**.",
  },
  { k: "figure", art: "broken-links-export" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Fix in the right order" },
  { k: "p", t: "Not every broken link needs the same fix:" },
  {
    k: "ul",
    items: [
      "**The page moved** → add a 301 redirect from the old URL to the new one, then update the link anyway so visitors don't pay for the hop",
      "**The page is gone for good** → remove or replace the link; let the URL return 410 if nothing should replace it",
      "**A typo in the link** → correct the link; no redirect needed",
      "**An external site changed** → update the link to the new location or remove it",
    ],
  },
  { k: "figure", art: "broken-links-fix" },
  {
    k: "p",
    t: "Start with the internal 4xx URLs that have the most inlinks — **Pages** sorts by **Inlinks** and by **Link Score** — because those are the links most visitors and crawlers hit.",
  },
  { k: "h2", t: "5. Confirm, then keep watching" },
  {
    k: "p",
    t: `Run the crawl again, open **Compare** on the new crawl and choose the first one under **Compare with**: what you fixed lands in **Resolved issues**. Then add a schedule under **Schedules** — ${scheduleCadenceLine("en")} — with **Email to workspace owner** ticked under **Export targets**, so new broken links reach your inbox before your visitors find them.`,
  },
];

const brokenLinksFr: LearnBlock[] = [
  { k: "h2", t: "Pourquoi les liens brisés comptent" },
  {
    k: "p",
    t: "Un lien brisé, c'est un clic perdu. Pour un visiteur, c'est un cul-de-sac; pour un moteur de recherche, c'est le signe d'un site mal entretenu, et l'autorité qui circule vers cette URL ne mène nulle part. Les liens brisés internes, vous pouvez tous les corriger vous-même. Les liens externes — ceux qui pointent vers d'autres sites — ne se réparent pas à la source, mais vous pouvez les mettre à jour ou les retirer.",
  },
  {
    k: "p",
    t: `${NB} trouve les deux en une seule exploration et, contrairement à un vérificateur page par page, vous dit **où** se trouve chaque lien brisé : vous n'avez pas à le chercher.`,
  },
  { k: "h2", t: "1. Lancer une exploration" },
  {
    k: "p",
    t: `Ouvrez ${NB} et allez dans **Nouvelle exploration**. Collez l'URL de votre page d'accueil, laissez le **Mode** sur **Exploration (suivre les liens)**, gardez le **Rendu JavaScript** sur **Désactivé (HTML brut)**, sauf si votre site construit ses liens en JavaScript, puis lancez. Quelques centaines de pages prennent quelques minutes; ${NB} respecte le robots.txt et n'envoie jamais plus de deux requêtes par seconde.`,
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Ouvrir la vue Problèmes" },
  { k: "p", t: "Une fois l'exploration terminée, ouvrez **Problèmes**. Les liens brisés se trouvent dans la famille **Codes de réponse** (les noms des règles s'affichent en anglais) :" },
  {
    k: "ul",
    items: [
      "**Internal client error (4xx)** — les pages de votre site qui renvoient une erreur 404, 410 ou semblable",
      "**Internal server error (5xx)** — les pages que votre serveur n'a pas pu livrer",
      "**Broken external link (4xx)** et **External link server error (5xx)** — les liens de votre site vers d'autres sites qui ne fonctionnent plus",
      "**No response** — les délais dépassés et les connexions refusées",
    ],
  },
  {
    k: "p",
    t: "Chaque ligne indique le nombre de pages touchées. Ouvrez-la pour voir les URL; sous chacune, **Trouvée sur** nomme la page qui y mène. Pour le texte d'ancre — et toutes les autres pages qui pointent vers la même URL — ouvrez cette URL dans **Pages** et consultez son panneau **Liens entrants**.",
  },
  { k: "figure", art: "broken-links-where" },
  { k: "h2", t: "3. Exporter la liste" },
  {
    k: "p",
    t: "Utilisez **Exports → Liens brisés (CSV)**. Chaque ligne correspond à un lien interne : l'URL source, l'URL brisée, le texte d'ancre et le code de statut. C'est le fichier à remettre au développeur ou à la personne responsable du contenu; il se passe d'explications. Les liens vers d'autres sites ont leur propre fichier, **Liens externes (CSV)**.",
  },
  { k: "figure", art: "broken-links-export" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Corriger dans le bon ordre" },
  { k: "p", t: "Tous les liens brisés ne demandent pas la même correction :" },
  {
    k: "ul",
    items: [
      "**La page a déménagé** → ajoutez une redirection 301 de l'ancienne URL vers la nouvelle, puis corrigez quand même le lien pour épargner ce détour aux visiteurs",
      "**La page a disparu pour de bon** → retirez ou remplacez le lien; laissez l'URL renvoyer un 410 si rien ne doit la remplacer",
      "**Une coquille dans le lien** → corrigez le lien; aucune redirection nécessaire",
      "**Un site externe a changé** → mettez le lien à jour vers la nouvelle adresse ou retirez-le",
    ],
  },
  { k: "figure", art: "broken-links-fix" },
  {
    k: "p",
    t: "Commencez par les URL internes en 4xx qui reçoivent le plus de liens — **Pages** se trie par **Liens entrants** et par **Link Score** — puisque ce sont les liens que visiteurs et robots empruntent le plus.",
  },
  { k: "h2", t: "5. Vérifier, puis garder l'œil ouvert" },
  {
    k: "p",
    t: `Relancez l'exploration, ouvrez **Comparer** sur la nouvelle et choisissez la première sous **Comparer avec** : ce que vous avez corrigé apparaît dans **Problèmes résolus**. Ajoutez ensuite une planification dans **Planifications** — ${scheduleCadenceLine("fr")} — en cochant **Courriel au propriétaire de l'espace** sous **Destinations d'export**, pour que les nouveaux liens brisés arrivent dans votre boîte avant que vos visiteurs tombent dessus.`,
  },
];

export const BROKEN_LINKS_GUIDE: LearnGuide = {
  slug: "how-to-find-broken-links",
  group: "nosy-bat",
  hero: "broken-links",
  howTo: true,
  order: 7,
  title: "How to find broken links on your site (and fix them in the right order)",
  description: `Find every 404 and server error with ${NB}, see which page each one was found on, and export the list for whoever fixes it.`,
  readingTime: 5,
  tag: NB,
  blurb: "Every 404 and server error, the page it's on, and the order to fix them in.",
  cta: "crawler",
  related: [
    { href: "/learn", label: "Learn SEO →", internal: true },
  ],
  body: brokenLinksEn,
  fr: {
    title: "Trouver les liens brisés de votre site (et les corriger dans le bon ordre)",
    description: `Trouvez chaque erreur 404 et chaque erreur serveur avec ${NB}, voyez sur quelle page chacune a été trouvée, et exportez la liste pour la personne qui corrige.`,
    blurb: "Chaque 404 et erreur serveur, la page où elle se trouve, et l'ordre de correction.",
    body: brokenLinksFr,
    related: [
      { href: "/learn", label: "Apprendre le SEO →", internal: true },
    ],
  },
};

export const NOSY_BAT_GUIDES: LearnGuide[] = [BROKEN_LINKS_GUIDE];
