// src/lib/site-crawler/free-result.ts
//
// The free public crawler's result link (/free-tools/site-crawler/r/<token>):
// what anyone with the link sees (status, progress, the preview: host, pages,
// Site health, kind totals, the top FREE_FIX_FIRST rules), and what only an
// unlocked browser gets (every rule that fired, and the CSV).
//
// UNLOCK. An email posted to /unlock is stored as a FreeCrawlLead (kept after
// the crawl is purged) and answered with a cookie `erfc_<token>` whose value is
// an HMAC of the token: the server checks it on every read, so a cookie for one
// result does not open another and a hand-made one opens nothing. The full list
// is never sent to a browser without it (the blur is a placeholder, not hidden
// data).
//
// BREVO. Only a lead that ticked the consent box is sent, through Brevo's
// double opt-in (a confirmation email first; the contact joins the free-tools
// list only once they click), with SOURCE free-crawler.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/infrastructure/observability/logger";
import { prisma } from "@/lib/prisma";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { SITE_URL } from "@/lib/seo/constants";
import { FREE_CRAWL_RETENTION_DAYS, FREE_FIX_FIRST } from "./free-limits";
import { queueEstimate } from "./public-api";
import { fixFirst, healthOf } from "./site-health";

const DAY_MS = 86_400_000;

/** The largest paid crawl (URLs), read from the plan config, formatted for the locale: the CTA's "up to N URLs". */
export function paidCrawlCeiling(locale: string): string {
  const max = Math.max(...Object.values(PLAN_CONFIGS).map((p) => p.crawlUrlCap));
  return new Intl.NumberFormat(locale.startsWith("fr") ? "fr-CA" : "en-US").format(max);
}

export const FREE_ROW_SELECT = {
  token: true,
  domain: true,
  host: true,
  createdAt: true,
  crawlJob: {
    select: { id: true, tenantId: true, rootUrl: true, status: true, stoppedReason: true, pagesCrawled: true, urlCap: true, summary: true, createdAt: true, startedAt: true, finishedAt: true },
  },
} as const;

export type FreeRow = NonNullable<Awaited<ReturnType<typeof freeCrawlByToken>>>;

/** A free crawl by its result token, while its result link lives (FREE_CRAWL_RETENTION_DAYS). */
export async function freeCrawlByToken(token: string, now: Date = new Date()) {
  if (!/^[\w-]{16,64}$/.test(token)) return null;
  return prisma.freeCrawl.findFirst({
    where: { token, createdAt: { gt: new Date(now.getTime() - FREE_CRAWL_RETENTION_DAYS * DAY_MS) } },
    select: FREE_ROW_SELECT,
  });
}

export function freeExpiresAt(row: { createdAt: Date }): Date {
  return new Date(row.createdAt.getTime() + FREE_CRAWL_RETENTION_DAYS * DAY_MS);
}

export type FreePhase = "queued" | "crawling" | "completed" | "failed" | "cancelled";
const PHASE: Record<string, FreePhase> = { QUEUED: "queued", RUNNING: "crawling", COMPLETED: "completed", FAILED: "failed", CANCELLED: "cancelled" };

/** What the progress view polls. */
export async function freeStatus(row: FreeRow) {
  const j = row.crawlJob;
  const q = await queueEstimate(j);
  return {
    status: PHASE[j.status] ?? "failed",
    host: row.host,
    pagesCrawled: j.pagesCrawled,
    urlCap: j.urlCap,
    queuePosition: q.queuePosition,
    estimatedStart: q.estimatedStart,
  };
}

type IssueTally = { count: number; kind?: string; priority: string; pages?: number };
const issuesOf = (summary: unknown): Record<string, IssueTally> => ((summary as { issues?: Record<string, IssueTally> } | null)?.issues ?? {});

/** The rule's one-line why: the first sentence of its description. */
export function oneLineWhy(ruleId: string): string | null {
  const d = RULE_COPY[ruleId]?.description;
  if (!d) return null;
  const m = /^.*?[.!?](?=\s|$)/.exec(d.trim());
  return (m ? m[0] : d).trim();
}

export interface FreePreview {
  host: string;
  pagesCrawled: number;
  health: number | null;
  byKind: { issue: number; warning: number; opportunity: number };
  fixFirst: { ruleId: string; name: string; why: string | null; pages: number; count: number }[];
  stoppedReason: string | null;
  rulesFired: number;
}

/** What anyone with the link sees once the crawl has ended. */
export function freePreview(row: FreeRow): FreePreview {
  const s = row.crawlJob.summary as { issuesByKind?: Partial<Record<"issue" | "warning" | "opportunity", number>> } | null;
  const issues = issuesOf(row.crawlJob.summary);
  return {
    host: row.host,
    pagesCrawled: row.crawlJob.pagesCrawled,
    health: healthOf(row.crawlJob.summary),
    byKind: { issue: s?.issuesByKind?.issue ?? 0, warning: s?.issuesByKind?.warning ?? 0, opportunity: s?.issuesByKind?.opportunity ?? 0 },
    fixFirst: fixFirst(issues, FREE_FIX_FIRST).map((it) => ({ ...it, name: RULE_COPY[it.ruleId]?.name ?? it.ruleId, why: oneLineWhy(it.ruleId) })),
    stoppedReason: row.crawlJob.stoppedReason,
    rulesFired: Object.values(issues).filter((t) => t.count > 0).length,
  };
}

