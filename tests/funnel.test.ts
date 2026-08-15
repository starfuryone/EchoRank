// tests/funnel.test.ts
//
// The White-Label Audit Funnel: the origin allowlist that stands in for the
// CSRF check, the email gate, the monthly quota, tenant isolation on every
// read, the lead write, and the white-label absence assertions.
//
// Prisma, Redis, the sidecar, the mailer and the logger are stubbed; everything
// else is the real code path. Same approach as
// tests/opportunity-scanner-store.test.ts, and for the same reason: this box's
// .env is not readable by the test account and there is no test database, so
// what can be verified without one is verified thoroughly.
//
// ── The two headline properties ────────────────────────────────────────────
//
// 1. THE ORIGIN ALLOWLIST IS THE ONLY THING STANDING WHERE CSRF USED TO BE.
//    src/proxy.ts exempts POST /api/public/funnel/audit from the app-wide host
//    check, so if the allowlist is ever weakened — a loose comparison, a
//    missing-Origin fall-through, an empty list treated as "allow all" — there
//    is nothing behind it. Every one of those failure modes is asserted here
//    as a refusal, not inferred from the fact that the function is called.
//
// 2. NO BRAND STRING REACHES THE EMBED. The whole product promise is that an
//    agency's visitor sees no trace of us. Asserted by reading the actual
//    source of the embed page, its client component and the loader — the same
//    way Prompt 7's outreach PDF is held to its filename contract.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { funnelConfig, funnelLead, tenant, notification, redis, loggerFns, sidecar, mailer } =
  vi.hoisted(() => ({
    funnelConfig: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    funnelLead: { create: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
    redis: { incr: vi.fn(), decr: vi.fn(), expire: vi.fn(), get: vi.fn(), set: vi.fn() },
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sidecar: { sidecarPost: vi.fn() },
    mailer: { sendMail: vi.fn() },
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: { funnelConfig, funnelLead, tenant, notification },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));
vi.mock("@/lib/av-sidecar", () => sidecar);
vi.mock("@/lib/mailer", () => mailer);

import { FUNNEL_KEY_PATTERN, generateFunnelKey, isFunnelKey } from "@/lib/funnel/keys";
import {
  MAX_ORIGINS,
  normalizeOrigin,
  originAllowed,
  validateOriginList,
} from "@/lib/funnel/origins";
import {
  FUNNEL_AUDIT_LIMITS,
  FUNNEL_IP_LIMIT_PER_DAY,
  consumeFunnelIpLimit,
  funnelAuditLimit,
  funnelQuotaKey,
  releaseFunnelAudit,
  reserveFunnelAudit,
} from "@/lib/funnel/quota";
import {
  normalizeFunnelDomain,
  normalizeLeadEmail,
  runFunnelAudit,
} from "@/lib/funnel/audit";
import { normalizeAccentColor, sanitizeBrandingInput } from "@/lib/funnel/branding";
import {
  createFunnel,
  deleteFunnel,
  getFunnel,
  leadsForExport,
  listLeads,
  recordLead,
  updateFunnel,
  LEADS_EXPORT_CAP,
} from "@/lib/funnel/store";
import { LEAD_CSV_COLUMNS } from "@/lib/funnel/csv";
import { toCsv } from "@/lib/csv-export";
import { NOTIFICATION_HREF, NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { NOTIFICATIONS_COPY } from "@/lib/i18n/dashboard";

const TENANT = "tenant_a";
const OTHER = "tenant_b";
const FUNNEL = "funnel_1";

beforeEach(() => {
  vi.clearAllMocks();
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
  redis.decr.mockResolvedValue(0);
  redis.get.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Keys
// ═══════════════════════════════════════════════════════════════════════════

describe("funnel keys", () => {
  it("mints keys that match the pattern every route validates against", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateFunnelKey()).toMatch(FUNNEL_KEY_PATTERN);
    }
  });

  it("refuses anything that could escape a JavaScript string literal", () => {
    // The key is interpolated into /api/public/funnel.js and into the iframe
    // URL. This check IS the XSS control, so the hostile shapes are asserted
    // one by one rather than trusted to the regex being read correctly.
    for (const bad of [
      '"; alert(1); //',
      "ef_" + "z".repeat(32), // right length, not hex
      "ef_" + "0".repeat(31),
      "ef_" + "0".repeat(33),
      "EF_" + "0".repeat(32),
      "ef_0123456789abcdef0123456789abcde<",
      "../../etc/passwd",
      "",
      null,
      undefined,
      12345,
    ]) {
      expect(isFunnelKey(bad), String(bad)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The origin allowlist — the CSRF replacement
// ═══════════════════════════════════════════════════════════════════════════

describe("normalizeOrigin", () => {
  it("normalises to exactly what a browser sends in Origin", () => {
    expect(normalizeOrigin("https://acme.com")).toEqual({ ok: true, origin: "https://acme.com" });
    expect(normalizeOrigin("https://acme.com/")).toEqual({ ok: true, origin: "https://acme.com" });
    expect(normalizeOrigin("  https://ACME.com  ")).toEqual({
      ok: true,
      origin: "https://acme.com",
    });
    // :443 is the scheme default and collapses, so the stored value matches the
    // header a browser will actually send.
    expect(normalizeOrigin("https://acme.com:443")).toEqual({
      ok: true,
      origin: "https://acme.com",
    });
    // A non-default port is part of the origin and is kept.
    expect(normalizeOrigin("https://acme.com:8443")).toEqual({
      ok: true,
      origin: "https://acme.com:8443",
    });
  });

  it("refuses http — the widget captures an email address", () => {
    expect(normalizeOrigin("http://acme.com")).toEqual({ ok: false, reason: "not_https" });
  });

  it("refuses wildcards outright, before URL parsing can launder them", () => {
    // new URL("https://*.acme.com") SUCCEEDS and yields hostname "*.acme.com",
    // which would normalise into an entry that looks saved and can never match.
    for (const bad of ["https://*.acme.com", "https://*", "*://acme.com", "https://acme.*"]) {
      expect(normalizeOrigin(bad), bad).toEqual({ ok: false, reason: "wildcard" });
    }
  });

  it("refuses anything carrying a path, query or fragment", () => {
    expect(normalizeOrigin("https://acme.com/embed")).toEqual({ ok: false, reason: "has_path" });
    expect(normalizeOrigin("https://acme.com/?x=1")).toEqual({ ok: false, reason: "has_path" });
    expect(normalizeOrigin("https://acme.com/#a")).toEqual({ ok: false, reason: "has_path" });
  });

  it("refuses embedded credentials", () => {
    expect(normalizeOrigin("https://u:p@acme.com")).toEqual({
      ok: false,
      reason: "has_credentials",
    });
  });

  it("refuses non-http schemes and junk", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "acme.com", "", "   "]) {
      expect(normalizeOrigin(bad).ok, bad).toBe(false);
    }
  });
});

describe("validateOriginList", () => {
  it("returns every rejection rather than silently dropping it", () => {
    const { origins, rejected } = validateOriginList([
      "https://acme.com",
      "http://insecure.com",
      "https://*.wild.com",
      "https://acme.com", // duplicate
    ]);
    expect(origins).toEqual(["https://acme.com"]);
    expect(rejected.map((r) => r.reason)).toEqual(["not_https", "wildcard", "duplicate"]);
  });

  it("caps the list — a long enough allowlist is a wildcard by other means", () => {
    const many = Array.from({ length: MAX_ORIGINS + 5 }, (_, i) => `https://a${i}.com`);
    expect(validateOriginList(many).origins).toHaveLength(MAX_ORIGINS);
  });
});

describe("originAllowed — the CSRF replacement", () => {
  const allowed = ["https://acme.com", "https://shop.acme.com"];

  it("allows an exact registered origin", () => {
    expect(originAllowed("https://acme.com", allowed)).toBe(true);
    expect(originAllowed("https://shop.acme.com", allowed)).toBe(true);
    // Normalised on the way in, so the trailing-slash form still matches.
    expect(originAllowed("https://acme.com/", allowed)).toBe(true);
  });

  it("REFUSES a disallowed origin", () => {
    expect(originAllowed("https://evil.com", allowed)).toBe(false);
    expect(originAllowed("http://acme.com", allowed)).toBe(false);
  });

  it("REFUSES a suffix or prefix collision — the classic allowlist bug", () => {
    // Every one of these would pass a naive endsWith()/includes() check.
    for (const bad of [
      "https://acme.com.evil.test",
      "https://notacme.com",
      "https://acme.com.br",
      "https://evil.com/https://acme.com",
      "https://acme.com:8443",
    ]) {
      expect(originAllowed(bad, allowed), bad).toBe(false);
    }
  });

  it("REFUSES a missing Origin — absence must never be the case that passes", () => {
    expect(originAllowed(null, allowed)).toBe(false);
    expect(originAllowed(undefined, allowed)).toBe(false);
    expect(originAllowed("", allowed)).toBe(false);
  });

  it('REFUSES the literal "null" a sandboxed or opaque document sends', () => {
    expect(originAllowed("null", allowed)).toBe(false);
  });

  it("REFUSES everything when the list is empty — an unconfigured funnel is inert", () => {
    expect(originAllowed("https://acme.com", [])).toBe(false);
    expect(originAllowed(null, [])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The email gate
// ═══════════════════════════════════════════════════════════════════════════

describe("normalizeLeadEmail — the gate in front of the score", () => {
  it("accepts and lowercases a normal address", () => {
    expect(normalizeLeadEmail("  Someone@Acme.COM ")).toBe("someone@acme.com");
    expect(normalizeLeadEmail("a.b+tag@sub.acme.co.uk")).toBe("a.b+tag@sub.acme.co.uk");
  });

  it("refuses anything that is not email-shaped — no address, no score", () => {
    for (const bad of [
      "",
      "   ",
      "acme.com",
      "@acme.com",
      "someone@",
      "someone@acme",
      "two@@acme.com",
      "spaces in@acme.com",
      "someone@acme .com",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(normalizeLeadEmail(bad), String(bad)).toBeNull();
    }
  });

  it("bounds the length so a pasted paragraph cannot become a row", () => {
    expect(normalizeLeadEmail(`${"a".repeat(250)}@acme.com`)).toBeNull();
  });
});

describe("normalizeFunnelDomain", () => {
  it("reduces every shape of the same site to one registrable domain", () => {
    for (const input of ["acme.com", "www.acme.com", "https://acme.com/pricing?x=1"]) {
      expect(normalizeFunnelDomain(input), input).toBe("acme.com");
    }
  });

  it("refuses the SSRF targets — this box runs the sidecar on 127.0.0.1", () => {
    for (const bad of [
      "127.0.0.1",
      "localhost",
      "169.254.169.254",
      "10.0.0.5",
      "192.168.1.1",
      "http://127.0.0.1:4500/audit",
      "file:///etc/passwd",
      "not a domain",
      "",
      null,
      undefined,
    ]) {
      expect(normalizeFunnelDomain(bad), String(bad)).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Quota
// ═══════════════════════════════════════════════════════════════════════════

describe("funnel audit quota", () => {
  it("is exhaustive over PlanType and zero below Agency", () => {
    expect(FUNNEL_AUDIT_LIMITS.AI_VISIBILITY).toBe(0);
    expect(FUNNEL_AUDIT_LIMITS.STARTER).toBe(0);
    expect(FUNNEL_AUDIT_LIMITS.GROWTH).toBe(0);
    expect(FUNNEL_AUDIT_LIMITS.AGENCY).toBeGreaterThan(0);
    expect(FUNNEL_AUDIT_LIMITS.ENTERPRISE).toBeGreaterThan(FUNNEL_AUDIT_LIMITS.AGENCY);
  });

  it("keys the counter by tenant and UTC month, so it self-cleans", () => {
    expect(funnelQuotaKey(TENANT, new Date("2026-08-15T12:00:00Z"))).toBe(
      `echorank:funnel:audits:${TENANT}:2026-08`,
    );
    expect(funnelQuotaKey(TENANT, new Date("2026-01-01T00:00:00Z"))).toBe(
      `echorank:funnel:audits:${TENANT}:2026-01`,
    );
  });

  it("INCRs first and sets a TTL past the longest month", async () => {
    redis.incr.mockResolvedValue(3);
    const decision = await reserveFunnelAudit(TENANT, "AGENCY");
    expect(decision).toMatchObject({ allowed: true, used: 3 });
    expect(redis.incr).toHaveBeenCalledWith(funnelQuotaKey(TENANT));
    const [, ttl] = redis.expire.mock.calls[0];
    expect(ttl).toBeGreaterThan(31 * 24 * 60 * 60);
  });

  it("rolls the INCR back when it went over — read-then-write would race", async () => {
    redis.incr.mockResolvedValue(FUNNEL_AUDIT_LIMITS.AGENCY + 1);
    const decision = await reserveFunnelAudit(TENANT, "AGENCY");
    expect(decision.allowed).toBe(false);
    expect(redis.decr).toHaveBeenCalledWith(funnelQuotaKey(TENANT));
  });

  it("refuses a plan with no allowance at all", async () => {
    redis.incr.mockResolvedValue(1);
    expect((await reserveFunnelAudit(TENANT, "GROWTH")).allowed).toBe(false);
    expect(funnelAuditLimit("GROWTH")).toBe(0);
  });

  // FAILS CLOSED. This is an anonymous endpoint that fans out to the sidecar;
  // "fail open" here means "fail expensive".
  it("refuses when Redis is unreachable rather than serving uncapped", async () => {
    redis.incr.mockRejectedValue(new Error("ECONNREFUSED"));
    const decision = await reserveFunnelAudit(TENANT, "AGENCY");
    expect(decision.allowed).toBe(false);
    expect(decision.unavailable).toBe(true);
  });

  it("gives a slot back when the audit never ran", async () => {
    await releaseFunnelAudit(TENANT);
    expect(redis.decr).toHaveBeenCalledWith(funnelQuotaKey(TENANT));
  });

  it("never turns a failed rollback into a failed request", async () => {
    redis.decr.mockRejectedValue(new Error("down"));
    await expect(releaseFunnelAudit(TENANT)).resolves.toBeUndefined();
  });
});

describe("per key+IP burst limit", () => {
  it("keys on the funnel AND the IP together", async () => {
    redis.incr.mockResolvedValue(1);
    await consumeFunnelIpLimit("ef_abc", "9.9.9.9", new Date("2026-08-15T10:00:00Z"));
    expect(redis.incr).toHaveBeenCalledWith("echorank:funnel:ip:ef_abc:2026-08-15:9.9.9.9");
  });

  it("refuses past the daily allowance", async () => {
    redis.incr.mockResolvedValue(FUNNEL_IP_LIMIT_PER_DAY + 1);
    expect((await consumeFunnelIpLimit("ef_abc", "9.9.9.9")).ok).toBe(false);
  });

  it("fails closed when Redis is down", async () => {
    redis.incr.mockRejectedValue(new Error("down"));
    expect((await consumeFunnelIpLimit("ef_abc", "9.9.9.9")).ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The audit call
// ═══════════════════════════════════════════════════════════════════════════

describe("runFunnelAudit", () => {
  it("uses the same internal sidecar path as the free audit", async () => {
    sidecar.sidecarPost.mockResolvedValue({
      status: 200,
      data: { score: 72, checks: [["schema", 2, 10, "fail", "Add JSON-LD"]] },
    });

    const result = await runFunnelAudit("acme.com");
    expect(sidecar.sidecarPost).toHaveBeenCalledWith(
      "/audit",
      { url: "acme.com", crawl: false },
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(result).toEqual({
      ok: true,
      summary: {
        score: 72,
        grade: "B",
        gaps: [{ category: "schema", status: "fail", recommendation: "Add JSON-LD", lost: 8 }],
      },
    });
  });

  it("never fabricates a score when the sidecar is unhappy", async () => {
    for (const response of [
      { status: 502, data: { error: "unavailable" } },
      { status: 200, data: {} },
      { status: 200, data: { score: "72" } },
      { status: 200, data: { score: NaN } },
      { status: 200, data: { score: Infinity } },
    ]) {
      sidecar.sidecarPost.mockResolvedValue(response);
      expect(await runFunnelAudit("acme.com")).toEqual({ ok: false, reason: "audit_failed" });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Branding
// ═══════════════════════════════════════════════════════════════════════════

describe("branding input", () => {
  it("accepts only a real hex colour — this value is interpolated into CSS", () => {
    expect(normalizeAccentColor("#AABBCC")).toBe("#aabbcc");
    expect(normalizeAccentColor("#abc")).toBe("#aabbcc");
    for (const bad of [
      "red",
      "#12",
      "#1234567",
      "#gggggg",
      "rgb(1,2,3)",
      "#aabbcc; } body { display:none",
      "expression(alert(1))",
      null,
      42,
    ]) {
      expect(normalizeAccentColor(bad), String(bad)).toBeNull();
    }
  });

  it("stores only http(s) logo URLs — never a javascript: or data: payload", () => {
    expect(sanitizeBrandingInput({ logoUrl: "https://cdn.acme.com/l.svg" }).logoUrl).toBe(
      "https://cdn.acme.com/l.svg",
    );
    for (const bad of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==",
      "file:///etc/passwd",
      "//evil.com/l.svg",
      "",
    ]) {
      expect(sanitizeBrandingInput({ logoUrl: bad }).logoUrl, bad).toBeNull();
    }
  });

  it("bounds the display name so it cannot break the widget's layout", () => {
    expect(sanitizeBrandingInput({ name: "x".repeat(500) }).name).toHaveLength(60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tenant isolation — every read
// ═══════════════════════════════════════════════════════════════════════════

describe("tenant isolation", () => {
  it("getFunnel scopes on tenantId, never findUnique on the id alone", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    await getFunnel(TENANT, FUNNEL);
    expect(funnelConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FUNNEL, tenantId: TENANT } }),
    );
    // The unscoped read must not be reachable from this path at all.
    expect(funnelConfig.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for another tenant's funnel rather than throwing", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    expect(await getFunnel(OTHER, FUNNEL)).toBeNull();
  });

  it("updateFunnel proves ownership before it writes", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    expect(await updateFunnel(OTHER, FUNNEL, { active: false })).toBeNull();
    expect(funnelConfig.update).not.toHaveBeenCalled();
  });

  it("updateFunnel never lets a patch rotate the embed key", async () => {
    funnelConfig.findFirst.mockResolvedValue({ id: FUNNEL });
    funnelConfig.update.mockResolvedValue({ id: FUNNEL });
    // `key` is not in UpdateFunnelInput; even smuggled through it must not be
    // written, because rotating it silently breaks every live <script> tag.
    await updateFunnel(TENANT, FUNNEL, { key: "ef_" + "f".repeat(32) } as never);
    expect(funnelConfig.update.mock.calls[0][0].data).not.toHaveProperty("key");
  });

  it("deleteFunnel proves ownership before it cascades", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    expect(await deleteFunnel(OTHER, FUNNEL)).toBe(false);
    expect(funnelConfig.delete).not.toHaveBeenCalled();
  });

  it("listLeads filters on tenantId as well as funnelId", async () => {
    funnelConfig.findFirst.mockResolvedValue({ id: FUNNEL });
    funnelLead.findMany.mockResolvedValue([]);
    await listLeads(TENANT, FUNNEL);
    expect(funnelLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { funnelId: FUNNEL, tenantId: TENANT } }),
    );
  });

  it("listLeads refuses outright for a funnel this tenant does not own", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    expect(await listLeads(OTHER, FUNNEL)).toBeNull();
    expect(funnelLead.findMany).not.toHaveBeenCalled();
  });

  it("leadsForExport refuses outright for another tenant's funnel", async () => {
    funnelConfig.findFirst.mockResolvedValue(null);
    expect(await leadsForExport(OTHER, FUNNEL)).toBeNull();
    expect(funnelLead.findMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The lead write
// ═══════════════════════════════════════════════════════════════════════════

describe("recordLead", () => {
  it("stores the captured email against the owning tenant", async () => {
    funnelLead.create.mockResolvedValue({ id: "lead_1", createdAt: new Date() });
    await recordLead({
      tenantId: TENANT,
      funnelId: FUNNEL,
      email: "someone@acme.com",
      domain: "acme.com",
      summary: { score: 72, grade: "B", gaps: [] },
      ip: "9.9.9.9",
    });
    expect(funnelLead.create.mock.calls[0][0].data).toMatchObject({
      tenantId: TENANT,
      funnelId: FUNNEL,
      email: "someone@acme.com",
      domain: "acme.com",
      score: 72,
      ip: "9.9.9.9",
    });
  });

  // THE EMAIL IS THE PRODUCT. A funnel that captured an address for a site the
  // sidecar could not reach is still a lead, and losing it would throw away the
  // only thing the agency is paying for.
  it("still writes the lead when the audit failed, with a NULL score", async () => {
    funnelLead.create.mockResolvedValue({ id: "lead_2", createdAt: new Date() });
    await recordLead({
      tenantId: TENANT,
      funnelId: FUNNEL,
      email: "someone@acme.com",
      domain: "acme.com",
      summary: null,
      ip: null,
    });
    const { data } = funnelLead.create.mock.calls[0][0];
    expect(data.email).toBe("someone@acme.com");
    // Null, never 0 — "we could not reach the site" is not "the site scored 0".
    expect(data.score).toBeNull();
  });
});

describe("createFunnel", () => {
  it("mints a valid key and stores the validated origin list", async () => {
    funnelConfig.create.mockResolvedValue({ id: FUNNEL });
    await createFunnel({
      tenantId: TENANT,
      label: "Acme",
      allowedOrigins: ["https://acme.com"],
      branding: { name: "Acme", logoUrl: null, accentColor: "#112233" },
      notifyEmail: "sales@acme.com",
    });
    const { data } = funnelConfig.create.mock.calls[0][0];
    expect(data.key).toMatch(FUNNEL_KEY_PATTERN);
    expect(data.tenantId).toBe(TENANT);
    expect(data.allowedOrigins).toEqual(["https://acme.com"]);
  });

  it("never creates a funnel with a blank label", async () => {
    funnelConfig.create.mockResolvedValue({ id: FUNNEL });
    await createFunnel({
      tenantId: TENANT,
      label: "   ",
      allowedOrigins: [],
      branding: {},
      notifyEmail: null,
    });
    expect(funnelConfig.create.mock.calls[0][0].data.label).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSV export
// ═══════════════════════════════════════════════════════════════════════════

describe("lead CSV", () => {
  const rows = [
    {
      email: "someone@acme.com",
      domain: "acme.com",
      score: 72,
      createdAt: new Date("2026-08-15T10:00:00Z"),
    },
  ];

  it("writes the BOM and CRLF so Excel reads it correctly", () => {
    const csv = toCsv(rows, LEAD_CSV_COLUMNS);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  // These cells came from a stranger typing into a public form — the highest
  // risk of formula injection anywhere in the app.
  it("neutralises a formula smuggled in through the email field", () => {
    const csv = toCsv(
      [{ ...rows[0], email: "=HYPERLINK(\"http://evil\",\"click\")" }],
      LEAD_CSV_COLUMNS,
    );
    expect(csv).toContain("'=HYPERLINK");
  });

  it("leaves the score a real number so the column stays sortable", () => {
    expect(toCsv(rows, LEAD_CSV_COLUMNS)).toContain(",72,");
  });

  it("renders a missing score as an empty cell, never as a zero", () => {
    const csv = toCsv([{ ...rows[0], score: null }], LEAD_CSV_COLUMNS);
    expect(csv).not.toContain(",0,");
    expect(csv).toContain(",,");
  });

  it("announces truncation rather than cutting silently", async () => {
    funnelConfig.findFirst.mockResolvedValue({ id: FUNNEL, label: "Acme" });
    funnelLead.findMany.mockResolvedValue(
      Array.from({ length: LEADS_EXPORT_CAP + 1 }, (_, i) => ({
        id: `l${i}`,
        email: `a${i}@acme.com`,
        domain: "acme.com",
        score: 50,
        createdAt: new Date(),
      })),
    );
    const result = await leadsForExport(TENANT, FUNNEL);
    expect(result?.truncated).toBe(true);
    expect(result?.rows).toHaveLength(LEADS_EXPORT_CAP);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notification registration — four places
// ═══════════════════════════════════════════════════════════════════════════

describe("funnel_lead notification", () => {
  it("is registered in the type list, the href map and all three catalogs", () => {
    expect(NOTIFICATION_TYPES).toContain("funnel_lead");
    expect(NOTIFICATION_HREF.funnel_lead).toBe("/visibility/tools/funnels");
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const copy = NOTIFICATIONS_COPY[locale].types.funnel_lead;
      expect(copy.title, locale).toBeTruthy();
      expect(copy.label, locale).toBeTruthy();
    }
  });

  // The row is tenant-wide, so it renders for every member of the agency. The
  // captured address belongs in the table, not in the tray.
  it("never puts the lead's email address in the rendered copy", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const copy = NOTIFICATIONS_COPY[locale].types.funnel_lead;
      expect(`${copy.title} ${copy.body}`, locale).not.toContain("{email}");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHITE LABEL — the absence assertions
// ═══════════════════════════════════════════════════════════════════════════

describe("white-label contract", () => {
  const root = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  /**
   * The surfaces a visitor on the agency's site can actually observe: the page
   * they see, the component that draws it, and the script in their view-source.
   */
  const EMBED_SOURCES = [
    "src/app/embed/audit/page.tsx",
    "src/components/funnel/embed-audit-client.tsx",
    "src/app/api/public/funnel.js/route.ts",
  ];

  /**
   * Comments are stripped before matching. Every one of these files EXPLAINS the
   * white-label contract at length and necessarily names the brand while doing
   * so; what must not carry it is the code that produces output.
   */
  function code(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  it.each(EMBED_SOURCES)("%s emits no brand string", (path) => {
    const body = code(read(path));
    expect(body).not.toMatch(/Echorank/i);
    expect(body).not.toMatch(/echorank360/i);
  });

  it("the embed page overrides the root layout's branded title template", () => {
    // The root layout appends "| Echorank360" to any bare string title and
    // carries a branded default description. Both reach the DOM inside the
    // iframe unless the page sets an ABSOLUTE title and its own description.
    const page = read("src/app/embed/audit/page.tsx");
    expect(page).toMatch(/title:\s*\{\s*absolute:/);
    expect(page).toMatch(/description:/);
  });

  it("the embed page is noindex — it is a widget, not a destination", () => {
    expect(read("src/app/embed/audit/page.tsx")).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("the embed renders no footer and imports no shared chrome", () => {
    for (const path of EMBED_SOURCES) {
      const body = read(path);
      expect(body, path).not.toMatch(/from "@\/components\/layout\//);
      expect(body, path).not.toMatch(/<Footer|<SiteHeader|<Navbar/);
    }
  });

  it("the loader carries no branded banner comment, unlike attribution.js", () => {
    // attribution.js deliberately opens with an "Echorank360 AI attribution"
    // banner that lands in the customer's view-source. This one must not: the
    // agency's visitor reading page source is part of what they see.
    const loader = read("src/app/api/public/funnel.js/route.ts");
    const emitted = loader.slice(loader.indexOf("function loader"));
    expect(emitted).not.toMatch(/Echorank/i);
  });

  it("the logo is rendered in an <img>, never inline <svg> or <object>", () => {
    // branding.ts returns an SVG data: URI from a URL a customer typed. Inside
    // <img> browsers disable scripting and external fetches; inline <svg> or
    // <object> would execute it.
    // Comments stripped: the file EXPLAINS this rule and names the tags it
    // forbids while doing so.
    const client = code(read("src/components/funnel/embed-audit-client.tsx"));
    expect(client).toMatch(/<img\b[\s\S]*?src=\{branding\.logoDataUri\}/);
    expect(client).not.toMatch(/<object|<embed\b|dangerouslySetInnerHTML/);
  });

  it("the lead CSV filename is ours, and that is deliberate", () => {
    // This file is downloaded by the AGENCY, not handed to a prospect — the
    // white-label filename rule applies to outreach artifacts a stranger
    // receives. Asserted so the distinction is not "fixed" by mistake.
    const route = read("src/app/api/agency/funnels/[id]/leads/export/route.ts");
    expect(route).toMatch(/csvFilename\("funnel-leads"\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Proxy wiring — the two paths that break silently without it
// ═══════════════════════════════════════════════════════════════════════════

describe("proxy wiring", () => {
  const proxy = readFileSync(join(__dirname, "..", "src", "proxy.ts"), "utf8");

  it("exempts the capture endpoint from the host CSRF check", () => {
    // Without this every legitimate call — all of which are cross-origin — is
    // rejected 403 before the route's own allowlist ever runs.
    expect(proxy).toContain('pathname !== "/api/public/funnel/audit"');
  });

  it("marks the capture endpoint and the embed page public, by EXACT match", () => {
    // A prefix entry would hand anonymous access to anything added later under
    // /api/public/funnel/ or /embed/.
    expect(proxy).toContain('"/api/public/funnel/audit"');
    expect(proxy).toContain('"/embed/audit"');
    expect(proxy).not.toContain('"/embed/"');
    expect(proxy).not.toContain('"/api/public/funnel/"');
  });
});
