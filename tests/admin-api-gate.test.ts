// tests/admin-api-gate.test.ts
//
// /api/admin/* is staff only (PLATFORM_ADMIN_EMAILS), at two layers:
//   - the REAL proxy (src/proxy.ts default export) answers 403 before any
//     route runs, signed out included;
//   - every route under src/app/api/admin calls requirePlatformAdminApi(),
//     because the proxy waves through any /api/ request carrying the
//     internal secret.
// A tenant OWNER is not staff: until this gate, /api/admin/queues answered
// any tenant's OWNER/ADMIN with every queue's counts.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Session = { user: { id: string; email: string } } | null;
let session: Session = null;

// One mock for both shapes of NextAuth's `auth`: the proxy's wrapper
// (auth(handler)) and a route's session read (auth()).
vi.mock("@/lib/auth", () => ({
  auth: (handler?: unknown) => {
    if (typeof handler === "function") {
      return (req: NextRequest & { auth?: Session }, ev: unknown) => {
        req.auth = session;
        return handler(req, ev);
      };
    }
    return Promise.resolve(session);
  },
}));

vi.mock("@/infrastructure/queue/registry", () => ({
  getQueue: () => ({ getJobCounts: async () => ({ waiting: 0, active: 0, failed: 2 }) }),
}));
vi.mock("@/infrastructure/redis/config", () => ({ QUEUE_NAMES: ["visibility-monitoring"] }));
vi.mock("@/infrastructure/queue/failure-alert", () => ({ alertRedis: () => ({}) }));
vi.mock("@/lib/queue-alerts", () => ({ queueAlertStatus: async () => ({ lastRun: null }) }));

import proxy from "@/proxy";
import { GET as queuesGET } from "@/app/api/admin/queues/route";
import { isAdminApiPath, isPlatformAdminEmail } from "@/lib/platform-admin-emails";

const STAFF = { user: { id: "u_staff", email: "Staff@Echorank360.com" } };
const OWNER = { user: { id: "u_owner", email: "owner@tenant.example" } };

beforeEach(() => {
  vi.stubEnv("PLATFORM_ADMIN_EMAILS", " ops@echorank360.com , staff@echorank360.com ");
});
afterEach(() => {
  vi.unstubAllEnvs();
  session = null;
});

async function viaProxy(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const req = new NextRequest(new URL(path, "https://echorank360.com"), { method: init.method ?? "GET", headers: init.headers });
  const res = await proxy(req, undefined as never);
  return {
    status: res?.status ?? 200,
    location: res?.headers.get("location") ?? null,
    next: res?.headers.get("x-middleware-next") ?? null,
    body: res && res.headers.get("content-type")?.includes("json") ? await res.json() : null,
  };
}

describe("allowlist", () => {
  it("is case- and space-insensitive, and empty means nobody", () => {
    expect(isPlatformAdminEmail("STAFF@echorank360.com")).toBe(true);
    expect(isPlatformAdminEmail("owner@tenant.example")).toBe(false);
    expect(isPlatformAdminEmail(null)).toBe(false);
    expect(isPlatformAdminEmail("staff@echorank360.com", {} as NodeJS.ProcessEnv)).toBe(false);
    expect(isPlatformAdminEmail("", { PLATFORM_ADMIN_EMAILS: "," } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("covers /api/admin and below, not look-alikes", () => {
    expect(isAdminApiPath("/api/admin")).toBe(true);
    expect(isAdminApiPath("/api/admin/queues")).toBe(true);
    expect(isAdminApiPath("/api/admin/anything/new")).toBe(true);
    expect(isAdminApiPath("/api/administrator")).toBe(false);
    expect(isAdminApiPath("/api/av/audit-admin")).toBe(false);
  });
});

describe("the proxy", () => {
  it.each(["/api/admin/queues", "/api/admin/not-yet-written", "/api/admin"])("403s %s signed out (no 307 to /login)", async (path) => {
    const res = await viaProxy(path);
    expect(res.status).toBe(403);
    expect(res.location).toBeNull();
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("403s a signed-in tenant owner who is not staff", async () => {
    session = OWNER;
    expect((await viaProxy("/api/admin/queues")).status).toBe(403);
  });

  it("403s staff too when the allowlist is unset", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    session = STAFF;
    expect((await viaProxy("/api/admin/queues")).status).toBe(403);
  });

  it("lets staff through to the route", async () => {
    session = STAFF;
    const res = await viaProxy("/api/admin/queues");
    expect(res.status).toBe(200);
    expect(res.next).toBe("1");
  });

  it("leaves non-admin routes alone: a signed-in owner still reaches them", async () => {
    session = OWNER;
    expect((await viaProxy("/api/team")).next).toBe("1");
  });
});

describe("GET /api/admin/queues (the route's own check)", () => {
  it("403s signed out and a tenant owner — the internal-secret bypass skips the proxy", async () => {
    expect((await queuesGET()).status).toBe(403);
    session = OWNER;
    const res = await queuesGET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("answers staff with every queue, and no tenant id", async () => {
    session = STAFF;
    const res = await queuesGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queues).toEqual([{ name: "visibility-monitoring", waiting: 0, active: 0, failed: 2 }]);
    expect(body.failedTotal).toBe(2);
    expect(body).not.toHaveProperty("tenantId");
  });
});

describe("every route under src/app/api/admin", () => {
  const root = join(process.cwd(), "src/app/api/admin");
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^route\.(ts|tsx|js)$/.test(f)) routes.push(p);
    }
  };
  walk(root);

  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((p) => [relative(process.cwd(), p), p]))("%s gates every handler on requirePlatformAdminApi()", (_name, p) => {
    const src = readFileSync(p, "utf8");
    const handlers = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]);
    // `export const GET = …` would dodge the per-function count below.
    expect(src).not.toMatch(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/);
    expect(handlers.length).toBeGreaterThan(0);
    // Each handler body, from its `export` to the next one, calls the gate first.
    const bodies = src.split(/(?=export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b)/).slice(1);
    for (const body of bodies) {
      expect(body).toMatch(/^export[^{]*\{\s*const (\w+) = await requirePlatformAdminApi\(\);\s*if \(\1 instanceof NextResponse\) return \1;/);
    }
    // A tenant role is not staff.
    expect(src).not.toMatch(/requireRole|requireTenant/);
  });
});
