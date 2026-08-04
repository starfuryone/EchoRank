// Historical route handlers — auth, SSRF, rate limits, and the promise that
// browsing history spends nothing.
//
// Prisma, the session guard, Redis, the sidecar and global fetch are stubbed.
// Zod, the SSRF guard, dedupe, the caps, Wayback parsing and error mapping are
// the real code path.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const pageSnapshot = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  deleteMany: vi.fn(),
};
const serpCheck = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { pageSnapshot, serpCheck } }));

// See content-explorer.route.test.ts on the load-bearing `..._a`.
const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 4 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const sidecarPost = vi.fn();
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost: (...a: unknown[]) => sidecarPost(...a) }));

const redisStore = new Map<string, string>();
const redis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => { redisStore.set(k, v); return "OK"; }),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

const s3send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = s3send; },
  PutObjectCommand: class { constructor(public input: Record<string, unknown>) {} },
  GetObjectCommand: class { constructor(public input: Record<string, unknown>) {} },
  DeleteObjectCommand: class { constructor(public input: Record<string, unknown>) {} },
}));

const { POST: CAPTURE } = await import("@/app/api/ai/visibility/historical/capture/route");
const { POST: WAYBACK } = await import("@/app/api/ai/visibility/historical/wayback/route");
const { POST: IMPORT } = await import("@/app/api/ai/visibility/historical/wayback/import/route");
const { GET: TIMELINE } = await import("@/app/api/ai/visibility/historical/timeline/route");
const { GET: LIST } = await import("@/app/api/ai/visibility/historical/list/route");
const { resetSpacesClient } = await import("@/lib/historical/spaces");

const TENANT = "tenant_a";

function membership(tenantId = TENANT) {
  return { tenantId, tenant: { id: tenantId, planType: "GROWTH", name: "Acme" } };
}

