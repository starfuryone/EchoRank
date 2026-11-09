// The purchase archive, Phase 1 (ECHORANK-DATA-ARCHIVE.md): the shared core
// (keys, body, scrubbing, hashing), the DataForSEO and LLM wrappers, the
// non-blocking capture, the spool and its alert, idempotency, the worker's
// last-attempt spool, and the guard that every paid provider client goes
// through a wrapper. No real provider or Spaces call: fetch, S3 and the index
// are fakes.
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_PARAMS,
  canonicalJson,
  dedupeKey,
  endpointSlug,
  manifestKey,
  objectKey,
  prepareObject,
  requestHash,
  scrubRequest,
  type PreparedObject,
} from "@/lib/purchase-archive/core";
import {
  dataforseoDecision,
  isExcludedDataforseoPath,
  liveSecrets,
  purchaseArchiveConfig,
  purchaseArchiveEnabled,
} from "@/lib/purchase-archive/config";
import { archivePurchase, runCapture, type CaptureDeps } from "@/lib/purchase-archive/capture";
import { archiveDataforseoResponse, isUnfinishedOnPagePoll } from "@/lib/purchase-archive/dataforseo";
import { archiveLlmAnswer } from "@/lib/purchase-archive/llm";
import { listSpool, serializeObject, writeSpool } from "@/lib/purchase-archive/spool";
import { checkSpoolAlert, drainSpool, storeObject, writeManifest, type ArchiveIndex } from "@/lib/purchase-archive/writer";
import { runWithPurchaseContext } from "@/lib/purchase-archive/context";
import type { ObjectStore } from "@/lib/spaces/client";

// ─── Fakes ──────────────────────────────────────────────────────────────────

function fakeStore(opts: { failPut?: () => boolean } = {}) {
  const objects = new Map<string, { body: Buffer; metadata?: Record<string, string> }>();
  const puts: string[] = [];
  const store: ObjectStore = {
    async put(key, body, o) {
      if (opts.failPut?.()) throw new Error("Spaces unreachable");
      puts.push(key);
      objects.set(key, { body: Buffer.isBuffer(body) ? body : Buffer.from(String(body)), metadata: o?.metadata });
    },
    async get() {
      throw new Error("not used");
    },
    async head(key) {
      const o = objects.get(key);
      return o ? { contentLength: o.body.length, metadata: o.metadata ?? {}, lastModified: null } : null;
    },
    async deleteKeys(keys) {
      for (const k of keys) objects.delete(k);
      return keys.length;
    },
    async *list(prefix) {
      for (const [key, o] of objects) if (key.startsWith(prefix)) yield { key, size: o.body.length, lastModified: null };
    },
    async listPrefixes() {
      return [];
    },
    async presignGet() {
      throw new Error("the purchase archive never presigns");
    },
  };
  return { store, objects, puts };
}

function fakeIndex() {
  const rows = new Map<string, { o: PreparedObject; s3Key: string; storedAt: Date | null; createdAt: Date }>();
  const index: ArchiveIndex = {
    async find(k) {
      const r = rows.get(k);
      return r ? { s3Key: r.s3Key, storedAt: r.storedAt } : null;
    },
    async reserve(o) {
      if (rows.has(o.dedupeKey)) return false;
      rows.set(o.dedupeKey, { o, s3Key: o.s3Key, storedAt: null, createdAt: new Date(o.receivedAt) });
      return true;
    },
    async markStored(k, at) {
      rows.get(k)!.storedAt = at;
    },
    async rowsBetween(from, to) {
      return [...rows.values()]
        .filter((r) => r.storedAt && r.createdAt >= from && r.createdAt < to)
        .map((r) => ({
          s3Key: r.s3Key,
          requestHash: r.o.requestHash,
          provider: r.o.provider,
          endpoint: r.o.endpoint,
          costUsd: r.o.costUsd,
          bytes: r.o.bytes,
          tenantId: r.o.tenantId,
          createdAt: r.createdAt,
        }));
    },
  };
  return { index, rows };
}

function captureDeps(over: Partial<CaptureDeps> = {}) {
  const queued: unknown[] = [];
  const spooled: PreparedObject[] = [];
  const deps: CaptureDeps = {
    enabled: () => true,
    enqueue: async (o) => {
      queued.push(o);
    },
    spool: async (o) => {
      spooled.push(o);
    },
    lookupTask: async () => null,
    secrets: () => [],
    ...over,
  };
  return { deps, queued, spooled };
}

