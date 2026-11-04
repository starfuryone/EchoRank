// src/lib/site-crawler/howto-copy.ts
//
// The crawler's "How to" walkthroughs: one per view (Overview = New crawl,
// Issues = Results and /issues, Pages, History, Schedules), 3–5 numbered
// steps each with a one-line title and one or two sentences, plus an optional
// "good to know" note. Every step has a pictogram (howto-art/, locale-free,
// no text in it); the ids below are shared by all locales, so a locale can't
// drift from the drawings. tests/site-crawler-howto.test.tsx checks every
// locale has as many steps as HOWTO_ART.
//
// Dependency-free (Client Components import it). de-CH uses ss, never ß.

import type { DashLocale } from "@/lib/i18n/dashboard";

export const HOWTO_VIEWS = ["overview", "issues", "pages", "history", "schedules"] as const;
export type HowtoView = (typeof HOWTO_VIEWS)[number];

export type HowtoArtId =
  | "paste-url"
  | "mode-render"
  | "advanced"
  | "review-plan"
  | "start"
  | "fix-first"
  | "kinds"
  | "expand-rule"
  | "affected-pages"
  | "export"
  | "search-scope"
  | "page-score"
  | "sort-detail"
  | "metric-columns"
  | "find-crawl"
  | "read-metrics"
  | "pin"
  | "open-report"
  | "compare"
  | "create-schedule"
  | "cadence-time"
  | "export-targets"
  | "toggle-run";

/** The pictogram of each step, in order. Locale-free. */
export const HOWTO_ART: Record<HowtoView, readonly HowtoArtId[]> = {
  overview: ["paste-url", "mode-render", "advanced", "review-plan", "start"],
  issues: ["fix-first", "kinds", "expand-rule", "affected-pages", "export"],
  pages: ["search-scope", "page-score", "sort-detail", "metric-columns", "export"],
  history: ["find-crawl", "read-metrics", "pin", "open-report", "compare"],
  schedules: ["create-schedule", "cadence-time", "export-targets", "toggle-run"],
};

export interface HowtoStep {
  title: string;
  body: string;
}

export interface HowtoWalkthrough {
  title: string;
  steps: HowtoStep[];
  note?: { title: string; body: string };
}

export interface HowtoUi {
  stepOf: (n: string, total: string) => string;
  stepsLabel: string;
  goToStep: (n: string, title: string) => string;
  previous: string;
  next: string;
  done: string;
  dontShow: string;
  close: string;
}

export interface HowtoCopy {
  ui: HowtoUi;
  views: Record<HowtoView, HowtoWalkthrough>;
}

