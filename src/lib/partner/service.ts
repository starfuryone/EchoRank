// src/lib/partner/service.ts
//
// The partner API's work: one AI-visibility audit, a benchmark of several, and
// the answer check. Every engine call goes through the code the dashboard
// already uses — the sidecar's /audit (as /api/ai/visibility/audit does) and
// its /track (as the tracked-prompt worker does). Nothing here re-implements
// either.
import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { costUsdFor, roundUsd } from "@/lib/ai-monitor/pricing";
import type { PartnerContext } from "./auth";
import { PARTNER_BENCHMARK_MAX_COMPETITORS, PARTNER_QUERY_ENGINES, type PartnerKind } from "./limits";
import { PartnerQuotaUnavailableError, releasePartnerCall, reservePartnerCall } from "./quota";
import { benchmarkSummary, domainRoot, toPartnerAudit, type PartnerAudit, type PartnerAuditMode } from "./shape";

/** A route's answer: status + JSON body (+ headers for 429/503). */
export interface PartnerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const AUDIT_TIMEOUT_MS: Record<PartnerAuditMode, number> = { quick: 60_000, full: 120_000 };
const TRACK_TIMEOUT_MS = 90_000;

/** answer_track.py MAX_TOKENS: the ceiling every answer is billed against. */
const TRACK_MAX_OUTPUT_TOKENS = 700;
/** answer_track.py SYSTEM, ~200 characters. */
const TRACK_SYSTEM_CHARS = 200;

interface SidecarAuditResult {
  url?: string;
  score?: number;
  grade?: string;
  checks?: unknown[];
  robots?: { bots?: Record<string, unknown> };
  error?: string;
}

interface TrackResult {
  id: string;
  brand_mentioned: boolean;
  excerpt: string;
  error: string | null;
  model: string;
}
interface TrackResponse {
  engine?: string;
  model?: string;
  results?: TrackResult[];
  error?: string;
  detail?: string;
}

function quotaRefused(retryAfter: number, kind: PartnerKind): PartnerResult {
  return {
    status: 429,
    body: { error: "rate_limited", scope: `month_${kind}`, retryAfter },
    headers: { "Retry-After": String(retryAfter) },
  };
}

const UNAVAILABLE: PartnerResult = { status: 503, body: { error: "quota_unavailable" }, headers: { "Retry-After": "30" } };

/** Reserve one call of `kind`, or the refusal to return. */
async function reserve(ctx: PartnerContext, kind: PartnerKind): Promise<PartnerResult | null> {
  try {
    const d = await reservePartnerCall(ctx.keyId, ctx.subject, kind);
    return d.allowed ? null : quotaRefused(d.retryAfter ?? 3600, kind);
  } catch (err) {
    if (err instanceof PartnerQuotaUnavailableError) return UNAVAILABLE;
    throw err;
  }
}

