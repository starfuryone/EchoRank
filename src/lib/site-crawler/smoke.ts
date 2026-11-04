// src/lib/site-crawler/smoke.ts
//
// The production smoke test behind `npm run crawl:smoke` (scripts/crawl-smoke.ts):
// one real crawl, started the way POST /api/seo/v1/crawl starts it, then one
// PASS / FAIL / SKIP line per check against what it stored and what the API
// serves for it.
//
//   start   StartCrawlBodySchema (the handler's own schema) → the handler's
//           paid-plan, rate-limit and quota guards → startCrawl(), which runs
//           checkCrawlConfig, the plan caps and the real site-crawl enqueue.
//           The backlink estimate (pages × last metered unit cost, the Add
//           data card's formula) is printed before anything is enqueued.
//   wait    crawl_jobs polled until COMPLETED / FAILED / CANCELLED, then the
//           post-crawl metrics job (PSI, backlinks) until each opted-in source
//           is done or stopped — or until --timeout minutes.
//   check   database reads, plus HTTP against the running web process for the
//           API routes (Pages, CSV, graph, Compare, PDF report).
//
// HTTP AUTH. Those routes sit behind requirePaidPlan(), which needs a session.
// The script mints a 30-minute Auth.js session JWT for the tenant's oldest
// OWNER/ADMIN member, signed with AUTH_SECRET from .env (which is why it runs
// as echorank), and sends it only to CRAWL_SMOKE_BASE_URL (default
// http://127.0.0.1:4400). The token, cookies and every key stay in memory and
// are never printed. Side effects besides the crawl itself: one stored
// comparison row (the Compare check) and, with --segment, a saved segment that
// is added for the start and removed straight after it.

