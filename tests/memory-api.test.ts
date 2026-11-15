// AI memory at the edges: /api/account/memory (the settings page's API) and
// the MCP tools remember / recall through the real /api/public/v1/mcp route.
// What matters here is the tenant: it comes from the session or the API key,
// never from a body, and two keys never see each other's memories.
//
// The sidecar is replaced by an in-memory store with its semantics (scope per
// tenant, on/off per tenant); the queue's addJob writes straight into it, as
// worker + sidecar would.

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  type Row = { id: string; memory: string; surface: string };
  const facts = new Map<string, Row[]>();
  const enabled = new Map<string, boolean>();
  let seq = 0;
  const redisStore = new Map<string, number>();
  return {
    facts,
    enabled,
    redisStore,
    membership: { tenantId: "tA", userId: "u1", role: "OWNER" as string, tenant: { planType: "GROWTH" as string } },
    keys: { "Bearer key-A": "tA", "Bearer key-B": "tB" } as Record<string, string>,
    plans: { tA: "AGENCY", tB: "AGENCY" } as Record<string, string>,
    client: {
      getMemorySettings: vi.fn(async (tenantId: string) => ({ enabled: m.enabled.get(tenantId) ?? true, total: (m.facts.get(tenantId) ?? []).length })),
      setMemoryEnabled: vi.fn(async (tenantId: string, on: boolean) => {
        m.enabled.set(tenantId, on);
        return { enabled: on, total: (m.facts.get(tenantId) ?? []).length };
      }),
      listMemories: vi.fn(async (tenantId: string) => ({
        items: (m.facts.get(tenantId) ?? []).map((r) => ({ ...r, created_at: null, category: "general" })),
        nextCursor: null,
        total: (m.facts.get(tenantId) ?? []).length,
      })),
      deleteMemory: vi.fn(async (tenantId: string, id: string) => {
        const rows = m.facts.get(tenantId) ?? [];
        const i = rows.findIndex((r) => r.id === id);
        if (i < 0) return false;
        rows.splice(i, 1);
        return true;
      }),
      purgeTenantMemory: vi.fn(async (tenantId: string) => {
        const n = (m.facts.get(tenantId) ?? []).length;
        m.facts.set(tenantId, []);
        return { purged: { memories: n }, remaining: 0 };
      }),
      searchMemories: vi.fn(async ({ tenantId, query }: { tenantId: string; query: string }) => {
        if (m.enabled.get(tenantId) === false) return { ok: true, results: [] };
        const words = query.toLowerCase().split(/\W+/).filter(Boolean);
        return {
          ok: true,
          results: (m.facts.get(tenantId) ?? [])
            .filter((r) => words.some((w) => r.memory.toLowerCase().includes(w)))
            .map((r) => ({ ...r, score: 0.5, created_at: "2026-11-15T00:00:00Z" })),
        };
      }),
      MemoryUnavailableError: class extends Error {},
    },
    addJob: vi.fn(async (_q: string, _n: string, job: { tenantId: string; text?: string; surface: string }) => {
      const rows = m.facts.get(job.tenantId) ?? [];
      rows.push({ id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, memory: job.text ?? "", surface: job.surface });
      m.facts.set(job.tenantId, rows);
      return { id: `j${seq}` };
    }),
    redis: {
      get: vi.fn(async (k: string) => (m.redisStore.has(k) ? String(m.redisStore.get(k)) : null)),
      incr: vi.fn(async (k: string) => {
        m.redisStore.set(k, (m.redisStore.get(k) ?? 0) + 1);
        return m.redisStore.get(k)!;
      }),
      expire: vi.fn(async () => 1),
      decr: vi.fn(async () => 0),
    },
  };
});

vi.mock("@/lib/memory/client", () => m.client);
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: m.addJob }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => m.redis, getSubscriberConnection: () => m.redis }));
vi.mock("@/lib/paid-plan", async (orig) => ({
  ...(await orig<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: async () => m.membership,
  hasPaidPlan: async () => true,
}));
vi.mock("@/lib/api-keys", () => ({
  authenticatePublicRequest: async (req: Request) => {
    const tenantId = m.keys[req.headers.get("authorization") ?? ""];
    if (!tenantId) return { ok: false, response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) };
    return { ok: true, tenantId, keyId: `key-${tenantId}` };
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, name: `Workspace ${where.id}`, planType: m.plans[where.id] })) },
  },
}));

const account = await import("@/app/api/account/memory/route");
const accountItem = await import("@/app/api/account/memory/[id]/route");
const mcp = await import("@/app/api/public/v1/mcp/route");

beforeEach(() => {
  vi.clearAllMocks();
  m.facts.clear();
  m.enabled.clear();
  m.redisStore.clear();
  m.membership.tenantId = "tA";
  m.membership.role = "OWNER";
  m.membership.tenant.planType = "GROWTH";
  m.plans.tA = "AGENCY";
  m.plans.tB = "AGENCY";
});

