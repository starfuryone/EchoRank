// src/lib/site-crawler/marketing-copy.ts
//
// The ONE copy source for what the crawler does, on every public surface: the
// /site-crawler page, the "what the crawler checks" guide, and anything after
// them. en + fr; de-CH and the other marketing locales fold to en.
//
// GATED, NOT PROMISED. Every item carries a gate, evaluated server-side at
// render:
//   { family }  — that rule family is in the registry (packages/crawl-rules);
//   { flag }    — FLAGS[...] is on in production (src/lib/flags.ts);
//   { always }  — shown.
// A closed gate renders nothing: no placeholder, no "coming soon". Phase 4
// sub-phases flip flags and add rows here; they do not touch the pages.
//
// The brand name is read from CRAWLER_BRAND, never spelled out, so the
// brand test (tests/nosy-bat-brand.test.ts) holds here too.
//
// Dependency-light on purpose: no registry import. Callers pass the set of
// family ids, which is what lets a test stub the registry.

import { CRAWLER_BRAND } from "./brand";
import { CRAWL_PIN_MAX, MAX_EXTERNAL_LINKS_PER_PAGE } from "./constants";
import { FREE_CRAWL_RETENTION_DAYS, FREE_CRAWL_URL_CAP } from "./free-limits";
import { flag as flagOn, FLAGS, type FlagName, type Flags } from "@/lib/flags";
import type { CrawlCadence, PlanConfig } from "@/lib/plan-config";

export type CopyBase = "en" | "fr";
type Text = Readonly<Record<CopyBase, string>>;

export type CrawlGate = { family: string } | { flag: FlagName } | { always: true };

export interface CrawlCapability {
  /** Anchor and stable key, kebab-case. */
  id: string;
  gate: CrawlGate;
  title: Text;
  body: Text;
  /** A longer body that replaces `body` once this flag is on. */
  whenFlag?: { flag: FlagName; body: Text };
}

const NB = CRAWLER_BRAND.name;

export const CRAWL_INTRO: Text = {
  en: `${NB} is the site crawler inside Echorank. It fetches every page the way a search engine would, runs each one through the rule library, and keeps the evidence next to every finding. A crawl collects, among other things:`,
  fr: `${NB} est le robot d'exploration intégré à Echorank. Il lit chaque page comme le ferait un moteur de recherche, la passe dans la bibliothèque de règles et garde la preuve à côté de chaque constat. Une exploration recueille, entre autres :`,
};

export const CRAWL_CLOSER: Text = {
  en: "Every finding is an issue, a warning or an opportunity. Each shows its evidence and how to fix it. Nothing is guessed: a check that can't be read is marked not assessable, not failed.",
  fr: "Chaque constat est un problème, un avertissement ou une occasion. Chacun montre sa preuve et comment le corriger. Rien n'est deviné : une vérification impossible à lire est marquée non évaluable, pas échouée.",
};

const cap = (
  id: string,
  gate: CrawlGate,
  en: [string, string],
  fr: [string, string],
  whenFlag?: CrawlCapability["whenFlag"],
): CrawlCapability => ({ id, gate, title: { en: en[0], fr: fr[0] }, body: { en: en[1], fr: fr[1] }, ...(whenFlag ? { whenFlag } : {}) });

