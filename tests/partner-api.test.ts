// Partner API (/api/partner/v1/*) — the surface a sibling product (EchoPilot)
// calls with a long-lived key. Tested through the real route handlers, with
// Prisma, Redis and the av-visibility sidecar stubbed:
//
//   1. AUTH       — missing / unknown / revoked key → 401, wrong scope → 403
//                   (both directions: partner key on /public, public key on
//                   /partner), subject header required.
//   2. LIMITS     — the per-key monthly allowance and the per-subject hourly
//                   limit answer 429 with Retry-After; a failed upstream call
//                   gives its reservation back.
//   3. SHAPE      — the audit wire shape, quick vs full → crawl flag, SSRF guard.
//   4. ISOLATION  — GET /audit/:id serves only audits this key created.
//   5. QUERY      — the /track answer check, costUsd logged, and the
//                   /api/v1/visibility/query alias answering identically.
//   6. FREE AUDIT — /api/av/audit's per-IP limit survives a module reload
//                   (it lives in Redis now, not in a Map).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

// ─── Fakes ───────────────────────────────────────────────────────────────────

const store = new Map<string, number>();
const redis = {
  incr: vi.fn(async (k: string) => {
    const n = (store.get(k) ?? 0) + 1;
    store.set(k, n);
    return n;
  }),
  decr: vi.fn(async (k: string) => {
    const n = (store.get(k) ?? 0) - 1;
    store.set(k, n);
    return n;
  }),
  get: vi.fn(async (k: string) => (store.has(k) ? String(store.get(k)) : null)),
  expire: vi.fn(async () => 1),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

type KeyRow = { id: string; tenantId: string; keyHash: string; revokedAt: Date | null; scopes: string[] };
const keys: KeyRow[] = [];
type AuditRow = { id: string; tenantId: string; url: string; score: number; grade: string; raw: unknown; createdAt: Date };
const audits: AuditRow[] = [];
type CallRow = { apiKeyId: string; subject: string; kind: string; auditId: string | null; costUsd: number; ok: boolean };
const calls: CallRow[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => keys.find((k) => k.keyHash === where.keyHash) ?? null),
      update: vi.fn(async () => ({})),
    },
    visibilityAudit: {
      create: vi.fn(async ({ data }: { data: Omit<AuditRow, "id" | "createdAt"> }) => {
        const row = { ...data, id: `aud_${audits.length + 1}`, createdAt: new Date("2026-10-06T07:00:00Z") };
        audits.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        audits.find((a) => a.id === where.id && a.tenantId === where.tenantId) ?? null),
    },
    partnerCall: {
      create: vi.fn(async ({ data }: { data: CallRow }) => {
        calls.push({ ...data, costUsd: Number(data.costUsd) });
        return data;
      }),
      findFirst: vi.fn(async ({ where }: { where: { apiKeyId: string; auditId: string } }) =>
        calls.find((c) => c.apiKeyId === where.apiKeyId && c.auditId === where.auditId) ?? null),
    },
  },
}));

vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: vi.fn(async () => true) }));

const sidecarPost = vi.fn();
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost: (...a: unknown[]) => sidecarPost(...a) }));

// ─── Keys ────────────────────────────────────────────────────────────────────

function makeKey(id: string, tenantId: string, scopes: string[], revoked = false): string {
  const idPart = createHash("md5").update(id).digest("hex").slice(0, 24);
  const secret = createHash("sha1").update(id).digest("hex").slice(0, 48);
  keys.push({
    id,
    tenantId,
    keyHash: createHash("sha256").update(secret).digest("hex"),
    revokedAt: revoked ? new Date() : null,
    scopes,
  });
  return `er_api_${idPart}.${secret}`;
}

let PARTNER = "";
let PARTNER_B = "";
let PUBLIC = "";
let REVOKED = "";