const req = (method: string, body?: unknown, url = "https://echorank360.com/api/account/memory") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("/api/account/memory: the tenant is the session's", () => {
  it("a tenantId in the body is ignored on PUT and DELETE", async () => {
    expect((await account.PUT(req("PUT", { enabled: false, tenantId: "tB" }))).status).toBe(200);
    expect(m.client.setMemoryEnabled).toHaveBeenCalledWith("tA", false);
    expect((await account.DELETE(req("DELETE", { confirm: "DELETE", tenantId: "tB" }))).status).toBe(200);
    expect(m.client.purgeTenantMemory).toHaveBeenCalledWith("tA");
  });

  it("a tenantId in the query is ignored on GET", async () => {
    await account.GET(req("GET", undefined, "https://echorank360.com/api/account/memory?tenantId=tB&cursor=0"));
    expect(m.client.listMemories).toHaveBeenCalledWith("tA", 0);
    expect(m.client.getMemorySettings).toHaveBeenCalledWith("tA");
  });

  it("delete-all needs the typed confirm; members cannot switch off or delete all", async () => {
    expect((await account.DELETE(req("DELETE", { confirm: "yes" }))).status).toBe(400);
    m.membership.role = "MEMBER";
    expect((await account.PUT(req("PUT", { enabled: false }))).status).toBe(403);
    expect((await account.DELETE(req("DELETE", { confirm: "DELETE" }))).status).toBe(403);
    expect(m.client.setMemoryEnabled).not.toHaveBeenCalled();
    expect(m.client.purgeTenantMemory).not.toHaveBeenCalled();
  });

  it("a plan without memory says so and reaches no store", async () => {
    m.membership.tenant.planType = "AI_VISIBILITY";
    const r = await (await account.GET(req("GET"))).json();
    expect(r).toMatchObject({ included: false, allowance: { addsPerMonth: 0, maxStored: 0 } });
    expect(m.client.listMemories).not.toHaveBeenCalled();
  });

  it("item delete is scoped: another tenant's id is a 404", async () => {
    m.facts.set("tB", [{ id: "0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10", memory: "B's fact", surface: "mcp" }]);
    const ctx = { params: Promise.resolve({ id: "0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10" }) };
    expect((await accountItem.DELETE(req("DELETE"), ctx)).status).toBe(404);
    expect(m.client.deleteMemory).toHaveBeenCalledWith("tA", "0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10");
    expect(m.facts.get("tB")).toHaveLength(1);
    expect((await accountItem.DELETE(req("DELETE"), { params: Promise.resolve({ id: "../tenant/tB" }) })).status).toBe(404);
  });
});

// ─── MCP: two API keys, two workspaces ───────────────────────────────────────

let rpcId = 0;
async function rpc(key: string, method: string, params?: unknown) {
  const res = await mcp.POST(
    new Request("https://echorank360.com/api/public/v1/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: key },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    }) as never,
  );
  return { status: res.status, body: (await res.json()) as { result?: Record<string, unknown>; error?: unknown } };
}
const call = (key: string, name: string, args: Record<string, unknown>) => rpc(key, "tools/call", { name, arguments: args });
const structured = (r: Awaited<ReturnType<typeof rpc>>) => r.body.result?.structuredContent as Record<string, unknown>;

describe("MCP remember / recall", () => {
  it("handshake: initialize, then both tools are listed with the right posture", async () => {
    const init = await rpc("Bearer key-A", "initialize", { protocolVersion: "2025-06-18" });
    expect(init.status).toBe(200);
    const list = await rpc("Bearer key-A", "tools/list");
    const tools = (list.body.result!.tools as { name: string; annotations: { readOnlyHint: boolean } }[]);
    expect(tools.find((t) => t.name === "remember")?.annotations.readOnlyHint).toBe(false);
    expect(tools.find((t) => t.name === "recall")?.annotations.readOnlyHint).toBe(true);
  });

  it("key A's memories are invisible to key B, even when A names B's tenant", async () => {
    const saved = await call("Bearer key-A", "remember", { text: "Our tone is warm and plain.", tenantId: "tB" });
    expect(structured(saved)).toMatchObject({ queued: true, addsUsed: 1, addsLimit: 10_000 });
    expect(m.addJob).toHaveBeenCalledWith("memory-add", "add", expect.objectContaining({ tenantId: "tA", surface: "mcp" }));
    expect(m.facts.get("tB")).toBeUndefined();

    const a = await call("Bearer key-A", "recall", { query: "tone" });
    expect((structured(a).memories as { memory: string }[]).map((x) => x.memory)).toEqual(["Our tone is warm and plain."]);
    const b = await call("Bearer key-B", "recall", { query: "tone", tenantId: "tA" });
    expect(structured(b)).toMatchObject({ available: true, memories: [] });
    expect(m.client.searchMemories).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: "tB" }));
  });

  it("an unknown key gets nothing", async () => {
    expect((await call("Bearer nope", "recall", { query: "tone" })).status).toBe(401);
  });

  it("remember refuses, as a tool error, when memory is off, the month is used up, or the plan lacks it", async () => {
    m.enabled.set("tA", false);
    let r = await call("Bearer key-A", "remember", { text: "Tone is plain." });
    expect(r.body.result).toMatchObject({ isError: true });
    expect(JSON.stringify(r.body.result)).toContain("switched off");
    m.enabled.set("tA", true);

    m.plans.tA = "STARTER";
    m.redisStore.set(`echorank:memory:adds:tA:${new Date().toISOString().slice(0, 7)}`, 500);
    r = await call("Bearer key-A", "remember", { text: "Tone is plain." });
    expect(JSON.stringify(r.body.result)).toContain("allowance (500 adds) is used up");

    m.plans.tA = "AI_VISIBILITY";
    r = await call("Bearer key-A", "recall", { query: "tone" });
    expect(JSON.stringify(r.body.result)).toContain("not included");
    expect(m.addJob).not.toHaveBeenCalled();
  });

  it("bad arguments are a readable tool error", async () => {
    const r = await call("Bearer key-A", "remember", { text: "" });
    expect(r.body.result).toMatchObject({ isError: true });
  });
});