export const CRAWL_CAPABILITIES: readonly CrawlCapability[] = [
  cap("response-codes", { family: "response_codes" },
    ["Response codes", "Broken links and server errors: no response, timeouts, 4XX and 5XX, on internal and external URLs, each with the page it was found on."],
    ["Codes de réponse", "Liens brisés et erreurs serveur : absence de réponse, délais dépassés, 4XX et 5XX, sur les URL internes et externes, chacun avec la page où on l'a trouvé."]),
  cap("redirects", { family: "response_codes" },
    ["Redirects", "301s, 302s and meta refresh, every hop of a chain, and loops."],
    ["Redirections", "301, 302 et meta refresh, chaque saut d'une chaîne, et les boucles."],
    {
      flag: "crawl.render",
      body: {
        en: "301s, 302s, meta refresh and, on rendered pages, JavaScript redirects, every hop of a chain, and loops.",
        fr: "301, 302, meta refresh et, sur les pages rendues, redirections JavaScript, chaque saut d'une chaîne, et les boucles.",
      },
    }),
  cap("blocked-urls", { family: "response_codes" },
    ["Blocked URLs", "Pages the live robots.txt keeps crawlers out of."],
    ["URL bloquées", "Les pages dont le robots.txt en ligne interdit l'accès aux robots."],
    {
      flag: "crawl.customRobots",
      body: {
        en: "Pages the live robots.txt keeps crawlers out of, and what a draft robots.txt would change, before you publish it.",
        fr: "Les pages dont le robots.txt en ligne interdit l'accès aux robots, et ce qu'un brouillon de robots.txt changerait, avant que vous le publiiez.",
      },
    }),
  cap("external-links", { flag: "crawl.externalLinks" },
    ["External links", "Every outbound link with its status code, anchor text and source page."],
    ["Liens externes", "Chaque lien sortant avec son code de réponse, son texte d'ancre et sa page source."]),
  // The directory breakdown is drawn by the Structure tab (4c).
  cap("site-structure", { flag: "crawl.visualise" },
    ["Site structure", "Indexability and crawl depth by directory, orphan pages, and the pages that carry the most internal links."],
    ["Structure du site", "Indexabilité et profondeur d'exploration par répertoire, pages orphelines, et les pages qui portent le plus de liens internes."]),
  cap("internal-linking", { family: "links" },
    ["Internal linking", "Inlink and outlink counts per page, nofollow links, pages reachable from only one place, links to redirects, links with parameters."],
    ["Maillage interne", "Nombre de liens entrants et sortants par page, liens nofollow, pages accessibles depuis un seul endroit, liens vers des redirections, liens avec paramètres."]),
  cap("anchor-text", { family: "links" },
    ["Anchor text", "Every anchor, aggregated and per link, with the non-descriptive ones (\"click here\", \"read more\") flagged."],
    ["Texte d'ancre", "Chaque ancre, regroupée et lien par lien, avec les ancres peu descriptives (« cliquez ici », « en savoir plus ») signalées."]),
  cap("security", { family: "security" },
    ["Security", "HTTP pages, mixed content, forms posting over HTTP, missing HSTS, CSP, X-Content-Type-Options, X-Frame-Options and Referrer-Policy headers, unsafe target=_blank."],
    ["Sécurité", "Pages en HTTP, contenu mixte, formulaires envoyés en HTTP, en-têtes HSTS, CSP, X-Content-Type-Options, X-Frame-Options et Referrer-Policy absents, target=_blank non sécurisé."]),
  cap("url-issues", { family: "url" },
    ["URL issues", "Non-ASCII characters, underscores, uppercase, parameters, over-long URLs, repeated path segments, multiple slashes, trailing-slash variants."],
    ["Problèmes d'URL", "Caractères non ASCII, traits de soulignement, majuscules, paramètres, URL trop longues, segments de chemin répétés, barres obliques multiples, variantes avec et sans barre finale."]),
  cap("page-titles", { family: "page_titles" },
    ["Page titles", "Missing, duplicate, long, short, multiple, same as the H1, measured in characters and pixels."],
    ["Titres de page", "Absents, en double, trop longs, trop courts, multiples, identiques au H1, mesurés en caractères et en pixels."]),
  cap("meta-descriptions", { family: "meta_description" },
    ["Meta descriptions", "Missing, duplicate, long, short, multiple, measured in characters and pixels."],
    ["Méta-descriptions", "Absentes, en double, trop longues, trop courtes, multiples, mesurées en caractères et en pixels."]),
  cap("headings", { family: "h1" },
    ["Headings", "H1 and H2 missing, duplicate, long, empty, multiple, or out of sequence."],
    ["Intertitres", "H1 et H2 absents, en double, trop longs, vides, multiples ou hors séquence."]),
  cap("content", { family: "content" },
    ["Content", "Word count, readability, thin pages, placeholder text, soft 404s, text-to-HTML ratio, missing language attribute."],
    ["Contenu", "Nombre de mots, lisibilité, pages trop minces, texte de remplissage, fausses 404, ratio texte/HTML, attribut de langue absent."]),
  cap("directives", { family: "directives" },
    ["Directives", "noindex, nofollow, none, noarchive, nosnippet and the rest, in meta robots or X-Robots-Tag, and the conflicts between them."],
    ["Directives", "noindex, nofollow, none, noarchive, nosnippet et les autres, dans la balise meta robots ou l'en-tête X-Robots-Tag, et les conflits entre eux."]),
  cap("canonicals", { family: "canonicals" },
    ["Canonicals", "Link elements and HTTP headers, canonicals that point at redirects, errors or noindexed pages, header-vs-HTML mismatches."],
    ["Canoniques", "Éléments link et en-têtes HTTP, canoniques qui pointent vers des redirections, des erreurs ou des pages en noindex, écarts entre l'en-tête et le HTML."]),
  cap("pagination", { family: "pagination" },
    ["Pagination", "rel=\"next\" and rel=\"prev\" targets, sequence errors, paginated pages canonicalised to the first."],
    ["Pagination", "Cibles rel=\"next\" et rel=\"prev\", erreurs de séquence, pages paginées canonisées vers la première."]),
  cap("hreflang", { family: "hreflang" },
    ["hreflang", "Missing return tags, missing self-reference and x-default, invalid language or region codes, hreflang to non-200 or noindexed pages."],
    ["hreflang", "Balises de retour absentes, autoréférence et x-default absents, codes de langue ou de région invalides, hreflang vers des pages non 200 ou en noindex."]),
  cap("duplicate-content", { family: "content" },
    ["Duplicate content", "Exact duplicates by content hash, near-duplicates by similarity, and repeated titles, descriptions and headings across the site."],
    ["Contenu dupliqué", "Doublons exacts par empreinte du contenu, quasi-doublons par similarité, et titres, descriptions et intertitres répétés d'une page à l'autre."]),
  cap("rendering", { flag: "crawl.render" },
    ["Rendering", "JavaScript sites rendered in headless Chromium, so React, Vue and Angular pages are crawled as a search engine sees them."],
    ["Rendu", "Les sites JavaScript sont rendus dans Chromium sans interface, pour que les pages React, Vue et Angular soient explorées comme un moteur de recherche les voit."]),
  cap("javascript", { family: "javascript" },
    ["JavaScript dependence", "Content, links, titles, descriptions, headings and canonicals that exist only after JavaScript runs, and noindex tags that JavaScript adds or removes."],
    ["Dépendance au JavaScript", "Contenu, liens, titres, descriptions, intertitres et canoniques qui n'existent qu'une fois le JavaScript exécuté, et balises noindex que le JavaScript ajoute ou retire."]),
  cap("images", { family: "images" },
    ["Images", "Missing alt text, over-long alt text, alt equal to the filename, missing width and height, oversized files, broken images."],
    ["Images", "Texte alternatif absent ou trop long, texte alternatif identique au nom de fichier, largeur et hauteur absentes, fichiers trop lourds, images brisées."]),
  cap("validation", { family: "validation" },
    ["Validation", "Missing doctype, elements in the wrong place in <head>, duplicate <html> or <body>, missing viewport: the things that stop a bot parsing a page reliably."],
    ["Validation", "Doctype absent, éléments mal placés dans <head>, <html> ou <body> en double, viewport absent : ce qui empêche un robot de lire une page de façon fiable."]),
  cap("user-agent", { flag: "crawl.config" },
    ["User agent", `Crawl as ${NB}, as Googlebot smartphone or desktop, or as any custom string on a site you have verified.`],
    ["Agent utilisateur", `Explorez en tant que ${NB}, que Googlebot mobile ou ordinateur, ou avec la chaîne de votre choix sur un site que vous avez vérifié.`]),
  cap("custom-headers", { flag: "crawl.config" },
    ["Custom headers and cookies", "Send your own request headers, a cookie string or HTTP basic auth with every request to the site you crawl."],
    ["En-têtes et témoins personnalisés", "Envoyez vos propres en-têtes de requête, une chaîne de témoins ou une authentification HTTP de base à chaque requête vers le site exploré."]),
  cap("custom-search", { flag: "crawl.extraction" },
    ["Custom source search", "Search every page's source for a string or a pattern: a tracking tag, a keyword, a snippet of code."],
    ["Recherche dans le code source", "Cherchez une chaîne ou un motif dans le code source de chaque page : une balise de suivi, un mot-clé, un extrait de code."]),
  cap("custom-extraction", { flag: "crawl.extraction" },
    ["Custom extraction", "Pull any value from the HTML with CSS selectors, XPath or a regular expression: prices, SKUs, authors, dates, social tags."],
    ["Extraction personnalisée", "Extrayez n'importe quelle valeur du HTML avec des sélecteurs CSS, XPath ou une expression régulière : prix, codes produit, auteurs, dates, balises sociales."]),
  cap("custom-javascript", { flag: "crawl.customJs" },
    ["Custom JavaScript", "Run your own snippet in the rendered page and keep what it returns: scroll, click \"load more\", read a data layer."],
    ["JavaScript personnalisé", "Exécutez votre propre extrait dans la page rendue et conservez ce qu'il renvoie : défiler, cliquer sur « afficher plus », lire une couche de données."]),
  cap("google-analytics", { flag: "crawl.ga4" },
    ["Google Analytics", "GA4 sessions, users, engagement and key events per landing page, on the same row as the crawl data."],
    ["Google Analytics", "Sessions, utilisateurs, engagement et événements clés GA4 par page d'arrivée, sur la même ligne que les données d'exploration."]),
  cap("search-console", { flag: "crawl.gsc" },
    ["Search Console", "Clicks, impressions, CTR and position per page for the last 28 days, joined to every crawled URL."],
    ["Search Console", "Clics, impressions, CTR et position par page sur les 28 derniers jours, joints à chaque URL explorée."]),
  cap("pagespeed", { flag: "crawl.psi" },
    ["PageSpeed Insights", "Lighthouse scores, Core Web Vitals field data and the top performance opportunities for the pages you choose."],
    ["PageSpeed Insights", "Scores Lighthouse, données terrain des Core Web Vitals et principales occasions de performance pour les pages que vous choisissez."]),
  cap("mobile-usability", { family: "mobile" },
    ["Mobile usability", "Viewport, font size, tap targets and content wider than the screen, from the rendered page."],
    ["Ergonomie mobile", "Viewport, taille de police, zones tactiles et contenu plus large que l'écran, d'après la page rendue."],
    {
      flag: "crawl.psi",
      body: {
        en: "Viewport, font size, tap targets and content wider than the screen, from the rendered page and Lighthouse.",
        fr: "Viewport, taille de police, zones tactiles et contenu plus large que l'écran, d'après la page rendue et Lighthouse.",
      },
    }),
  cap("backlinks", { flag: "crawl.backlinks" },
    ["Backlink metrics", "Referring domains and backlink counts per URL, so you know which broken or redirecting pages are costing you links."],
    ["Métriques de liens entrants", "Domaines référents et nombre de liens entrants par URL, pour savoir quelles pages brisées ou redirigées vous coûtent des liens."]),
  cap("xml-sitemaps", { flag: "crawl.sitemapGen" },
    ["XML sitemaps", "Generate a sitemap and an image sitemap from the crawl, indexable pages only, split automatically at 50,000 URLs."],
    ["Plans de site XML", "Générez un plan de site et un plan de site d'images à partir de l'exploration, pages indexables seulement, découpés automatiquement à 50 000 URL."]),
  cap("sitemap-analysis", { family: "sitemaps" },
    ["Sitemap analysis", "Read the site's XML sitemaps during the crawl to find URLs that are missing, non-indexable, redirecting, broken or orphaned."],
    ["Analyse des plans de site", "Lisez les plans de site XML pendant l'exploration pour repérer les URL absentes, non indexables, redirigées, brisées ou orphelines."]),
  cap("custom-robots", { flag: "crawl.customRobots" },
    ["Custom robots.txt", "Edit a copy of the site's robots.txt and test which URLs it would allow or block."],
    ["robots.txt personnalisé", "Modifiez une copie du robots.txt du site et vérifiez quelles URL il autoriserait ou bloquerait."]),
  cap("amp", { flag: "crawl.amp" },
    ["AMP", "Find AMP URLs, validate them with the official validator, and check the canonical links in both directions."],
    ["AMP", "Repérez les URL AMP, validez-les avec le validateur officiel et vérifiez les liens canoniques dans les deux sens."]),
  cap("visualisations", { flag: "crawl.visualise" },
    ["Visualisations", "Directory tree, crawl tree and a force-directed internal-link graph, coloured by indexability and sized by inlinks."],
    ["Visualisations", "Arborescence des répertoires, arbre d'exploration et graphe du maillage interne, colorés selon l'indexabilité et dimensionnés selon les liens entrants."]),
  cap("structured-data", { family: "structured_data" },
    ["Structured data", "Extract JSON-LD and microdata, catch parse errors, and check required and recommended properties for common schema.org types."],
    ["Données structurées", "Extrayez le JSON-LD et les microdonnées, repérez les erreurs d'analyse et vérifiez les propriétés obligatoires et recommandées des types schema.org courants."]),
  cap("spelling", { family: "spelling" },
    ["Spelling", "Spell-check page copy in English, French and German, with your own brand words whitelisted."],
    ["Orthographe", "Vérifiez l'orthographe du texte des pages en anglais, en français et en allemand, avec vos propres mots de marque sur liste blanche."],
    {
      flag: "crawl.ai",
      body: {
        en: "Spell-check page copy in English, French and German, with your own brand words whitelisted. Grammar checks run through the AI prompts.",
        fr: "Vérifiez l'orthographe du texte des pages en anglais, en français et en allemand, avec vos propres mots de marque sur liste blanche. La grammaire se vérifie avec les requêtes IA.",
      },
    }),
  cap("accessibility", { family: "accessibility" },
    ["Accessibility", "Automated WCAG 2.1 AA checks with the axe-core rule set on every rendered page."],
    ["Accessibilité", "Vérifications WCAG 2.1 AA automatisées avec les règles axe-core sur chaque page rendue."]),
  cap("forms-login", { flag: "crawl.login" },
    ["Forms-based authentication", "Log in through your site's own login form before crawling, to audit the pages behind it. Your verified sites only; logout links are never followed."],
    ["Authentification par formulaire", "Connectez-vous via le formulaire de connexion de votre site avant l'exploration, pour auditer les pages protégées. Sur vos sites vérifiés seulement ; les liens de déconnexion ne sont jamais suivis."]),
  cap("index-status", { flag: "crawl.inspection" },
    ["Index status", "What Google reports for each page: indexed or not, its chosen canonical, last crawl."],
    ["État d'indexation", "Ce que Google indique pour chaque page : indexée ou non, l'URL canonique retenue, la dernière exploration."]),
  cap("semantic-duplicates", { flag: "crawl.semantic" },
    ["Semantic duplicates", "Pages that say the same thing in different words, and pages that don't belong on the site."],
    ["Doublons sémantiques", "Les pages qui disent la même chose avec d'autres mots, et celles qui n'ont pas leur place sur le site."]),
  cap("ai-prompts", { flag: "crawl.ai" },
    ["AI prompts", "Run up to three prompts per crawl against page content with Claude, OpenAI or Gemini: classify intent, summarise, suggest titles, check grammar."],
    ["Requêtes IA", "Lancez jusqu'à trois requêtes par exploration sur le contenu des pages avec Claude, OpenAI ou Gemini : classer l'intention, résumer, proposer des titres, vérifier la grammaire."]),
  cap("segments", { flag: "crawl.segments" },
    ["Segments", "Group pages by URL pattern, extracted value, depth or status, and filter every table and total by segment."],
    ["Segments", "Regroupez les pages par motif d'URL, valeur extraite, profondeur ou statut, et filtrez chaque tableau et chaque total par segment."]),
  cap("crawl-comparison", { flag: "crawl.compare" },
    ["Crawl comparison", "Diff two crawls: pages added or removed, issues fixed or introduced, element changes, with URL mapping to compare staging against production."],
    ["Comparaison d'explorations", "Comparez deux explorations : pages ajoutées ou retirées, problèmes corrigés ou apparus, éléments modifiés, avec une correspondance d'URL pour comparer la préproduction à la production."]),
  // Phase 4c. Each claim behind its own flag: Sheets and the Looker Studio
  // guide wait for crawl.sheets (an operator step), and no card mentions a
  // Looker Studio template until one is published (TODO(fred)).
  cap("scheduling", { flag: "crawl.schedule" },
    ["Scheduling", "Daily, weekly or monthly crawls on a fixed day and hour, each one compared with the run before it."],
    ["Planification", "Explorations quotidiennes, hebdomadaires ou mensuelles à jour et heure fixes, chacune comparée à la précédente."],
    {
      flag: "crawl.sheets",
      body: {
        en: "Daily, weekly or monthly crawls on a fixed day and hour, each one compared with the run before it and written to Google Sheets, ready to chart in Looker Studio.",
        fr: "Explorations quotidiennes, hebdomadaires ou mensuelles à jour et heure fixes, chacune comparée à la précédente et écrite dans Google Sheets, prête à être suivie dans Looker Studio.",
      },
    }),
  cap("reports", { flag: "crawl.reports" },
    ["Reports", "A PDF report for every crawl — totals, the top issues with their evidence, segments and the changes since the last crawl — and scheduled results emailed with the changes and links to the CSVs."],
    ["Rapports", "Un rapport PDF pour chaque exploration — totaux, principaux problèmes avec leur preuve, segments et changements depuis la dernière exploration — et les résultats planifiés envoyés par courriel avec les changements et les liens vers les CSV."]),
  cap("list-mode", { flag: "crawl.listMode" },
    ["List mode", "Paste or upload a URL list and check status and redirect chains without crawling, for migrations."],
    ["Mode liste", "Collez ou téléversez une liste d'URL et vérifiez les codes et les chaînes de redirection sans explorer, pour les migrations."]),
  cap("csv-export", { always: true },
    ["CSV export", "Every table — issues, pages, duplicates, redirects — exports to CSV."],
    ["Export CSV", "Chaque tableau — problèmes, pages, doublons, redirections — s'exporte en CSV."]),
];

