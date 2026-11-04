// src/lib/i18n/site-crawler-4c.ts
//
// Site Crawler Phase 4c copy (Structure, Compare, Schedules, Sheets, PDF),
// attached to SITE_CRAWLER_COPY[locale].p4c. Kept apart from dashboard.ts so
// each 4c commit edits a small file. Dependency-free; de-CH uses ss, never ß.

const en = {
  // ── Structure ───────────────────────────────────────────────────────────
  tabStructure: "Structure",
  filterUrlPrefix: "URL starts with",
  stViewLabel: "View",
  stViewDirectory: "Directory tree",
  stViewCrawlTree: "Crawl tree",
  stViewLinks: "Internal-link graph",
  stLoading: "Laying out…",
  stEmpty: "No pages to draw.",
  stPurged: "Retention deleted this crawl's pages, so there is nothing to draw.",
  stTruncated: "Showing the first 20,000 links among these pages.",
  stNodesNote: (n: string) => `${n} pages, most-linked first (at most 2,000).`,
  stHelp: "Click a node to see its pages in the Pages tab. Click a folder's toggle to open or close it.",
  stLegendIndexable: "Indexable",
  stLegendNonIndexable: "Non-indexable",
  stLegendError: "Error",
  stSizeNote: "Size = internal links in",
  stExportSvg: "SVG",
  stExportPng: "PNG",
  stToggle: (name: string, open: boolean) => `${open ? "Close" : "Open"} ${name}`,
  stTooltip: (url: string, inlinks: string, depth: string) => `${url}\n${inlinks} inlinks · depth ${depth}`,
  stFolderTooltip: (path: string, pages: string) => `${path}\n${pages} pages`,
};

export type SiteCrawler4cCopy = typeof en;

const fr: SiteCrawler4cCopy = {
  tabStructure: "Structure",
  filterUrlPrefix: "L'URL commence par",
  stViewLabel: "Vue",
  stViewDirectory: "Arborescence des répertoires",
  stViewCrawlTree: "Arbre d'exploration",
  stViewLinks: "Graphe du maillage interne",
  stLoading: "Mise en page…",
  stEmpty: "Aucune page à afficher.",
  stPurged: "La conservation a supprimé les pages de cette exploration : il n'y a rien à afficher.",
  stTruncated: "Affichage des 20 000 premiers liens entre ces pages.",
  stNodesNote: (n: string) => `${n} pages, les plus liées d'abord (2 000 au plus).`,
  stHelp: "Cliquez sur un nœud pour voir ses pages dans l'onglet Pages. Cliquez sur le bouton d'un dossier pour l'ouvrir ou le fermer.",
  stLegendIndexable: "Indexable",
  stLegendNonIndexable: "Non indexable",
  stLegendError: "Erreur",
  stSizeNote: "Taille = liens internes entrants",
  stExportSvg: "SVG",
  stExportPng: "PNG",
  stToggle: (name: string, open: boolean) => `${open ? "Fermer" : "Ouvrir"} ${name}`,
  stTooltip: (url: string, inlinks: string, depth: string) => `${url}\n${inlinks} liens entrants · profondeur ${depth}`,
  stFolderTooltip: (path: string, pages: string) => `${path}\n${pages} pages`,
};

const deCH: SiteCrawler4cCopy = {
  tabStructure: "Struktur",
  filterUrlPrefix: "URL beginnt mit",
  stViewLabel: "Ansicht",
  stViewDirectory: "Verzeichnisbaum",
  stViewCrawlTree: "Crawl-Baum",
  stViewLinks: "Interner Linkgraph",
  stLoading: "Wird angeordnet…",
  stEmpty: "Keine Seiten zum Darstellen.",
  stPurged: "Die Aufbewahrung hat die Seiten dieses Crawls gelöscht, es gibt nichts darzustellen.",
  stTruncated: "Es werden die ersten 20’000 Links zwischen diesen Seiten gezeigt.",
  stNodesNote: (n: string) => `${n} Seiten, die meistverlinkten zuerst (höchstens 2’000).`,
  stHelp: "Klicken Sie auf einen Knoten, um seine Seiten im Tab «Seiten» zu sehen. Mit dem Schalter eines Ordners öffnen oder schliessen Sie ihn.",
  stLegendIndexable: "Indexierbar",
  stLegendNonIndexable: "Nicht indexierbar",
  stLegendError: "Fehler",
  stSizeNote: "Grösse = eingehende interne Links",
  stExportSvg: "SVG",
  stExportPng: "PNG",
  stToggle: (name: string, open: boolean) => `${name} ${open ? "schliessen" : "öffnen"}`,
  stTooltip: (url: string, inlinks: string, depth: string) => `${url}\n${inlinks} eingehende Links · Tiefe ${depth}`,
  stFolderTooltip: (path: string, pages: string) => `${path}\n${pages} Seiten`,
};

export const SITE_CRAWLER_4C = { en, fr, "de-CH": deCH } as const;