const en: HowtoCopy = {
  ui: {
    stepOf: (n, total) => `Step ${n} of ${total}`,
    stepsLabel: "Steps",
    goToStep: (n, title) => `Step ${n}: ${title}`,
    previous: "Previous",
    next: "Next",
    done: "Done",
    dontShow: "Don't show again",
    close: "Close",
  },
  views: {
    overview: {
      title: "How to start a crawl",
      steps: [
        { title: "Paste your site's URL", body: "Start from the homepage, or any page you want the crawl to begin from. The crawl stays on that site." },
        {
          title: "Pick the mode and rendering",
          body: "Spider follows links from the URL; List mode fetches only the URLs you paste. Turn on JavaScript rendering if pages build their content in the browser.",
        },
        {
          title: "Open Advanced options only if you need them",
          body: "Limits, include and exclude rules, extraction, segments and extra data all live there. Each section's summary line says what is set.",
        },
        { title: "Review the setup", body: "Check the URL, the mode and the plan lines under the form before you start." },
        { title: "Start the crawl", body: "Results appear as pages come in. You can leave the page; the crawl keeps running and shows in History." },
      ],
      note: {
        title: "What the plan lines mean",
        body: "They show how many pages this crawl may fetch, how many pages can be rendered and how many crawls you have left this month, all read from your plan.",
      },
    },
    issues: {
      title: "How to work through the issues",
      steps: [
        {
          title: "Read the Fix first banner",
          body: "It counts the high-priority findings and the pages they affect. Those are the fixes with the biggest effect.",
        },
        {
          title: "Filter by kind, family or segment",
          body: "Issues are things that are broken, warnings are things that probably hurt, opportunities are improvements worth making. Combine kinds with a family or a segment.",
        },
        { title: "Expand a rule", body: "Each row opens to show the evidence for the first affected URLs and how to fix it." },
        { title: "Open the affected pages", body: "See all pages lists every page with that finding, in the Pages view." },
        { title: "Export", body: "Export a rule's findings, or the whole list, as CSV to share or track the fixes." },
      ],
    },
    pages: {
      title: "How to explore pages",
      steps: [
        { title: "Search or scope", body: "Search URLs and titles, or narrow to indexable, non-indexable, error, redirect or orphan pages, or a segment." },
        {
          title: "Read the status and the page score",
          body: "The score starts at 100 and loses 3 per high-priority finding, 1 per medium and 0.25 per low, times 10 and never below 0.",
        },
        {
          title: "Sort and open a page",
          body: "Sort by status, issues, score or links, then open a row to see its findings with how to fix them, its inlinks and its data.",
        },
        {
          title: "Turn on metric columns",
          body: "Columns adds crawl details and the data joined from other sources, such as Search Console clicks, when the crawl has it.",
        },
        { title: "Export", body: "Export CSV downloads every page that matches your search and filters." },
      ],
    },
    history: {
      title: "How to use your crawl history",
      steps: [
        { title: "Find a crawl", body: "Filter by site or by status to find the crawl you want." },
        { title: "Read Pages, Findings and Health", body: "Health is scored only for crawls that finished; others show a dash with the reason." },
        { title: "Pin the ones to keep", body: "Pinned crawls keep their full data beyond your plan's limit, so you can come back to them." },
        { title: "Open a report", body: "View report opens a finished crawl; View details opens one that stopped early or failed." },
        { title: "Compare two crawls", body: "In a report, Compare shows what changed against an earlier crawl of the same site." },
      ],
      note: {
        title: "Why incomplete crawls aren't comparable",
        body: "A crawl that stopped early or was cancelled saw only part of the site, so its counts would show changes that aren't real.",
      },
    },
    schedules: {
      title: "How to schedule crawls",
      steps: [
        { title: "Create a schedule", body: "Enter the site's URL. The schedule runs with the settings saved as that site's defaults." },
        { title: "Choose the frequency and time", body: "Daily, weekly or monthly, as your plan allows, at an hour in your workspace's timezone." },
        { title: "Choose where reports go", body: "Email the workspace owner after each run, and Google Sheets where it's available." },
        { title: "Pause or run now", body: "The switch pauses a schedule without deleting it. Run now starts its crawl straight away." },
      ],
      note: {
        title: "How each run is compared",
        body: "Each run is compared with that schedule's previous run: the row shows the change in health, and the report lists what is new and what was fixed.",
      },
    },
  },
};