// ─── Gates ──────────────────────────────────────────────────────────────────

export interface GateContext {
  /** Rule family ids present in the registry. Empty when the package is absent. */
  families: ReadonlySet<string>;
  flags?: Flags;
}

export function gateOpen(gate: CrawlGate, ctx: GateContext): boolean {
  if ("always" in gate) return gate.always === true;
  if ("family" in gate) return ctx.families.has(gate.family);
  return flagOn(gate.flag, ctx.flags ?? FLAGS);
}

export function visibleCapabilities(ctx: GateContext): CrawlCapability[] {
  return CRAWL_CAPABILITIES.filter((c) => gateOpen(c.gate, ctx));
}

/** The body to show: the longer one when its flag is on. */
export function capabilityBody(c: CrawlCapability, base: CopyBase, flags: Flags = FLAGS): string {
  return c.whenFlag && flagOn(c.whenFlag.flag, flags) ? c.whenFlag.body[base] : c.body[base];
}

// ─── Feature table ──────────────────────────────────────────────────────────
//
// The 32 rows of SITE-CRAWLER-PHASE4.md's feature table, in its order. Caps are
// READ from plan-config.ts; a row whose cap is not in the config yet shows a
// tick. Phase 4 adds each cap to PlanConfig and its `cap` reader here in the
// same commit that flips the row's flag.

