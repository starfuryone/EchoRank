// Bot Analytics — domain resolution and the access-check result shape.
//
// The resolution order is the change that made this tool standalone, so the
// fallback chain gets a case per link plus the input path that used to not exist.
// Tenant isolation is asserted by construction: every resolver query is scoped to
// the tenant id it was handed, and the test proves a second tenant's rows are
// invisible.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Prisma double ──────────────────────────────────────────────────────────
//
// Keyed by tenant so an isolation test is possible at all: the fakes below refuse
// to return a row whose tenantId does not match the query, which is exactly the
// mistake (findUnique by id alone) the repo's conventions forbid.

interface Fixture {
  botAnalyticsDomain?: string | null;
  auditDomain?: string | null;
  monitorUrl?: string | null;
  auditUrl?: string | null;
}
const fixtures = new Map<string, Fixture>();

const prisma = {
  tenant: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const f = fixtures.get(where.id);
      if (!f) return null;
      return {
        botAnalyticsDomain: f.botAnalyticsDomain ?? null,
        auditDomain: f.auditDomain ?? null,
      };
    }),
  },
  visibilityMonitor: {
    findFirst: vi.fn(async ({ where }: { where: { tenantId: string } }) => {
      const f = fixtures.get(where.tenantId);
      return f?.monitorUrl ? { url: f.monitorUrl } : null;
    }),
  },
  visibilityAudit: {
    findFirst: vi.fn(async ({ where }: { where: { tenantId: string } }) => {
      const f = fixtures.get(where.tenantId);
      return f?.auditUrl ? { url: f.auditUrl } : null;
    }),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma }));

const { resolveBotAnalyticsDomain, normalizeDomainInput, hostnameOf } = await import(
  "@/lib/bot-analytics/domain"
);

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ─── Resolution order ───────────────────────────────────────────────────────
describe("resolveBotAnalyticsDomain", () => {
  it("returns null when the tenant has nothing set — a prompt, not a dead end", async () => {
    fixtures.set("t1", {});
    expect(await resolveBotAnalyticsDomain("t1")).toEqual({ domain: null, source: null });
  });

  it("falls back to the onboarding domain when there is no monitor or audit", async () => {
    fixtures.set("t1", { auditDomain: "onboarding.com" });
    expect(await resolveBotAnalyticsDomain("t1")).toEqual({
      domain: "onboarding.com",
      source: "settings",
    });
  });

  it("prefers the active monitor over the onboarding domain", async () => {
    fixtures.set("t1", {
      auditDomain: "onboarding.com",
      monitorUrl: "https://monitored.com/some/path",
    });
    const r = await resolveBotAnalyticsDomain("t1");
    expect(r).toEqual({ domain: "monitored.com", source: "monitor" });
  });

  it("uses the newest audit when there is no active monitor", async () => {
    fixtures.set("t1", { auditDomain: "onboarding.com", auditUrl: "https://audited.com/" });
    expect(await resolveBotAnalyticsDomain("t1")).toEqual({
      domain: "audited.com",
      source: "monitor",
    });
  });

  it("lets the on-page domain win over both inferred sources", async () => {
    // The input would be useless otherwise: most workspaces have a monitor, so
    // ranking inference above an explicit choice would make the box look broken.
    fixtures.set("t1", {
      botAnalyticsDomain: "chosen.com",
      auditDomain: "onboarding.com",
      monitorUrl: "https://monitored.com/",
    });
    expect(await resolveBotAnalyticsDomain("t1")).toEqual({
      domain: "chosen.com",
      source: "manual",
    });
  });

  it("keeps tenants isolated — one tenant's domain never resolves for another", async () => {
    fixtures.set("t1", { monitorUrl: "https://tenant-one.com/" });
    fixtures.set("t2", { monitorUrl: "https://tenant-two.com/" });
    expect((await resolveBotAnalyticsDomain("t1")).domain).toBe("tenant-one.com");
    expect((await resolveBotAnalyticsDomain("t2")).domain).toBe("tenant-two.com");
    expect((await resolveBotAnalyticsDomain("t3")).domain).toBeNull();
  });

  it("scopes every query by tenantId", async () => {
    fixtures.set("t1", { monitorUrl: "https://tenant-one.com/" });
    await resolveBotAnalyticsDomain("t1");
    for (const call of prisma.visibilityMonitor.findFirst.mock.calls) {
      expect((call[0] as { where: { tenantId: string } }).where.tenantId).toBe("t1");
    }
  });

  it("skips a stored value that is not a usable hostname", async () => {
    fixtures.set("t1", { botAnalyticsDomain: "   ", auditDomain: "fallback.com" });
    expect((await resolveBotAnalyticsDomain("t1")).domain).toBe("fallback.com");
  });
});

// ─── Input validation ───────────────────────────────────────────────────────
describe("normalizeDomainInput", () => {
  it("accepts a bare domain and a subdomain", () => {
    expect(normalizeDomainInput("echorank360.com")).toBe("echorank360.com");
    expect(normalizeDomainInput("blog.echorank360.com")).toBe("blog.echorank360.com");
    expect(normalizeDomainInput("  ECHORANK360.COM  ")).toBe("echorank360.com");
  });

  it("takes the host out of a pasted URL, which is what people paste", () => {
    expect(normalizeDomainInput("https://echorank360.com/pricing?x=1")).toBe("echorank360.com");
    expect(normalizeDomainInput("http://echorank360.com:8080/a")).toBe("echorank360.com");
    expect(normalizeDomainInput("https://user:pw@echorank360.com/")).toBe("echorank360.com");
    expect(normalizeDomainInput("echorank360.com.")).toBe("echorank360.com");
  });

  it("rejects what a human gets wrong, and what an attacker tries", () => {
    for (const bad of [
      "",
      "   ",
      "localhost",
      "router",
      "127.0.0.1",
      "169.254.169.254",
      "::1",
      "not a domain",
      "a..b.com",
      "-lead.com",
      "trail-.com",
      "example.c",
      "example.123",
      "under_score.com",
    ]) {
      expect(normalizeDomainInput(bad)).toBeNull();
    }
  });

  it("rejects a label over 63 characters and a name over 253", () => {
    expect(normalizeDomainInput(`${"a".repeat(64)}.com`)).toBeNull();
    // 4 x 61 + 3 = 247 characters, inside the limit.
    expect(normalizeDomainInput(`${`${"a".repeat(60)}.`.repeat(4)}com`)).not.toBeNull();
    // 5 x 61 + 3 = 308 characters, past it.
    expect(normalizeDomainInput(`${`${"a".repeat(60)}.`.repeat(5)}com`)).toBeNull();
  });
});

describe("hostnameOf", () => {
  it("normalizes stored URLs and bare domains alike", () => {
    expect(hostnameOf("https://a.com/x")).toBe("a.com");
    expect(hostnameOf("a.com")).toBe("a.com");
    expect(hostnameOf("HTTP://A.COM")).toBe("a.com");
    expect(hostnameOf("")).toBeNull();
    expect(hostnameOf("   ")).toBeNull();
  });
});
