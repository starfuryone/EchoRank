// src/lib/site-crawler/sheets.ts
//
// Google Sheets export (Phase 4c, behind crawl.sheets). Four tabs, a fixed
// layout the Looker Studio guide documents (help article
// looker-studio-crawl-report):
//
//   Summary   one row APPENDED per crawl — the history Looker charts over time
//   Issues    replaced each export: one row per rule with findings
//   Pages     replaced each export: one row per page (≤ SHEETS_PAGE_ROWS)
//   Compare   replaced each export: bucket counts, then new / resolved per rule
//
// Auth: the tenant's Google connection (gsc_connections), whose refresh token
// carries the spreadsheets scope once the tenant has run "Connect Google
// Sheets". The client is an interface so the tests drive a mock; the REST
// implementation below is the only code that talks to Google.
//
// Memory-first: pages stream from Postgres in keyset chunks and go out one
// chunk per request.

import "server-only";
import { prisma } from "@/lib/prisma";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { getConnection, withAccessToken } from "@/lib/gsc/service";
import { GscReauthError } from "@/lib/gsc/client";
import { ruleTalliesFor } from "./rule-summary";
import { getIssueTotals } from "./issue-totals";
import type { ComparisonResult } from "./compare";
import { COMPARE_HEADER, ISSUES_HEADER, PAGES_HEADER, SHEET_TABS, SHEETS_PAGE_ROWS, SUMMARY_HEADER } from "./sheets-layout";

export { SHEET_TABS, SUMMARY_HEADER, ISSUES_HEADER, PAGES_HEADER, COMPARE_HEADER, SHEETS_PAGE_ROWS } from "./sheets-layout";
export const SHEETS_CHUNK = 5_000;

export class SheetsNotConnectedError extends Error {
  readonly status = 409;
  readonly code = "SHEETS_NOT_CONNECTED";
  constructor() {
    super("Connect Google Sheets first.");
    this.name = "SheetsNotConnectedError";
  }
}
export class SheetsScopeError extends Error {
  readonly status = 409;
  readonly code = "SHEETS_SCOPE_MISSING";
  constructor() {
    super("The Google connection does not allow Sheets yet. Connect Google Sheets again.");
    this.name = "SheetsScopeError";
  }
}

type Cell = string | number | boolean | null;

/** A spreadsheet URL or a bare ID → the ID; empty → null (create one); anything else → "invalid". */
export function spreadsheetIdOf(raw: string | undefined): string | null | "invalid" {
  if (!raw) return null;
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/.exec(raw) ?? /^([A-Za-z0-9_-]{20,100})$/.exec(raw);
  return m ? m[1]! : "invalid";
}