export const CRAWL_PLANS = ["STARTER", "GROWTH", "AGENCY"] as const;
export type CrawlPlan = (typeof CRAWL_PLANS)[number];

export interface CrawlFeatureRow {
  id: string;
  label: Text;
  gate: CrawlGate;
  /** Reads this row's cap from the plan config; absent = no cap (a tick). */
  cap?: (plan: PlanConfig, base: CopyBase) => string;
}

const fmt = (n: number, base: CopyBase) => new Intl.NumberFormat(base === "fr" ? "fr-CA" : "en-US").format(n);

const row = (id: string, gate: CrawlGate, en: string, fr: string, capFn?: CrawlFeatureRow["cap"]): CrawlFeatureRow => ({
  id,
  gate,
  label: { en, fr },
  ...(capFn ? { cap: capFn } : {}),
});

const CADENCE: Record<CopyBase, Record<CrawlCadence, string>> = {
  en: { daily: "daily", weekly: "weekly", monthly: "monthly" },
  fr: { daily: "quotidienne", weekly: "hebdomadaire", monthly: "mensuelle" },
};

/** "2 scheduled crawls · weekly or monthly", from crawlSchedules / crawlScheduleCadences. */
function scheduleCell(p: PlanConfig, b: CopyBase): string {
  const list = p.crawlScheduleCadences.map((c) => CADENCE[b][c]);
  const or = b === "fr" ? " ou " : " or ";
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")}${or}${list[list.length - 1]}` : (list[0] ?? "");
  if (b === "fr") return `${fmt(p.crawlSchedules, b)} ${p.crawlSchedules > 1 ? "explorations planifiées" : "exploration planifiée"} · ${joined}`;
  return `${fmt(p.crawlSchedules, b)} ${p.crawlSchedules > 1 ? "scheduled crawls" : "scheduled crawl"} · ${joined}`;
}