const fr: HowtoCopy = {
  ui: {
    stepOf: (n, total) => `Étape ${n} sur ${total}`,
    stepsLabel: "Étapes",
    goToStep: (n, title) => `Étape ${n} : ${title}`,
    previous: "Précédent",
    next: "Suivant",
    done: "Terminé",
    dontShow: "Ne plus afficher",
    close: "Fermer",
  },
  views: {
    overview: {
      title: "Lancer une exploration",
      steps: [
        { title: "Collez l'URL de votre site", body: "Partez de la page d'accueil ou de toute page où l'exploration doit commencer. Elle reste sur ce site." },
        {
          title: "Choisissez le mode et le rendu",
          body: "Le mode Exploration suit les liens depuis l'URL ; le mode Liste ne récupère que les URL collées. Activez le rendu JavaScript si les pages construisent leur contenu dans le navigateur.",
        },
        {
          title: "N'ouvrez les options avancées qu'au besoin",
          body: "Limites, règles d'inclusion et d'exclusion, extraction, segments et données supplémentaires s'y trouvent. La ligne de résumé de chaque section indique ce qui est réglé.",
        },
        { title: "Vérifiez la configuration", body: "Contrôlez l'URL, le mode et les lignes du forfait sous le formulaire avant de lancer." },
        {
          title: "Lancez l'exploration",
          body: "Les résultats s'affichent au fil des pages. Vous pouvez quitter la page : l'exploration continue et apparaît dans l'historique.",
        },
      ],
      note: {
        title: "Ce que disent les lignes du forfait",
        body: "Elles indiquent le nombre de pages que cette exploration peut récupérer, le nombre de pages rendues possibles et les explorations qu'il vous reste ce mois-ci, selon votre forfait.",
      },
    },
    issues: {
      title: "Traiter les problèmes",
      steps: [
        {
          title: "Lisez le bandeau « À corriger d'abord »",
          body: "Il compte les constats prioritaires et les pages touchées. Ce sont les corrections qui ont le plus d'effet.",
        },
        {
          title: "Filtrez par type, famille ou segment",
          body: "Les problèmes sont des erreurs, les avertissements nuisent probablement, les opportunités sont des améliorations utiles. Combinez un type avec une famille ou un segment.",
        },
        { title: "Dépliez une règle", body: "Chaque ligne affiche la preuve pour les premières URL concernées et la façon de corriger." },
        { title: "Ouvrez les pages concernées", body: "« Voir toutes les pages » liste chaque page touchée dans la vue Pages." },
        { title: "Exportez", body: "Exportez les constats d'une règle, ou toute la liste, en CSV pour partager ou suivre les corrections." },
      ],
    },
    pages: {
      title: "Explorer les pages",
      steps: [
        {
          title: "Recherchez ou filtrez",
          body: "Cherchez dans les URL et les titres, ou limitez aux pages indexables, non indexables, en erreur, redirigées, orphelines ou à un segment.",
        },
        {
          title: "Lisez le statut et le score de page",
          body: "Le score part de 100 et perd 3 par constat prioritaire, 1 par moyen et 0,25 par faible, multipliés par 10, sans descendre sous 0.",
        },
        {
          title: "Triez et ouvrez une page",
          body: "Triez par statut, problèmes, score ou liens, puis ouvrez une ligne pour voir ses constats et leur correction, ses liens entrants et ses données.",
        },
        {
          title: "Affichez les colonnes de mesures",
          body: "Colonnes ajoute les détails d'exploration et les données jointes d'autres sources, comme les clics Search Console, quand l'exploration en dispose.",
        },
        { title: "Exportez", body: "Exporter en CSV télécharge chaque page qui correspond à votre recherche et à vos filtres." },
      ],
    },
    history: {
      title: "Utiliser l'historique",
      steps: [
        { title: "Trouvez une exploration", body: "Filtrez par site ou par statut pour retrouver l'exploration voulue." },
        {
          title: "Lisez Pages, Constats et Santé",
          body: "La santé n'est calculée que pour les explorations terminées ; les autres affichent un tiret avec la raison.",
        },
        { title: "Épinglez celles à garder", body: "Les explorations épinglées conservent toutes leurs données au-delà de la limite du forfait." },
        {
          title: "Ouvrez un rapport",
          body: "« Voir le rapport » ouvre une exploration terminée ; « Voir les détails », une exploration arrêtée tôt ou échouée.",
        },
        { title: "Comparez deux explorations", body: "Dans un rapport, Comparer montre ce qui a changé depuis une exploration antérieure du même site." },
      ],
      note: {
        title: "Pourquoi les explorations incomplètes ne se comparent pas",
        body: "Une exploration arrêtée tôt ou annulée n'a vu qu'une partie du site : ses chiffres montreraient des changements qui n'existent pas.",
      },
    },
    schedules: {
      title: "Planifier des explorations",
      steps: [
        { title: "Créez une planification", body: "Saisissez l'URL du site. La planification utilise les réglages enregistrés par défaut pour ce site." },
        {
          title: "Choisissez la fréquence et l'heure",
          body: "Chaque jour, chaque semaine ou chaque mois, selon votre forfait, à une heure du fuseau de votre espace.",
        },
        {
          title: "Choisissez où vont les rapports",
          body: "Un courriel au propriétaire de l'espace après chaque exécution, et Google Sheets lorsque c'est disponible.",
        },
        {
          title: "Mettez en pause ou lancez maintenant",
          body: "L'interrupteur suspend une planification sans la supprimer. « Lancer maintenant » démarre son exploration tout de suite.",
        },
      ],
      note: {
        title: "Comment chaque exécution est comparée",
        body: "Chaque exécution est comparée à la précédente de la même planification : la ligne montre l'écart de santé et le rapport liste ce qui est nouveau et ce qui a été corrigé.",
      },
    },
  },
};