export interface FreeRuleRow {
  ruleId: string;
  name: string;
  kind: "issue" | "warning" | "opportunity";
  priority: "high" | "medium" | "low";
  count: number;
  pages: number;
}

const KIND_RANK = { issue: 0, warning: 1, opportunity: 2 } as const;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Every rule that fired, worst first. Unlocked browsers only. */
export function freeFullList(row: FreeRow): FreeRuleRow[] {
  return Object.entries(issuesOf(row.crawlJob.summary))
    .filter(([, t]) => t.count > 0)
    .map(([ruleId, t]) => ({
      ruleId,
      name: RULE_COPY[ruleId]?.name ?? ruleId,
      kind: (t.kind ?? "issue") as FreeRuleRow["kind"],
      priority: (t.priority ?? "low") as FreeRuleRow["priority"],
      count: t.count,
      pages: t.pages ?? t.count,
    }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.pages - a.pages || a.ruleId.localeCompare(b.ruleId));
}

// ─── The unlock cookie ───────────────────────────────────────────────────────

export const unlockCookieName = (token: string) => `erfc_${token}`;

function unlockSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.GSC_TOKEN_ENCRYPTION_KEY || null;
}

/** The cookie value that unlocks `token`; null when the server has no secret to sign with. */
export function unlockValue(token: string, secret: string | null = unlockSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`free-crawl-unlock:${token}`).digest("base64url");
}

export function isUnlocked(token: string, cookieValue: string | undefined | null, secret: string | null = unlockSecret()): boolean {
  const want = unlockValue(token, secret);
  if (!want || !cookieValue) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(cookieValue);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Set-Cookie for an unlocked result: this browser, until the result expires. */
export function unlockCookie(row: { token: string; createdAt: Date }, now: Date = new Date()): string | null {
  const value = unlockValue(row.token);
  if (!value) return null;
  const maxAge = Math.max(60, Math.floor((freeExpiresAt(row).getTime() - now.getTime()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${unlockCookieName(row.token)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export const LEAD_SOURCE = "free-crawler";
const BREVO_DOI_URL = "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";

/** Store the lead (once per result and email). Leads outlive the crawl: no FK, no retention. */
export async function recordLead(input: { row: FreeRow; email: string; locale: string; consent: boolean }) {
  const email = input.email.trim().toLowerCase();
  const lead = await prisma.freeCrawlLead.upsert({
    where: { token_email: { token: input.row.token, email } },
    create: { token: input.row.token, email, domain: input.row.domain, locale: input.locale, marketingConsent: input.consent, source: LEAD_SOURCE },
    update: input.consent ? { marketingConsent: true } : {},
    select: { id: true, doiRequestedAt: true },
  });
  if (input.consent && !lead.doiRequestedAt) {
    const sent = await requestDoubleOptIn(email, input.locale, input.row.domain).catch((err: Error) => {
      logger.warn({ err: err.message }, "free crawler: Brevo double opt-in failed");
      return "skipped" as const;
    });
    if (sent === "sent") await prisma.freeCrawlLead.update({ where: { id: lead.id }, data: { doiRequestedAt: new Date() } });
  }
  return lead;
}

/**
 * Brevo's double opt-in: Brevo emails a confirmation (template
 * BREVO_DOI_TEMPLATE_ID); the contact joins BREVO_FREE_TOOLS_LIST_ID only when
 * they click it, then lands on redirectionUrl. Skipped (logged, nothing sent)
 * when unconfigured, outside production, or with MAIL_DRY_RUN=1.
 */
export async function requestDoubleOptIn(
  email: string,
  locale: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
  // Another free tool's leads (the Website Authority Checker) use the same
  // list and template with their own SOURCE and landing page.
  opts: { source?: string; redirectPath?: string } = {},
): Promise<"sent" | "skipped"> {
  const source = opts.source ?? LEAD_SOURCE;
  const redirectPath = opts.redirectPath ?? "/free-tools/site-crawler";
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_FREE_TOOLS_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  if (!apiKey || !Number.isInteger(listId) || listId <= 0 || !Number.isInteger(templateId) || templateId <= 0) {
    logger.warn("free crawler: Brevo free-tools list or DOI template not configured; consented lead not sent");
    return "skipped";
  }
  if (process.env.NODE_ENV !== "production" || process.env.MAIL_DRY_RUN === "1") {
    logger.warn({ listId }, "DRY RUN: Brevo double opt-in logged instead of sent");
    return "skipped";
  }
  const base = locale === "fr" ? "fr" : "en";
  const res = await fetchImpl(BREVO_DOI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", "api-key": apiKey },
    body: JSON.stringify({
      email,
      includeListIds: [listId],
      templateId,
      redirectionUrl: `${SITE_URL}/${base}${redirectPath}?subscribed=1`,
      attributes: { SOURCE: source, LOCALE: base, CHECKED_DOMAIN: domain },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo double opt-in failed (${res.status})`);
  return "sent";
}
