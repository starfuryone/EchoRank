// src/lib/site-crawler/nosybat-card.ts
//
// The crawler-only plan's card lines on /pricing and /site-crawler (owner's
// spec, 2026-11-10: "Feature lines from nosybatFacts"). Server-side: the facts
// read the rule registry. pricing-tiers.ts puts these in place of the
// config-derived lines headlines.ts would give the card.
//
// No number is written here. A line whose feature is off (its flag, a zero
// cap, an unenforced limit) is left out. At most nine lines: the card grid
// holds nine entries (tests/pricing-cards.dom.test.tsx).

import { flag as flagOn, FLAGS, type FlagName, type Flags } from "@/lib/flags";
import { supportLine } from "@/lib/pricing-page/headlines";
import { CADENCE_WORDS } from "./nosybat-plan-table";
import { nbList, nbNum, nbOr, shows, type FactsBase, type NosybatFacts } from "./nosybat-facts";

export function nosybatCardLines(f: NosybatFacts, b: FactsBase, flags: Flags = FLAGS): string[] {
  const on = (x: FlagName) => flagOn(x, flags);
  const p = f.plans.NOSY_BAT;
  const n = (v: number) => nbNum(v, b);
  const t = (en: string, fr: string, de: string) => ({ en, fr, de })[b];
  const lines: (string | false)[] = [];

  if (f.rules.count > 0) {
    const r = f.rules.label;
    lines.push(t(`${r} checks on every page, with the evidence`, `${r} vérifications sur chaque page, preuves à l'appui`, `${r} Prüfungen auf jeder Seite, mit Belegen`));
  }

  const urls = n(p.urlsPerCrawl);
  const crawls =
    p.crawlsPerMonth === null
      ? t("unlimited crawls", "explorations illimitées", "unbegrenzte Crawls")
      : t(`${n(p.crawlsPerMonth)} crawls a month`, `${n(p.crawlsPerMonth)} explorations par mois`, `${n(p.crawlsPerMonth)} Crawls pro Monat`);
  lines.push(t(`Up to ${urls} URLs per crawl, ${crawls}`, `Jusqu'à ${urls} URL par exploration, ${crawls}`, `Bis ${urls} URLs pro Crawl, ${crawls}`));

  // The gated limits, only while code enforces them (nosybat-enforced.ts).
  const pages = shows(f, "pagesPerMonth") && p.pagesPerMonth !== null ? t(`${n(p.pagesPerMonth)} pages a month`, `${n(p.pagesPerMonth)} pages par mois`, `${n(p.pagesPerMonth)} Seiten pro Monat`) : null;
  const atOnce = shows(f, "crawlsAtOnce") ? t(`${n(p.crawlsAtOnce)} crawls at once`, `${n(p.crawlsAtOnce)} explorations simultanées`, `${n(p.crawlsAtOnce)} Crawls gleichzeitig`) : null;
  const room = [pages, atOnce].filter((x): x is string => Boolean(x));
  if (room.length > 0) lines.push(room.join(" · "));

  lines.push(
    on("crawl.render") && p.renderedPages > 0 &&
      t(`JavaScript rendering, up to ${n(p.renderedPages)} pages per crawl`, `Rendu JavaScript, jusqu'à ${n(p.renderedPages)} pages par exploration`, `JavaScript-Rendering, bis ${n(p.renderedPages)} Seiten pro Crawl`),
  );

  if (on("crawl.schedule") && p.schedules > 0 && p.cadences.length > 0) {
    const when = nbOr(p.cadences.map((c) => CADENCE_WORDS[b][c]), b);
    lines.push(t(`Scheduled crawls: ${when}`, `Explorations planifiées : ${when}`, `Geplante Crawls: ${when}`));
  }

  const work = [
    on("crawl.compare") && t("crawl comparison", "comparaison d'explorations", "Crawl-Vergleich"),
    t("CSV on every table", "CSV sur chaque tableau", "CSV auf jeder Tabelle"),
    on("crawl.reports") && t("a PDF report per crawl", "un rapport PDF par exploration", "ein PDF-Bericht pro Crawl"),
  ].filter((x): x is string => Boolean(x));
  const w = nbList(work, b);
  lines.push(w.charAt(0).toUpperCase() + w.slice(1));

  const google = [
    on("crawl.gsc") && "Search Console",
    on("crawl.ga4") && "GA4",
    on("crawl.psi") && p.psiPages > 0 && "PageSpeed",
  ].filter((x): x is string => Boolean(x));
  if (google.length > 0) {
    const g = nbList(google, b);
    lines.push(t(`${g} data beside the findings`, `Données ${g} à côté des constats`, `${g}-Daten neben den Befunden`));
  }

  lines.push(t("One user", "Un utilisateur", "Ein Benutzer"));
  lines.push(supportLine("NOSY_BAT", b));
  return lines.filter((l): l is string => Boolean(l)).slice(0, 9);
}