const deCH: HowtoCopy = {
  ui: {
    stepOf: (n, total) => `Schritt ${n} von ${total}`,
    stepsLabel: "Schritte",
    goToStep: (n, title) => `Schritt ${n}: ${title}`,
    previous: "Zurück",
    next: "Weiter",
    done: "Fertig",
    dontShow: "Nicht mehr anzeigen",
    close: "Schliessen",
  },
  views: {
    overview: {
      title: "So starten Sie einen Crawl",
      steps: [
        {
          title: "URL Ihrer Website einfügen",
          body: "Beginnen Sie bei der Startseite oder einer beliebigen Seite, ab der gecrawlt werden soll. Der Crawl bleibt auf dieser Website.",
        },
        {
          title: "Modus und Rendering wählen",
          body: "Der Spider folgt Links ab der URL; der Listenmodus ruft nur die eingefügten URLs ab. Schalten Sie JavaScript-Rendering ein, wenn Seiten ihren Inhalt im Browser aufbauen.",
        },
        {
          title: "Erweiterte Optionen nur bei Bedarf öffnen",
          body: "Dort finden Sie Grenzen, Ein- und Ausschlussregeln, Extraktion, Segmente und zusätzliche Daten. Die Zusammenfassung jedes Abschnitts zeigt, was eingestellt ist.",
        },
        { title: "Einrichtung prüfen", body: "Prüfen Sie vor dem Start die URL, den Modus und die Planzeilen unter dem Formular." },
        {
          title: "Crawl starten",
          body: "Ergebnisse erscheinen, sobald Seiten eintreffen. Sie können die Seite verlassen; der Crawl läuft weiter und erscheint im Verlauf.",
        },
      ],
      note: {
        title: "Was die Planzeilen bedeuten",
        body: "Sie zeigen, wie viele Seiten dieser Crawl abrufen darf, wie viele Seiten gerendert werden können und wie viele Crawls Ihnen diesen Monat bleiben, gemäss Ihrem Plan.",
      },
    },
    issues: {
      title: "So arbeiten Sie die Probleme ab",
      steps: [
        {
          title: "Das Banner «Zuerst beheben» lesen",
          body: "Es zählt die Befunde mit hoher Priorität und die betroffenen Seiten. Das sind die Korrekturen mit der grössten Wirkung.",
        },
        {
          title: "Nach Art, Familie oder Segment filtern",
          body: "Probleme sind Fehler, Warnungen schaden wahrscheinlich, Chancen sind lohnende Verbesserungen. Kombinieren Sie eine Art mit einer Familie oder einem Segment.",
        },
        { title: "Eine Regel aufklappen", body: "Jede Zeile zeigt die Belege für die ersten betroffenen URLs und wie man es behebt." },
        { title: "Betroffene Seiten öffnen", body: "«Alle Seiten ansehen» listet jede betroffene Seite in der Seitenansicht." },
        { title: "Exportieren", body: "Exportieren Sie die Befunde einer Regel oder die ganze Liste als CSV, um Korrekturen zu teilen oder zu verfolgen." },
      ],
    },
    pages: {
      title: "So erkunden Sie Seiten",
      steps: [
        {
          title: "Suchen oder eingrenzen",
          body: "Durchsuchen Sie URLs und Titel oder grenzen Sie auf indexierbare, nicht indexierbare, fehlerhafte, weitergeleitete oder verwaiste Seiten oder ein Segment ein.",
        },
        {
          title: "Status und Seitenwert lesen",
          body: "Der Wert beginnt bei 100 und verliert je Befund mit hoher Priorität 3, je mittlerem 1 und je niedrigem 0,25, mal 10 und nie unter 0.",
        },
        {
          title: "Sortieren und eine Seite öffnen",
          body: "Sortieren Sie nach Status, Problemen, Wert oder Links und öffnen Sie eine Zeile für ihre Befunde mit Behebung, ihre eingehenden Links und ihre Daten.",
        },
        {
          title: "Messwert-Spalten einblenden",
          body: "Spalten fügt Crawl-Details und Daten aus anderen Quellen hinzu, etwa Search-Console-Klicks, wenn der Crawl sie hat.",
        },
        { title: "Exportieren", body: "CSV exportieren lädt jede Seite herunter, die zu Ihrer Suche und Ihren Filtern passt." },
      ],
    },
    history: {
      title: "So nutzen Sie den Crawl-Verlauf",
      steps: [
        { title: "Einen Crawl finden", body: "Filtern Sie nach Website oder Status, um den gewünschten Crawl zu finden." },
        {
          title: "Seiten, Befunde und Zustand lesen",
          body: "Der Zustand wird nur für abgeschlossene Crawls bewertet; die anderen zeigen einen Strich mit dem Grund.",
        },
        { title: "Wichtige Crawls anheften", body: "Angeheftete Crawls behalten ihre vollständigen Daten über die Grenze Ihres Plans hinaus." },
        {
          title: "Einen Bericht öffnen",
          body: "«Bericht ansehen» öffnet einen abgeschlossenen Crawl; «Details ansehen» einen früh gestoppten oder fehlgeschlagenen.",
        },
        { title: "Zwei Crawls vergleichen", body: "In einem Bericht zeigt Vergleichen, was sich seit einem früheren Crawl derselben Website geändert hat." },
      ],
      note: {
        title: "Warum unvollständige Crawls nicht vergleichbar sind",
        body: "Ein früh gestoppter oder abgebrochener Crawl hat nur einen Teil der Website gesehen; seine Zahlen würden Änderungen zeigen, die es nicht gibt.",
      },
    },
    schedules: {
      title: "So planen Sie Crawls",
      steps: [
        {
          title: "Einen Zeitplan erstellen",
          body: "Geben Sie die URL der Website ein. Der Zeitplan nutzt die als Standard gespeicherten Einstellungen dieser Website.",
        },
        {
          title: "Häufigkeit und Uhrzeit wählen",
          body: "Täglich, wöchentlich oder monatlich, soweit Ihr Plan es erlaubt, zu einer Stunde in der Zeitzone Ihres Workspace.",
        },
        { title: "Wählen, wohin Berichte gehen", body: "Eine E-Mail an den Workspace-Inhaber nach jedem Lauf, und Google Sheets, wo verfügbar." },
        {
          title: "Pausieren oder jetzt ausführen",
          body: "Der Schalter pausiert einen Zeitplan, ohne ihn zu löschen. «Jetzt ausführen» startet seinen Crawl sofort.",
        },
      ],
      note: {
        title: "Wie jeder Lauf verglichen wird",
        body: "Jeder Lauf wird mit dem vorherigen Lauf desselben Zeitplans verglichen: Die Zeile zeigt die Veränderung des Zustands, der Bericht listet Neues und Behobenes.",
      },
    },
  },
};

export const HOWTO_COPY: Record<DashLocale, HowtoCopy> = { en, fr, "de-CH": deCH };

/** localStorage key of a view's walkthrough state: "seen" (auto-opened once) or "off" (don't show again). */
export const howtoStorageKey = (view: HowtoView) => `crawler-howto:${view}`;
