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
  // ── Semantic duplicates ─────────────────────────────────────────────────
  semOn: "Find semantic duplicates and off-topic pages",
  semHelp: (cap: string) => `Compares what the top pages say (up to ${cap}), not just their wording, after the crawl.`,
  semNeedsKey: "Runs on your own OpenAI key — add it in Settings → Integrations first.",
  semOwnKey: "Runs on your own OpenAI key (text-embedding-3-small), billed to your OpenAI account.",
  semEstimate: (tokens: string, usd: string) => `About ${tokens} tokens, roughly ${usd} at OpenAI's published price.`,
  confirmSem: (pages: string, usd: string) => `Semantic comparison of ${pages} pages: roughly ${usd} on your OpenAI account.`,
  semStatusRunning: (done: string, total: string) => `Semantic comparison: ${done} of ${total} pages read.`,
  semStatusDone: (embedded: string, total: string) => `Semantic comparison: ${embedded} of ${total} pages compared.`,
  semStatusKey: "Semantic comparison stopped: the OpenAI key is missing or was refused. Check Settings → Integrations.",
  problemSemKey: "Semantic duplicates need your OpenAI key. Add it in Settings → Integrations.",
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
  semOn: "Repérer les doublons sémantiques et les pages hors sujet",
  semHelp: (cap: string) => `Compare ce que disent les pages principales (jusqu'à ${cap}), pas seulement leur formulation, après l'exploration.`,
  semNeedsKey: "Utilise votre propre clé OpenAI : ajoutez-la d'abord dans Paramètres → Intégrations.",
  semOwnKey: "Utilise votre propre clé OpenAI (text-embedding-3-small), facturée sur votre compte OpenAI.",
  semEstimate: (tokens: string, usd: string) => `Environ ${tokens} jetons, soit à peu près ${usd} au tarif publié d'OpenAI.`,
  confirmSem: (pages: string, usd: string) => `Comparaison sémantique de ${pages} pages : environ ${usd} sur votre compte OpenAI.`,
  semStatusRunning: (done: string, total: string) => `Comparaison sémantique : ${done} pages lues sur ${total}.`,
  semStatusDone: (embedded: string, total: string) => `Comparaison sémantique : ${embedded} pages comparées sur ${total}.`,
  semStatusKey: "Comparaison sémantique arrêtée : la clé OpenAI est absente ou a été refusée. Vérifiez Paramètres → Intégrations.",
  problemSemKey: "Les doublons sémantiques nécessitent votre clé OpenAI. Ajoutez-la dans Paramètres → Intégrations.",
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
  semOn: "Semantische Duplikate und themenfremde Seiten finden",
  semHelp: (cap: string) => `Vergleicht nach dem Crawl, was die wichtigsten Seiten aussagen (bis ${cap}), nicht nur ihren Wortlaut.`,
  semNeedsKey: "Läuft mit Ihrem eigenen OpenAI-Schlüssel – hinterlegen Sie ihn zuerst unter Einstellungen → Integrationen.",
  semOwnKey: "Läuft mit Ihrem eigenen OpenAI-Schlüssel (text-embedding-3-small), abgerechnet über Ihr OpenAI-Konto.",
  semEstimate: (tokens: string, usd: string) => `Etwa ${tokens} Tokens, rund ${usd} zum veröffentlichten Preis von OpenAI.`,
  confirmSem: (pages: string, usd: string) => `Semantischer Vergleich von ${pages} Seiten: rund ${usd} auf Ihrem OpenAI-Konto.`,
  semStatusRunning: (done: string, total: string) => `Semantischer Vergleich: ${done} von ${total} Seiten gelesen.`,
  semStatusDone: (embedded: string, total: string) => `Semantischer Vergleich: ${embedded} von ${total} Seiten verglichen.`,
  semStatusKey: "Semantischer Vergleich gestoppt: Der OpenAI-Schlüssel fehlt oder wurde abgelehnt. Prüfen Sie Einstellungen → Integrationen.",
  problemSemKey: "Semantische Duplikate brauchen Ihren OpenAI-Schlüssel. Hinterlegen Sie ihn unter Einstellungen → Integrationen.",
};

export const SITE_CRAWLER_4G = { en, fr, "de-CH": deCH } as const;