export const CRAWL_FEATURE_ROWS: readonly CrawlFeatureRow[] = [
  row("broken-links", { family: "response_codes" }, "Find broken links, errors & redirects", "Liens brisés, erreurs et redirections"),
  // Phase 4g: the same on every plan (a per-page limit, not a plan cap).
  row("external-links", { flag: "crawl.externalLinks" }, "External links", "Liens externes", (_p, b) =>
    b === "fr" ? `${fmt(MAX_EXTERNAL_LINKS_PER_PAGE, b)} par page, code vérifié une fois par exploration` : `${fmt(MAX_EXTERNAL_LINKS_PER_PAGE, b)} per page, status checked once per crawl`),
  row("link-score", { flag: "crawl.linkScore" }, "Link Score", "Link Score", (_p, b) =>
    b === "fr" ? "Toutes les pages explorées" : "Every crawled page"),
  // Phase 4g caps per crawl, from plan-config (on the tenant's own OpenAI key).
  row("semantic-duplicates", { flag: "crawl.semantic" }, "Semantic duplicates", "Doublons sémantiques", (p, b) =>
    b === "fr" ? `${fmt(p.crawlSemanticPages, b)} pages par exploration` : `${fmt(p.crawlSemanticPages, b)} pages per crawl`),
  row("index-status", { flag: "crawl.inspection" }, "Index status", "État d'indexation", (p, b) =>
    b === "fr" ? `${fmt(p.crawlInspectionPages, b)} pages par exploration` : `${fmt(p.crawlInspectionPages, b)} pages per crawl`),
  row("titles-meta", { family: "page_titles" }, "Analyse page titles & meta data", "Analyse des titres et métadonnées"),
  row("directives", { family: "directives" }, "Review meta robots & directives", "Meta robots et directives"),
  row("hreflang", { family: "hreflang" }, "Audit hreflang attributes", "Audit des attributs hreflang"),
  row("exact-duplicates", { family: "content" }, "Discover exact duplicate pages", "Pages en double exact"),
  row("xml-sitemaps", { flag: "crawl.sitemapGen" }, "Generate XML sitemaps", "Génération de plans de site XML"),
  row("visualisations", { flag: "crawl.visualise" }, "Site visualisations", "Visualisations du site"),
  // Live today: the per-plan URL cap and monthly crawls are the tier caps.
  row("crawl-limit", { always: true }, "Crawl limit", "Limite d'exploration", (p, b) =>
    b === "fr"
      ? `${fmt(p.crawlUrlCap, b)} URL par exploration · ${p.crawlsPerMonth === null ? "explorations illimitées" : `${fmt(p.crawlsPerMonth, b)} explorations par mois`}`
      : `${fmt(p.crawlUrlCap, b)} URLs per crawl · ${p.crawlsPerMonth === null ? "unlimited crawls" : `${fmt(p.crawlsPerMonth, b)} crawls a month`}`),
  // Phase 4c caps: scheduled crawls per workspace and the cadences each plan may pick.
  row("scheduling", { flag: "crawl.schedule" }, "Scheduling", "Planification", (p, b) => scheduleCell(p, b)),
  row("crawl-configuration", { flag: "crawl.config" }, "Crawl configuration", "Configuration de l'exploration"),
  row("save-open", { always: true }, "Save & open crawls", "Enregistrer et rouvrir les explorations", (p, b) =>
    b === "fr"
      ? `${fmt(p.crawlsKept, b)} dernières explorations conservées · ${CRAWL_PIN_MAX} épinglées en plus`
      : `Last ${fmt(p.crawlsKept, b)} crawls kept · ${CRAWL_PIN_MAX} more pinned`),
  row("javascript-rendering", { family: "javascript" }, "JavaScript rendering", "Rendu JavaScript"),
  row("crawl-comparison", { flag: "crawl.compare" }, "Crawl comparison", "Comparaison d'explorations"),
  row("near-duplicates", { family: "content" }, "Near duplicate content", "Contenu quasi dupliqué"),
  row("custom-robots", { flag: "crawl.customRobots" }, "Custom robots.txt", "robots.txt personnalisé"),
  row("mobile-usability", { family: "mobile" }, "Mobile usability", "Ergonomie mobile"),
  row("amp", { flag: "crawl.amp" }, "AMP crawling & validation", "Exploration et validation AMP"),
  row("structured-data", { family: "structured_data" }, "Structured data & validation", "Données structurées et validation"),
  // Spelling only: the spell check is built in; grammar runs through the AI
  // prompts (Phase 4e, its own row), so this row does not claim it.
  row("spelling", { family: "spelling" }, "Spelling", "Orthographe"),
  // Phase 4b caps, per crawl (searches, extractors) and per site (segments).
  row("source-search", { flag: "crawl.extraction" }, "Custom source code search", "Recherche dans le code source", (p, b) =>
    b === "fr" ? `${fmt(p.crawlSearches, b)} recherches par exploration` : `${fmt(p.crawlSearches, b)} searches per crawl`),
  row("custom-extraction", { flag: "crawl.extraction" }, "Custom extraction", "Extraction personnalisée", (p, b) =>
    b === "fr" ? `${fmt(p.crawlExtractors, b)} extracteurs par exploration` : `${fmt(p.crawlExtractors, b)} extractors per crawl`),
  // Phase 4e caps per crawl, from plan-config.
  row("custom-javascript", { flag: "crawl.customJs" }, "Custom JavaScript", "JavaScript personnalisé", (p, b) =>
    b === "fr"
      ? `${fmt(p.crawlJsSnippets, b)} ${p.crawlJsSnippets > 1 ? "extraits" : "extrait"} par exploration`
      : `${fmt(p.crawlJsSnippets, b)} ${p.crawlJsSnippets > 1 ? "snippets" : "snippet"} per crawl`),
  row("ai-crawl", { flag: "crawl.ai" }, "Crawl with AI (Claude / OpenAI / Gemini)", "Exploration avec l'IA (Claude / OpenAI / Gemini)", (p, b) =>
    b === "fr" ? `${fmt(p.crawlAiPages, b)} pages par exploration, 3 requêtes` : `${fmt(p.crawlAiPages, b)} pages per crawl, 3 prompts`),
  row("google-analytics", { flag: "crawl.ga4" }, "Google Analytics integration", "Intégration Google Analytics"),
  row("search-console", { flag: "crawl.gsc" }, "Search Console integration", "Intégration Search Console"),
  // Phase 4d caps per crawl, from plan-config; Search Console and GA4 are uncapped.
  row("pagespeed", { flag: "crawl.psi" }, "PageSpeed Insights integration", "Intégration PageSpeed Insights", (p, b) =>
    b === "fr" ? `${fmt(p.crawlPsiPages, b)} pages par exploration, mobile et ordinateur` : `${fmt(p.crawlPsiPages, b)} pages per crawl, mobile and desktop`),
  row("accessibility", { family: "accessibility" }, "Accessibility auditing", "Audit d'accessibilité"),
  row("link-metrics", { flag: "crawl.backlinks" }, "Link metrics integration", "Intégration des métriques de liens", (p, b) =>
    b === "fr" ? `${fmt(p.crawlBacklinkPages, b)} pages par exploration` : `${fmt(p.crawlBacklinkPages, b)} pages per crawl`),
  row("forms-auth", { flag: "crawl.login" }, "Forms-based authentication", "Authentification par formulaire"),
  row("segmentation", { flag: "crawl.segments" }, "Segmentation", "Segmentation", (p, b) =>
    b === "fr" ? `${fmt(p.crawlSegments, b)} segments par site` : `${fmt(p.crawlSegments, b)} segments per site`),
  // Sheets export + the Looker Studio guide; the PDF report (crawl.reports) is not this row.
  row("looker-studio", { flag: "crawl.sheets" }, "Looker Studio crawl report", "Rapport d'exploration Looker Studio"),
  // Phase 3d-A: start and read crawls from scripts and AI assistants, every paid plan.
  row("api", { flag: "crawl.api" }, "Command line & API", "Ligne de commande et API", (_p, b) => (b === "fr" ? "API REST et MCP" : "REST API and MCP")),
  row("support", { always: true }, "Free technical support", "Soutien technique gratuit"),
];