import "server-only";
import Papa from "papaparse";
import { encode } from "next-auth/jwt";
import { Prisma, type PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { flag, type FlagName } from "@/lib/flags";
import { hasPaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { RULES, FAMILY_ID_PREFIXES, RULE_FAMILIES, type RuleFamily } from "@/lib/crawl-rules";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { EXTRACTOR_PRESETS, readStoredConfig, type CrawlConfigInput, type ExtractorPreset } from "./crawl-config";
import { ISSUE_COLUMNS, LINK_SCORE_COLUMN, metricCsvColumns, pageColumns, withSegmentColumn } from "./csv-columns";
import { cachedTotals, toTotals } from "./issue-totals";
import { METRIC_COLUMNS, METRIC_SOURCES, type MetricSource } from "./metrics-shared";
import { metricCoverage } from "./metrics";
import { targetPages, type SourceState } from "./metrics-runner";
import { propertyCovers } from "./gsc-join";
import { featureCapsForPlan, getCrawlQuota } from "./quota";
import { startCrawl } from "./service";
import { SegmentDefSchema, segmentRuleProblem } from "./segments";
import { START_RATE_LIMIT, START_RATE_WINDOW_MS, StartCrawlBodySchema, startRateKey } from "./start-body";
import { COMPARE_BUCKETS } from "./compare";
import { THIN_MAX_WORDS, RENDER_MODES, type RenderMode } from "./types";
import { validateRootUrl } from "./url";
import { JS_PRESETS, type JsPreset } from "./js-snippets";
import { aiTokenEstimate, type AiPreset } from "./ai-shared";
import { marketingTokensUsed } from "@/lib/marketing/quota";

// ─── Arguments ───────────────────────────────────────────────────────────────

export interface SmokeArgs {
  tenant: string | null;
  url: string | null;
  render: RenderMode | null;
  psi: number | null;
  backlinks: number | null;
  extract: ExtractorPreset[];
  search: string | null;
  segment: string | null;
  /** Phase 4e: one custom JavaScript preset (needs --render), AI prompt presets on --ai-pages pages, the site's saved login. */
  js: JsPreset | null;
  ai: AiPreset[];
  aiPages: number;
  login: boolean;
  /** Phase 4g: semantic duplicates on N pages (the tenant's OpenAI key), URL Inspection on N pages. */
  semantic: number | null;
  inspect: number | null;
  timeoutMin: number;
  baseUrl: string;
  /** Phase 3d-A: "api" starts through POST /api/public/v1/crawl with a throwaway key (created, then revoked). */
  via: "direct" | "api";
}

/** --js takes the presets that need no further input. */
const SMOKE_JS = JS_PRESETS.filter((p) => p !== "loadMore" && p !== "custom");
/** --ai takes a preset id or its label, comma-separated: "suggest title", "grammar check", … */
const AI_ALIASES: Record<string, AiPreset> = {
  intent: "intent", "classify intent": "intent",
  summary: "summary", summarise: "summary", summarize: "summary",
  title: "title", "suggest title": "title", "suggest title + description": "title",
  grammar: "grammar", "grammar check": "grammar",
};

/** "og" is shorthand for the three Open Graph presets; otherwise preset keys, comma-separated. */
const EXTRACT_ALIASES: Record<string, ExtractorPreset[]> = { og: ["ogTitle", "ogDescription", "ogImage"] };

export const USAGE = `usage: npm run crawl:smoke -- --tenant <slug> --url <https://host> [--render thin|all] [--psi N]
       [--backlinks N] [--extract og|<preset,...>] [--search "<text>"] [--segment "<glob>"] [--timeout <minutes>]
       [--js ${SMOKE_JS.join("|")}] [--ai "suggest title"|intent|summary|grammar[,…]] [--ai-pages N] [--login]
       [--semantic N] [--inspect N] [--via api]
presets: ${Object.keys(EXTRACTOR_PRESETS).join(", ")} (og = ogTitle,ogDescription,ogImage)
env:   CRAWL_SMOKE_BASE_URL (default http://127.0.0.1:4400) — the web process the API checks call`;

export function parseArgs(argv: readonly string[], env: Record<string, string | undefined> = process.env): SmokeArgs {
  const out: SmokeArgs = {
    tenant: null, url: null, render: null, psi: null, backlinks: null, extract: [], search: null, segment: null,
    js: null, ai: [], aiPages: 5, login: false, semantic: null, inspect: null,
    timeoutMin: 20, baseUrl: (env.CRAWL_SMOKE_BASE_URL || "http://127.0.0.1:4400").replace(/\/+$/, ""), via: "direct",
  };
  const int = (name: string, v: string | undefined) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} takes a positive integer, got ${JSON.stringify(v)}`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const v = argv[i + 1];
    const take = () => {
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      i++;
      return v;
    };
    switch (a) {
      case "--tenant": out.tenant = take(); break;
      case "--url": out.url = take(); break;
      case "--render": {
        const m = take();
        if (!(RENDER_MODES as readonly string[]).includes(m) || m === "none") throw new Error(`--render takes thin or all, got ${m}`);
        out.render = m as RenderMode;
        break;
      }
      case "--psi": out.psi = int("psi", take()); break;
      case "--backlinks": out.backlinks = int("backlinks", take()); break;
      case "--extract": {
        for (const k of take().split(",").map((s) => s.trim()).filter(Boolean)) {
          const keys = EXTRACT_ALIASES[k] ?? (k in EXTRACTOR_PRESETS ? [k as ExtractorPreset] : null);
          if (!keys) throw new Error(`--extract: unknown preset ${k}`);
          for (const key of keys) if (!out.extract.includes(key)) out.extract.push(key);
        }
        break;
      }
      case "--search": out.search = take(); break;
      case "--segment": out.segment = take(); break;
      case "--timeout": out.timeoutMin = int("timeout", take()); break;
      case "--js": {
        const p = take();
        if (!(SMOKE_JS as readonly string[]).includes(p)) throw new Error(`--js takes ${SMOKE_JS.join(", ")}, got ${p}`);
        out.js = p as JsPreset;
        break;
      }
      case "--ai": {
        for (const k of take().split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
          const preset = AI_ALIASES[k];
          if (!preset) throw new Error(`--ai: unknown prompt ${k}`);
          if (!out.ai.includes(preset)) out.ai.push(preset);
        }
        if (out.ai.length > 3) throw new Error("--ai takes at most 3 prompts");
        break;
      }
      case "--ai-pages": out.aiPages = int("ai-pages", take()); break;
      case "--login": out.login = true; break;
      case "--semantic": out.semantic = int("semantic", take()); break;
      case "--inspect": out.inspect = int("inspect", take()); break;
      case "--via": {
        const via = take();
        if (via !== "api" && via !== "direct") throw new Error(`--via takes api or direct, got ${via}`);
        out.via = via;
        break;
      }
      default: throw new Error(`unknown argument ${a}`);
    }
  }
  if (out.js && !out.render) throw new Error("--js runs on rendered pages: add --render thin|all");
  return out;
}

/** The POST /api/seo/v1/crawl body these arguments stand for. `config` only when an option needs one. */
export function requestBody(args: SmokeArgs): unknown {
  const config: Partial<CrawlConfigInput> = {};
  if (args.extract.length) config.extractors = args.extract.map((k) => ({ ...EXTRACTOR_PRESETS[k] }));
  if (args.search) config.searches = [{ name: args.search.slice(0, 60), pattern: args.search, isRegex: false }];
  if (args.psi || args.backlinks) {
    config.addData = {
      psi: args.psi ? { pages: args.psi, segment: null } : null,
      backlinks: args.backlinks ? { pages: args.backlinks, segment: null } : null,
    };
  }
  if (args.js) config.js = [{ name: args.js, preset: args.js, selector: null, code: null }];
  if (args.ai.length) config.ai = { provider: "claude", prompts: args.ai.map((preset) => ({ preset, text: null })), top: { pages: args.aiPages, segment: null } };
  if (args.login) config.useLogin = true;
  if (args.semantic) config.semantic = { pages: args.semantic, segment: null };
  if (args.inspect) config.inspection = { pages: args.inspect, segment: null };
  return {
    url: args.url ?? "",
    renderMode: args.render ?? "none",
    ...(Object.keys(config).length ? { config } : {}),
  };
}

// ─── Results ─────────────────────────────────────────────────────────────────

export type Verdict = "PASS" | "FAIL" | "SKIP";
export interface CheckLine {
  verdict: Verdict;
  name: string;
  value: string;
}

export interface SmokeDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  out: (line: string) => void;
  env: Record<string, string | undefined>;
  /** Poll interval while waiting on the crawl. */
  pollMs?: number;
}

export interface SmokeResult {
  exitCode: number;
  jobId: string | null;
  lines: CheckLine[];
}

const usd = (n: number) => `$${n.toFixed(4)}`;
const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

/** Family of a stored rule id: the registry when it knows it, else the id's prefix. */
const FAMILY_OF = new Map(RULES.map((r) => [r.id, r.family]));
export function familyOf(ruleId: string): RuleFamily | null {
  const known = FAMILY_OF.get(ruleId);
  if (known) return known;
  const prefix = ruleId.split(".")[0]!;
  for (const f of RULE_FAMILIES) {
    if (f === prefix || (FAMILY_ID_PREFIXES[f] ?? []).includes(prefix)) return f;
  }
  return null;
}

/**
 * Families switched on by a product flag. The issues-by-family check FAILs
 * one of these when its flag is on, the crawl stored the facts its rules read,
 * and it produced no findings. Families without a flag are only reported:
 * their facts are every page, and a clean site legitimately has none of them.
 */
export const GATED_FAMILIES: Partial<Record<RuleFamily, FlagName>> = {
  javascript: "crawl.render",
  accessibility: "crawl.render",
  mobile: "crawl.render",
  performance: "crawl.psi",
  search_console: "crawl.gsc",
  analytics: "crawl.ga4",
  backlinks: "crawl.backlinks",
  extraction: "crawl.extraction",
  robots: "crawl.customRobots",
  amp: "crawl.amp",
  ai: "crawl.ai",
};

type Num = number | null | undefined;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Indexable the way search_console/analytics rules read it: 200, HTML, not noindex, self or no canonical. */
function indexable(p: { url: string; statusCode: Num; noindex: boolean | null; contentType: string | null; canonical: string | null }) {
  if (p.statusCode !== 200 || p.noindex) return false;
  if (p.contentType && !/html/i.test(p.contentType)) return false;
  return p.canonical === null || p.canonical.replace(/\/+$/, "") === p.url.replace(/\/+$/, "");
}

/**
 * Whether the crawl stored facts a gated family's rules would fire on, read
 * from the stored columns. "unknown" when the facts are not stored (mobile's
 * viewport and font sizes live only in the crawl's memory): reported, not judged.
 */
export async function familyFacts(jobId: string, config: ReturnType<typeof readStoredConfig>, summary: unknown): Promise<Partial<Record<RuleFamily, boolean | "unknown">>> {
  const rendered = await prisma.crawlPage.findMany({
    where: { crawlJobId: jobId, renderedWordCount: { not: null } },
    select: { jsOnly: true, consoleErrors: true, renderedWordCount: true, axeViolations: true },
  });
  const anyTrue = (o: unknown) => !!o && typeof o === "object" && Object.values(o as Record<string, unknown>).some((v) => v === true);
  const anyCount = (o: unknown) =>
    !!o && typeof o === "object" &&
    Object.values(o as Record<string, unknown>).some((v) => (isNum(v) ? v > 0 : isNum((v as { nodes?: unknown } | null)?.nodes) && (v as { nodes: number }).nodes > 0));

  const metricRows = await prisma.crawlPageMetric.findMany({
    where: { crawlJobId: jobId, source: { in: ["psi", "backlinks"] } },
    select: { source: true, data: true, page: { select: { statusCode: true } } },
  });
  const psiImperfect = metricRows.some((m) => {
    if (m.source !== "psi") return false;
    return (["mobile", "desktop"] as const).some((s) => {
      const r = (m.data as Record<string, { performance?: unknown; error?: string } | undefined>)?.[s];
      const v = r && !r.error ? r.performance : null;
      return isNum(v) && v < (v > 1 ? 100 : 1);
    });
  });
  const backlinkFacts = metricRows.some((m) => {
    if (m.source !== "backlinks") return false;
    const d = m.data as { backlinks?: unknown; error?: string } | null;
    const status = m.page?.statusCode ?? null;
    return !d?.error && isNum(d?.backlinks) && d.backlinks > 0 && (status === null || status >= 300);
  });

  // search_console / analytics: the join ran ("ok"), and some page reads the way a rule fires on.
  const joined = (summary as { metrics?: Record<string, { status?: string }> } | null)?.metrics ?? {};
  const joinFacts = async (source: "gsc" | "ga4") => {
    if (joined[source]?.status !== "ok") return false;
    const pages = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId },
      select: {
        url: true, statusCode: true, noindex: true, contentType: true, canonical: true, inlinkCount: true,
        metrics: { where: { source }, select: { data: true } },
      },
    });
    return pages.some((p) => {
      const d = p.metrics[0]?.data as Record<string, unknown> | undefined;
      if (source === "gsc") {
        const impressions = isNum(d?.impressions) ? d.impressions : 0;
        const clicks = isNum(d?.clicks) ? d.clicks : 0;
        return (indexable(p) && impressions === 0) || (impressions > 0 && (p.inlinkCount ?? 0) <= 1) || (clicks > 0 && !!p.noindex);
      }
      return indexable(p) && (isNum(d?.sessions) ? d.sessions : 0) === 0;
    });
  };

  // extraction.empty: a page where some extractors found a value and others did not. search.match: any hit.
  const extractors = config?.extractors.length ?? 0;
  let extractionFacts = false;
  if (extractors > 1) {
    const perPage = await prisma.crawlExtraction.groupBy({ by: ["pageId"], where: { crawlJobId: jobId, NOT: { values: { isEmpty: true } } }, _count: { _all: true } });
    extractionFacts = perPage.some((g) => g._count._all > 0 && g._count._all < extractors);
  }
  if (!extractionFacts && (config?.searches.length ?? 0) > 0) {
    const hits = await prisma.crawlPage.findMany({ where: { crawlJobId: jobId, searchHits: { not: Prisma.DbNull } }, select: { searchHits: true } });
    extractionFacts = hits.some((p) => Object.values((p.searchHits as Record<string, unknown>) ?? {}).some((n) => isNum(n) && n > 0));
  }

  return {
    javascript: rendered.some((p) => anyTrue(p.jsOnly) || (p.consoleErrors ?? 0) > 0 || p.renderedWordCount === 0),
    accessibility: rendered.some((p) => anyCount(p.axeViolations)),
    mobile: rendered.length > 0 ? "unknown" : false,
    performance: psiImperfect,
    search_console: await joinFacts("gsc"),
    analytics: flag("crawl.ga4") ? await joinFacts("ga4") : false,
    backlinks: backlinkFacts,
    extraction: extractionFacts,
    robots: Boolean(config?.customRobots),
    // Phase 4e: whether a rule fires depends on the validator and the AMP pair; only "AMP was found" is stored.
    amp: (await prisma.crawlPage.count({ where: { crawlJobId: jobId, OR: [{ ampHtml: { not: null } }, { isAmp: true }] } })) > 0 ? "unknown" : false,
    // Phase 4e: whether a rule fires depends on what the model answered; only that it answered is countable.
    ai: config?.ai ? "unknown" : false,
  };
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"] as const;
const SESSION_MAX_AGE_S = 30 * 60;

/** A cookie header carrying a short-lived session for `user` acting in `tenantId`. Never logged. */
export async function sessionCookie(secret: string, user: { id: string; email: string | null; name: string | null }, tenantId: string): Promise<string> {
  const token = { sub: user.id, id: user.id, email: user.email, name: user.name };
  // Auth.js salts the JWT with the cookie's name, and which name the server
  // reads depends on whether it believes it is behind https (AUTH_URL). Both
  // are sent; it reads the one it expects.
  const parts = await Promise.all(
    SESSION_COOKIES.map(async (name) => `${name}=${await encode({ token, secret, salt: name, maxAge: SESSION_MAX_AGE_S })}`),
  );
  return [...parts, `echorank_active_tenant=${tenantId}`].join("; ");
}

/** First line of a streamed body, without reading the rest of a possibly large CSV. */
async function firstLine(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    const nl = buf.search(/\r?\n/);
    if (nl >= 0) {
      await reader.cancel().catch(() => undefined);
      return buf.slice(0, nl);
    }
    if (done) return buf;
  }
}

/** A CSV header row as cells: BOM stripped, quoting undone. */
export function csvHeaderCells(line: string): string[] {
  const parsed = Papa.parse<string[]>(line.replace(/^﻿/, ""), { header: false });
  return (parsed.data[0] ?? []).map(String);
}

/** A short, secret-free description of a non-2xx answer. */
async function describeFailure(res: Response): Promise<string> {
  if (res.status >= 300 && res.status < 400) return `${res.status} → ${res.headers.get("location") ?? "?"} (session not accepted?)`;
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { code?: string; error?: string };
    return `${res.status} ${j.code ?? ""} ${(j.error ?? "").slice(0, 120)}`.trim();
  } catch {
    return `${res.status} ${text.slice(0, 80).replace(/\s+/g, " ")}`.trim();
  }
}

// ─── The run ─────────────────────────────────────────────────────────────────

type JobRow = {
  id: string;
  rootUrl: string;
  status: string;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  renderMode: string;
  renderCap: number;
  pagesRendered: number;
  config: unknown;
  summary: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};
const JOB_SELECT = {
  id: true, rootUrl: true, status: true, pagesCrawled: true, issueCount: true, stoppedReason: true, renderMode: true,
  renderCap: true, pagesRendered: true, config: true, summary: true, startedAt: true, finishedAt: true, createdAt: true,
} as const;
const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/** Opted-in post-crawl sources still running. Empty once every one is done or stopped. */
export function pendingMetrics(job: Pick<JobRow, "config" | "summary">): ("psi" | "backlinks" | "ai" | "semantic" | "gsc_inspection")[] {
  const add = readStoredConfig(job.config)?.addData;
  const ai = readStoredConfig(job.config)?.ai;
  const states = ((job.summary as { metrics?: Record<string, SourceState | undefined> } | null)?.metrics ?? {});
  const settled = (s: SourceState | undefined) => s?.status === "done" || s?.status === "stopped";
  const out: ("psi" | "backlinks" | "ai" | "semantic" | "gsc_inspection")[] = [];
  if (ai && flag("crawl.ai") && !settled(states.ai)) out.push("ai");
  const stored = readStoredConfig(job.config);
  if (stored?.semantic && flag("crawl.semantic") && !settled(states.semantic)) out.push("semantic");
  if (stored?.inspection && flag("crawl.inspection") && !settled(states.gsc_inspection)) out.push("gsc_inspection");
  if (add?.backlinks && flag("crawl.backlinks") && !settled(states.backlinks)) out.push("backlinks");
  if (add?.psi && flag("crawl.psi") && !settled(states.psi)) out.push("psi");
  return out;
}

/** --via api: the throwaway key this run created; runSmoke revokes it whatever happens. */
interface ApiRun {
  tenantId: string;
  keyId: string;
  /** Never printed. */
  key: string;
}

export async function runSmoke(args: SmokeArgs, deps: SmokeDeps): Promise<SmokeResult> {
  const apiRun: { current: ApiRun | null } = { current: null };
  try {
    return await runSmokeInner(args, deps, apiRun);
  } finally {
    if (apiRun.current) {
      await revokeApiKey(apiRun.current.tenantId, apiRun.current.keyId).catch(() => undefined);
      deps.out("[smoke] temporary API key revoked");
    }
  }
}

async function runSmokeInner(args: SmokeArgs, deps: SmokeDeps, apiRun: { current: ApiRun | null }): Promise<SmokeResult> {
  const lines: CheckLine[] = [];
  const say = deps.out;
  const check = (verdict: Verdict, name: string, value: string) => {
    lines.push({ verdict, name, value });
    say(`${verdict.padEnd(4)}  ${name.padEnd(38)} ${value}`);
  };
  const finish = (jobId: string | null): SmokeResult => {
    const failed = lines.filter((l) => l.verdict === "FAIL").length;
    const passed = lines.filter((l) => l.verdict === "PASS").length;
    const skipped = lines.filter((l) => l.verdict === "SKIP").length;
    say("─".repeat(72));
    say(`${failed ? "SMOKE FAILED" : "SMOKE OK"} — ${passed} pass · ${failed} fail · ${skipped} skip${jobId ? ` · crawl ${jobId}` : ""}`);
    return { exitCode: failed ? 1 : 0, jobId, lines };
  };

  // ── 1. tenant, guards, config ────────────────────────────────────────────
  if (!args.tenant || !args.url) {
    say(USAGE);
    const tenants = await prisma.tenant.findMany({ where: { source: "customer" }, orderBy: { createdAt: "asc" }, take: 50, select: { slug: true, name: true, planType: true } });
    if (tenants.length) say(`tenants: ${tenants.map((t) => `${t.slug ?? "-"} (${t.planType})`).join(", ")}`);
    return { exitCode: 2, jobId: null, lines };
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug: args.tenant }, select: { id: true, name: true, slug: true, planType: true } });
  if (!tenant) {
    say(`no tenant with slug ${args.tenant}`);
    return { exitCode: 2, jobId: null, lines };
  }
  const plan = tenant.planType as PlanType;
  say(`[smoke] tenant ${tenant.slug} (${tenant.name}, ${plan}) · ${args.url} · web ${args.baseUrl}`);

  // The handler's guard chain: requirePaidPlan → zod → rate limit → startCrawl (lock, URL, config, quota).
  if (!(await hasPaidPlan(tenant.id))) {
    check("FAIL", "start", "tenant is not on an active paid plan (the handler answers 403)");
    return finish(null);
  }
  const parsed = StartCrawlBodySchema.safeParse(requestBody(args));
  if (!parsed.success) {
    check("FAIL", "start", `request body refused: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    return finish(null);
  }
  const body = parsed.data;

  const member = await prisma.tenantMember.findFirst({
    where: { tenantId: tenant.id, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  const secret = deps.env.AUTH_SECRET || deps.env.NEXTAUTH_SECRET || "";

  const quota = await getCrawlQuota(tenant.id, plan);
  const blPages = body.config?.addData?.backlinks?.pages ?? 0;
  const estimate = flag("crawl.backlinks") ? blPages * quota.backlinkUnitUsd : 0;
  say(
    `[smoke] plan caps: ${quota.urlCap} URLs · render ${quota.renderCap} · PSI ${quota.psiCap} · backlinks ${quota.backlinkCap} · ` +
      `crawls left ${quota.remaining ?? "unlimited"}`,
  );
  say(
    `[smoke] backlink estimate ${usd(estimate)} (${blPages} × ${usd(quota.backlinkUnitUsd)}, last metered unit) · ` +
      `SEO budget left ${usd(quota.seoBudgetLeftUsd)}`,
  );

  // --segment: segments are saved per host and snapshotted at creation, so the
  // pattern has to be a saved segment for the length of startCrawl.
  let segmentIndex: number | null = null;
  let tempSegmentId: string | null = null;
  const rootCheck = validateRootUrl(body.url);
  const host = rootCheck.ok && rootCheck.url ? new URL(rootCheck.url).hostname : null;
  if (args.segment && host && flag("crawl.segments")) {
    const cap = featureCapsForPlan(plan).segmentCap;
    const saved = await prisma.crawlSegment.findMany({ where: { tenantId: tenant.id, host }, orderBy: { position: "asc" }, select: { name: true, rule: true, position: true } });
    const usable = saved.slice(0, cap);
    const at = usable.findIndex((s) => {
      const r = s.rule as { kind?: string; pattern?: string } | null;
      return r?.kind === "urlPattern" && r.pattern?.trim() === args.segment!.trim();
    });
    if (at >= 0) segmentIndex = at;
    else {
      const def = SegmentDefSchema.safeParse({ name: `smoke ${args.segment}`.slice(0, 60), rule: { kind: "urlPattern", pattern: args.segment } });
      const problem = def.success ? segmentRuleProblem(def.data.rule) : "invalid";
      if (!def.success || problem) {
        check("FAIL", "start", `--segment ${args.segment}: ${problem}`);
        return finish(null);
      }
      if (usable.length >= cap) {
        check("FAIL", "start", `--segment: ${host} already has ${usable.length} of ${cap} saved segments and none is ${args.segment}`);
        return finish(null);
      }
      const position = saved.length ? Math.max(...saved.map((s) => s.position)) + 1 : 0;
      const row = await prisma.crawlSegment.create({ data: { tenantId: tenant.id, host, name: def.data.name, rule: def.data.rule, position }, select: { id: true } });
      tempSegmentId = row.id;
      segmentIndex = usable.length;
    }
  }

  const limited = args.via === "api" ? { success: true } : await rateLimit(startRateKey(tenant.id), START_RATE_LIMIT, START_RATE_WINDOW_MS);
  if (!limited.success) {
    if (tempSegmentId) await prisma.crawlSegment.delete({ where: { id: tempSegmentId } }).catch(() => undefined);
    check("FAIL", "start", "rate limited (3 starts a minute); wait a minute");
    return finish(null);
  }

  // Phase 4e: the Marketing Studio token meter before the run, for the AI check.
  const aiEstimate = flag("crawl.ai") ? aiTokenEstimate(body.config?.ai ?? null) : 0;
  const tokensBefore = aiEstimate ? await marketingTokensUsed(tenant.id) : 0;
  if (aiEstimate) say(`[smoke] AI estimate ${aiEstimate} tokens (${body.config!.ai!.top.pages} pages × ${body.config!.ai!.prompts.length} prompts × 2k) · meter ${tokensBefore}`);

  let jobId: string;
  const publicApi = `${args.baseUrl}/api/public/v1/crawl`;
  const idemKey = `crawl-smoke-${deps.now()}-${tenant.id}`;
  const bearer = () => ({ authorization: `Bearer ${apiRun.current!.key}` });
  try {
    if (args.via === "api") {
      const issued = await createApiKey(tenant.id, "crawl:smoke (temporary)", ["public"]);
      apiRun.current = { tenantId: tenant.id, keyId: issued.id, key: issued.key };
      say(`[smoke] temporary API key ${issued.prefix}… created (revoked at the end)`);
      const res = await deps.fetch(publicApi, {
        method: "POST",
        headers: { ...bearer(), "content-type": "application/json", "idempotency-key": idemKey },
        body: JSON.stringify(requestBody(args)),
      });
      const started = (await res.json().catch(() => null)) as { crawlId?: string; queuePosition?: number | null; error?: string } | null;
      if (res.status !== 202 || !started?.crawlId) {
        check("FAIL", "api start", `${res.status} ${started?.error ?? ""}`.trim());
        return finish(null);
      }
      check("PASS", "api start", `202 · crawl ${started.crawlId} · queue position ${started.queuePosition ?? "-"}`);
      jobId = started.crawlId;
      const again = await deps.fetch(publicApi, {
        method: "POST",
        headers: { ...bearer(), "content-type": "application/json", "idempotency-key": idemKey },
        body: JSON.stringify(requestBody(args)),
      });
      const replay = (await again.json().catch(() => null)) as { crawlId?: string } | null;
      check(again.status === 200 && replay?.crawlId === jobId ? "PASS" : "FAIL", "api idempotency", `replay ${again.status} · ${replay?.crawlId === jobId ? "same crawl" : `crawl ${replay?.crawlId ?? "none"}`}`);
    } else {
      const started = await startCrawl(tenant.id, plan, body.url, body.renderMode, {
        config: body.config,
        saveAsDefault: false,
        mode: body.mode,
        urls: body.urls,
      });
      jobId = started.id;
    }
  } catch (err) {
    const e = err as Error & { problems?: unknown };
    check("FAIL", "start", `${e.name}: ${e.message}${e.problems ? ` ${JSON.stringify(e.problems)}` : ""}`);
    return finish(null);
  } finally {
    if (tempSegmentId) await prisma.crawlSegment.delete({ where: { id: tempSegmentId } }).catch(() => undefined);
  }
  say(`[smoke] enqueued crawl ${jobId} on site-crawl; waiting up to ${args.timeoutMin} min`);

  // ── 2. wait ──────────────────────────────────────────────────────────────
  const deadline = deps.now() + args.timeoutMin * 60_000;
  const pollMs = deps.pollMs ?? 5_000;
  let job = (await prisma.crawlJob.findUnique({ where: { id: jobId }, select: JOB_SELECT })) as JobRow;
  let lastNote = "";
  let timedOut = false;
  for (;;) {
    const pending = job.status === "COMPLETED" ? pendingMetrics(job) : [];
    if (TERMINAL.has(job.status) && pending.length === 0) break;
    const note = pending.length ? `COMPLETED · waiting for ${pending.join(", ")}` : `${job.status} · ${job.pagesCrawled} pages`;
    if (note !== lastNote) say(`[smoke] ${note}`);
    lastNote = note;
    if (deps.now() >= deadline) {
      timedOut = true;
      break;
    }
    await deps.sleep(pollMs);
    job = (await prisma.crawlJob.findUnique({ where: { id: jobId }, select: JOB_SELECT })) as JobRow;
  }

  // ── 3. checks ────────────────────────────────────────────────────────────
  if (job.status !== "COMPLETED") {
    check("FAIL", "job completed", `${job.status}${job.stoppedReason ? ` (${job.stoppedReason})` : ""}${timedOut ? ` after the ${args.timeoutMin} min timeout` : ""}`);
    say("[smoke] the remaining checks need a completed crawl; not run");
    return finish(jobId);
  }
  check("PASS", "job completed", `COMPLETED${job.stoppedReason ? ` (${job.stoppedReason})` : ""}`);
  check(job.pagesCrawled > 0 ? "PASS" : "FAIL", "pages crawled > 0", String(job.pagesCrawled));
  const ran = job.startedAt && job.finishedAt ? job.finishedAt.getTime() - job.startedAt.getTime() : null;
  const queued = job.startedAt ? job.startedAt.getTime() - job.createdAt.getTime() : null;
  check(ran !== null ? "PASS" : "FAIL", "duration", ran !== null ? `${fmtDuration(ran)} crawling · ${fmtDuration(queued ?? 0)} queued` : "no startedAt/finishedAt");

  // --via api: the public read endpoints answer for the crawl, with the key that started it.
  if (args.via === "api" && apiRun.current) {
    const get = async (path: string) => {
      try {
        return await deps.fetch(`${publicApi}/${jobId}${path}`, { headers: bearer(), redirect: "manual" });
      } catch (err) {
        return `web not reachable at ${args.baseUrl}: ${(err as Error).message}`.slice(0, 160);
      }
    };
    const status = await get("");
    if (typeof status === "string") check("FAIL", "api status", status);
    else {
      const b = (await status.json().catch(() => null)) as { status?: string; progress?: { pagesCrawled?: number }; health?: number | null } | null;
      const ok = status.ok && b?.status === "completed" && b.progress?.pagesCrawled === job.pagesCrawled;
      check(ok ? "PASS" : "FAIL", "api status", `${status.status} · ${b?.status ?? "?"} · ${b?.progress?.pagesCrawled ?? "?"} pages · health ${b?.health ?? "-"}`);
    }
    const issues = await get("/issues?limit=5");
    if (typeof issues === "string") check("FAIL", "api issues", issues);
    else {
      const b = (await issues.json().catch(() => null)) as { issues?: unknown[]; nextCursor?: string | null } | null;
      check(issues.ok && Array.isArray(b?.issues) ? "PASS" : "FAIL", "api issues", `${issues.status} · ${b?.issues?.length ?? "?"} rows · next ${b?.nextCursor ? "yes" : "none"}`);
    }
    const pages = await get("/pages?limit=5");
    if (typeof pages === "string") check("FAIL", "api pages", pages);
    else {
      const b = (await pages.json().catch(() => null)) as { pages?: unknown[] } | null;
      check(pages.ok && Array.isArray(b?.pages) ? "PASS" : "FAIL", "api pages", `${pages.status} · ${b?.pages?.length ?? "?"} rows`);
    }
    const csv = await get("/export?view=issues");
    if (typeof csv === "string") check("FAIL", "api CSV issues", csv);
    else {
      const type = csv.headers.get("content-type") ?? "";
      const head = (await csv.text()).split(/\r?\n/)[0] ?? "";
      check(csv.ok && type.includes("text/csv") && head.includes("URL") ? "PASS" : "FAIL", "api CSV issues", `${csv.status} · ${type || "no type"} · ${head.slice(0, 60)}`);
    }
  }

  const config = readStoredConfig(job.config);
  const segments = config?.segments ?? [];

  // Header totals (crawl_jobs.summary.totals, what the header tiles read) vs a fresh groupBy (Overview).
  const grouped = await prisma.crawlIssue.groupBy({ by: ["severity"], where: { crawlJobId: jobId }, _count: { _all: true } });
  const live = toTotals(Object.fromEntries(grouped.map((g) => [g.severity, g._count._all])));
  const header = cachedTotals(job.summary);
  const fmtT = (t: { ERROR: number; WARNING: number; NOTICE: number }) => `${t.ERROR}/${t.WARNING}/${t.NOTICE}`;
  if (!header) check("FAIL", "header totals = Overview groupBy", `summary carries no totals; groupBy ${fmtT(live)}`);
  else {
    const same = header.ERROR === live.ERROR && header.WARNING === live.WARNING && header.NOTICE === live.NOTICE;
    check(same ? "PASS" : "FAIL", "header totals = Overview groupBy", `header ${fmtT(header)} · groupBy ${fmtT(live)} (E/W/N)`);
  }

  // Issues by family.
  const byRule = await prisma.crawlIssue.groupBy({ by: ["ruleId"], where: { crawlJobId: jobId }, _count: { _all: true } });
  const families = new Map<string, { rules: number; issues: number }>();
  for (const g of byRule) {
    const f = g.ruleId ? (familyOf(g.ruleId) ?? "unknown") : "legacy";
    const cur = families.get(f) ?? { rules: 0, issues: 0 };
    families.set(f, { rules: cur.rules + 1, issues: cur.issues + g._count._all });
  }
  const facts = await familyFacts(jobId, config, job.summary);
  const silent: string[] = [];
  const unjudged: string[] = [];
  for (const [fam, flagName] of Object.entries(GATED_FAMILIES) as [RuleFamily, FlagName][]) {
    if (!flag(flagName) || families.has(fam)) continue;
    if (facts[fam] === true) silent.push(fam);
    else if (facts[fam] === "unknown") unjudged.push(fam);
  }
  const seen = [...families.entries()].sort((a, b) => b[1].issues - a[1].issues).map(([f, c]) => `${f} ${c.rules}r/${c.issues}`).join(", ");
  check(
    silent.length ? "FAIL" : "PASS",
    "issues by family",
    `${families.size} families: ${seen || "none"}` +
      (silent.length ? ` · NO RULES despite facts: ${silent.join(", ")}` : "") +
      (unjudged.length ? ` · not judged (facts not stored): ${unjudged.join(", ")}` : ""),
  );

  // Render mode.
  if (!args.render) check("SKIP", "rendered pages", "no --render");
  else if (job.renderMode === "none") check("FAIL", "rendered pages", `asked for ${args.render}, crawl ran raw (plan render cap ${job.renderCap})`);
  else {
    const html = { crawlJobId: jobId, statusCode: { gte: 200, lt: 300 }, contentType: { contains: "html", mode: "insensitive" as const } };
    const candidates = await prisma.crawlPage.count({
      where: job.renderMode === "all" ? html : { ...html, OR: [{ wordCount: { lt: THIN_MAX_WORDS } }, { internalLinks: 0, externalOutlinks: 0 }] },
    });
    const expected = Math.min(job.renderCap, candidates);
    check(job.pagesRendered === expected ? "PASS" : "FAIL", "rendered pages = min(cap, candidates)", `${job.pagesRendered} rendered · cap ${job.renderCap} · ${candidates} ${job.renderMode} candidates`);
    const a11y = families.get("accessibility")?.issues ?? 0;
    const js = families.get("javascript")?.issues ?? 0;
    check(a11y > 0 && js > 0 ? "PASS" : "FAIL", "accessibility.* and javascript.*", `accessibility ${a11y} · javascript ${js}`);
  }

  // crawl_page_metrics by source.
  const coverage = await metricCoverage(jobId);
  const states = ((job.summary as { metrics?: Record<string, (SourceState & { status: string }) | undefined> } | null)?.metrics ?? {});
  const stateNote = (s: { status?: string; stoppedReason?: string; failed?: number } | undefined) =>
    s ? ` (${s.status}${s.stoppedReason ? `: ${s.stoppedReason}` : ""}${s.failed ? `, ${s.failed} failed` : ""})` : "";
  const add = config?.addData;
  if (!args.psi) check("SKIP", "metrics: psi", "no --psi");
  else if (!flag("crawl.psi")) check("SKIP", "metrics: psi", "crawl.psi is off");
  else if (!add?.psi) check("FAIL", "metrics: psi", "the opt-in did not reach the crawl's config");
  else {
    const expected = (await targetPages(jobId, add.psi, { htmlOnly: true })).length;
    check(coverage.psi === expected ? "PASS" : "FAIL", "metrics: psi = min(--psi, pages)", `${coverage.psi} of ${expected} (--psi ${args.psi})${stateNote(states.psi)}`);
  }
  if (!args.backlinks) check("SKIP", "metrics: backlinks", "no --backlinks");
  else if (!flag("crawl.backlinks")) check("SKIP", "metrics: backlinks", "crawl.backlinks is off");
  else if (!add?.backlinks) check("FAIL", "metrics: backlinks", "the opt-in did not reach the crawl's config");
  else {
    const expected = (await targetPages(jobId, add.backlinks, { htmlOnly: false })).length;
    const s = states.backlinks;
    if (coverage.backlinks === expected) check("PASS", "metrics: backlinks = --backlinks", `${coverage.backlinks} of ${expected} (--backlinks ${args.backlinks})${stateNote(s)}`);
    else if (s?.stoppedReason === "usd_cap") check("PASS", "metrics: backlinks", `stopped at the USD cap after ${coverage.backlinks} of ${expected}`);
    else check("FAIL", "metrics: backlinks = --backlinks", `${coverage.backlinks} of ${expected} (--backlinks ${args.backlinks})${stateNote(s)}`);
  }
  if (!flag("crawl.gsc")) check("SKIP", "metrics: gsc", "crawl.gsc is off");
  else {
    const conn = await prisma.gscConnection.findUnique({ where: { tenantId: tenant.id }, select: { status: true, siteUrl: true } });
    const covers = conn?.status === "ACTIVE" && !!conn.siteUrl && propertyCovers(conn.siteUrl, job.rootUrl);
    const joinStatus = (states.gsc as { status?: string } | undefined)?.status ?? "none";
    if (!covers) check("SKIP", "metrics: gsc", conn ? `connection ${conn.status}, property ${conn.siteUrl ?? "unset"} does not cover the host` : "no GSC connection");
    else check(coverage.gsc > 0 ? "PASS" : "FAIL", "metrics: gsc > 0", `${coverage.gsc} pages · join ${joinStatus}`);
  }
  if (!flag("crawl.ga4")) check("SKIP", "metrics: ga4", "crawl.ga4 is off");
  else {
    const conn = await prisma.gscConnection.findUnique({ where: { tenantId: tenant.id }, select: { ga4PropertyId: true } });
    if (!conn?.ga4PropertyId) check("SKIP", "metrics: ga4", "no GA4 property picked");
    else check(coverage.ga4 > 0 ? "PASS" : "FAIL", "metrics: ga4 > 0", `${coverage.ga4} pages`);
  }

  // SeoApiCall: no job id on the ledger, so the tenant's backlinks/summary calls since this crawl was created.
  const calls = await prisma.seoApiCall.findMany({
    where: { tenantId: tenant.id, path: BACKLINKS.summary, createdAt: { gte: job.createdAt } },
    select: { costUsd: true, ok: true },
  });
  const spent = calls.reduce((n, c) => n + Number(c.costUsd), 0);
  const ceiling = estimate * 1.5;
  check(
    spent <= ceiling + 1e-9 ? "PASS" : "FAIL",
    "SeoApiCall USD ≤ estimate × 1.5",
    `${calls.length} calls (${calls.filter((c) => !c.ok).length} failed) · ${usd(spent)} · estimate ${usd(estimate)} · ceiling ${usd(ceiling)}`,
  );

  // ── HTTP ─────────────────────────────────────────────────────────────────
  if (!member?.user || !secret) {
    const why = !secret ? "AUTH_SECRET is not set (run as echorank so .env loads)" : "tenant has no OWNER/ADMIN member to act as";
    for (const name of ["pages API metric groups", "CSV pages", "CSV issues", "structure graph", "compare", "PDF report"]) check("FAIL", name, why);
    return finish(jobId);
  }
  const cookie = await sessionCookie(secret, member.user, tenant.id);
  const origin = new URL(args.baseUrl).origin;
  const api = `${args.baseUrl}/api/seo/v1/crawl/${jobId}`;
  const http = async (path: string, init: { method?: string; body?: unknown } = {}): Promise<Response | string> => {
    try {
      return await deps.fetch(`${api}${path}`, {
        method: init.method ?? "GET",
        redirect: "manual",
        headers: {
          cookie,
          accept: "*/*",
          ...(init.method && init.method !== "GET" ? { origin, "content-type": "application/json" } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch (err) {
      return `web not reachable at ${args.baseUrl}: ${(err as Error).message}`.slice(0, 160);
    }
  };
  const json = async <T,>(path: string, name: string, init?: { method?: string; body?: unknown }): Promise<T | null> => {
    const res = await http(path, init);
    if (typeof res === "string") return check("FAIL", name, res), null;
    if (!res.ok) return check("FAIL", name, await describeFailure(res)), null;
    return (await res.json()) as T;
  };

  // Pages API: for every source with data, the source's first metric column sorted desc, NULLS LAST.
  type PagesPayload = { total: number; pages: { metrics?: Record<string, unknown> }[] };
  const sources = METRIC_SOURCES.filter((s) => coverage[s] > 0);
  const all = await json<PagesPayload>("/pages?pageSize=1", "pages API metric groups");
  if (all) {
    const missing: MetricSource[] = [];
    let failed = false;
    for (const s of sources) {
      const key = METRIC_COLUMNS.find((c) => c.source === s)!.key;
      const top = await json<PagesPayload>(`/pages?pageSize=1&sort=${encodeURIComponent(key)}&dir=desc`, "pages API metric groups");
      if (!top) {
        failed = true;
        break;
      }
      if (!top.pages[0]?.metrics?.[s]) missing.push(s);
    }
    if (!failed) {
      const present = sources.filter((s) => !missing.includes(s));
      check(
        missing.length ? "FAIL" : "PASS",
        "pages API metric groups",
        sources.length
          ? `${present.join(", ") || "none"} present${missing.length ? ` · MISSING ${missing.join(", ")}` : ""} · ${all.total} pages`
          : `no source has data · ${all.total} pages`,
      );
    }
  }

  // CSV exports: status, then the header row against the columns the route builds.
  const searchNames = (config?.searches ?? []).map((s) => s.name);
  const csvCheck = async (name: string, path: string, expected: string[]) => {
    const res = await http(path);
    if (typeof res === "string") return check("FAIL", name, res);
    if (res.status !== 200) return check("FAIL", name, await describeFailure(res));
    const got = csvHeaderCells(await firstLine(res));
    const same = got.length === expected.length && got.every((h, i) => h === expected[i]);
    check(same ? "PASS" : "FAIL", name, same ? `200 · ${got.length} columns` : `200 · header differs: got [${got.join(", ")}] want [${expected.join(", ")}]`);
  };
  const scored = flag("crawl.linkScore") && (await prisma.crawlPage.count({ where: { crawlJobId: jobId, linkScore: { not: null } }, take: 1 })) > 0;
  await csvCheck("CSV pages", "/pages?format=csv", withSegmentColumn([...pageColumns(searchNames), ...(scored ? [LINK_SCORE_COLUMN] : []), ...metricCsvColumns(sources)], segments, () => []).map((c) => c.header));
  await csvCheck("CSV issues", "/export?view=issues", withSegmentColumn(ISSUE_COLUMNS, segments, () => []).map((c) => c.header));

  // Extraction, search, segment.
  if (!args.extract.length) check("SKIP", "extraction values", "no --extract");
  else {
    const n = config?.extractors.length ?? 0;
    const rows = await prisma.crawlExtraction.groupBy({ by: ["extractorIndex"], where: { crawlJobId: jobId, kind: "extract", NOT: { values: { isEmpty: true } } }, _count: { _all: true } });
    const per = (config?.extractors ?? []).map((e, i) => `${e.name} ${rows.find((r) => r.extractorIndex === i)?._count._all ?? 0}`).join(" · ");
    check(rows.length > 0 ? "PASS" : "FAIL", "extraction values present", n ? `pages with a value: ${per}` : "no extractor reached the crawl's config");
  }
  // ── Phase 4e ─────────────────────────────────────────────────────────────
  const valuesOf = async (kind: "js" | "ai") => {
    const rows = await prisma.crawlExtraction.findMany({ where: { crawlJobId: jobId, kind }, select: { pageId: true, values: true } });
    const errors = rows.filter((r) => (r.values[0] ?? "").startsWith("error: ")).length;
    return { rows: rows.length, ok: rows.length - errors, errors, pages: new Set(rows.map((r) => r.pageId)).size };
  };
  if (!args.js) check("SKIP", "js snippet values", "no --js");
  else if (!flag("crawl.customJs")) check("SKIP", "js snippet values", "crawl.customJs is off");
  else if (!config?.js?.length) check("FAIL", "js snippet values present", "the snippet did not reach the crawl's config");
  else {
    const v = await valuesOf("js");
    check(v.ok > 0 ? "PASS" : "FAIL", "js snippet values present", `${args.js}: ${v.ok} values · ${v.errors} errors on ${v.pages} of ${job.pagesRendered} rendered pages`);
  }
  if (!args.ai.length) check("SKIP", "ai values", "no --ai");
  else if (!flag("crawl.ai")) check("SKIP", "ai values", "crawl.ai is off");
  else if (!config?.ai) check("FAIL", "ai values present", "the prompts did not reach the crawl's config");
  else {
    const v = await valuesOf("ai");
    const st = (job.summary as { metrics?: { ai?: SourceState } } | null)?.metrics?.ai;
    check(v.ok > 0 ? "PASS" : "FAIL", "ai values present", `${v.ok} answers · ${v.errors} errors on ${v.pages} pages${st?.stoppedReason ? ` · stopped: ${st.stoppedReason}` : ""}`);
    const moved = (await marketingTokensUsed(tenant.id)) - tokensBefore;
    const ok = moved > 0 && moved < aiEstimate * 1.5;
    check(ok ? "PASS" : "FAIL", "ai token meter < estimate × 1.5", `meter moved ${moved} · estimate ${aiEstimate} · limit ${Math.round(aiEstimate * 1.5)}`);
  }
  if (!args.login) check("SKIP", "authenticated pages", "no --login");
  else if (!flag("crawl.login")) check("SKIP", "authenticated pages", "crawl.login is off");
  else {
    const login = (job.summary as { login?: { status?: string; reason?: string } } | null)?.login;
    const saved = config?.login ?? null;
    const prefix = saved?.successCheck.kind === "urlPrefix" ? saved.successCheck.value : null;
    const behind = prefix ? await prisma.crawlPage.count({ where: { crawlJobId: jobId, statusCode: 200, url: { startsWith: prefix } } }) : job.pagesCrawled;
    if (login?.status !== "ok") check("FAIL", "authenticated pages crawled", `login ${login?.status ?? "not attempted"}${login?.reason ? ` (${login.reason})` : ""}`);
    else check(behind > 0 ? "PASS" : "FAIL", "authenticated pages crawled", prefix ? `logged in · ${behind} pages answered 200 under ${prefix}` : `logged in · ${behind} pages`);
  }
  // ── Phase 4g ─────────────────────────────────────────────────────────────
  if (!flag("crawl.externalLinks")) check("SKIP", "external links", "crawl.externalLinks is off");
  else {
    const rows = await prisma.crawlLink.count({ where: { crawlJobId: jobId, isExternal: true } });
    const checked = await prisma.crawlLink.count({ where: { crawlJobId: jobId, isExternal: true, status: { not: null } } });
    const ext = (job.summary as { external?: { urls?: number; capped?: boolean } } | null)?.external;
    check(rows > 0 ? "PASS" : "FAIL", "external rows present", `${rows} rows · ${ext?.urls ?? 0} distinct URLs · ${checked} rows with a status${ext?.capped ? " · resolve cap reached" : ""}`);
  }
  if (!flag("crawl.linkScore")) check("SKIP", "linkScore", "crawl.linkScore is off");
  else {
    const scoredPages = await prisma.crawlPage.count({ where: { crawlJobId: jobId, linkScore: { not: null } } });
    check(scoredPages === job.pagesCrawled ? "PASS" : "FAIL", "linkScore populated", `${scoredPages} of ${job.pagesCrawled} pages`);
  }
  if (!args.semantic) check("SKIP", "semantic rules", "no --semantic");
  else if (!flag("crawl.semantic")) check("SKIP", "semantic rules", "crawl.semantic is off");
  else {
    const st = (job.summary as { metrics?: { semantic?: SourceState & { embedded?: number } } } | null)?.metrics?.semantic;
    const n = await prisma.crawlIssue.count({ where: { crawlJobId: jobId, ruleId: { in: ["content.semantic_duplicate", "content.off_topic"] } } });
    const ok = st?.status === "done" && (st.embedded ?? 0) > 1;
    check(ok ? "PASS" : "FAIL", "semantic rules evaluated", `${st?.status ?? "not run"}${st?.stoppedReason ? ` (${st.stoppedReason})` : ""} · ${st?.embedded ?? 0} of ${st?.targets ?? 0} pages embedded · ${n} findings`);
  }
  if (!args.inspect) check("SKIP", "inspection rows", "no --inspect");
  else if (!flag("crawl.inspection")) check("SKIP", "inspection rows", "crawl.inspection is off");
  else {
    const rows = await prisma.crawlPageMetric.count({ where: { crawlJobId: jobId, source: "gsc_inspection" } });
    const st = (job.summary as { metrics?: { gsc_inspection?: SourceState } } | null)?.metrics?.gsc_inspection;
    const ok = rows > 0 && rows <= args.inspect;
    check(ok ? "PASS" : "FAIL", "inspection rows ≤ --inspect", `${rows} of ${args.inspect}${st?.stoppedReason ? ` · stopped: ${st.stoppedReason}` : ""}`);
  }
  if (!args.search) check("SKIP", "search counts", "no --search");
  else {
    const pages = await prisma.crawlPage.findMany({ where: { crawlJobId: jobId, searchHits: { not: Prisma.DbNull } }, select: { searchHits: true } });
    const counts = pages.map((p) => Number((p.searchHits as Record<string, unknown> | null)?.["0"] ?? 0));
    const matched = counts.filter((c) => c > 0).length;
    const total = counts.reduce((a, b) => a + b, 0);
    check(pages.length > 0 ? "PASS" : "FAIL", "search counts", `"${args.search}": ${total} matches on ${matched} pages · counted on ${pages.length} pages`);
  }
  if (!args.segment) check("SKIP", "segment totals", "no --segment");
  else if (!flag("crawl.segments")) check("SKIP", "segment totals", "crawl.segments is off");
  else if (segmentIndex === null || segmentIndex >= segments.length) check("FAIL", "segment totals", `segment ${args.segment} is not in the crawl's snapshot`);
  else {
    const seg = await json<PagesPayload>(`/pages?pageSize=1&segment=${segmentIndex}`, "segment totals");
    if (seg && all) {
      const ok = seg.total > 0 && seg.total < all.total;
      check(ok ? "PASS" : "FAIL", "segment totals narrower", `${args.segment}: ${seg.total} of ${all.total} pages${seg.total === 0 ? " (matched nothing)" : ""}`);
    }
  }

  // Structure graph.
  if (!flag("crawl.visualise")) check("SKIP", "structure graph", "crawl.visualise is off");
  else {
    const g = await json<{ nodes?: unknown[]; edges?: unknown[] }>("/graph?kind=links", "structure graph");
    if (g) {
      const ok = Array.isArray(g.nodes) && g.nodes.length > 0 && Array.isArray(g.edges);
      check(ok ? "PASS" : "FAIL", "structure graph nodes/edges", `${g.nodes?.length ?? "no"} nodes · ${g.edges?.length ?? "no"} edges`);
    }
  }

  // Compare against the previous completed crawl of the same host.
  if (!flag("crawl.compare")) check("SKIP", "compare", "crawl.compare is off");
  else {
    const earlier = await prisma.crawlJob.findMany({
      where: { tenantId: tenant.id, status: "COMPLETED", dataPurgedAt: null, id: { not: jobId }, createdAt: { lt: job.createdAt } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, rootUrl: true },
    });
    const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } };
    const baseline = earlier.find((c) => hostOf(c.rootUrl) === hostOf(job.rootUrl));
    if (!baseline) check("SKIP", "compare", `no earlier completed crawl of ${hostOf(job.rootUrl)}`);
    else {
      const row = await json<{ result?: { counts?: Record<string, unknown> } }>("/compare", "compare", { method: "POST", body: { baselineId: baseline.id } });
      if (row) {
        const counts = row.result?.counts ?? {};
        const ok = COMPARE_BUCKETS.every((b) => isNum(counts[b]));
        check(ok ? "PASS" : "FAIL", "compare buckets", `vs ${baseline.id}: ${COMPARE_BUCKETS.map((b) => `${b} ${counts[b] ?? "missing"}`).join(" · ")}`);
      }
    }
  }

  // PDF report.
  if (!flag("crawl.reports")) check("SKIP", "PDF report", "crawl.reports is off");
  else {
    const res = await http("/report", { method: "POST", body: {} });
    if (typeof res === "string") check("FAIL", "PDF report", res);
    else if (!res.ok) check("FAIL", "PDF report", await describeFailure(res));
    else {
      const type = res.headers.get("content-type") ?? "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 5));
      const ok = type.startsWith("application/pdf") && magic === "%PDF-";
      check(ok ? "PASS" : "FAIL", "PDF report application/pdf", `${res.status} · ${type || "no content-type"} · ${bytes.length} bytes${magic === "%PDF-" ? "" : " · not a PDF body"}`);
    }
  }

  return finish(jobId);
}
