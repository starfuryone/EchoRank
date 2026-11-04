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

const href = (slug: string) => `/learn/guides/${slug}`;

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

// ─── Guide 2 — xml-sitemap-generator ────────────────────────────────────────
//
// Corrected against the UI: the generator is a section of Crawl details, not
// an Exports item; "indexable only" is fixed, not an option; changefreq has no
// by-depth mode (priority does); the index file is sitemap_index.xml; and a
// schedule does not remember sitemap options.

const SITEMAP_LINE = "Sitemap: https://your-site.com/sitemap.xml";

const sitemapEn: LearnBlock[] = [
  { k: "h2", t: "What a sitemap should and shouldn't contain" },
  {
    k: "p",
    t: "A sitemap is a list of URLs you want indexed, with optional hints about when each changed. Search engines treat it as a suggestion, not a command, so a sitemap full of redirects, noindexed pages and duplicates does more harm than good: it wastes crawl budget and tells the engine your signals can't be trusted.",
  },
  {
    k: "p",
    t: `${NB} builds the sitemap from the crawl, so it only contains pages that are **indexable** today: HTML, status 200, no \`noindex\`, not canonicalised to another URL. Pages robots.txt keeps out are never crawled, so they never get in either.`,
  },
  { k: "figure", art: "sitemap-funnel" },
  { k: "h2", t: "1. Crawl the site" },
  {
    k: "p",
    t: "Any completed crawl in **Spider (follow links)** mode works; list-mode crawls don't offer the generator. If part of the site shouldn't be listed (a staging folder, internal tools), exclude it before you start with **Advanced options → Configuration → Never crawl URLs matching**, or leave it out in the generator's options below.",
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Open the generator" },
  { k: "p", t: "On the crawl's results page, open **Crawl details** and then **Generate XML sitemap**. What it includes is fixed — indexable pages only — and the rest is yours to set:" },
  {
    k: "ul",
    items: [
      "**lastmod** — **Crawl date** (the default), the page's **Last-Modified header** when the server sends one, or **Leave out**. Use the header if your CMS sets it correctly; otherwise leave it out. A wrong lastmod is worse than no lastmod.",
      "**changefreq** and **priority** — **Leave out**, or a fixed value; priority can also go **By depth (1.0 for the home page)**. Most engines ignore both, so leaving them out is fine.",
      "**Leave out URLs matching (one per line)** — paths to exclude even if they are indexable.",
      "**Add an image sitemap** — a second file listing the images found on each page.",
    ],
  },
  { k: "h2", t: "3. Download and place the files" },
  {
    k: "p",
    t: "**Download .zip** gives you `sitemap.xml` — or, past 50,000 URLs, `sitemap-1.xml`, `sitemap-2.xml`… with a `sitemap_index.xml` that points at each one. Upload them to the root of the site, next to `robots.txt`, so the sitemap URL is `https://your-site.com/sitemap.xml` (or the index's).",
  },
  { k: "figure", art: "sitemap-index" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Tell the engines" },
  { k: "p", t: "Add one line to `robots.txt`:" },
  { k: "code", t: SITEMAP_LINE },
  {
    k: "p",
    t: `Then submit the same URL in Google Search Console under **Sitemaps**. On the next crawl, ${NB}'s **Sitemaps** family checks the result: **No XML sitemap found**, **Sitemap not declared in robots.txt**, **Non-indexable URL in the sitemap**, **Redirect in the sitemap** and **Error page in the sitemap** should all come back empty.`,
  },
  { k: "figure", art: "sitemap-where" },
  { k: "h2", t: "5. Keep it current" },
  {
    k: "p",
    t: "Regenerate after any structural change — new sections, removed pages, a migration. If you crawl on a **schedule**, every completed run is a fresh crawl to build from: open its **Crawl details**, set the options and download. The options are not saved with the schedule, so note the ones you chose.",
  },
];

const sitemapFr: LearnBlock[] = [
  { k: "h2", t: "Ce qu'un plan de site doit contenir, et ce qu'il doit laisser de côté" },
  {
    k: "p",
    t: "Un plan de site est la liste des URL que vous voulez voir indexées, avec, au besoin, une indication de leur dernière modification. Les moteurs de recherche le prennent comme une suggestion, pas comme un ordre : un plan de site rempli de redirections, de pages noindex et de doublons fait plus de tort que de bien. Il gaspille le budget d'exploration et apprend au moteur que vos signaux ne sont pas fiables.",
  },
  {
    k: "p",
    t: `${NB} construit le plan de site à partir de l'exploration; il ne contient donc que les pages **indexables** aujourd'hui : du HTML, un statut 200, aucun \`noindex\`, aucune URL canonique pointant ailleurs. Les pages que le robots.txt bloque ne sont jamais explorées, alors elles n'y entrent pas non plus.`,
  },
  { k: "figure", art: "sitemap-funnel" },
  { k: "h2", t: "1. Explorer le site" },
  {
    k: "p",
    t: "N'importe quelle exploration terminée en mode **Exploration (suivre les liens)** fait l'affaire; les explorations en mode liste n'offrent pas le générateur. Si une partie du site ne doit pas figurer dans le plan (un dossier de préproduction, des outils internes), excluez-la avant de lancer avec **Options avancées → Configuration → Ne jamais explorer les URL correspondant à**, ou écartez-la dans les options du générateur ci-dessous.",
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Ouvrir le générateur" },
  { k: "p", t: "Dans les résultats de l'exploration, ouvrez **Détails de l'exploration**, puis **Générer un plan de site XML**. Le contenu est fixe — les pages indexables seulement — et le reste vous appartient :" },
  {
    k: "ul",
    items: [
      "**lastmod** — **Date de l'exploration** (par défaut), l'**En-tête Last-Modified** de la page quand le serveur l'envoie, ou **Ne pas l'indiquer**. Prenez l'en-tête si votre CMS le règle correctement; sinon, ne l'indiquez pas. Un lastmod erroné est pire qu'aucun lastmod.",
      "**changefreq** et **priority** — **Ne pas l'indiquer**, ou une valeur fixe; priority peut aussi suivre **Selon la profondeur (1.0 pour l'accueil)**. La plupart des moteurs ignorent les deux : vous pouvez les laisser de côté.",
      "**Écarter les URL correspondant à (une par ligne)** — les chemins à exclure même s'ils sont indexables.",
      "**Ajouter un plan de site d'images** — un second fichier qui liste les images trouvées sur chaque page.",
    ],
  },
  { k: "h2", t: "3. Télécharger et placer les fichiers" },
  {
    k: "p",
    t: "**Télécharger le .zip** vous donne `sitemap.xml` — ou, au-delà de 50 000 URL, `sitemap-1.xml`, `sitemap-2.xml`… avec un `sitemap_index.xml` qui pointe vers chacun. Téléversez-les à la racine du site, à côté du `robots.txt`, pour que l'adresse du plan soit `https://your-site.com/sitemap.xml` (ou celle de l'index).",
  },
  { k: "figure", art: "sitemap-index" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Prévenir les moteurs" },
  { k: "p", t: "Ajoutez une ligne au `robots.txt` :" },
  { k: "code", t: SITEMAP_LINE },
  {
    k: "p",
    t: `Soumettez ensuite la même URL dans la Google Search Console, sous **Sitemaps**. À l'exploration suivante, la famille **Sitemaps** de ${NB} vérifie le résultat : **No XML sitemap found**, **Sitemap not declared in robots.txt**, **Non-indexable URL in the sitemap**, **Redirect in the sitemap** et **Error page in the sitemap** devraient tous revenir vides (les noms des règles s'affichent en anglais).`,
  },
  { k: "figure", art: "sitemap-where" },
  { k: "h2", t: "5. Le garder à jour" },
  {
    k: "p",
    t: "Régénérez-le après tout changement de structure — nouvelles sections, pages retirées, migration. Si vous explorez selon une **planification**, chaque exécution terminée est une exploration fraîche à partir de laquelle bâtir le fichier : ouvrez ses **Détails de l'exploration**, réglez les options et téléchargez. Les options ne sont pas enregistrées avec la planification; notez celles que vous avez choisies.",
  },
];

export const SITEMAP_GUIDE: LearnGuide = {
  slug: "xml-sitemap-generator",
  group: "nosy-bat",
  hero: "sitemap",
  howTo: true,
  order: 8,
  title: "Generate an XML sitemap from a crawl",
  description: `Build a sitemap that only lists pages search engines should index — from what ${NB} actually crawled, not from a guess.`,
  readingTime: 5,
  tag: NB,
  blurb: "Indexable pages only, built from a real crawl, split and indexed past 50,000 URLs.",
  cta: "crawler",
  related: [{ href: href("how-to-find-broken-links"), label: "How to find broken links", internal: true }],
  body: sitemapEn,
  fr: {
    title: "Générer un plan de site XML à partir d'une exploration",
    description: `Bâtissez un plan de site qui ne liste que les pages à indexer — à partir de ce que ${NB} a réellement exploré, pas d'une supposition.`,
    blurb: "Les pages indexables seulement, tirées d'une vraie exploration, découpées et indexées au-delà de 50 000 URL.",
    body: sitemapFr,
    related: [{ href: href("how-to-find-broken-links"), label: "Trouver les liens brisés", internal: true }],
  },
};

// ─── Guide 3 — web-scraping-with-custom-extraction ─────────────────────────
//
// Corrected against the UI: "multiple" is the checkbox All matches (up to 20);
// Starter has fewer custom searches than the other tiers (read from config);
// segments live in their own Advanced options section, are saved per site and
// apply from the next crawl; a JS snippet's return value lands on Extraction.
// The spec's "Export respects the filter" is not claimed — unverified.

const X = NOSY_BAT_GUIDE_FACTS;
const capsLine = (b: Base) =>
  b === "fr"
    ? `Jusqu'à ${X.extractors.starter}, ${X.extractors.growth} ou ${X.extractors.agency} extracteurs par exploration, sur ${X.names.starter}, ${X.names.growth} et ${X.names.agency}.`
    : `Up to ${X.extractors.starter}, ${X.extractors.growth} or ${X.extractors.agency} extractors per crawl on ${X.names.starter}, ${X.names.growth} and ${X.names.agency}.`;
const searchLine = (b: Base) =>
  b === "fr"
    ? `${X.searches.starter} recherches sur ${X.names.starter}, ${X.searches.top} à partir de ${X.names.growth}`
    : `${X.searches.starter} searches on ${X.names.starter}, ${X.searches.top} from ${X.names.growth} up`;

const extractionEn: LearnBlock[] = [
  { k: "h2", t: "What extraction is for" },
  {
    k: "p",
    t: "A crawl already collects the SEO facts about each page. Extraction collects **your** facts: the price on every product page, the author and date on every article, the schema type, the tracking tag, the text of a specific heading. The result is a table with one row per page and one column per extractor, exportable as CSV.",
  },
  {
    k: "p",
    t: "Typical uses: check that every product shows a price; list every post without an author; find pages whose breadcrumb is missing; confirm the analytics tag is on every page; collect all `og:image` values to find pages sharing one.",
  },
  { k: "h2", t: "The three ways to point at a value" },
  {
    k: "ul",
    items: [
      "**CSS selector** — the simplest. `h1`, `.price`, `meta[property=\"og:title\"]`. Name an **Attribute (optional)** such as `content` or `href`, or leave it empty for the text.",
      "**XPath** — when you need structure: `//div[@class=\"price\"]/span[2]`, or \"the paragraph after this heading\".",
      "**Regex** — run against the raw HTML, for things that aren't elements: an order ID pattern, a tracking ID, a date inside a script. It returns its first capture group, or the whole match.",
    ],
  },
  {
    k: "p",
    t: "**Start from a preset** prefills the common ones: **Open Graph tags**, **Product price and SKU**, **Author and date**, **hreflang** and **Canonical**.",
  },
  { k: "figure", art: "extraction-selector" },
  { k: "h2", t: "1. Add extractors before the crawl" },
  {
    k: "p",
    t: `**New crawl → Advanced options → Extraction & search**. Under **Custom extraction**, choose **Add extractor**, give it a **Name**, pick its **Type**, paste the **Expression**, and tick **All matches (up to 20)** if a page can hold several values (every product on a category page). ${capsLine("en")}`,
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Add a custom search (optional)" },
  {
    k: "p",
    t: `The same section takes a **Custom search**: a string or pattern counted in every HTML page's source — ${searchLine("en")}. The count appears in the **Custom search** column on **Pages**, and the filter **gtag: not found** answers "which pages don't contain \`gtag(\`" in one click.`,
  },
  { k: "h2", t: "3. Read the Extraction tab" },
  {
    k: "p",
    t: "After the crawl, **Data → Extraction** shows the URL plus one column per extractor. Filter to **Author: empty** — or **has a value** — to find the pages that are missing something, and take the table away with **Exports → Extraction (CSV)**.",
  },
  { k: "figure", art: "extraction-table" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Turn values into segments" },
  {
    k: "p",
    t: "In **Advanced options → Segments**, choose **Add segment** with the rule **Extracted value equals** — \"pages where `type` = product\" — and **Save for this site**. Segments apply from the site's next crawl; from then on Issues, Pages, Compare and every CSV can be filtered to the segment. This is how you check \"do all product pages have structured data\" without touching a spreadsheet.",
  },
  { k: "figure", art: "extraction-segments" },
  { k: "h2", t: "5. Pages built by JavaScript" },
  {
    k: "p",
    t: "If the value only exists after JavaScript runs, set **JavaScript rendering** to **Thin pages only** or **All pages** and the extractors read the rendered page. On a **verified site** you can also add **Custom JavaScript** — **Scroll to the bottom**, **Click “load more”**, **Read window.dataLayer**, or your own function — and the value each snippet returns appears on the Extraction tab.",
  },
  { k: "h2", t: "Limits and manners" },
  {
    k: "p",
    t: `${NB} identifies itself as Echorank360Bot, obeys robots.txt and stays under two requests a second, on your site and on any other. Extraction is for sites you own or have permission to crawl; it is not a way around a site's terms. Custom JavaScript and the Googlebot or custom user agents are only available on sites you have verified as yours.`,
  },
];

const extractionFr: LearnBlock[] = [
  { k: "h2", t: "À quoi sert l'extraction" },
  {
    k: "p",
    t: "Une exploration recueille déjà les faits SEO de chaque page. L'extraction recueille **vos** faits : le prix sur chaque fiche produit, l'auteur et la date de chaque article, le type de données structurées, la balise de suivi, le texte d'un intertitre précis. Le résultat est un tableau d'une ligne par page et d'une colonne par extracteur, exportable en CSV.",
  },
  {
    k: "p",
    t: "Usages courants : vérifier que chaque produit affiche un prix; lister les articles sans auteur; trouver les pages sans fil d'Ariane; confirmer que la balise d'analyse est partout; recueillir toutes les valeurs `og:image` pour repérer les pages qui partagent la même.",
  },
  { k: "h2", t: "Trois façons de désigner une valeur" },
  {
    k: "ul",
    items: [
      "**Sélecteur CSS** — le plus simple. `h1`, `.price`, `meta[property=\"og:title\"]`. Indiquez un **Attribut (facultatif)** comme `content` ou `href`, ou laissez-le vide pour obtenir le texte.",
      "**XPath** — quand la structure compte : `//div[@class=\"price\"]/span[2]`, ou « le paragraphe qui suit cet intertitre ».",
      "**Expression régulière** — appliquée au HTML brut, pour ce qui n'est pas un élément : un format de numéro de commande, un identifiant de suivi, une date dans un script. Elle renvoie son premier groupe de capture, ou la correspondance entière.",
    ],
  },
  {
    k: "p",
    t: "**Partir d'un modèle** préremplit les cas courants : **Balises Open Graph**, **Prix et code produit**, **Auteur et date**, **hreflang** et **URL canonique**.",
  },
  { k: "figure", art: "extraction-selector" },
  { k: "h2", t: "1. Ajouter les extracteurs avant l'exploration" },
  {
    k: "p",
    t: `**Nouvelle exploration → Options avancées → Extraction et recherche**. Sous **Extraction personnalisée**, choisissez **Ajouter un extracteur**, donnez-lui un **Nom**, choisissez son **Type**, collez l'**Expression**, et cochez **Toutes les correspondances (20 au plus)** si une page peut contenir plusieurs valeurs (chaque produit d'une page de catégorie). ${capsLine("fr")}`,
  },
  { k: "guideCta", at: "inline" },
  { k: "h2", t: "2. Ajouter une recherche personnalisée (facultatif)" },
  {
    k: "p",
    t: `La même section accepte une **Recherche personnalisée** : un texte ou un motif compté dans le code source de chaque page HTML — ${searchLine("fr")}. Le compte apparaît dans la colonne **Recherche personnalisée** de **Pages**, et le filtre **gtag : absent** répond en un clic à « quelles pages ne contiennent pas \`gtag(\` ».`,
  },
  { k: "h2", t: "3. Lire l'onglet Extraction" },
  {
    k: "p",
    t: "Après l'exploration, **Données → Extraction** affiche l'URL et une colonne par extracteur. Filtrez sur **Author : vide** — ou **a une valeur** — pour trouver les pages auxquelles il manque quelque chose, et emportez le tableau avec **Exports → Extraction (CSV)**.",
  },
  { k: "figure", art: "extraction-table" },
  { k: "guideCta", at: "nudge" },
  { k: "h2", t: "4. Faire des valeurs des segments" },
  {
    k: "p",
    t: "Dans **Options avancées → Segments**, choisissez **Ajouter un segment** avec la règle **La valeur extraite est** — « les pages où `type` = product » — puis **Enregistrer pour ce site**. Les segments s'appliquent à partir de la prochaine exploration du site; dès lors, Problèmes, Pages, Comparer et chaque CSV peuvent être filtrés sur le segment. Voilà comment vérifier « toutes les fiches produit ont-elles des données structurées? » sans ouvrir de tableur.",
  },
  { k: "figure", art: "extraction-segments" },
  { k: "h2", t: "5. Les pages construites en JavaScript" },
  {
    k: "p",
    t: "Si la valeur n'existe qu'après l'exécution du JavaScript, réglez le **Rendu JavaScript** sur **Pages minces seulement** ou **Toutes les pages** : les extracteurs liront la page rendue. Sur un **site vérifié**, vous pouvez aussi ajouter du **JavaScript personnalisé** — défiler jusqu'en bas, cliquer sur « charger plus », lire window.dataLayer ou votre propre fonction — et la valeur que renvoie chaque extrait apparaît dans l'onglet Extraction.",
  },
  { k: "h2", t: "Limites et savoir-vivre" },
  {
    k: "p",
    t: `${NB} s'identifie comme Echorank360Bot, respecte le robots.txt et reste sous deux requêtes par seconde, sur votre site comme sur tout autre. L'extraction sert aux sites qui vous appartiennent ou que vous avez la permission d'explorer; ce n'est pas un moyen de contourner les conditions d'un site. Le JavaScript personnalisé et les agents utilisateurs Googlebot ou personnalisés ne sont offerts que sur les sites dont vous avez vérifié la propriété.`,
  },
];

export const EXTRACTION_GUIDE: LearnGuide = {
  slug: "web-scraping-with-custom-extraction",
  group: "nosy-bat",
  hero: "extraction",
  // Article only (spec): this guide is a reference as much as a walkthrough.
  howTo: false,
  order: 9,
  title: "Web scraping with custom extraction",
  description: "Pull prices, SKUs, authors, dates or any value from every page of a site in one crawl — with CSS selectors, XPath or a regular expression.",
  readingTime: 6,
  tag: NB,
  blurb: "Your own columns on every page: CSS, XPath or regex, then filter and segment by them.",
  cta: "crawler",
  related: [
    { href: href("how-to-find-broken-links"), label: "How to find broken links", internal: true },
    { href: "/learn", label: "Learn SEO →", internal: true },
  ],
  body: extractionEn,
  fr: {
    title: "Extraire des données de chaque page avec l'extraction personnalisée",
    description: "Récupérez prix, codes produit, auteurs, dates ou toute autre valeur sur chaque page d'un site, en une exploration — avec des sélecteurs CSS, XPath ou une expression régulière.",
    blurb: "Vos propres colonnes sur chaque page : CSS, XPath ou expression régulière, puis filtres et segments.",
    body: extractionFr,
    related: [
      { href: href("how-to-find-broken-links"), label: "Trouver les liens brisés", internal: true },
      { href: "/learn", label: "Apprendre le SEO →", internal: true },
    ],
  },
};

export const NOSY_BAT_GUIDES: LearnGuide[] = [BROKEN_LINKS_GUIDE, SITEMAP_GUIDE, EXTRACTION_GUIDE];