// ─── The free crawler on this page (flag crawl.free) ─────────────────────────
//
// The feature table's Free column: one cell down the whole column (the free
// crawl is one fixed offer, not a per-feature cap), and the "Try it free"
// strip above the pricing strip. Numbers from free-limits.ts.

export const FREE_COLUMN: { head: Text; summary: Text; link: Text } = {
  head: { en: "Free", fr: "Gratuit" },
  summary: {
    en: `${FREE_CRAWL_URL_CAP} URLs · raw HTML · full rule library · ${FREE_CRAWL_RETENTION_DAYS}-day results`,
    fr: `${FREE_CRAWL_URL_CAP} URL · HTML brut · bibliothèque de règles complète · résultats conservés ${FREE_CRAWL_RETENTION_DAYS} jours`,
  },
  link: { en: "Try it free", fr: "Essayer gratuitement" },
};

/** The byline, as text beside or under the logo (never in the image). */
export const CRAWLER_BYLINE: Text = { en: CRAWLER_BRAND.byline, fr: "robot d'exploration par Echorank" };

export const FREE_TRY_STRIP: { label: Text; h2: Text; body: Text; button: Text } = {
  label: { en: "Try it free", fr: "Essayez gratuitement" },
  h2: {
    en: `Crawl ${FREE_CRAWL_URL_CAP} pages of your site, free`,
    fr: `Explorez ${FREE_CRAWL_URL_CAP} pages de votre site, gratuitement`,
  },
  body: {
    en: `No account. ${CRAWLER_BRAND.name} crawls ${FREE_CRAWL_URL_CAP} pages of raw HTML against the full rule library and shows your Site health and the five problems to fix first. The result is yours for ${FREE_CRAWL_RETENTION_DAYS} days.`,
    fr: `Sans compte. ${CRAWLER_BRAND.name} explore ${FREE_CRAWL_URL_CAP} pages de HTML brut avec toute la bibliothèque de règles et affiche la santé de votre site et les cinq problèmes à corriger en premier. Le résultat reste disponible ${FREE_CRAWL_RETENTION_DAYS} jours.`,
  },
  button: { en: `Crawl ${FREE_CRAWL_URL_CAP} pages free`, fr: `Explorer ${FREE_CRAWL_URL_CAP} pages gratuitement` },
};

export function visibleFeatureRows(ctx: GateContext): CrawlFeatureRow[] {
  return CRAWL_FEATURE_ROWS.filter((r) => gateOpen(r.gate, ctx));
}