function req(path: string, opts: { key?: string; subject?: string | null; body?: unknown; method?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.key) headers.authorization = `Bearer ${opts.key}`;
  if (opts.subject !== null) headers["x-partner-subject"] = opts.subject ?? "tenant_123";
  return new Request(`http://127.0.0.1:4400${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

const SIDECAR_AUDIT = {
  url: "https://example.com/",
  score: 72,
  grade: "B",
  checks: [
    { category: "robots.txt AI access", points: 20, max: 25, status: "1/8 AI crawlers blocked", recommendation: "Unblock AI crawlers in robots.txt: CCBot." },
    { category: "Server-rendered content", points: 20, max: 20, status: "Server-rendered", recommendation: "" },
    { category: "XML sitemap", points: 0, max: 10, status: "No sitemap found", recommendation: "Publish /sitemap.xml" },
  ],
  robots: {
    present: true,
    sitemaps: [],
    bots: {
      Bytespider: { status: "BLOCKED", detail: "Disallow: /" },
      CCBot: { status: "BLOCKED", detail: "Disallow: / (matched 'CCBot')" },
      GPTBot: { status: "ALLOWED", detail: "no matching rule (default allow)" },
    },
  },
  rendering: { likely_csr: false, text_len: 2400, framework: "Next.js" },
  pages_found: {},
};

beforeEach(() => {
  store.clear();
  keys.length = 0;
  audits.length = 0;
  calls.length = 0;
  sidecarPost.mockReset();
  PARTNER = makeKey("key_partner", "t_partner", ["partner"]);
  PARTNER_B = makeKey("key_partner_b", "t_partner", ["partner"]);
  PUBLIC = makeKey("key_public", "t_customer", ["public"]);
  REVOKED = makeKey("key_revoked", "t_partner", ["partner"], true);
});

// ─── 1. Auth ─────────────────────────────────────────────────────────────────

describe("partner auth", () => {
  it("401 without a key, with an unknown key, with a revoked key", async () => {
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    expect((await POST(req("/api/partner/v1/audit", { body: { url: "example.com" } }))).status).toBe(401);
    expect((await POST(req("/api/partner/v1/audit", { key: "er_api_ab.cd", body: { url: "example.com" } }))).status).toBe(401);
    expect((await POST(req("/api/partner/v1/audit", { key: REVOKED, body: { url: "example.com" } }))).status).toBe(401);
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("403 for a public-scope key on a partner route", async () => {
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req("/api/partner/v1/audit", { key: PUBLIC, body: { url: "example.com" } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "wrong_scope" });
  });

  it("403 for a partner key on a public route", async () => {
    const { authenticatePublicRequest } = await import("@/lib/api-keys");
    const r = await authenticatePublicRequest(req("/api/public/v1/audit/latest", { key: PARTNER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("400 without x-partner-subject, and for an email as subject", async () => {
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const missing = await POST(req("/api/partner/v1/audit", { key: PARTNER, subject: null, body: { url: "example.com" } }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "missing_partner_subject" });
    const email = await POST(req("/api/partner/v1/audit", { key: PARTNER, subject: "owner@example.com", body: { url: "example.com" } }));
    expect(email.status).toBe(400);
    expect(sidecarPost).not.toHaveBeenCalled();
  });
});

// ─── 2. Limits ───────────────────────────────────────────────────────────────

describe("partner limits", () => {
  it("429 + Retry-After when the key's monthly allowance is spent; nothing reaches the sidecar", async () => {
    const { keyQuotaKey } = await import("@/lib/partner/quota");
    const { PARTNER_MONTHLY_LIMITS } = await import("@/lib/partner/limits");
    store.set(keyQuotaKey("key_partner", "audit_full"), PARTNER_MONTHLY_LIMITS.audit_full);
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "full" } }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await res.json()).scope).toBe("month_audit_full");
    expect(sidecarPost).not.toHaveBeenCalled();
    // quick has its own allowance
    sidecarPost.mockResolvedValue({ status: 200, data: SIDECAR_AUDIT });
    expect((await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "quick" } }))).status).toBe(200);
  });

  it("the 61st request from one subject in an hour is a 429; another subject is unaffected", async () => {
    const { subjectHourKey } = await import("@/lib/partner/quota");
    store.set(subjectHourKey("key_partner", "tenant_123"), 60);
    const { GET } = await import("@/app/api/partner/v1/audit/[id]/route");
    const ctx = { params: Promise.resolve({ id: "aud_1" }) };
    const res = await GET(req("/api/partner/v1/audit/aud_1", { key: PARTNER }), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await GET(req("/api/partner/v1/audit/aud_1", { key: PARTNER, subject: "tenant_456" }), ctx)).status).toBe(404);
  });

  it("a failed sidecar call gives the reservation back and is logged as not ok", async () => {
    const { keyQuotaKey } = await import("@/lib/partner/quota");
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "AI Visibility service is unavailable." } });
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com" } }));
    expect(res.status).toBe(502);
    expect(store.get(keyQuotaKey("key_partner", "audit_quick"))).toBe(0);
    expect(calls).toEqual([expect.objectContaining({ kind: "audit_quick", ok: false })]);
  });

  it("an unreachable site is the caller's 422, not our 502", async () => {
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "Couldn't fetch https://nope.example/ (could not connect)." } });
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "nope.example.org" } }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("site_unreachable");
  });
});

// ─── 3. Shape ────────────────────────────────────────────────────────────────

describe("partner audit shape", () => {
  it("returns the stored audit in the wire shape; quick → crawl:false, full → crawl:true", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: SIDECAR_AUDIT });
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "quick" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(sidecarPost).toHaveBeenLastCalledWith("/audit", { url: "https://example.com/", crawl: false }, expect.anything());
    expect(body).toMatchObject({
      id: "aud_1",
      url: "https://example.com/",
      mode: "quick",
      score: 72,
      grade: "B",
      robotsTxt: true,
      rendering: { likelyCsr: false, textLength: 2400, framework: "Next.js" },
      createdAt: "2026-10-06T07:00:00.000Z",
    });
    // scored engines first, vendor attached
    expect(body.crawlers.map((c: { engine: string }) => c.engine)).toEqual(["GPTBot", "CCBot", "Bytespider"]);
    expect(body.crawlers[0]).toEqual({ engine: "GPTBot", vendor: "OpenAI", status: "ALLOWED", scored: true, detail: "no matching rule (default allow)" });
    expect(body.checks[0]).toEqual({
      key: "robots",
      label: "robots.txt AI access",
      score: 20,
      max: 25,
      detail: "1/8 AI crawlers blocked",
      recommendation: "Unblock AI crawlers in robots.txt: CCBot.",
    });
    expect(body.checks.map((c: { key: string }) => c.key)).toEqual(["robots", "rendering", "sitemap"]);
    // stored under the partner tenant, ledgered with the subject, cost 0
    expect(audits[0].tenantId).toBe("t_partner");
    expect(calls[0]).toMatchObject({ apiKeyId: "key_partner", subject: "tenant_123", kind: "audit_quick", auditId: "aud_1", costUsd: 0, ok: true });

    await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "full" } }));
    expect(sidecarPost).toHaveBeenLastCalledWith("/audit", { url: "https://example.com/", crawl: true }, expect.anything());
  });

  it("refuses private and malformed URLs before the sidecar (SSRF guard)", async () => {
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    for (const url of ["http://127.0.0.1:4500/health", "http://169.254.169.254/", "localhost", "file:///etc/passwd", "https://a.internal/"]) {
      const res = await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url } }));
      expect(res.status, url).toBe(400);
    }
    expect((await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "deep" } }))).status).toBe(400);
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("benchmark: ≤5 competitors, dashboard summary + audit per entry, failures inline", async () => {
    const { POST } = await import("@/app/api/partner/v1/benchmark/route");
    const six = ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"];
    expect((await POST(req("/api/partner/v1/benchmark", { key: PARTNER, body: { you: "example.com", competitors: six } }))).status).toBe(400);

    sidecarPost.mockImplementation(async (_p: string, b: { url: string }) =>
      b.url.includes("down") ? { status: 502, data: { error: `Couldn't fetch ${b.url} (could not connect).` } } : { status: 200, data: { ...SIDECAR_AUDIT, url: b.url } },
    );
    const res = await POST(req("/api/partner/v1/benchmark", { key: PARTNER, body: { you: "example.com", competitors: ["rival.com", "down.com"], mode: "quick" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.you).toMatchObject({ url: "https://example.com/", score: 72, grade: "B", blocked: 2, botTotal: 3 });
    expect(body.you.audit.mode).toBe("quick");
    expect(body.competitors[0]).toMatchObject({ url: "https://rival.com/", score: 72 });
    expect(body.competitors[1]).toEqual({ url: "https://down.com/", error: "site_unreachable" });
    expect(sidecarPost.mock.calls.every((c) => c[1].crawl === false)).toBe(true);
  });
});

