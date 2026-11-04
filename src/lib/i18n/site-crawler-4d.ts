// src/lib/i18n/site-crawler-4d.ts
//
// Site Crawler Phase 4d copy (Add data: Search Console, PageSpeed, GA4,
// backlinks), attached to SITE_CRAWLER_COPY[locale].p4d. Dependency-free;
// de-CH uses ss, never ß.

const en = {
  addTitle: "Add data",
  addHelp: "Join other sources onto the crawl's pages. They run after the crawl, on its most-linked pages.",
  byLabel: "Chosen by",
  byInlinks: "Most internal links",
  bySegment: (name: string) => `Most internal links in “${name}”`,
  pagesLabel: "Pages",
  psiLabel: (cap: string) => `Run PageSpeed on the top pages (up to ${cap})`,
  psiQuota: (left: string, limit: string) => `${left} of ${limit} Lighthouse runs left this hour.`,
  psiNeeds: (runs: string) => `Needs ${runs} runs: mobile and desktop for each page. Runs past the hourly allowance wait for it to free up, so results can arrive a few hours after the crawl.`,
  confirmTitle: "Before the crawl starts",
  confirmPsi: (pages: string, runs: string, left: string, limit: string) =>
    `PageSpeed on ${pages} pages: ${runs} Lighthouse runs from the Lighthouse tool's allowance (${left} of ${limit} left this hour).`,
  confirmStart: "Start crawl",
  confirmBack: "Back",
  problemSegment: "The chosen segment no longer exists for this site. Pick another one.",
  problemCap: (cap: string) => `Your plan allows up to ${cap} pages here.`,
  blLabel: (cap: string) => `Fetch backlink metrics for the top pages (up to ${cap})`,
  blEstimate: (cost: string, unit: string, left: string) => `Estimated ${cost} (${unit} per page, from the last lookup), charged to your monthly SEO data budget: ${left} left. Lookups stop if the budget runs out.`,
  confirmBacklinks: (pages: string, cost: string, left: string) => `Backlink metrics on ${pages} pages: about ${cost} of your SEO data budget (${left} left).`,
};

export type SiteCrawler4dCopy = typeof en;

const fr: SiteCrawler4dCopy = {
  addTitle: "Ajouter des données",
  addHelp: "Joignez d'autres sources aux pages de l'exploration. Elles s'exécutent après l'exploration, sur ses pages les plus liées.",
  byLabel: "Choisies selon",
  byInlinks: "Le plus de liens internes",
  bySegment: (name: string) => `Le plus de liens internes dans « ${name} »`,
  pagesLabel: "Pages",
  psiLabel: (cap: string) => `Lancer PageSpeed sur les pages principales (jusqu'à ${cap})`,
  psiQuota: (left: string, limit: string) => `${left} analyses Lighthouse sur ${limit} restantes cette heure-ci.`,
  psiNeeds: (runs: string) => `Nécessite ${runs} analyses : mobile et ordinateur pour chaque page. Au-delà de l'allocation horaire, les analyses attendent qu'elle se libère : les résultats peuvent arriver quelques heures après l'exploration.`,
  confirmTitle: "Avant le lancement",
  confirmPsi: (pages: string, runs: string, left: string, limit: string) =>
    `PageSpeed sur ${pages} pages : ${runs} analyses prises sur l'allocation de l'outil Lighthouse (${left} sur ${limit} restantes cette heure-ci).`,
  confirmStart: "Lancer l'exploration",
  confirmBack: "Retour",
  problemSegment: "Le segment choisi n'existe plus pour ce site. Choisissez-en un autre.",
  problemCap: (cap: string) => `Votre forfait permet jusqu'à ${cap} pages ici.`,
  blLabel: (cap: string) => `Récupérer les métriques de liens entrants des pages principales (jusqu'à ${cap})`,
  blEstimate: (cost: string, unit: string, left: string) => `Coût estimé ${cost} (${unit} par page, d'après la dernière requête), imputé à votre budget mensuel de données SEO : ${left} restants. Les requêtes s'arrêtent si le budget est épuisé.`,
  confirmBacklinks: (pages: string, cost: string, left: string) => `Métriques de liens entrants sur ${pages} pages : environ ${cost} de votre budget de données SEO (${left} restants).`,
};

const deCH: SiteCrawler4dCopy = {
  addTitle: "Daten hinzufügen",
  addHelp: "Andere Quellen mit den Seiten des Crawls verknüpfen. Sie laufen nach dem Crawl, auf den meistverlinkten Seiten.",
  byLabel: "Ausgewählt nach",
  byInlinks: "Meiste interne Links",
  bySegment: (name: string) => `Meiste interne Links in «${name}»`,
  pagesLabel: "Seiten",
  psiLabel: (cap: string) => `PageSpeed auf den wichtigsten Seiten ausführen (bis ${cap})`,
  psiQuota: (left: string, limit: string) => `Noch ${left} von ${limit} Lighthouse-Läufen in dieser Stunde.`,
  psiNeeds: (runs: string) => `Braucht ${runs} Läufe: Mobil und Desktop pro Seite. Läufe über dem Stundenkontingent warten, bis es wieder frei ist, Ergebnisse können also einige Stunden nach dem Crawl eintreffen.`,
  confirmTitle: "Bevor der Crawl startet",
  confirmPsi: (pages: string, runs: string, left: string, limit: string) =>
    `PageSpeed auf ${pages} Seiten: ${runs} Lighthouse-Läufe aus dem Kontingent des Lighthouse-Tools (noch ${left} von ${limit} in dieser Stunde).`,
  confirmStart: "Crawl starten",
  confirmBack: "Zurück",
  problemSegment: "Das gewählte Segment gibt es für diese Website nicht mehr. Wählen Sie ein anderes.",
  problemCap: (cap: string) => `Ihr Abo erlaubt hier bis zu ${cap} Seiten.`,
  blLabel: (cap: string) => `Backlink-Kennzahlen für die wichtigsten Seiten abrufen (bis ${cap})`,
  blEstimate: (cost: string, unit: string, left: string) => `Geschätzt ${cost} (${unit} pro Seite, aus der letzten Abfrage), belastet Ihr monatliches SEO-Datenbudget: noch ${left}. Die Abfragen stoppen, wenn das Budget aufgebraucht ist.`,
  confirmBacklinks: (pages: string, cost: string, left: string) => `Backlink-Kennzahlen für ${pages} Seiten: etwa ${cost} Ihres SEO-Datenbudgets (noch ${left}).`,
};

export const SITE_CRAWLER_4D = { en, fr, "de-CH": deCH } as const;