/** One row's cells: the cap string per plan, or `true` (a tick) when the row has no cap. */
export function featureCells(
  r: CrawlFeatureRow,
  plans: Readonly<Record<CrawlPlan, PlanConfig>>,
  base: CopyBase,
): Record<CrawlPlan, string | true> {
  const out = {} as Record<CrawlPlan, string | true>;
  for (const p of CRAWL_PLANS) out[p] = r.cap ? r.cap(plans[p], base) : true;
  return out;
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

export interface FaqContext {
  plans: Readonly<Record<CrawlPlan, PlanConfig>>;
}

export interface CrawlFaqEntry {
  gate: CrawlGate;
  q: Text;
  a: Readonly<Record<CopyBase, (ctx: FaqContext) => string>>;
}

const capsSentence = (ctx: FaqContext, base: CopyBase) => {
  const [s, g, a] = CRAWL_PLANS.map((p) => ({ cap: fmt(ctx.plans[p].crawlUrlCap, base), name: ctx.plans[p].name }));
  return base === "fr"
    ? `Jusqu'à ${s.cap} URL par exploration avec ${s.name}, ${g.cap} avec ${g.name} et ${a.cap} avec ${a.name}. Les sites plus grands s'explorent par sections, avec des motifs d'inclusion.`
    : `Up to ${s.cap} URLs per crawl on ${s.name}, ${g.cap} on ${g.name} and ${a.cap} on ${a.name}. Larger sites crawl in sections with include patterns.`;
};

export const CRAWL_FAQ: readonly CrawlFaqEntry[] = [
  {
    gate: { always: true },
    q: { en: "Does it need an install?", fr: "Faut-il installer quelque chose ?" },
    a: {
      en: () => `No. ${NB} runs on Echorank's servers; you start a crawl from the browser and come back to the results.`,
      fr: () => `Non. ${NB} tourne sur les serveurs d'Echorank : vous lancez une exploration depuis le navigateur et revenez aux résultats quand vous voulez.`,
    },
  },
  {
    gate: { always: true },
    q: { en: "How many pages can it crawl?", fr: "Combien de pages peut-il explorer ?" },
    a: { en: (c) => capsSentence(c, "en"), fr: (c) => capsSentence(c, "fr") },
  },
  {
    gate: { always: true },
    q: { en: "Will it slow my site down?", fr: "Va-t-il ralentir mon site ?" },
    a: {
      en: () => "It identifies itself as Echorank360Bot, obeys robots.txt and stays under two requests a second.",
      fr: () => "Il s'identifie comme Echorank360Bot, respecte le robots.txt et reste sous deux requêtes par seconde.",
    },
  },
  {
    gate: { always: true },
    q: { en: "Is it included in my plan?", fr: "Est-il inclus dans mon forfait ?" },
    a: {
      en: () => "Yes, on every plan from Starter. Plans differ in caps, not features. No per-user licence.",
      fr: () => "Oui, dans chaque forfait à partir de Starter. Les forfaits diffèrent par leurs plafonds, pas par leurs fonctions. Aucune licence par utilisateur.",
    },
  },
  {
    gate: { always: true },
    q: { en: "Can my team use it?", fr: "Mon équipe peut-elle l'utiliser ?" },
    a: {
      en: () => "Everyone on your Echorank plan sees the same crawls, issues and exports.",
      fr: () => "Toutes les personnes de votre forfait Echorank voient les mêmes explorations, les mêmes problèmes et les mêmes exports.",
    },
  },
  {
    gate: { flag: "crawl.render" },
    q: { en: "Does it render JavaScript?", fr: "Fait-il le rendu du JavaScript ?" },
    a: {
      en: () => "Yes, in headless Chromium. Rendering is off, thin pages or all pages, within your plan's rendered-page cap.",
      fr: () => "Oui, dans Chromium sans interface. Le rendu est désactivé, limité aux pages minces ou appliqué à toutes les pages, dans la limite de pages rendues de votre forfait.",
    },
  },
  {
    gate: { always: true },
    q: { en: "What happens to my data?", fr: "Qu'advient-il de mes données ?" },
    a: {
      en: () => "Crawl data stays in your tenant, is kept for your plan's number of crawls, and is never shared. We store extracted fields, not page HTML.",
      fr: () => "Les données d'exploration restent dans votre espace, sont conservées pour le nombre d'explorations de votre forfait et ne sont jamais partagées. Nous gardons les champs extraits, pas le HTML des pages.",
    },
  },
];

export function visibleFaq(ctx: GateContext & FaqContext, base: CopyBase): { q: string; a: string }[] {
  return CRAWL_FAQ.filter((f) => gateOpen(f.gate, ctx)).map((f) => ({ q: f.q[base], a: f.a[base](ctx) }));
}

// ─── The crawler guides' calls to action (NOSY-BAT-GUIDES.md) ───────────────
//
// Three per guide, one component (<GuideCta>): an inline band after the first
// numbered step, a one-sentence nudge after the export / compare step, and a
// closing card before "Related". The copy is a function of the plans so no
// cap is ever written down here; the caller passes PLAN_CONFIGS for the crawl
// tiers, the same way visibleFaq() is called. Every button goes to /pricing
// (signed out) or /crawler (signed in) — never to the registration form.

type PlansCtx = Readonly<Record<CrawlPlan, PlanConfig>>;
type CtaText = Readonly<Record<CopyBase, (p: PlansCtx) => string>>;

export interface GuideCtaCopy {
  inline: CtaText;
  nudge: CtaText;
  closing: { h: CtaText; p1: CtaText; p2: CtaText };
}

/** Button and link labels, shared by every guide. */
export const GUIDE_CTA_CHROME: {
  plans: Text;
  open: Text;
  free: Text;
  nudgePlans: Text;
  nudgeOpen: Text;
} = {
  plans: { en: "See plans", fr: "Voir les forfaits" },
  open: { en: `Open ${NB}`, fr: `Ouvrir ${NB}` },
  free: { en: `or crawl ${FREE_CRAWL_URL_CAP} pages free`, fr: `ou explorez ${FREE_CRAWL_URL_CAP} pages gratuitement` },
  nudgePlans: { en: "See plans →", fr: "Voir les forfaits →" },
  nudgeOpen: { en: `Open ${NB} →`, fr: `Ouvrir ${NB} →` },
};

const largest = (p: PlansCtx, b: CopyBase) => fmt(Math.max(...CRAWL_PLANS.map((id) => p[id].crawlUrlCap)), b);
/** The first crawl tier whose schedules may run weekly. */
const weeklyFrom = (p: PlansCtx) => CRAWL_PLANS.map((id) => p[id]).find((c) => c.crawlScheduleCadences.includes("weekly"))?.name ?? p.AGENCY.name;
const fixed = (en: string, fr: string): CtaText => ({ en: () => en, fr: () => fr });

export const guideCtas: Readonly<Record<string, GuideCtaCopy>> = {
  "how-to-find-broken-links": {
    inline: fixed(
      `${NB} finds every broken link on your site and tells you which page it's on.`,
      `${NB} trouve chaque lien brisé de votre site et vous dit sur quelle page il se trouve.`,
    ),
    // The spec's "every week … on every paid plan" is not what the plans say:
    // Starter schedules monthly. The cadence comes from the config instead.
    nudge: {
      en: (p) => `Want this list on a schedule without lifting a finger? Every plan from Starter schedules crawls — weekly from ${weeklyFrom(p)} up.`,
      fr: (p) => `Vous voulez recevoir cette liste sans lever le petit doigt ? Chaque forfait à partir de Starter planifie les explorations — chaque semaine à partir de ${weeklyFrom(p)}.`,
    },
    closing: {
      h: fixed("Stop finding broken links by accident.", "Cessez de tomber sur vos liens brisés par hasard."),
      p1: {
        en: (p) => `Crawl up to ${largest(p, "en")} pages, export the source of every broken link, and get a scheduled check in your inbox.`,
        fr: (p) => `Explorez jusqu'à ${largest(p, "fr")} pages, exportez la source de chaque lien brisé et recevez une vérification planifiée dans votre boîte de réception.`,
      },
      p2: fixed("Included in every Echorank plan from Starter — no per-user licence.", "Inclus dans chaque forfait Echorank à partir de Starter — aucune licence par utilisateur."),
    },
  },
  "xml-sitemap-generator": {
    inline: fixed(
      `Your sitemap should list what's indexable today — ${NB} builds it from a real crawl.`,
      `Votre plan de site doit lister ce qui est indexable aujourd'hui — ${NB} le bâtit à partir d'une vraie exploration.`,
    ),
    // "One click from current" would overpromise: a schedule does not keep the
    // generator's options. What it does keep is a fresh crawl to build from.
    nudge: fixed(
      "Sites change; sitemaps go stale. A scheduled crawl means there is always a fresh crawl to build the file from.",
      "Les sites changent; les plans de site vieillissent. Avec une exploration planifiée, vous avez toujours une exploration récente pour bâtir le fichier.",
    ),
    closing: {
      h: fixed("A sitemap search engines can trust.", "Un plan de site digne de confiance pour les moteurs."),
      p1: fixed(
        "Indexable pages only, split automatically at 50,000 URLs, image sitemap included.",
        "Les pages indexables seulement, découpé automatiquement à 50 000 URL, plan de site d'images compris.",
      ),
      p2: fixed(
        "Generate it from any completed crawl, on any plan from Starter.",
        "Générez-le à partir de n'importe quelle exploration terminée, sur chaque forfait à partir de Starter.",
      ),
    },
  },
  "web-scraping-with-custom-extraction": {
    inline: {
      en: (p) => `${p.STARTER.crawlExtractors} extractors on ${p.STARTER.name}, ${p.AGENCY.crawlExtractors} on ${p.AGENCY.name} — CSS, XPath or regex, on every page of the crawl.`,
      fr: (p) => `${p.STARTER.crawlExtractors} extracteurs sur ${p.STARTER.name}, ${p.AGENCY.crawlExtractors} sur ${p.AGENCY.name} — CSS, XPath ou expression régulière, sur chaque page de l'exploration.`,
    },
    nudge: fixed(
      "Turn an extracted value into a segment and every report filters to it — no spreadsheet needed.",
      "Faites d'une valeur extraite un segment, et chaque rapport se filtre dessus — sans tableur.",
    ),
    closing: {
      h: fixed("Every page, your columns.", "Chaque page, vos colonnes."),
      p1: fixed(
        "Extract prices, authors, tags or anything else across the whole site in one crawl, then export it.",
        "Extrayez prix, auteurs, balises ou n'importe quoi d'autre sur tout le site en une exploration, puis exportez le tout.",
      ),
      p2: fixed(
        "Rendering and custom JavaScript when the page is built in the browser.",
        "Rendu et JavaScript personnalisé quand la page se construit dans le navigateur.",
      ),
    },
  },
  "how-to-audit-a-site-migration": {
    inline: fixed(
      "Pin the baseline crawl now; after launch, Compare shows exactly what changed.",
      "Épinglez l'exploration de référence dès maintenant; après le lancement, Comparer montre exactement ce qui a changé.",
    ),
    nudge: fixed(
      "Staging on another host? URL mapping compares it to production before anyone else sees it.",
      "La préproduction est sur un autre hôte ? La correspondance d'URL la compare à la production avant que quiconque la voie.",
    ),
    closing: {
      h: fixed("Launch without losing a page.", "Lancez sans perdre une seule page."),
      // "a weekly watch" would be wrong on Starter, which schedules monthly.
      p1: fixed(
        "List-mode redirect checks, crawl comparison with URL mapping, and a scheduled watch for the first month.",
        "Vérification des redirections en mode liste, comparaison d'explorations avec correspondance d'URL et une surveillance planifiée pendant le premier mois.",
      ),
      p2: fixed("Everything in this guide is on every plan from Starter.", "Tout ce que décrit ce guide est offert dans chaque forfait à partir de Starter."),
    },
  },
};

/** One guide's CTA copy, resolved for a base and the crawl tiers. Undefined for a guide without CTAs. */
export function guideCtaCopy(slug: string, base: CopyBase, plans: PlansCtx) {
  const c = guideCtas[slug];
  if (!c) return undefined;
  return {
    inline: c.inline[base](plans),
    nudge: c.nudge[base](plans),
    closing: { h: c.closing.h[base](plans), p1: c.closing.p1[base](plans), p2: c.closing.p2[base](plans) },
    byline: CRAWLER_BYLINE[base],
    labels: {
      plans: GUIDE_CTA_CHROME.plans[base],
      open: GUIDE_CTA_CHROME.open[base],
      free: GUIDE_CTA_CHROME.free[base],
      nudgePlans: GUIDE_CTA_CHROME.nudgePlans[base],
      nudgeOpen: GUIDE_CTA_CHROME.nudgeOpen[base],
    },
  };
}

export type GuideCtaResolved = NonNullable<ReturnType<typeof guideCtaCopy>>;
