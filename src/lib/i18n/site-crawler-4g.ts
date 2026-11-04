// src/lib/i18n/site-crawler-4g.ts
//
// Site Crawler Phase 4g copy (external links, Link Score, semantic
// duplicates, index status), attached to SITE_CRAWLER_COPY[locale].p4g.
// Dependency-free; de-CH uses ss, never ß.

const en = {
  // ── External tab ────────────────────────────────────────────────────────
  tabExternal: "External",
  exTitle: "External links",
  exHelp: (cap: string) => `Every outbound link, up to ${cap} per page, with the status it answered once during this crawl.`,
  colUrl: "URL",
  colStatus: "Status",
  colSources: "Source pages",
  colAnchor: "First anchor",
  statusAll: "All statuses",
  statusNone: "Not checked",
  hostAll: "All hosts",
  hostLabel: "Host",
  showSources: (n: string) => `Show ${n} pages`,
  hideSources: "Hide",
  sourcesMore: (n: string) => `First ${n} shown.`,
  noRows: "No external links match.",
  notChecked: "not checked",
  // ── Link Score ──────────────────────────────────────────────────────────
  colLinkScore: "Link Score",
  linkScoreHelp: "Internal PageRank, 0–100 on a log scale: how much link weight the site's own links give the page.",
};

export type SiteCrawler4gCopy = typeof en;

const fr: SiteCrawler4gCopy = {
  tabExternal: "Externes",
  exTitle: "Liens externes",
  exHelp: (cap: string) => `Chaque lien sortant, jusqu'à ${cap} par page, avec le code qu'il a renvoyé une fois pendant cette exploration.`,
  colUrl: "URL",
  colStatus: "Code",
  colSources: "Pages sources",
  colAnchor: "Première ancre",
  statusAll: "Tous les codes",
  statusNone: "Non vérifiés",
  hostAll: "Tous les hôtes",
  hostLabel: "Hôte",
  showSources: (n: string) => `Afficher ${n} pages`,
  hideSources: "Masquer",
  sourcesMore: (n: string) => `${n} premières affichées.`,
  noRows: "Aucun lien externe ne correspond.",
  notChecked: "non vérifié",
  colLinkScore: "Link Score",
  linkScoreHelp: "PageRank interne, de 0 à 100 sur une échelle logarithmique : le poids que les liens du site donnent à la page.",
};

const deCH: SiteCrawler4gCopy = {
  tabExternal: "Extern",
  exTitle: "Externe Links",
  exHelp: (cap: string) => `Jeder ausgehende Link, bis zu ${cap} pro Seite, mit dem Status, den er während dieses Crawls einmal geliefert hat.`,
  colUrl: "URL",
  colStatus: "Status",
  colSources: "Quellseiten",
  colAnchor: "Erster Ankertext",
  statusAll: "Alle Status",
  statusNone: "Nicht geprüft",
  hostAll: "Alle Hosts",
  hostLabel: "Host",
  showSources: (n: string) => `${n} Seiten anzeigen`,
  hideSources: "Ausblenden",
  sourcesMore: (n: string) => `Die ersten ${n} werden angezeigt.`,
  noRows: "Keine externen Links gefunden.",
  notChecked: "nicht geprüft",
  colLinkScore: "Link Score",
  linkScoreHelp: "Interner PageRank, 0–100 auf einer logarithmischen Skala: wie viel Linkgewicht die Links der eigenen Website der Seite geben.",
};

export const SITE_CRAWLER_4G = { en, fr, "de-CH": deCH } as const;