function post(url: string, body: unknown): Request {
  return new Request(`https://echorank360.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  resetSpacesClient();
  process.env.SPACES_KEY = "DO00TESTKEY";
  process.env.SPACES_SECRET = "test-secret";
  process.env.SPACES_REGION = "sfo3";
  process.env.SPACES_BUCKET = "datacleanupbucket";

  requirePaidPlan.mockResolvedValue(membership());
  rateLimit.mockResolvedValue({ success: true, remaining: 4 });
  pageSnapshot.findFirst.mockResolvedValue(null);
  pageSnapshot.findMany.mockResolvedValue([]);
  pageSnapshot.create.mockResolvedValue({ id: "snap_1" });
  pageSnapshot.count.mockResolvedValue(1);
  serpCheck.findMany.mockResolvedValue([]);
  s3send.mockResolvedValue({});
  sidecarPost.mockResolvedValue({ status: 200, data: { rendered_markdown: "# Page\n\nHello." } });

  fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

// ── Auth ────────────────────────────────────────────────────────────────────

describe("auth", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["capture", () => CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://a.com" }))],
    ["wayback", () => WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://a.com" }))],
    ["import", () => IMPORT(post("/api/ai/visibility/historical/wayback/import", { url: "https://a.com", timestamps: ["20190412031545"] }))],
    ["list", () => LIST(new Request("https://echorank360.com/api/ai/visibility/historical/list"))],
  ];

  it.each(cases)("%s 401s with no session", async (_name, run) => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    expect((await run()).status).toBe(401);
  });

  it.each(cases)("%s 403s an unpaid plan", async (_name, run) => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("PAST_DUE"));
    expect((await run()).status).toBe(403);
  });
});

// ── SSRF ────────────────────────────────────────────────────────────────────

describe("SSRF guard on capture", () => {
  const rejected = [
    ["metadata service", "http://169.254.169.254/latest/meta-data/"],
    ["localhost", "http://localhost/admin"],
    ["loopback ip", "http://127.0.0.1:4400/"],
    ["private range", "http://10.0.0.5/"],
    ["private range 192", "http://192.168.1.1/"],
    ["file scheme", "file:///etc/passwd"],
    ["gopher scheme", "gopher://evil.com/"],
    ["credentials in url", "https://user:pass@evil.com/"],
    ["odd port", "https://evil.com:2375/"],
    [".internal suffix", "https://db.internal/"],
    [".local suffix", "https://printer.local/"],
  ] as const;

  it.each(rejected)("rejects %s", async (_label, url) => {
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_URL");
    // Nothing was fetched and nothing was stored.
    expect(sidecarPost).not.toHaveBeenCalled();
    expect(pageSnapshot.create).not.toHaveBeenCalled();
  });

  it("rejects before spending a rate-limit token", async () => {
    await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "http://127.0.0.1/" }));
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("accepts a normal public https url", async () => {
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(200);
    expect(sidecarPost).toHaveBeenCalledTimes(1);
  });

  it("accepts a THIRD-PARTY url — no ownership check", async () => {
    // Capturing a competitor's page is the point of the tool. The tenant here
    // owns echorank360.com and is capturing something else entirely.
    for (const url of ["https://cnn.com/", "https://competitor-site.com/pricing"]) {
      sidecarPost.mockClear();
      const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url }));
      expect(res.status, url).toBe(200);
      expect(sidecarPost).toHaveBeenCalledTimes(1);
    }
  });

  it("normalizes scheme-less input before fetching", async () => {
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "cnn.com" }));
    expect(res.status).toBe(200);
    expect(sidecarPost.mock.calls[0][1]).toEqual({ url: "https://cnn.com/" });
    // And the stored url is the normalized one, so the list shows what was captured.
    expect((await res.json()).url).toBe("https://cnn.com/");
  });

  it("preserves a query string, which is a different page", async () => {
    await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "example.org/search?q=plumbers" }));
    expect(sidecarPost.mock.calls[0][1]).toEqual({ url: "https://example.org/search?q=plumbers" });
  });

  it("bounds the capture with a timeout", async () => {
    await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://cnn.com/" }));
    const opts = sidecarPost.mock.calls[0][2] as { timeoutMs?: number };
    expect(opts.timeoutMs).toBe(10_000);
  });

  it("reports a timeout as a retryable failure, not a broken page", async () => {
    // sidecarPost turns an aborted request into a 502 with its own message.
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "AI Visibility service is unavailable." } });
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://slow-site.com/" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("CAPTURE_FAILED");
    expect(pageSnapshot.create).not.toHaveBeenCalled();
  });
});

// ── Rate limits ─────────────────────────────────────────────────────────────

describe("rate limits", () => {
  it("429s capture over the limit, without fetching", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("429s wayback import over the limit", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await IMPORT(post("/api/ai/visibility/historical/wayback/import", {
      url: "https://echorank360.com/", timestamps: ["20190412031545"],
    }));
    expect(res.status).toBe(429);
  });

  it("caps an import request at MAX_WAYBACK_IMPORT via schema", async () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => String(20190412031500 + i));
    const res = await IMPORT(post("/api/ai/visibility/historical/wayback/import", {
      url: "https://echorank360.com/", timestamps: tooMany,
    }));
    expect(res.status).toBe(400);
  });
});

// ── Capture behaviour ───────────────────────────────────────────────────────

describe("capture", () => {
  it("stores a snapshot and reports created", async () => {
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    const payload = await res.json();
    expect(payload.created).toBe(true);
    expect(pageSnapshot.create).toHaveBeenCalledTimes(1);
  });

  it("dedupes an unchanged page: no row, created=false", async () => {
    const { hashContent } = await import("@/lib/historical/snapshots");
    pageSnapshot.findFirst.mockResolvedValue({ contentHash: hashContent("# Page\n\nHello.") });
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    const payload = await res.json();
    expect(payload.created).toBe(false);
    expect(pageSnapshot.create).not.toHaveBeenCalled();
  });

  it("maps a site that BLOCKS us to 422, not 502", async () => {
    // cnn.com answers 451 to the AI crawler user-agent. That is someone else's
    // access policy, not our bad gateway, and 502 sends the reader hunting for
    // a bug on our side.
    for (const upstream of [
      "The page returned HTTP 451 to an AI crawler.",
      "The page returned HTTP 403 to an AI crawler.",
      "Request was blocked by the origin.",
    ]) {
      sidecarPost.mockResolvedValue({ status: 502, data: { error: upstream } });
      const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://cnn.com/" }));
      expect(res.status, upstream).toBe(422);
      expect((await res.json()).code).toBe("CAPTURE_BLOCKED");
    }
    expect(pageSnapshot.create).not.toHaveBeenCalled();
  });

  it("still reports a genuine upstream fault as 502", async () => {
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "AI Visibility service is unavailable." } });
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://example.org/" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("CAPTURE_FAILED");
  });

  it("maps a sidecar 429 to a retryable error, not a 500", async () => {
    sidecarPost.mockResolvedValue({ status: 429, data: { error: "All render slots busy" } });
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(429);
  });

  it("503s when storage is unconfigured, without inventing a bucket", async () => {
    delete process.env.SPACES_BUCKET;
    resetSpacesClient();
    const res = await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("STORAGE_NOT_CONFIGURED");
  });
});

// ── Wayback ─────────────────────────────────────────────────────────────────

describe("wayback lookup", () => {
  const cdxRows = [
    ["timestamp", "original", "statuscode", "digest"],
    ["20190412031545", "https://echorank360.com/", "200", "AAA"],
    ["20200105120000", "https://echorank360.com/", "200", "BBB"],
  ];

  it("parses CDX rows into captures, newest first", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(cdxRows), { status: 200 }));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    const payload = await res.json();
    expect(payload.captures.map((c: { timestamp: string }) => c.timestamp)).toEqual([
      "20200105120000", "20190412031545",
    ]);
    expect(payload.captures[1].capturedAt).toBe("2019-04-12T03:15:45.000Z");
  });

  it("caches the CDX response and does not refetch", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(cdxRows), { status: 200 }));
    await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from Redis
  });

  it("accepts a third-party, scheme-less url", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(cdxRows), { status: 200 }));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "cnn.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://cnn.com/");
  });

  // ── error vs empty ───────────────────────────────────────────────────────
  //
  // These two are the whole point. Both produce zero captures, and telling a
  // user their page was never archived when the Archive simply did not answer
  // is a false statement about their history.

  it("reports an outage as an outage, not as 'never archived'", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(503);
    const payload = await res.json();
    expect(payload.code).toBe("ARCHIVE_UNREACHABLE");
    expect(payload.captures).toEqual([]);
  });

  it("distinguishes a timeout from a network error", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    fetchMock.mockRejectedValue(abort);
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect((await res.json()).reason).toBe("timeout");
  });

  it("treats a CDX 5xx as unreachable", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 503 }));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("http");
  });

  it("treats a malformed CDX payload as unreachable, not as empty", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ oops: true }), { status: 200 }));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("malformed");
  });

  it("reports a genuine zero-coverage answer as empty, with 200", async () => {
    // Header row only — CDX answered, and the answer is "nothing".
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([["timestamp", "original", "statuscode", "digest"]]), { status: 200 }),
    );
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.code).toBe("ARCHIVE_EMPTY");
    expect(payload.captures).toEqual([]);
  });

  it("does not cache an outage as zero coverage", async () => {
    // A cached outage would report "never archived" for 24h after one bad
    // minute, which is the original bug with a longer memory.
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));

    fetchMock.mockResolvedValue(new Response(JSON.stringify(cdxRows), { status: 200 }));
    const res = await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    expect(res.status).toBe(200);
    expect((await res.json()).captures.length).toBe(2);
  });

  it("fails an import loudly when the Archive is down", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    const res = await IMPORT(post("/api/ai/visibility/historical/wayback/import", {
      url: "https://echorank360.com/", timestamps: ["20190412031545"],
    }));
    // Not "1 failed snapshot" — one outage.
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("CAPTURE_FAILED");
  });
});

describe("wayback import", () => {
  it("stores with the ARCHIVE timestamp, not now()", async () => {
    const cdx = [
      ["timestamp", "original", "statuscode", "digest"],
      ["20190412031545", "https://echorank360.com/", "200", "AAA"],
    ];
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/cdx/")) return new Response(JSON.stringify(cdx), { status: 200 });
      return new Response("<html><body><h1>Old page</h1></body></html>", { status: 200 });
    });
    sidecarPost.mockResolvedValue({ status: 200, data: { markdown: "# Old page" } });

    const res = await IMPORT(post("/api/ai/visibility/historical/wayback/import", {
      url: "https://echorank360.com/", timestamps: ["20190412031545"],
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).imported).toBe(1);

    const stored = pageSnapshot.create.mock.calls[0][0].data;
    expect(stored.source).toBe("wayback");
    expect(new Date(stored.capturedAt).toISOString()).toBe("2019-04-12T03:15:45.000Z");
  });

  it("reports per-snapshot failures without failing the import", async () => {
    const cdx = [
      ["timestamp", "original", "statuscode", "digest"],
      ["20190412031545", "https://echorank360.com/", "200", "AAA"],
      ["20200105120000", "https://echorank360.com/", "200", "BBB"],
    ];
    let replay = 0;
    fetchMock.mockImplementation(async (input: unknown) => {
      if (String(input).includes("/cdx/")) return new Response(JSON.stringify(cdx), { status: 200 });
      replay++;
      // First replay 404s, second succeeds.
      return replay === 1
        ? new Response("gone", { status: 404 })
        : new Response("<html><body><p>Later</p></body></html>", { status: 200 });
    });
    sidecarPost.mockResolvedValue({ status: 200, data: { markdown: "# Later" } });

    const res = await IMPORT(post("/api/ai/visibility/historical/wayback/import", {
      url: "https://echorank360.com/", timestamps: ["20190412031545", "20200105120000"],
    }));
    const payload = await res.json();
    expect(payload.imported).toBe(1);
    expect(payload.failed).toBe(1);
    expect(payload.outcomes).toHaveLength(2);
  });
});

// ── The zero-spend promise ──────────────────────────────────────────────────

describe("browsing history spends nothing", () => {
  it("timeline reads SerpCheck and calls no external service", async () => {
    serpCheck.findMany.mockResolvedValue([
      {
        id: "c1",
        createdAt: new Date("2026-07-29T01:32:23Z"),
        itemCount: 87,
        results: { items: [{ domain: "a.com", position: 1, url: "https://a.com/", title: "A", snippet: "" }] },
      },
    ]);
    const res = await TIMELINE(new Request(
      "https://echorank360.com/api/ai/visibility/historical/timeline?keyword=plumber+toronto&locationCode=2124&languageCode=en&device=desktop",
    ));
    expect(res.status).toBe(200);
    expect((await res.json()).checks).toHaveLength(1);
    // No DataForSEO, no Anthropic, no Wayback, no sidecar.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("list reads metadata and touches no object storage", async () => {
    pageSnapshot.findMany.mockResolvedValue([
      { url: "https://a.com/", capturedAt: new Date("2026-08-01T00:00:00Z") },
    ]);
    const res = await LIST(new Request("https://echorank360.com/api/ai/visibility/historical/list"));
    expect(res.status).toBe(200);
    expect(s3send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("nothing in this feature calls Anthropic", () => {
  it("no handler reaches api.anthropic.com", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    await CAPTURE(post("/api/ai/visibility/historical/capture", { url: "https://echorank360.com/" }));
    await WAYBACK(post("/api/ai/visibility/historical/wayback", { url: "https://echorank360.com/" }));
    await LIST(new Request("https://echorank360.com/api/ai/visibility/historical/list"));
    await TIMELINE(new Request(
      "https://echorank360.com/api/ai/visibility/historical/timeline?keyword=k&locationCode=2124&languageCode=en&device=desktop",
    ));

    const called = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(called.some((u) => u.includes("api.anthropic.com"))).toBe(false);
    const sidecarPaths = sidecarPost.mock.calls.map((c) => String(c[0]));
    expect(sidecarPaths.every((p) => p.startsWith("/internal/"))).toBe(true);
  });
});
