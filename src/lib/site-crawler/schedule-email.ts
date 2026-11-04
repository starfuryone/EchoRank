// src/lib/site-crawler/schedule-email.ts
//
// The scheduled-crawl email (Phase 4c, exportTo.email, crawl.reports): a
// Brevo transactional message through the shared relay (sendMail) to the
// tenant owner, with the crawl's summary, the deltas against the previous
// run, and links to the crawl and its CSVs.
//
// SIGN-IN LINKS ONLY. Every link is a plain app or API URL that needs the
// recipient's session; nothing here mints a public or signed URL. Signed out,
// the proxy sends them through /login and back (callbackUrl keeps the query).
//
// Copy in en / fr / de-CH by the tenant's default language (de-CH: ss, never ß).

import "server-only";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getIssueTotals } from "./issue-totals";
import type { ComparisonResult } from "./compare";

type Loc = "en" | "fr" | "de-CH";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";

const COPY = {
  en: {
    subject: (host: string) => `Scheduled crawl finished: ${host}`,
    intro: (host: string, pages: string) => `Your scheduled crawl of ${host} finished: ${pages} pages crawled.`,
    issues: "Issues",
    errors: "errors",
    warnings: "warnings",
    notices: "notices",
    since: "Since the previous scheduled crawl",
    added: "pages added",
    removed: "pages removed",
    changed: "pages changed",
    issuesNew: "new issues",
    issuesResolved: "resolved issues",
    noBaseline: "This is the first run, so there is nothing to compare with yet.",
    open: "Open the crawl",
    csvs: "Downloads (CSV)",
    csvIssues: "All issues",
    csvPages: "All pages",
    csvBroken: "Broken links",
    csvAdded: "Pages added",
    csvRemoved: "Pages removed",
    csvNew: "New issues",
    signIn: "These links open in Echorank and ask you to sign in if you are not already.",
    why: "You receive this because a crawl schedule in your workspace has email export turned on. Turn it off under Site Crawler → Configuration → Scheduled crawls.",
  },
  fr: {
    subject: (host: string) => `Exploration planifiée terminée : ${host}`,
    intro: (host: string, pages: string) => `L'exploration planifiée de ${host} est terminée : ${pages} pages explorées.`,
    issues: "Problèmes",
    errors: "erreurs",
    warnings: "avertissements",
    notices: "remarques",
    since: "Depuis l'exploration planifiée précédente",
    added: "pages ajoutées",
    removed: "pages retirées",
    changed: "pages modifiées",
    issuesNew: "nouveaux problèmes",
    issuesResolved: "problèmes résolus",
    noBaseline: "C'est la première exécution : il n'y a encore rien à comparer.",
    open: "Ouvrir l'exploration",
    csvs: "Téléchargements (CSV)",
    csvIssues: "Tous les problèmes",
    csvPages: "Toutes les pages",
    csvBroken: "Liens brisés",
    csvAdded: "Pages ajoutées",
    csvRemoved: "Pages retirées",
    csvNew: "Nouveaux problèmes",
    signIn: "Ces liens s'ouvrent dans Echorank et vous demandent de vous connecter si ce n'est pas déjà fait.",
    why: "Vous recevez ce message parce qu'une planification d'exploration de votre espace de travail a l'export par courriel activé. Désactivez-le sous Explorateur de site → Configuration → Explorations planifiées.",
  },
  "de-CH": {
    subject: (host: string) => `Geplanter Crawl abgeschlossen: ${host}`,
    intro: (host: string, pages: string) => `Ihr geplanter Crawl von ${host} ist abgeschlossen: ${pages} Seiten gecrawlt.`,
    issues: "Probleme",
    errors: "Fehler",
    warnings: "Warnungen",
    notices: "Hinweise",
    since: "Seit dem vorherigen geplanten Crawl",
    added: "neue Seiten",
    removed: "entfernte Seiten",
    changed: "geänderte Seiten",
    issuesNew: "neue Probleme",
    issuesResolved: "behobene Probleme",
    noBaseline: "Dies ist der erste Lauf, es gibt noch nichts zu vergleichen.",
    open: "Crawl öffnen",
    csvs: "Downloads (CSV)",
    csvIssues: "Alle Probleme",
    csvPages: "Alle Seiten",
    csvBroken: "Defekte Links",
    csvAdded: "Neue Seiten",
    csvRemoved: "Entfernte Seiten",
    csvNew: "Neue Probleme",
    signIn: "Diese Links öffnen sich in Echorank und verlangen eine Anmeldung, falls Sie nicht bereits angemeldet sind.",
    why: "Sie erhalten diese Nachricht, weil ein Crawl-Zeitplan in Ihrem Arbeitsbereich den E-Mail-Export eingeschaltet hat. Schalten Sie ihn unter Site Crawler → Konfiguration → Geplante Crawls aus.",
  },
} as const satisfies Record<Loc, Record<string, unknown>>;