async function ledger(
  ctx: PartnerContext,
  kind: PartnerKind,
  data: { auditId?: string; costUsd?: number; ok?: boolean; error?: string },
): Promise<void> {
  try {
    await prisma.partnerCall.create({
      data: {
        apiKeyId: ctx.keyId,
        subject: ctx.subject,
        kind,
        auditId: data.auditId ?? null,
        costUsd: data.costUsd ?? 0,
        ok: data.ok ?? true,
        error: data.error?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[partner] ledger write failed", err);
  }
}

/** URL check before anything leaves the box — the SSRF guard the bot-access probe uses. */
export function checkPartnerUrl(raw: unknown): { ok: true; url: string } | { ok: false; reason: string } {
  if (typeof raw !== "string" || raw.length > 300) return { ok: false, reason: "not_a_url" };
  const g = guardCheckUrl(raw);
  return g.ok && g.url ? { ok: true, url: g.url } : { ok: false, reason: g.reason ?? "not_a_url" };
}

type AuditOutcome = { ok: true; audit: PartnerAudit } | { ok: false; status: number; error: string; detail?: string };

/** Sidecar /audit → stored VisibilityAudit (partner tenant, monitorId null) → wire shape. No quota, no ledger. */
async function auditOne(ctx: PartnerContext, url: string, mode: PartnerAuditMode): Promise<AuditOutcome> {
  const { status, data } = await sidecarPost<SidecarAuditResult>(
    "/audit",
    { url, crawl: mode === "full" },
    { timeoutMs: AUDIT_TIMEOUT_MS[mode] },
  );
  if (status !== 200 || typeof data.score !== "number" || data.error) {
    const msg = data.error ?? `sidecar ${status}`;
    // The sidecar answers 502 "Couldn't fetch <url> (...)" when the SITE is down — the
    // caller's input, not our outage.
    if (/^Couldn't fetch/.test(msg)) return { ok: false, status: 422, error: "site_unreachable", detail: msg };
    if (status === 400) return { ok: false, status: 400, error: "invalid_url", detail: msg };
    return { ok: false, status: 502, error: "upstream_error", detail: msg };
  }
  const row = await prisma.visibilityAudit.create({
    data: {
      tenantId: ctx.tenantId,
      monitorId: null,
      url: data.url ?? url,
      score: data.score,
      grade: data.grade ?? "?",
      checks: (data.checks ?? []) as unknown as Prisma.InputJsonValue,
      bots: (data.robots?.bots ?? {}) as unknown as Prisma.InputJsonValue,
      raw: data as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, url: true, score: true, grade: true, raw: true, createdAt: true },
  });
  return { ok: true, audit: toPartnerAudit(row, mode) };
}

export async function partnerAudit(ctx: PartnerContext, body: Record<string, unknown>): Promise<PartnerResult> {
  const mode = body.mode === "full" ? "full" : body.mode === "quick" || body.mode === undefined ? "quick" : null;
  if (!mode) return { status: 400, body: { error: "invalid_mode", allowed: ["quick", "full"] } };
  const checked = checkPartnerUrl(body.url);
  if (!checked.ok) return { status: 400, body: { error: "invalid_url", reason: checked.reason } };

  const kind: PartnerKind = mode === "full" ? "audit_full" : "audit_quick";
  const refused = await reserve(ctx, kind);
  if (refused) return refused;

  const out = await auditOne(ctx, checked.url, mode);
  if (!out.ok) {
    await releasePartnerCall(ctx.keyId, ctx.subject, kind);
    await ledger(ctx, kind, { ok: false, error: out.detail ?? out.error });
    return { status: out.status, body: { error: out.error, detail: out.detail } };
  }
  // The sidecar audit fetches pages; it calls no paid API, so its cost is 0 (logged, per CLAUDE.md).
  await ledger(ctx, kind, { auditId: out.audit.id, costUsd: 0 });
  return { status: 200, body: out.audit };
}

export async function partnerAuditById(ctx: PartnerContext, id: string): Promise<PartnerResult> {
  const call = await prisma.partnerCall.findFirst({
    where: { apiKeyId: ctx.keyId, auditId: id },
    select: { kind: true },
  });
  if (!call) return { status: 404, body: { error: "not_found" } };
  const row = await prisma.visibilityAudit.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, url: true, score: true, grade: true, raw: true, createdAt: true },
  });
  if (!row) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: toPartnerAudit(row, call.kind === "audit_full" ? "full" : "quick") };
}

export async function partnerBenchmark(ctx: PartnerContext, body: Record<string, unknown>): Promise<PartnerResult> {
  if (body.mode !== undefined && body.mode !== "quick") {
    return { status: 400, body: { error: "invalid_mode", allowed: ["quick"] } };
  }
  const comps = body.competitors;
  if (!Array.isArray(comps) || comps.length === 0 || comps.length > PARTNER_BENCHMARK_MAX_COMPETITORS) {
    return { status: 400, body: { error: "invalid_competitors", max: PARTNER_BENCHMARK_MAX_COMPETITORS } };
  }
  const you = checkPartnerUrl(body.you);
  if (!you.ok) return { status: 400, body: { error: "invalid_url", field: "you", reason: you.reason } };
  const urls: string[] = [];
  for (const [i, c] of comps.entries()) {
    const g = checkPartnerUrl(c);
    if (!g.ok) return { status: 400, body: { error: "invalid_url", field: `competitors[${i}]`, reason: g.reason } };
    urls.push(g.url);
  }

  const refused = await reserve(ctx, "benchmark");
  if (refused) return refused;

  const outcomes = await Promise.all([you.url, ...urls].map((u) => auditOne(ctx, u, "quick")));
  if (outcomes.every((o) => !o.ok)) {
    await releasePartnerCall(ctx.keyId, ctx.subject, "benchmark");
    await ledger(ctx, "benchmark", { ok: false, error: "every audit failed" });
    return { status: 502, body: { error: "upstream_error" } };
  }
  const entries = await Promise.all(
    outcomes.map(async (o, i) => {
      const url = i === 0 ? you.url : urls[i - 1];
      if (!o.ok) return { url, error: o.error };
      await ledger(ctx, "benchmark", { auditId: o.audit.id, costUsd: 0 });
      return { ...benchmarkSummary(o.audit), audit: o.audit };
    }),
  );
  return {
    status: 200,
    body: { mode: "quick", you: entries[0], competitors: entries.slice(1), createdAt: new Date().toISOString() },
  };
}