// ─── 4. Isolation ────────────────────────────────────────────────────────────

describe("GET /api/partner/v1/audit/:id", () => {
  it("serves the creating key's audit and 404s for any other key", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: SIDECAR_AUDIT });
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const created = await (await POST(req("/api/partner/v1/audit", { key: PARTNER, body: { url: "example.com", mode: "full" } }))).json();

    const { GET } = await import("@/app/api/partner/v1/audit/[id]/route");
    const ctx = { params: Promise.resolve({ id: created.id }) };
    const mine = await GET(req(`/api/partner/v1/audit/${created.id}`, { key: PARTNER }), ctx);
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual(created);

    // same partner tenant, different key: still not yours
    const other = await GET(req(`/api/partner/v1/audit/${created.id}`, { key: PARTNER_B }), ctx);
    expect(other.status).toBe(404);
  });
});

// ─── 5. Query + alias ────────────────────────────────────────────────────────

describe("visibility query", () => {
  const TRACK = {
    status: 200,
    data: {
      engine: "claude",
      model: "claude-haiku-4-5",
      results: [
        { id: "question", prompt: "q", brand_mentioned: true, brand_rank: 1, competitors: [], excerpt: "Try Acme Plumbing in Laval.", error: null, model: "claude-haiku-4-5" },
        { id: "description", prompt: "d", brand_mentioned: true, brand_rank: 1, competitors: [], excerpt: "Acme Plumbing is a plumber in Laval.", error: null, model: "claude-haiku-4-5" },
      ],
    },
  };
  const BODY = { question: "best plumber in Laval", business: "Acme Plumbing", website: "https://www.acmeplumbing.ca" };

  it("runs the question + a description prompt through /track with the worker's brand terms; logs costUsd", async () => {
    sidecarPost.mockResolvedValue(TRACK);
    const { POST } = await import("@/app/api/partner/v1/visibility/query/route");
    const res = await POST(req("/api/partner/v1/visibility/query", { key: PARTNER, body: BODY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const [path, payload] = sidecarPost.mock.calls[0];
    expect(path).toBe("/track");
    expect(payload.brand_terms).toEqual(["Acme Plumbing", "acmeplumbing"]);
    expect(payload.prompts.map((p: { id: string }) => p.id)).toEqual(["question", "description"]);
    expect(body).toMatchObject({
      mentioned: true,
      answer_excerpt: "Try Acme Plumbing in Laval.",
      engines: [{ engine: "claude", model: "claude-haiku-4-5", mentioned: true, answer_excerpt: "Try Acme Plumbing in Laval." }],
      description: "Acme Plumbing is a plumber in Laval.",
    });
    expect(body.costUsd).toBeGreaterThan(0);
    expect(body.costUsd).toBeLessThan(0.01);
    expect(calls[0]).toMatchObject({ kind: "query", subject: "tenant_123", costUsd: body.costUsd });
  });

  it("the /api/v1/visibility/query alias answers identically and enforces the same auth", async () => {
    sidecarPost.mockResolvedValue(TRACK);
    const main = await import("@/app/api/partner/v1/visibility/query/route");
    const alias = await import("@/app/api/v1/visibility/query/route");
    const a = await (await main.POST(req("/api/partner/v1/visibility/query", { key: PARTNER, body: BODY }))).json();
    const b = await (await alias.POST(req("/api/v1/visibility/query", { key: PARTNER, body: BODY }))).json();
    expect(b).toEqual(a);
    expect((await alias.POST(req("/api/v1/visibility/query", { key: PUBLIC, body: BODY }))).status).toBe(403);
    expect((await alias.POST(req("/api/v1/visibility/query", { body: BODY }))).status).toBe(401);
  });

  it("unsupported engines are reported, never silently answered; none supported → 400", async () => {
    sidecarPost.mockResolvedValue(TRACK);
    const { POST } = await import("@/app/api/partner/v1/visibility/query/route");
    const mixed = await (await POST(req("/api/partner/v1/visibility/query", { key: PARTNER, body: { ...BODY, engines: ["claude", "gemini"] } }))).json();
    expect(mixed.unsupportedEngines).toEqual(["gemini"]);
    const none = await POST(req("/api/partner/v1/visibility/query", { key: PARTNER, body: { ...BODY, engines: ["gemini"] } }));
    expect(none.status).toBe(400);
  });
});

// ─── 6. Free audit limit ─────────────────────────────────────────────────────

describe("/api/av/audit per-IP limit", () => {
  it("one success per IP per day, and it survives a module reload", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ score: 50 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const call = async () => {
      const { POST } = await import("@/app/api/av/audit/route");
      return POST(
        new Request("http://127.0.0.1:4400/api/av/audit", {
          method: "POST",
          headers: { "cf-connecting-ip": "203.0.113.9", "content-type": "application/json" },
          body: JSON.stringify({ brand: "example.com" }),
        }) as never,
      );
    };
    expect((await call()).status).toBe(200);
    vi.resetModules(); // what a pm2 restart did to the old in-process Map
    expect((await call()).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