export const SCHEDULE_EMAIL_COPY = COPY;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fold = (lang: string | null | undefined): Loc => (lang?.startsWith("fr") ? "fr" : lang?.startsWith("de") ? "de-CH" : "en");

export interface ScheduleEmailData {
  locale: Loc;
  host: string;
  crawlJobId: string;
  pagesCrawled: number;
  issues: { ERROR: number; WARNING: number; NOTICE: number };
  comparison: { id: string; counts: ComparisonResult["counts"] } | null;
}

/** Subject, HTML and text. Pure, so the copy and every link are testable. */
export function scheduleEmail(d: ScheduleEmailData): { subject: string; html: string; text: string; links: string[] } {
  const c = COPY[d.locale];
  const nf = new Intl.NumberFormat(d.locale === "en" ? "en-US" : d.locale);
  const n = (v: number) => nf.format(v);
  const api = `${SITE}/api/seo/v1/crawl/${d.crawlJobId}`;
  const open = `${SITE}/crawler/${encodeURIComponent(d.crawlJobId)}`;
  const csv: [string, string][] = [
    [c.csvIssues, `${api}/export`],
    [c.csvPages, `${api}/pages?format=csv`],
    [c.csvBroken, `${api}/export?view=broken-links`],
  ];
  if (d.comparison) {
    const b = `${api}/compare/${d.comparison.id}`;
    csv.push([c.csvAdded, `${b}?bucket=added&format=csv`], [c.csvRemoved, `${b}?bucket=removed&format=csv`], [c.csvNew, `${b}?bucket=issuesNew&format=csv`]);
  }
  const issueLine = `${c.issues}: ${n(d.issues.ERROR)} ${c.errors}, ${n(d.issues.WARNING)} ${c.warnings}, ${n(d.issues.NOTICE)} ${c.notices}`;
  const k = d.comparison?.counts;
  const deltas = k
    ? [`${n(k.added)} ${c.added}`, `${n(k.removed)} ${c.removed}`, `${n(k.changed)} ${c.changed}`, `${n(k.issuesNew)} ${c.issuesNew}`, `${n(k.issuesResolved)} ${c.issuesResolved}`]
    : null;

  const text = [
    c.intro(d.host, n(d.pagesCrawled)),
    issueLine,
    "",
    deltas ? `${c.since}:\n${deltas.map((x) => `- ${x}`).join("\n")}` : c.noBaseline,
    "",
    `${c.open}: ${open}`,
    "",
    `${c.csvs}:`,
    ...csv.map(([label, href]) => `- ${label}: ${href}`),
    "",
    c.signIn,
    c.why,
  ].join("\n");

  const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111827;max-width:560px">',
    p(esc(c.intro(d.host, n(d.pagesCrawled)))),
    p(esc(issueLine)),
    deltas ? `${p(`<strong>${esc(c.since)}</strong>`)}<ul style="margin:0 0 12px">${deltas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : p(esc(c.noBaseline)),
    p(`<a href="${esc(open)}" style="display:inline-block;background:#111827;color:#ffffff;padding:8px 14px;border-radius:8px;text-decoration:none">${esc(c.open)}</a>`),
    p(`<strong>${esc(c.csvs)}</strong>`),
    `<ul style="margin:0 0 12px">${csv.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul>`,
    `<p style="margin:0 0 8px;color:#6b7280;font-size:12px">${esc(c.signIn)}</p>`,
    `<p style="margin:0;color:#6b7280;font-size:12px">${esc(c.why)}</p>`,
    "</div>",
  ].join("");

  return { subject: c.subject(d.host), html, text, links: [open, ...csv.map(([, h]) => h)] };
}

/** The AfterRunHooks email: load, render, send to the owner. */
export async function sendScheduledCrawlEmail(ctx: { tenantId: string; crawlJobId: string; comparisonId: string | null }): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      defaultLanguage: true,
      members: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { user: { select: { email: true } } } },
    },
  });
  const to = tenant?.members[0]?.user?.email;
  if (!to) return false;
  const job = await prisma.crawlJob.findFirst({ where: { id: ctx.crawlJobId, tenantId: ctx.tenantId }, select: { id: true, rootUrl: true, pagesCrawled: true, summary: true } });
  if (!job) return false;
  const cmp = ctx.comparisonId ? await prisma.crawlComparison.findFirst({ where: { id: ctx.comparisonId, jobAId: job.id }, select: { id: true, result: true } }) : null;
  const mail = scheduleEmail({
    locale: fold(tenant?.defaultLanguage),
    host: new URL(job.rootUrl).hostname,
    crawlJobId: job.id,
    pagesCrawled: job.pagesCrawled,
    issues: await getIssueTotals(job.id, job.summary),
    comparison: cmp ? { id: cmp.id, counts: (cmp.result as unknown as ComparisonResult).counts } : null,
  });
  return sendMail({ to: [to], subject: mail.subject, html: mail.html, text: mail.text });
}