export interface SheetsClient {
  create(title: string, tabs: readonly string[]): Promise<{ spreadsheetId: string; url: string }>;
  tabTitles(spreadsheetId: string): Promise<string[]>;
  addTabs(spreadsheetId: string, titles: readonly string[]): Promise<void>;
  clear(spreadsheetId: string, tab: string): Promise<void>;
  /** Write rows starting at row `fromRow` (1-based). */
  write(spreadsheetId: string, tab: string, fromRow: number, rows: Cell[][]): Promise<void>;
  append(spreadsheetId: string, tab: string, rows: Cell[][]): Promise<void>;
  /** Whether the tab has anything in A1. */
  hasHeader(spreadsheetId: string, tab: string): Promise<boolean>;
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const a1 = (tab: string, cell = "A1") => `'${tab.replace(/'/g, "''")}'!${cell}`;

/** The REST client. Throws SheetsScopeError on 403, GscReauthError on 401. */
export function restSheetsClient(accessToken: string, fetchImpl: typeof fetch = fetch): SheetsClient {
  const call = async (url: string, init: RequestInit = {}) => {
    const res = await fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401) throw new GscReauthError();
    if (res.status === 403) throw new SheetsScopeError();
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  };
  const values = (id: string, range: string) => `${API}/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`;
  return {
    async create(title, tabs) {
      const d = await call(API, { method: "POST", body: JSON.stringify({ properties: { title }, sheets: tabs.map((t) => ({ properties: { title: t } })) }) });
      return { spreadsheetId: d.spreadsheetId as string, url: d.spreadsheetUrl as string };
    },
    async tabTitles(id) {
      const d = await call(`${API}/${encodeURIComponent(id)}?fields=sheets.properties.title`);
      return ((d.sheets as { properties: { title: string } }[] | undefined) ?? []).map((s) => s.properties.title);
    },
    async addTabs(id, titles) {
      if (!titles.length) return;
      await call(`${API}/${encodeURIComponent(id)}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: titles.map((title) => ({ addSheet: { properties: { title } } })) }) });
    },
    async clear(id, tab) {
      await call(`${values(id, `'${tab.replace(/'/g, "''")}'`)}:clear`, { method: "POST", body: "{}" });
    },
    async write(id, tab, fromRow, rows) {
      await call(`${values(id, a1(tab, `A${fromRow}`))}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: rows }) });
    },
    async append(id, tab, rows) {
      await call(`${values(id, a1(tab))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: rows }) });
    },
    async hasHeader(id, tab) {
      const d = await call(values(id, a1(tab, "A1:A1")));
      return Array.isArray(d.values) && d.values.length > 0;
    },
  };
}

/**
 * A cell as RAW text: values are written with valueInputOption=RAW, so a page
 * title beginning "=" is stored as text, never evaluated as a formula.
 */
const text = (v: string | null | undefined) => (v == null ? null : v.slice(0, 50_000));

export interface SheetsExportInput {
  tenantId: string;
  crawlJobId: string;
  comparisonId: string | null;
  /** null = create a new spreadsheet. */
  spreadsheetId: string | null;
}

/** Write the four tabs. Returns the spreadsheet written to. */
export async function exportCrawlToSheets(input: SheetsExportInput, client: SheetsClient): Promise<{ spreadsheetId: string; url: string; pages: number }> {
  const job = await prisma.crawlJob.findFirst({
    where: { id: input.crawlJobId, tenantId: input.tenantId, status: "COMPLETED", dataPurgedAt: null },
    select: { id: true, rootUrl: true, createdAt: true, summary: true, pagesCrawled: true },
  });
  if (!job) throw new Error("crawl_not_exportable");
  const host = new URL(job.rootUrl).hostname;

  let spreadsheetId = input.spreadsheetId;
  let url = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : "";
  if (!spreadsheetId) {
    const made = await client.create(`Echorank crawl report — ${host}`, SHEET_TABS);
    spreadsheetId = made.spreadsheetId;
    url = made.url;
  } else {
    const have = new Set(await client.tabTitles(spreadsheetId));
    await client.addTabs(spreadsheetId, SHEET_TABS.filter((t) => !have.has(t)));
  }

  // ── Summary: append one row ──
  const [indexable, errors, redirects] = await Promise.all([
    prisma.crawlPage.count({ where: { crawlJobId: job.id, statusCode: 200, noindex: { not: true } } }),
    prisma.crawlPage.count({ where: { crawlJobId: job.id, OR: [{ statusCode: null }, { statusCode: { gte: 400 } }] } }),
    prisma.crawlPage.count({ where: { crawlJobId: job.id, statusCode: { gte: 300, lt: 400 } } }),
  ]);
  const totals = await getIssueTotals(job.id, job.summary);
  const cmp = input.comparisonId
    ? await prisma.crawlComparison.findFirst({ where: { id: input.comparisonId, jobAId: job.id }, select: { result: true, jobB: { select: { createdAt: true } } } })
    : null;
  const counts = cmp ? (cmp.result as unknown as ComparisonResult).counts : null;
  if (!(await client.hasHeader(spreadsheetId, "Summary"))) await client.write(spreadsheetId, "Summary", 1, [[...SUMMARY_HEADER]]);
  await client.append(spreadsheetId, "Summary", [
    [
      job.createdAt.toISOString(),
      host,
      job.rootUrl,
      job.id,
      job.pagesCrawled,
      indexable,
      errors,
      redirects,
      totals.ERROR,
      totals.WARNING,
      totals.NOTICE,
      cmp ? cmp.jobB.createdAt.toISOString() : null,
      counts?.added ?? null,
      counts?.removed ?? null,
      counts?.changed ?? null,
      counts?.issuesNew ?? null,
      counts?.issuesResolved ?? null,
    ],
  ]);

  // ── Issues: one row per rule ──
  const tallies = await ruleTalliesFor(job.id, job.summary);
  const issueRows: Cell[][] = Object.entries(tallies.issues)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, t]) => [job.id, id, RULE_COPY[id]?.name ?? id, t.kind, t.priority, t.count]);
  await client.clear(spreadsheetId, "Issues");
  await client.write(spreadsheetId, "Issues", 1, [[...ISSUES_HEADER], ...issueRows]);

  // ── Pages: keyset chunks ──
  await client.clear(spreadsheetId, "Pages");
  await client.write(spreadsheetId, "Pages", 1, [[...PAGES_HEADER]]);
  let cursor: string | null = null;
  let row = 2;
  let pages = 0;
  while (pages < SHEETS_PAGE_ROWS) {
    const chunk: { id: string; url: string; statusCode: number | null; noindex: boolean | null; title: string | null; depth: number; inlinkCount: number | null; wordCount: number | null; inSitemap: boolean | null }[] =
      await prisma.crawlPage.findMany({
        where: { crawlJobId: job.id, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: Math.min(SHEETS_CHUNK, SHEETS_PAGE_ROWS - pages),
        select: { id: true, url: true, statusCode: true, noindex: true, title: true, depth: true, inlinkCount: true, wordCount: true, inSitemap: true },
      });
    if (!chunk.length) break;
    await client.write(
      spreadsheetId,
      "Pages",
      row,
      chunk.map((p) => [job.id, p.url, p.statusCode, p.statusCode === 200 && p.noindex !== true, text(p.title), p.depth, p.inlinkCount, p.wordCount, p.inSitemap]),
    );
    row += chunk.length;
    pages += chunk.length;
    cursor = chunk[chunk.length - 1]!.id;
  }

  // ── Compare ──
  await client.clear(spreadsheetId, "Compare");
  const cmpRows: Cell[][] = counts
    ? [
        ...Object.entries(counts).map(([k, v]) => [job.id, cmp!.jobB.createdAt.toISOString(), k, v]),
        ...(cmp!.result as unknown as ComparisonResult).rules.flatMap((r) => [
          [job.id, cmp!.jobB.createdAt.toISOString(), `new:${r.ruleId}`, r.new],
          [job.id, cmp!.jobB.createdAt.toISOString(), `resolved:${r.ruleId}`, r.resolved],
        ]),
      ]
    : [];
  await client.write(spreadsheetId, "Compare", 1, [[...COMPARE_HEADER], ...cmpRows]);

  return { spreadsheetId, url, pages };
}

/** Run with the tenant's Google connection. */
export async function withSheetsClient<T>(tenantId: string, fn: (client: SheetsClient) => Promise<T>): Promise<T> {
  const conn = await getConnection(tenantId);
  if (!conn || conn.status !== "ACTIVE") throw new SheetsNotConnectedError();
  return withAccessToken(conn, (token) => fn(restSheetsClient(token)));
}

/** The schedule hook: export, and remember a newly created spreadsheet on the schedule. */
export async function exportScheduledToSheets(ctx: { tenantId: string; crawlJobId: string; comparisonId: string | null; scheduleId: string; spreadsheetId: string | null }) {
  const out = await withSheetsClient(ctx.tenantId, (client) => exportCrawlToSheets(ctx, client));
  if (!ctx.spreadsheetId) {
    const row = await prisma.crawlSchedule.findFirst({ where: { id: ctx.scheduleId, tenantId: ctx.tenantId }, select: { exportTo: true } });
    const exportTo = { ...((row?.exportTo as object | null) ?? {}), sheets: { spreadsheetId: out.spreadsheetId } };
    await prisma.crawlSchedule.update({ where: { id: ctx.scheduleId }, data: { exportTo } });
  }
  return out;
}