/** Ceiling estimate: /track reports no token usage, so each answer is billed at its max_tokens. */
export function trackCostCeiling(model: string, promptChars: number): number {
  const inputTokens = Math.ceil((TRACK_SYSTEM_CHARS + promptChars) / 4);
  return costUsdFor("CLAUDE", model, { inputTokens, outputTokens: TRACK_MAX_OUTPUT_TOKENS, cachedInputTokens: 0 }).costUsd;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

export async function partnerQuery(ctx: PartnerContext, body: Record<string, unknown>): Promise<PartnerResult> {
  const question = str(body.question, 500);
  const business = str(body.business, 120);
  if (!question || question.length < 3) return { status: 400, body: { error: "invalid_question" } };
  if (!business) return { status: 400, body: { error: "invalid_business" } };
  let website: string | null = null;
  if (body.website !== undefined && body.website !== null && body.website !== "") {
    const g = checkPartnerUrl(body.website);
    if (!g.ok) return { status: 400, body: { error: "invalid_url", field: "website", reason: g.reason } };
    website = g.url;
  }
  const requested = Array.isArray(body.engines)
    ? body.engines.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase())
    : null;
  const engines = requested ? PARTNER_QUERY_ENGINES.filter((e) => requested.includes(e)) : [...PARTNER_QUERY_ENGINES];
  const unsupported = requested ? requested.filter((e) => !PARTNER_QUERY_ENGINES.includes(e)) : [];
  if (engines.length === 0) {
    return { status: 400, body: { error: "no_supported_engine", supported: PARTNER_QUERY_ENGINES } };
  }

  // Brand terms the way the tracked-prompt worker builds them: the name plus the domain root.
  const terms = new Set<string>();
  if (business.length >= 3) terms.add(business);
  const root = website ? domainRoot(website) : null;
  if (root) terms.add(root);
  if (terms.size === 0) terms.add(business);

  const host = website ? new URL(website).hostname.replace(/^www\./, "") : null;
  const describe = `In two or three sentences, what is ${business}${host ? ` (${host})` : ""} and what does it offer?`;

  const refused = await reserve(ctx, "query");
  if (refused) return refused;

  const { status, data } = await sidecarPost<TrackResponse>(
    "/track",
    {
      prompts: [
        { id: "question", text: question },
        { id: "description", text: describe },
      ],
      brand_terms: Array.from(terms),
      competitors: [],
    },
    { timeoutMs: TRACK_TIMEOUT_MS },
  );
  const results = Array.isArray(data.results) ? data.results : null;
  const q = results?.find((r) => r.id === "question");
  if (status !== 200 || !q || (q.error && !q.excerpt)) {
    const msg = q?.error ?? data.error ?? data.detail ?? `sidecar ${status}`;
    await releasePartnerCall(ctx.keyId, ctx.subject, "query");
    await ledger(ctx, "query", { ok: false, error: msg });
    return { status: 502, body: { error: "upstream_error" } };
  }
  const d = results?.find((r) => r.id === "description");
  const model = q.model ?? data.model ?? "unknown";
  const costUsd = roundUsd(
    (results ?? [])
      .filter((r) => !r.error)
      .reduce((sum, r) => sum + trackCostCeiling(r.model ?? model, r.id === "question" ? question.length : describe.length), 0),
  );
  await ledger(ctx, "query", { costUsd });

  const engine = data.engine ?? "claude";
  return {
    status: 200,
    body: {
      mentioned: !!q.brand_mentioned,
      answer_excerpt: q.excerpt || null,
      engines: [{ engine, model, mentioned: !!q.brand_mentioned, answer_excerpt: q.excerpt || null }],
      description: d && !d.error ? d.excerpt || null : null,
      costUsd,
      ...(unsupported.length ? { unsupportedEngines: unsupported } : {}),
    },
  };
}
