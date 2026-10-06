// The partner API through the REAL request proxy (src/proxy.ts default export),
// then the route handler — the path a server-to-server POST actually takes.
//
// Why this file exists: tests/partner-api.test.ts calls the handlers directly,
// so it cannot see the proxy's CSRF origin check, which answers 403
// {"error":"Invalid origin"} to any POST with neither Origin nor Referer before
// a handler runs. The partner API is exempt from that check ONLY for a
// `Authorization: Bearer …` request that carries no session cookie
// (isBearerWithoutSession in src/lib/csrf-protection.ts). A request with our
// session cookie is a browser and keeps the check.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

// ─── Fakes (Prisma, Redis, DNS, sidecar) ─────────────────────────────────────

const store = new Map<string, number>();
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    incr: async (k: string) => {
      store.set(k, (store.get(k) ?? 0) + 1);
      return store.get(k);
    },
    decr: async (k: string) => {
      store.set(k, (store.get(k) ?? 0) - 1);
      return store.get(k);
    },
    get: async (k: string) => (store.has(k) ? String(store.get(k)) : null),
    expire: async () => 1,
  }),
}));

const SECRET = createHash("sha1").update("proxy-test").digest("hex").slice(0, 48);
const KEY = `er_api_${"a".repeat(24)}.${SECRET}`;
const keyRow = { id: "key_p", tenantId: "t_partner", keyHash: createHash("sha256").update(SECRET).digest("hex"), revokedAt: null, scopes: ["partner"] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: async ({ where }: { where: { keyHash: string } }) => (where.keyHash === keyRow.keyHash ? keyRow : null),
      update: async () => ({}),
    },
    visibilityAudit: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "aud_1", createdAt: new Date("2026-10-06T08:00:00Z") }),
    },
    partnerCall: { create: async () => ({}) },
  },
}));

vi.mock("node:dns/promises", () => {
  const lookup = async () => [{ address: "93.184.215.14", family: 4 }];
  return { lookup, default: { lookup } };
});

vi.mock("@/lib/av-sidecar", () => ({
  sidecarPost: async () => ({
    status: 200,
    data: { url: "https://example.com/", score: 80, grade: "B", checks: [], robots: { present: true, bots: {} }, rendering: null },
  }),
}));

// ─── Harness ─────────────────────────────────────────────────────────────────

type Proxy = (req: NextRequest, ev: never) => Promise<Response | undefined> | Response | undefined;
let proxy: Proxy;

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "test-only-secret-0123456789abcdef0123456789");
  proxy = (await import("@/proxy")).default as unknown as Proxy;
});
beforeEach(() => store.clear());

function request(path: string, init: { key?: string; origin?: string; cookie?: string; method?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", "x-partner-subject": "tenant_1", host: "echorank360.com" });
  if (init.key) headers.set("authorization", `Bearer ${init.key}`);
  if (init.origin) headers.set("origin", init.origin);
  if (init.cookie) headers.set("cookie", init.cookie);
  const method = init.method ?? "POST";
  return new NextRequest(new URL(path, "https://echorank360.com"), {
    method,
    headers,
    body: method === "POST" ? JSON.stringify({ url: "example.com", mode: "quick" }) : undefined,
  });
}

/** What the proxy did: passed through to the route (`next`), or answered itself. */
async function throughProxy(req: NextRequest) {
  const res = await proxy(req, undefined as never);
  const passed = !res || res.headers.get("x-middleware-next") === "1";
  return { passed, status: res?.status ?? 200, body: passed || !res ? null : await res.clone().json().catch(() => null), location: res?.headers.get("location") ?? null };
}

const SESSION = "__Secure-authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.forged";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("proxy → partner route, server-to-server (Bearer, no Origin, no cookie)", () => {
  it("unknown key: the proxy passes it and the route answers 401", async () => {
    const req = request("/api/partner/v1/audit", { key: "er_api_ab.cd" });
    const p = await throughProxy(req);
    expect(p.passed).toBe(true);
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("valid partner key: the proxy passes it and the route answers 200", async () => {
    const req = request("/api/partner/v1/audit", { key: KEY });
    expect((await throughProxy(req)).passed).toBe(true);
    const { POST } = await import("@/app/api/partner/v1/audit/route");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).score).toBe(80);
  });

  it("every partner path and the alias pass the same way", async () => {
    for (const path of ["/api/partner/v1/benchmark", "/api/partner/v1/visibility/query", "/api/v1/visibility/query"]) {
      expect((await throughProxy(request(path, { key: KEY }))).passed, path).toBe(true);
    }
    const get = await throughProxy(request("/api/partner/v1/audit/aud_1", { key: KEY, method: "GET" }));
    expect(get.passed).toBe(true);
    expect(get.location).toBeNull(); // not 307'd to /login
  });
});

describe("browser-shaped requests keep the origin check", () => {
  it("session cookie + Bearer + no Origin → 403 Invalid origin", async () => {
    const p = await throughProxy(request("/api/partner/v1/audit", { key: KEY, cookie: SESSION }));
    expect(p.passed).toBe(false);
    expect(p.status).toBe(403);
    expect(p.body).toEqual({ error: "Invalid origin" });
  });

  it("chunked and non-secure session cookie names count too", async () => {
    for (const cookie of ["authjs.session-token=x", "__Secure-authjs.session-token.0=x", "next-auth.session-token=x"]) {
      const p = await throughProxy(request("/api/v1/visibility/query", { key: KEY, cookie }));
      expect(p.status, cookie).toBe(403);
    }
  });

  it("an unrelated cookie does not cost a Bearer call its exemption", async () => {
    expect((await throughProxy(request("/api/partner/v1/audit", { key: KEY, cookie: "echorank_locale=en" }))).passed).toBe(true);
  });

  it("session cookie + same-site Origin → passes the origin check (then the route's own auth)", async () => {
    const p = await throughProxy(request("/api/partner/v1/audit", { key: KEY, cookie: SESSION, origin: "https://echorank360.com" }));
    expect(p.passed).toBe(true);
  });

  it("no Bearer, no cookie, no Origin → 403 (the exemption needs the key header)", async () => {
    const p = await throughProxy(request("/api/partner/v1/audit"));
    expect(p.status).toBe(403);
  });
});

describe("non-partner paths are unchanged", () => {
  it("a Bearer POST without Origin to an app API route is still refused", async () => {
    const p = await throughProxy(request("/api/ai/visibility/audit", { key: KEY }));
    expect(p.status).toBe(403);
    expect(p.body).toEqual({ error: "Invalid origin" });
  });

  it("a look-alike path does not inherit the exemption", async () => {
    for (const path of ["/api/partnerx/v1/audit", "/api/partner/v2/audit", "/api/v1/visibility/query/extra"]) {
      expect((await throughProxy(request(path, { key: KEY }))).status, path).toBe(403);
    }
  });

  it("/api/public/v1/ keeps its existing unconditional exemption", async () => {
    expect((await throughProxy(request("/api/public/v1/mcp", { key: KEY }))).passed).toBe(true);
  });
});
