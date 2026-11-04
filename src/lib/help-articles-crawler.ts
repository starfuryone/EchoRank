// src/lib/help-articles-crawler.ts
//
// The Site Crawler's Looker Studio guide (Phase 4c, feature #31): how to send
// crawls to Google Sheets and connect that sheet in Looker Studio. A public
// help article (/{locale}/help/looker-studio-crawl-report), registered in
// HELP_ARTICLES only while crawl.sheets is on — the page never describes an
// export that production cannot run.
//
// The sheet layout is read from sheets-layout.ts, the same constants the
// exporter writes, so the column lists cannot drift from the sheet.
//
// TODO(fred): publish the Looker Studio template once a sample sheet exists,
// then add its "Make a copy → pick your sheet" link and steps here (both
// locales). Until then the guide builds the report from a blank one and the
// copy does not mention a template.
//
// Dependency-free: the proxy reaches this through help-articles.ts.

import type { HelpArticle } from "./help-articles";
import { COMPARE_HEADER, ISSUES_HEADER, LOOKER_STUDIO_SLUG, PAGES_HEADER, SHEETS_PAGE_ROWS, SUMMARY_HEADER } from "./site-crawler/sheets-layout";

export { LOOKER_STUDIO_SLUG };

const cols = (h: readonly string[]) => h.map((c) => `\`${c}\``).join(", ");
const n = (v: number, fr: boolean) => new Intl.NumberFormat(fr ? "fr-CA" : "en-US").format(v);