const SECRETS = {
  DATAFORSEO_LOGIN: "ops@echorank.example",
  DATAFORSEO_PASSWORD: "dfs-PASSWORD-9f8e7d6c",
  OPENAI_API_KEY: "sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA1234",
  GEMINI_API_KEY: "AIzaSyD-0123456789abcdefghijklmnopqrstu",
  ANTHROPIC_API_KEY: "sk-ant-api03-BBBBBBBBBBBBBBBBBBBBBB",
  PURCHASE_ARCHIVE_SECRET: "spaces-secret-ZZZZZZZZZZZZ",
};

function asEnv(o: Record<string, string>): NodeJS.ProcessEnv {
  return o as unknown as NodeJS.ProcessEnv;
}

function gunzipJson(buf: Buffer): Record<string, unknown> {
  return JSON.parse(gunzipSync(buf).toString("utf8"));
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "purchase-spool-"));
}

// ─── The shared core ────────────────────────────────────────────────────────

describe("core: keys, hashing, scrubbing", () => {
  it("builds the v1 object key with the endpoint slug, UTC date, hash and epoch", () => {
    const at = new Date("2026-11-09T23:59:59.123Z");
    expect(objectKey({ app: "echorank", provider: "dataforseo", endpoint: "v3/serp/google/organic/live/advanced", requestHash: "abc", receivedAt: at })).toBe(
      `v1/echorank/dataforseo/serp-google-organic-live-advanced/2026/11/09/abc-${at.getTime()}.json.gz`,
    );
    expect(manifestKey("echorank", at)).toBe("v1/echorank/_manifests/2026-11-09.ndjson.gz");
  });

  it("drops the version and task ids from the endpoint slug", () => {
    expect(endpointSlug("v3/serp/google/organic/task_get/advanced/11091234-1234-0066-0000-abcdefabcdef")).toBe("serp-google-organic-task_get-advanced");
    expect(endpointSlug("v3/on_page/summary/11091234-1234-0066-0000-abcdefabcdef")).toBe("on_page-summary");
    expect(endpointSlug("responses")).toBe("responses");
    expect(endpointSlug("../../etc/passwd")).not.toContain("/");
  });

  it("the slug is idempotent, so the stored key keeps its dashes", async () => {
    const slug = endpointSlug("v3/serp/google/organic/live/advanced");
    expect(endpointSlug(slug)).toBe(slug);
    const o = await prepareObject(
      "echorank",
      { provider: "dataforseo", endpoint: "v3/serp/google/organic/live/advanced", request: { keyword: "k" }, response: {}, costUsd: 0.002, providerTaskId: null, tenantId: null, purpose: "p" },
      { personalData: true, receivedAt: new Date("2026-11-09T00:00:00Z") },
    );
    expect(o.s3Key.startsWith("v1/echorank/dataforseo/serp-google-organic-live-advanced/2026/11/09/")).toBe(true);
  });

  it("hashes the canonical request: key order does not matter, values do", () => {
    expect(requestHash({ keyword: "a", location_code: 2840 })).toBe(requestHash({ location_code: 2840, keyword: "a" }));
    expect(requestHash({ keyword: "a" })).not.toBe(requestHash({ keyword: "b" }));
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it("denylist: credential keys are dropped at every depth", () => {
    const out = scrubRequest({
      keyword: "pizza",
      Authorization: "Basic xyz",
      login: "me",
      password: "p",
      api_key: "k",
      "x-goog-api-key": "g",
      filters: [{ token: "t", nested: { client_secret: "s", cookie: "c" }, value: 1 }],
    }) as Record<string, unknown>;
    const text = JSON.stringify(out);
    for (const k of ["Authorization", "login", "password", "api_key", "x-goog-api-key", "token", "client_secret", "cookie"]) {
      expect(text).not.toContain(`"${k}"`);
    }
    expect(out.keyword).toBe("pizza");
    expect(out.filters).toEqual([{ nested: {}, value: 1 }]);
  });

  it("allowlist: unknown top-level params are hashed, never stored", () => {
    const out = scrubRequest({ keyword: "pizza", customer_note: "call Jane at 555-0100" }) as Record<string, unknown>;
    expect(out.keyword).toBe("pizza");
    expect(out.customer_note).toEqual({ $hashed: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(JSON.stringify(out)).not.toContain("Jane");
    expect(ALLOWED_PARAMS.has("max_output_tokens")).toBe(true);
    // a token-COUNT param is not a credential
    expect((scrubRequest({ max_output_tokens: 1200 }) as Record<string, unknown>).max_output_tokens).toBe(1200);
  });

  it("redacts credential-shaped values inside allowed params", () => {
    const out = JSON.stringify(
      scrubRequest({ url: "https://x.example/?q=1&api_key=SECRET123&token=abc", input: `Bearer abcdefghijklmnop and ${SECRETS.OPENAI_API_KEY} and ${SECRETS.GEMINI_API_KEY}` }),
    );
    expect(out).not.toContain("SECRET123");
    expect(out).not.toContain("abcdefghijklmnop");
    expect(out).not.toContain(SECRETS.OPENAI_API_KEY);
    expect(out).not.toContain(SECRETS.GEMINI_API_KEY);
  });

  it("dedupe key: the same task is one key whenever it arrives; without a task id, the same request at another instant is another", () => {
    const base = { app: "echorank" as const, provider: "dataforseo", endpoint: "serp-google-organic-task_get-advanced", requestHash: "h" };
    const t1 = new Date(1_000);
    const t2 = new Date(2_000);
    expect(dedupeKey({ ...base, providerTaskId: "T", receivedAt: t1 })).toBe(dedupeKey({ ...base, providerTaskId: "T", receivedAt: t2 }));
    expect(dedupeKey({ ...base, providerTaskId: null, receivedAt: t1 })).toBe(dedupeKey({ ...base, providerTaskId: null, receivedAt: new Date(1_000) }));
    expect(dedupeKey({ ...base, providerTaskId: null, receivedAt: t1 })).not.toBe(dedupeKey({ ...base, providerTaskId: null, receivedAt: t2 }));
  });

  it("the body has the brief's fields, the metadata has provider/endpoint/cost/tenant", async () => {
    const o = await prepareObject(
      "echorank",
      { provider: "dataforseo", endpoint: "v3/backlinks/summary/live", request: { target: "a.com" }, response: { tasks: [] }, costUsd: 0.02, providerTaskId: "T1", tenantId: "ten1", purpose: "backlinks" },
      { personalData: false, receivedAt: new Date("2026-11-09T10:00:00Z") },
    );
    const body = gunzipJson(o.gz);
    expect(Object.keys(body).sort()).toEqual(["app", "costUsd", "endpoint", "provider", "providerTaskId", "purpose", "receivedAt", "request", "response", "tenantId", "v"].sort());
    expect(body).toMatchObject({ v: 1, app: "echorank", provider: "dataforseo", endpoint: "backlinks-summary-live", costUsd: 0.02, tenantId: "ten1", purpose: "backlinks" });
    expect(o.bytes).toBe(o.gz.length);
  });
});

// ─── Credentials never reach an object or an index row (fuzz) ──────────────

describe("credentials never appear in an object or index row", () => {
  const secrets = Object.values(SECRETS);
  const dfsBasic = Buffer.from(`${SECRETS.DATAFORSEO_LOGIN}:${SECRETS.DATAFORSEO_PASSWORD}`).toString("base64");

  /** Each provider's request shape, with a credential planted somewhere. */
  const shapes: Array<{ provider: string; endpoint: string; request: (s: string) => unknown }> = [
    { provider: "dataforseo", endpoint: "v3/serp/google/organic/live/advanced", request: (s) => [{ keyword: "k", location_code: 2840, password: s }] },
    { provider: "dataforseo", endpoint: "v3/dataforseo_labs/google/ranked_keywords/live", request: (s) => ({ target: "a.com", filters: [["x", "=", s]], login: s }) },
    { provider: "dataforseo", endpoint: "v3/backlinks/summary/live", request: (s) => ({ target: `https://a.com/?api_key=${s}` }) },
    { provider: "dataforseo", endpoint: "v3/on_page/pages", request: (s) => ({ id: "T", custom_headers: { Authorization: `Basic ${s}` } }) },
    { provider: "openai", endpoint: "responses", request: (s) => ({ model: "gpt-5-mini", input: "q", headers: { Authorization: `Bearer ${s}` }, apiKey: s }) },
    { provider: "gemini", endpoint: "generate_content", request: (s) => ({ contents: [{ parts: [{ text: "q" }] }], key: s, "x-goog-api-key": s }) },
    { provider: "anthropic", endpoint: "messages", request: (s) => ({ model: "claude", prompt: "q", x_api_key: s, unknown_field: s }) },
  ];

  for (const shape of shapes) {
    for (const secret of [...secrets, dfsBasic]) {
      it(`${shape.provider} ${shape.endpoint}: ${secret.slice(0, 6)}… is absent`, async () => {
        // The response echoes the secret too: the live-secret redaction removes it.
        const o = await prepareObject(
          "echorank",
          { provider: shape.provider, endpoint: shape.endpoint, request: shape.request(secret), response: { echo: secret, nested: [secret] }, costUsd: 0.01, providerTaskId: null, tenantId: "t", purpose: "p" },
          { personalData: false, secrets: liveSecrets(asEnv(SECRETS)) },
        );
        const text = gunzipSync(o.gz).toString("utf8");
        expect(text).not.toContain(secret);
        const row = { ...o, gz: undefined };
        expect(JSON.stringify(row)).not.toContain(secret);
      });
    }
  }
});

// ─── Config ─────────────────────────────────────────────────────────────────

describe("config", () => {
  it("reads PURCHASE_ARCHIVE_* on its own; SPACES_ARCHIVE_* never stands in", () => {
    const spaces = { SPACES_ARCHIVE_ENDPOINT: "e", SPACES_ARCHIVE_REGION: "r", SPACES_ARCHIVE_BUCKET: "b", SPACES_ARCHIVE_KEY: "k", SPACES_ARCHIVE_SECRET: "s" };
    expect(purchaseArchiveConfig(asEnv(spaces))).toBeNull();
    const full = { PURCHASE_ARCHIVE_ENDPOINT: "e", PURCHASE_ARCHIVE_REGION: "r", PURCHASE_ARCHIVE_BUCKET: "echorank-seodata", PURCHASE_ARCHIVE_KEY: "k", PURCHASE_ARCHIVE_SECRET: "s" };
    expect(purchaseArchiveConfig(asEnv(full))?.bucket).toBe("echorank-seodata");
    expect(purchaseArchiveEnabled(asEnv(full))).toBe(true);
    expect(purchaseArchiveEnabled(asEnv({ ...full, PURCHASE_ARCHIVE_ENABLED: "false" }))).toBe(false);
    expect(purchaseArchiveEnabled(asEnv({}))).toBe(false);
  });

  it("excludes Maps, Local Finder and Business Data; skips free and acknowledgement calls; flags personal data", () => {
    for (const p of ["v3/serp/google/maps/live/advanced", "v3/serp/google/local_finder/live/advanced", "v3/business_data/business_listings/search/live", "v3/business_data/google/questions_and_answers/live"]) {
      expect(dataforseoDecision(p)).toEqual({ archive: false, reason: "excluded" });
    }
    for (const p of ["v3/appendix/user_data", "v3/serp/google/organic/tasks_ready", "v3/serp/google/organic/task_post", "v3/ai_optimization/chat_gpt/llm_scraper/task_post", "v3/serp/google/locations"]) {
      expect(dataforseoDecision(p)).toEqual({ archive: false, reason: "not_purchased" });
    }
    expect(dataforseoDecision("v3/serp/google/organic/live/advanced")).toEqual({ archive: true, personalData: true });
    expect(dataforseoDecision("v3/serp/google/organic/task_get/advanced/T")).toEqual({ archive: true, personalData: true });
    expect(dataforseoDecision("v3/content_analysis/search/live")).toEqual({ archive: true, personalData: true });
    expect(dataforseoDecision("v3/ai_optimization/llm_mentions/search/live")).toEqual({ archive: true, personalData: true });
    expect(dataforseoDecision("v3/dataforseo_labs/google/ranked_keywords/live")).toEqual({ archive: true, personalData: false });
    expect(dataforseoDecision("v3/backlinks/summary/live")).toEqual({ archive: true, personalData: false });
    expect(dataforseoDecision("v3/on_page/pages")).toEqual({ archive: true, personalData: false });
  });

  it("only a finished OnPage summary is archived, not the polls", () => {
    expect(isUnfinishedOnPagePoll("v3/on_page/summary/T", [{ crawl_progress: "in_progress" }])).toBe(true);
    expect(isUnfinishedOnPagePoll("v3/on_page/summary/T", [{ crawl_progress: "finished" }])).toBe(false);
    expect(isUnfinishedOnPagePoll("v3/on_page/pages", [])).toBe(false);
  });
});

// ─── Google Places is never archived ───────────────────────────────────────

describe("Google Places / Maps responses are never archived", () => {
  const ROOT = join(__dirname, "..");
  const PLACES_FILES = ["src/lib/signals/competitors.ts", "src/lib/opportunity-scanner/places.ts", "src/lib/explain/gather.ts"];

  it("no Places call site imports the purchase archive", () => {
    for (const f of PLACES_FILES) {
      expect(readFileSync(join(ROOT, f), "utf8"), f).not.toMatch(/purchase-archive/);
    }
  });

  it("DataForSEO's resold Maps results are dropped before a capture is scheduled", async () => {
    const { deps, queued, spooled } = captureDeps();
    const enabled = vi.fn(() => true);
    archiveDataforseoResponse(
      { method: "POST", path: "v3/serp/google/maps/live/advanced", body: "[{}]", envelope: { tasks: [{ id: "x", cost: 0.002, result: [{}] }] } },
      { ...deps, enabled },
    );
    await new Promise((r) => setImmediate(r));
    expect(enabled).not.toHaveBeenCalled();
    expect(queued).toHaveLength(0);
    expect(spooled).toHaveLength(0);
    expect(isExcludedDataforseoPath("v3/business_data/google/questions_and_answers/live")).toBe(true);
  });
});

// ─── Non-blocking capture ──────────────────────────────────────────────────

describe("non-blocking capture", () => {
  const input = { provider: "dataforseo", endpoint: "v3/backlinks/summary/live", request: { target: "a.com" }, response: { tasks: [{ id: "T" }] }, costUsd: 0.02, providerTaskId: "T", tenantId: "t", purpose: "backlinks" };

  it("returns before any work runs", async () => {
    const { deps, queued } = captureDeps();
    const p = archivePurchase(input, { personalData: false }, deps);
    expect(queued).toHaveLength(0);
    expect(await p).toBe("queued");
    expect(queued).toHaveLength(1);
  });

  it("off when not configured: nothing runs", async () => {
    const { deps, queued } = captureDeps({ enabled: () => false });
    expect(await archivePurchase(input, { personalData: false }, deps)).toBe("off");
    expect(queued).toHaveLength(0);
  });

  it("queue down → spool; spool down too → dropped, never thrown", async () => {
    const a = captureDeps({ enqueue: async () => Promise.reject(new Error("redis down")) });
    expect(await runCapture(input, { personalData: false }, a.deps)).toBe("spooled");
    expect(a.spooled).toHaveLength(1);
    const b = captureDeps({ enqueue: async () => Promise.reject(new Error("redis down")), spool: async () => Promise.reject(new Error("EACCES")) });
    await expect(archivePurchase(input, { personalData: false }, b.deps)).resolves.toBe("dropped");
  });

  it("a body over the inline limit goes straight to the spool", async () => {
    const big = { ...input, response: { blob: Array.from({ length: 200_000 }, (_, i) => `${i}-${Math.random()}`) } };
    const { deps, queued, spooled } = captureDeps();
    expect(await runCapture(big, { personalData: false }, deps)).toBe("spooled");
    expect(queued).toHaveLength(0);
    expect(spooled).toHaveLength(1);
  });

  it("a task read takes the tenant and cost of the post that bought it", async () => {
    const { deps, queued } = captureDeps({ lookupTask: async () => ({ tenantId: "ten-9", costUsd: 0.0006 }) });
    await runCapture({ ...input, endpoint: "v3/serp/google/organic/task_get/advanced/T", tenantId: null, costUsd: 0 }, { personalData: true, resolveTask: true }, deps);
    expect(queued[0]).toMatchObject({ tenantId: "ten-9", costUsd: 0.0006, personalData: true });
  });

  it("a Spaces outage still returns the user's data (DataForSEO client end to end)", async () => {
    const env = { PURCHASE_ARCHIVE_ENDPOINT: "https://x.invalid", PURCHASE_ARCHIVE_REGION: "r", PURCHASE_ARCHIVE_BUCKET: "b", PURCHASE_ARCHIVE_KEY: "k", PURCHASE_ARCHIVE_SECRET: "s", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p", PURCHASE_ARCHIVE_SPOOL_DIR: tmp() };
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ tasks: [{ id: "T-live", status_code: 20000, cost: 0.02, path: ["v3", "backlinks", "summary", "live"], result: [{ rank: 7 }] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { postTask } = await import("@/lib/dataforseo/client");
      const out = await postTask("v3/backlinks/summary/live", { target: "a.com" });
      expect(out.data).toEqual([{ rank: 7 }]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

// ─── The wrappers ──────────────────────────────────────────────────────────

describe("the DataForSEO and LLM wrappers", () => {
  it("DataForSEO: the posted task is the request, the envelope the response, the context the tenant", async () => {
    const { deps, queued } = captureDeps();
    runWithPurchaseContext({ tenantId: "ten-1", purpose: "backlinks" }, () =>
      archiveDataforseoResponse(
        { method: "POST", path: "v3/backlinks/summary/live", body: JSON.stringify([{ target: "a.com" }]), envelope: { tasks: [{ id: "T1", cost: 0.02, data: { target: "a.com" }, result: [{}] }] } },
        deps,
      ),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(queued).toHaveLength(1);
    const o = queued[0] as ReturnType<typeof serializeObject>;
    expect(o).toMatchObject({ provider: "dataforseo", endpoint: "backlinks-summary-live", tenantId: "ten-1", purpose: "backlinks", costUsd: 0.02, providerTaskId: "T1", personalData: false });
    const body = gunzipJson(Buffer.from(o.gzB64, "base64"));
    expect(body.request).toEqual({ target: "a.com" });
    expect(body.response).toEqual({ tasks: [{ id: "T1", cost: 0.02, data: { target: "a.com" }, result: [{}] }] });
  });

  it("DataForSEO GET read: the echoed task is the request", async () => {
    const { deps, queued } = captureDeps();
    archiveDataforseoResponse({ method: "GET", path: "v3/serp/google/organic/task_get/advanced/T2", envelope: { tasks: [{ id: "T2", cost: 0, data: { keyword: "k", location_code: 2840 }, result: [{}] }] } }, deps);
    await new Promise((r) => setTimeout(r, 20));
    const body = gunzipJson(Buffer.from((queued[0] as { gzB64: string }).gzB64, "base64"));
    expect(body.request).toEqual({ keyword: "k", location_code: 2840 });
    expect(body.purpose).toBe("standard-queue");
  });

  it("LLM answers are personal data and keyed by the provider's response id", async () => {
    const { deps, queued } = captureDeps();
    archiveLlmAnswer({ provider: "openai", endpoint: "responses", request: { model: "m", input: "q" }, response: { id: "resp_1", output: [] }, costUsd: 0.03, tenantId: null, purpose: "free-ai-visibility-check" }, deps);
    await new Promise((r) => setTimeout(r, 20));
    expect(queued[0]).toMatchObject({ provider: "openai", endpoint: "responses", personalData: true, providerTaskId: "resp_1", tenantId: null });
  });
});

// ─── Writer: idempotency, spool order, alert, manifest ────────────────────

async function obj(at: number, over: Partial<Parameters<typeof prepareObject>[1]> = {}): Promise<PreparedObject> {
  return prepareObject(
    "echorank",
    { provider: "dataforseo", endpoint: "v3/backlinks/summary/live", request: { target: `a${at}.com` }, response: { at }, costUsd: 0.02, providerTaskId: null, tenantId: "t", purpose: "p", ...over },
    { personalData: false, receivedAt: new Date(at) },
  );
}

describe("writer", () => {
  it("idempotent: the same object twice is one put and one row", async () => {
    const { store, puts } = fakeStore();
    const { index, rows } = fakeIndex();
    const o = await obj(1_700_000_000_000);
    expect(await storeObject(o, { store, index })).toBe("stored");
    expect(await storeObject(o, { store, index })).toBe("duplicate");
    expect(puts).toHaveLength(1);
    expect(rows.size).toBe(1);
  });

  it("idempotent: the same provider task captured twice (another instant) is written once", async () => {
    const { store, puts } = fakeStore();
    const { index } = fakeIndex();
    const a = await obj(1_700_000_000_000, { providerTaskId: "TASK", request: { keyword: "k" } });
    const b = await obj(1_700_000_999_000, { providerTaskId: "TASK", request: { keyword: "k" } });
    expect(a.dedupeKey).toBe(b.dedupeKey);
    await storeObject(a, { store, index });
    expect(await storeObject(b, { store, index })).toBe("duplicate");
    expect(puts).toEqual([a.s3Key]);
  });

  it("a retry after a failed upload reuses its reserved row's key", async () => {
    let fail = true;
    const { store, puts } = fakeStore({ failPut: () => fail });
    const { index, rows } = fakeIndex();
    const o = await obj(1_700_000_000_000);
    await expect(storeObject(o, { store, index })).rejects.toThrow("Spaces unreachable");
    expect(rows.get(o.dedupeKey)?.storedAt).toBeNull();
    fail = false;
    expect(await storeObject(o, { store, index })).toBe("stored");
    expect(puts).toEqual([o.s3Key]);
  });

  it("the object carries the metadata and the gzipped body", async () => {
    const { store, objects } = fakeStore();
    const { index } = fakeIndex();
    const o = await obj(1_700_000_000_000);
    await storeObject(o, { store, index });
    const stored = objects.get(o.s3Key)!;
    expect(stored.metadata).toMatchObject({ provider: "dataforseo", endpoint: "backlinks-summary-live", cost: "0.02", tenant: "t" });
    expect(gunzipJson(stored.body).v).toBe(1);
  });

  it("the spool fills while Spaces is down and drains in arrival order", async () => {
    const dir = tmp();
    const times = [1_700_000_300_000, 1_700_000_100_000, 1_700_000_200_000];
    for (const t of times) await writeSpool(await obj(t), dir);
    for (const n of await listSpool(dir)) expect(statSync(join(dir, n)).mode & 0o777).toBe(0o600);

    const down = fakeStore({ failPut: () => true });
    const { index } = fakeIndex();
    const first = await drainSpool({ store: down.store, index, dir });
    expect(first).toMatchObject({ uploaded: 0, remaining: 3, failed: true });

    const up = fakeStore();
    const second = await drainSpool({ store: up.store, index, dir });
    expect(second).toMatchObject({ uploaded: 3, remaining: 0, failed: false });
    expect(up.puts.map((k) => Number(k.match(/-(\d+)\.json\.gz$/)![1]))).toEqual([...times].sort());
  });

  it("the alert fires once a day, only past 1,000 files", async () => {
    const dir = tmp();
    for (let i = 0; i < 1_000; i++) writeFileSync(join(dir, `${String(i).padStart(15, "0")}-x.json`), "{}");
    const claimed = new Set<string>();
    const posts: string[] = [];
    const deps = {
      dir,
      claimToday: async (d: string) => (claimed.has(d) ? false : (claimed.add(d), true)),
      post: async (l: string) => (posts.push(l), true),
      now: () => new Date("2026-11-09T12:00:00Z"),
    };
    expect((await checkSpoolAlert(deps)).alerted).toBe(false); // exactly 1,000: not past it
    writeFileSync(join(dir, "999999999999999-y.json"), "{}");
    expect((await checkSpoolAlert(deps)).alerted).toBe(true);
    expect((await checkSpoolAlert(deps)).alerted).toBe(false); // same day
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatch(/1001 objects/);
  });

  it("the manifest lists the day's stored objects, one line each", async () => {
    const { store, objects } = fakeStore();
    const { index } = fakeIndex();
    const day = Date.UTC(2026, 10, 9, 8);
    await storeObject(await obj(day), { store, index });
    await storeObject(await obj(day + 3_600_000), { store, index });
    await storeObject(await obj(day + 86_400_000), { store, index }); // next day
    const out = await writeManifest(new Date(day), { store, index });
    expect(out).toEqual({ key: "v1/echorank/_manifests/2026-11-09.ndjson.gz", lines: 2 });
    const lines = gunzipSync(objects.get(out.key)!.body).toString("utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(Object.keys(lines[0]).sort()).toEqual(["bytes", "cost", "endpoint", "hash", "key", "provider", "tenant", "ts"]);
  });
});

// ─── The worker ────────────────────────────────────────────────────────────

describe("purchase-archive worker", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("the last store attempt spools instead of failing; earlier attempts throw for a retry", async () => {
    const { processPurchaseArchiveJob } = await import("@/infrastructure/queue/workers/purchase-archive.worker");
    const down = fakeStore({ failPut: () => true });
    const { index } = fakeIndex();
    const spooled: PreparedObject[] = [];
    const deps = {
      store: () => down.store,
      index,
      spool: async (o: PreparedObject) => (spooled.push(o), "f"),
      claimAlertDay: async () => true,
      post: async () => true,
      now: () => new Date(),
      pageStore: () => null,
      drainPages: async () => ({ uploaded: 0, remaining: 0, failed: false }),
      pageDir: () => tmp(),
    };
    const o = serializeObject(await obj(1_700_000_000_000));
    const job = (attemptsMade: number) => ({ data: { kind: "store", object: o }, opts: { attempts: 5 }, attemptsMade }) as never;
    await expect(processPurchaseArchiveJob(job(0), deps)).rejects.toThrow("Spaces unreachable");
    await expect(processPurchaseArchiveJob(job(4), deps)).resolves.toEqual({ spooled: "store_failed" });
    expect(spooled).toHaveLength(1);
  });
});

// ─── Every provider client goes through the wrapper ───────────────────────

describe("every paid provider client goes through a wrapper", () => {
  const ROOT = join(__dirname, "..");
  const HOSTS = /api\.dataforseo\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|@anthropic-ai\/sdk|serper\.dev|places\.googleapis|maps\.googleapis/;

  /**
   * Every file that can reach a paid provider, and how it is handled. A new
   * file calling one of these hosts fails this test until it is classified
   * here: archived (and then it must import the wrapper) or not purchased data.
   */
  const CLASSIFIED: Record<string, { archived: true; via: RegExp } | { archived: false; why: string }> = {
    "src/lib/dataforseo/client.ts": { archived: true, via: /archiveDataforseoResponse\(/ },
    "src/lib/snapshot/engines.ts": { archived: true, via: /archiveLlmAnswer\(/ },
    "src/lib/ai-monitor/runner/http-engines.ts": { archived: true, via: /archiveLlmAnswer\(/ },
    "src/lib/ai-monitor/runner/providers.ts": { archived: true, via: /archiveLlmAnswer\(/ },
    "scripts/generate-locations.ts": { archived: false, why: "DataForSEO's free locations list, a one-off script" },
    "src/lib/ai-citations/options.ts": { archived: false, why: "mentions the host in a comment only" },
    "src/ai/providers/anthropic.ts": { archived: false, why: "the Claude client; the tracking answer is archived by its caller (providers.ts)" },
    "src/ai/providers/openai.ts": { archived: false, why: "generation client, not purchased data" },
    "src/app/api/ai/respond/route.ts": { archived: false, why: "review replies: our generation" },
    "src/lib/assistant/model.ts": { archived: false, why: "assistant: our generation" },
    "src/lib/blog-agent/client.ts": { archived: false, why: "blog agent: our generation" },
    "src/lib/marketing/client.ts": { archived: false, why: "Marketing Studio: our generation" },
    "src/lib/site-crawler/ai-batch.ts": { archived: false, why: "crawl AI on the customer's own key or ours: customer content" },
    "src/lib/site-crawler/ai-prompts.ts": { archived: false, why: "crawl AI prompts: customer content" },
    "src/lib/site-crawler/semantic.ts": { archived: false, why: "embeddings of customer pages" },
    "src/lib/explain/gather.ts": { archived: false, why: "Google Places: excluded by Google's terms" },
    "src/lib/opportunity-scanner/places.ts": { archived: false, why: "Google Places: excluded by Google's terms" },
    "src/lib/signals/competitors.ts": { archived: false, why: "Google Places: excluded by Google's terms" },
  };

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "generated" || name.startsWith(".")) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\./.test(name) && !p.includes("__tests__")) out.push(p);
    }
    return out;
  }

  it("every file calling a paid provider host is classified, and archived ones call their wrapper", () => {
    const found = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))]
      .filter((p) => HOSTS.test(readFileSync(p, "utf8")))
      .map((p) => relative(ROOT, p))
      .sort();
    const unclassified = found.filter((f) => !(f in CLASSIFIED));
    expect(unclassified, "classify these in CLASSIFIED").toEqual([]);
    for (const [file, c] of Object.entries(CLASSIFIED)) {
      if (c.archived) expect(readFileSync(join(ROOT, file), "utf8"), file).toMatch(c.via);
    }
  });

  /** Source without its comments: a host named in a comment is not a call. */
  function code(text: string): string {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
  }

  it("only the DataForSEO client reaches api.dataforseo.com from src/ (code, not comments)", () => {
    const hits = walk(join(ROOT, "src"))
      .filter((p) => /api\.dataforseo\.com/.test(code(readFileSync(p, "utf8"))))
      .map((p) => relative(ROOT, p));
    expect(hits).toEqual(["src/lib/dataforseo/client.ts"]);
  });

  it("the client's one fetch path hands every parsed success to the wrapper", async () => {
    vi.resetModules();
    const seen: Array<{ path: string; method: string }> = [];
    vi.doMock("@/lib/purchase-archive/dataforseo", () => ({
      archiveDataforseoResponse: (p: { path: string; method: string }) => seen.push({ path: p.path, method: p.method }),
    }));
    vi.stubEnv("DATAFORSEO_LOGIN", "l");
    vi.stubEnv("DATAFORSEO_PASSWORD", "p");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ tasks: [{ id: "T", status_code: 20000, cost: 0.01, result: [] }] }), { status: 200 })));
    try {
      const { postTask, getEndpoint } = await import("@/lib/dataforseo/client");
      await postTask("v3/dataforseo_labs/google/keyword_ideas/live", { keywords: ["a"] });
      await getEndpoint("v3/serp/google/organic/task_get/advanced/T");
      expect(seen).toEqual([
        { path: "v3/dataforseo_labs/google/keyword_ideas/live", method: "POST" },
        { path: "v3/serp/google/organic/task_get/advanced/T", method: "GET" },
      ]);
    } finally {
      vi.doUnmock("@/lib/purchase-archive/dataforseo");
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("the free AI Visibility Check's answer is archived; its JSON analysis call is not", async () => {
    vi.resetModules();
    const captured: Array<{ provider: string; endpoint: string; purpose: string }> = [];
    vi.doMock("@/lib/purchase-archive/llm", () => ({ archiveLlmAnswer: (p: { provider: string; endpoint: string; purpose: string }) => captured.push(p) }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "r1", model: "gpt-5-mini", output: [{ type: "message", content: [{ type: "output_text", text: '{"a":1}' }] }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 })),
    );
    try {
      const { askEngine, askJson } = await import("@/lib/snapshot/engines");
      await askEngine({ engine: "openai", model: "gpt-5-mini", apiKey: SECRETS.OPENAI_API_KEY } as never, "best pizza");
      await askJson({ engine: "openai", model: "gpt-5-mini", apiKey: SECRETS.OPENAI_API_KEY } as never, "i", "x", {});
      expect(captured).toHaveLength(1);
      expect(captured[0]).toMatchObject({ provider: "openai", endpoint: "responses", purpose: "free-ai-visibility-check" });
      expect(JSON.stringify(captured[0])).not.toContain(SECRETS.OPENAI_API_KEY);
    } finally {
      vi.doUnmock("@/lib/purchase-archive/llm");
      vi.unstubAllGlobals();
    }
  });
});
