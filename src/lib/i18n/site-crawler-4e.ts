// src/lib/i18n/site-crawler-4e.ts
//
// Site Crawler Phase 4e copy (custom JavaScript, AI prompts, forms login),
// attached to SITE_CRAWLER_COPY[locale].p4e. Dependency-free; de-CH uses ss,
// never ß.

const en = {
  // ── Custom JavaScript ───────────────────────────────────────────────────
  jsTitle: "Custom JavaScript",
  jsHelp: (cap: string) =>
    `Runs in each rendered page after it loads, before the page is read. Up to ${cap} snippets; the value each one returns appears on the Extraction tab.`,
  jsNeedsRender: "Runs on rendered pages only: choose a render mode above.",
  jsVerifiedOnly: "Verified sites only.",
  jsAdd: "Add snippet",
  jsRemove: "Remove",
  jsName: "Name",
  jsPreset: "What it does",
  jsSelector: "Button or link to click (CSS selector)",
  jsCode: "Function body (return the value to keep)",
  jsPresets: {
    scroll: "Scroll to the bottom",
    loadMore: "Click “load more”",
    dataLayer: "Read window.dataLayer",
    nextData: "Read __NEXT_DATA__ keys",
    custom: "Custom code",
  } as Record<string, string>,
  jsCapReached: (cap: string) => `Your plan allows ${cap} snippets per crawl.`,
  problemRender: "Custom JavaScript runs on rendered pages only. Choose a render mode.",
  problemSnippet: (n: string) => `Snippet ${n}: fill in the selector or the code.`,
};

export type SiteCrawler4eCopy = typeof en;

const fr: SiteCrawler4eCopy = {
  jsTitle: "JavaScript personnalisé",
  jsHelp: (cap: string) =>
    `S'exécute dans chaque page rendue une fois chargée, avant sa lecture. Jusqu'à ${cap} extraits ; la valeur renvoyée par chacun apparaît dans l'onglet Extraction.`,
  jsNeedsRender: "S'exécute uniquement sur les pages rendues : choisissez un mode de rendu ci-dessus.",
  jsVerifiedOnly: "Sites vérifiés seulement.",
  jsAdd: "Ajouter un extrait",
  jsRemove: "Retirer",
  jsName: "Nom",
  jsPreset: "Action",
  jsSelector: "Bouton ou lien à cliquer (sélecteur CSS)",
  jsCode: "Corps de la fonction (renvoyez la valeur à conserver)",
  jsPresets: {
    scroll: "Défiler jusqu'en bas",
    loadMore: "Cliquer sur « Voir plus »",
    dataLayer: "Lire window.dataLayer",
    nextData: "Lire les clés de __NEXT_DATA__",
    custom: "Code personnalisé",
  },
  jsCapReached: (cap: string) => `Votre forfait permet ${cap} extraits par exploration.`,
  problemRender: "Le JavaScript personnalisé s'exécute uniquement sur les pages rendues. Choisissez un mode de rendu.",
  problemSnippet: (n: string) => `Extrait ${n} : indiquez le sélecteur ou le code.`,
};

const deCH: SiteCrawler4eCopy = {
  jsTitle: "Eigenes JavaScript",
  jsHelp: (cap: string) =>
    `Läuft in jeder gerenderten Seite, nachdem sie geladen ist und bevor sie gelesen wird. Bis zu ${cap} Snippets; der Rückgabewert jedes Snippets erscheint im Tab Extraktion.`,
  jsNeedsRender: "Läuft nur auf gerenderten Seiten: Wählen Sie oben einen Render-Modus.",
  jsVerifiedOnly: "Nur für verifizierte Websites.",
  jsAdd: "Snippet hinzufügen",
  jsRemove: "Entfernen",
  jsName: "Name",
  jsPreset: "Aktion",
  jsSelector: "Zu klickender Button oder Link (CSS-Selektor)",
  jsCode: "Funktionsrumpf (den zu speichernden Wert zurückgeben)",
  jsPresets: {
    scroll: "Bis ganz nach unten scrollen",
    loadMore: "Auf «Mehr laden» klicken",
    dataLayer: "window.dataLayer lesen",
    nextData: "Schlüssel von __NEXT_DATA__ lesen",
    custom: "Eigener Code",
  },
  jsCapReached: (cap: string) => `Ihr Abo erlaubt ${cap} Snippets pro Crawl.`,
  problemRender: "Eigenes JavaScript läuft nur auf gerenderten Seiten. Wählen Sie einen Render-Modus.",
  problemSnippet: (n: string) => `Snippet ${n}: Selektor oder Code ausfüllen.`,
};

export const SITE_CRAWLER_4E = { en, fr, "de-CH": deCH } as const;