export const LOOKER_STUDIO_ARTICLE: HelpArticle = {
  slug: LOOKER_STUDIO_SLUG,
  category: "site-crawler",
  order: 1,
  readingTime: 4,
  copy: {
    en: {
      title: "Build a Looker Studio report from your Echorank crawls",
      description: "Send every crawl to a Google Sheet with a fixed layout, then point Looker Studio at that sheet to chart your site's health over time.",
      body: [
        { k: "p", t: "Send every crawl to a Google Sheet with a fixed layout, then point Looker Studio at that sheet to chart your site's health over time." },
        { k: "h2", t: "1. Send your crawls to Google Sheets" },
        {
          k: "steps",
          items: [
            { t: "In Echorank, open **Site Crawler** and select a completed crawl." },
            { t: "Under the crawl's summary, find **Google Sheets** and click **Export to Sheets**. The first time, follow **Connect Google Sheets** and approve access on Google's screen: Echorank asks for your spreadsheets in addition to Search Console." },
            { t: "Leave the spreadsheet field blank to create a new sheet, or paste the URL of one you own. Echorank writes four tabs and gives you the link." },
            { t: "To send every run automatically, open **Configuration → Run this crawl on a schedule** and tick **Also write the results to Google Sheets**. Each scheduled run writes to the same sheet." },
          ],
        },
        { k: "h2", t: "2. The sheet layout" },
        {
          k: "table",
          head: ["Tab", "What it holds", "Each export"],
          rows: [
            ["Summary", "One row per crawl: totals, issues by severity, and the changes since the crawl it was compared with.", "Adds a row"],
            ["Issues", "One row per issue type found in the crawl, with its kind, priority and number of findings.", "Replaced"],
            ["Pages", `One row per crawled page, up to ${n(SHEETS_PAGE_ROWS, false)}.`, "Replaced"],
            ["Compare", "The comparison with the previous crawl: pages added, removed and changed, and new and resolved issues per type.", "Replaced"],
          ],
        },
        { k: "p", t: `**Summary columns:** ${cols(SUMMARY_HEADER)}.` },
        { k: "p", t: `**Issues columns:** ${cols(ISSUES_HEADER)}.` },
        { k: "p", t: `**Pages columns:** ${cols(PAGES_HEADER)}.` },
        { k: "p", t: `**Compare columns:** ${cols(COMPARE_HEADER)}. Measure is a bucket (added, removed, changed, issuesNew, issuesResolved) or new:/resolved: followed by an issue's rule ID.` },
        { k: "p", t: "Keep the tab names and the first row as they are: the report reads them. You can add your own tabs to the same spreadsheet." },
        { k: "h2", t: "3. Connect your sheet in Looker Studio" },
        {
          k: "steps",
          items: [
            { t: "Go to lookerstudio.google.com and create a **Blank report**." },
            { t: "Choose the **Google Sheets** connector, pick your Echorank spreadsheet and the **Summary** tab. Keep **Use first row as headers** on, then click **Add**." },
            { t: "Set the type of `Crawl date (UTC)` to **Date & Time**. Add a time-series chart with `Crawl date (UTC)` as the dimension and `Errors`, `Warnings` and `Notices` as metrics." },
            { t: "Add the **Issues** and **Pages** tabs as two more data sources (**Resource → Manage added data sources → Add a data source**). A table of Issues sorted by `Findings` shows what to fix first." },
            { t: "That's it: Looker Studio reads the sheet when the report opens, so each new crawl appears without touching the report." },
          ],
        },
      ],
      faq: {
        q: "Can I see my crawls in Looker Studio?",
        a: "Yes. Export a crawl, or every scheduled crawl, to Google Sheets from the Site Crawler, then connect that sheet in Looker Studio. Walkthrough and sheet layout: [Build a Looker Studio report from your Echorank crawls](/help/looker-studio-crawl-report).",
      },
      blurb: "**Looker Studio crawl report** — Send crawls to Google Sheets and chart them in Looker Studio: [the guide](/help/looker-studio-crawl-report).",
      related: [{ href: "/site-crawler", label: "Site Crawler", internal: true }],
    },
    fr: {
      title: "Créer un rapport Looker Studio à partir de vos explorations Echorank",
      description: "Envoyez chaque exploration dans une feuille Google Sheets à la structure fixe, puis branchez Looker Studio sur cette feuille pour suivre la santé de votre site dans le temps.",
      body: [
        { k: "p", t: "Envoyez chaque exploration dans une feuille Google Sheets à la structure fixe, puis branchez Looker Studio sur cette feuille pour suivre la santé de votre site dans le temps." },
        { k: "h2", t: "1. Envoyer vos explorations vers Google Sheets" },
        {
          k: "steps",
          items: [
            { t: "Dans Echorank, ouvrez l'**Explorateur de site** et sélectionnez une exploration terminée." },
            { t: "Sous le résumé de l'exploration, repérez **Google Sheets** et cliquez sur **Exporter vers Sheets**. La première fois, suivez **Connecter Google Sheets** et autorisez l'accès sur l'écran de Google : Echorank demande l'accès à vos feuilles de calcul en plus de la Search Console." },
            { t: "Laissez le champ vide pour créer une nouvelle feuille, ou collez l'URL d'une feuille qui vous appartient. Echorank écrit quatre onglets et vous donne le lien." },
            { t: "Pour envoyer chaque exécution automatiquement, ouvrez **Configuration → Lancer cette exploration selon un calendrier** et cochez **Écrire aussi les résultats dans Google Sheets**. Chaque exécution planifiée écrit dans la même feuille." },
          ],
        },
        { k: "h2", t: "2. La structure de la feuille" },
        {
          k: "table",
          head: ["Onglet", "Contenu", "À chaque export"],
          rows: [
            ["Summary", "Une ligne par exploration : totaux, problèmes par gravité et changements depuis l'exploration comparée.", "Ajoute une ligne"],
            ["Issues", "Une ligne par type de problème trouvé, avec sa nature, sa priorité et son nombre de constats.", "Remplacé"],
            ["Pages", `Une ligne par page explorée, jusqu'à ${n(SHEETS_PAGE_ROWS, true)}.`, "Remplacé"],
            ["Compare", "La comparaison avec l'exploration précédente : pages ajoutées, retirées et modifiées, nouveaux problèmes et problèmes résolus par type.", "Remplacé"],
          ],
        },
        { k: "p", t: `**Colonnes de Summary :** ${cols(SUMMARY_HEADER)}.` },
        { k: "p", t: `**Colonnes d'Issues :** ${cols(ISSUES_HEADER)}.` },
        { k: "p", t: `**Colonnes de Pages :** ${cols(PAGES_HEADER)}.` },
        { k: "p", t: `**Colonnes de Compare :** ${cols(COMPARE_HEADER)}. Measure est une catégorie (added, removed, changed, issuesNew, issuesResolved) ou new:/resolved: suivi de l'identifiant de règle d'un problème.` },
        { k: "p", t: "Gardez les noms des onglets et la première ligne tels quels : le rapport les lit. Vous pouvez ajouter vos propres onglets dans la même feuille de calcul." },
        { k: "h2", t: "3. Connecter votre feuille dans Looker Studio" },
        {
          k: "steps",
          items: [
            { t: "Rendez-vous sur lookerstudio.google.com et créez un **Rapport vide**." },
            { t: "Choisissez le connecteur **Google Sheets**, votre feuille Echorank et l'onglet **Summary**. Laissez **Utiliser la première ligne comme en-têtes** activé, puis cliquez sur **Ajouter**." },
            { t: "Réglez le type de `Crawl date (UTC)` sur **Date et heure**. Ajoutez un graphique de série temporelle avec `Crawl date (UTC)` comme dimension et `Errors`, `Warnings` et `Notices` comme métriques." },
            { t: "Ajoutez les onglets **Issues** et **Pages** comme deux autres sources de données (**Ressource → Gérer les sources de données ajoutées → Ajouter une source de données**). Un tableau d'Issues trié par `Findings` montre quoi corriger d'abord." },
            { t: "C'est tout : Looker Studio lit la feuille à l'ouverture du rapport, donc chaque nouvelle exploration y apparaît sans toucher au rapport." },
          ],
        },
      ],
      faq: {
        q: "Puis-je voir mes explorations dans Looker Studio?",
        a: "Oui. Exportez une exploration, ou chaque exploration planifiée, vers Google Sheets depuis l'Explorateur de site, puis connectez cette feuille dans Looker Studio. Marche à suivre et structure de la feuille : [Créer un rapport Looker Studio à partir de vos explorations Echorank](/help/looker-studio-crawl-report).",
      },
      blurb: "**Rapport d'exploration Looker Studio** — Envoyez vos explorations vers Google Sheets et suivez-les dans Looker Studio : [le guide](/help/looker-studio-crawl-report).",
      related: [{ href: "/site-crawler", label: "Explorateur de site", internal: true }],
    },
  },
};
