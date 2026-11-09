// The Link Authority Checker (paid since 2026-11-09): input, copy rules, the
// DataForSEO purchases metered to the tenant and their cache, the landing page
// (no form, no API call), its registration, and the upgrade screen a free
// tenant gets. The route and the monthly allowance:
// tests/authority-checker-routes.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Redis (GET / SET) ──────────────────────────────────────────────────────
const kv = vi.hoisted(() => new Map<string, string>());
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    get: async (k: string) => kv.get(k) ?? null,
    set: async (k: string, v: string) => {
      kv.set(k, v);
      return "OK";
    },
  }),
}));

// ─── DataForSEO: the live call and the ledger row it writes ─────────────────
const upstream = vi.hoisted(() => ({
  calls: [] as { path: string; task: Record<string, unknown> }[],
  rows: [] as Record<string, unknown>[],
  respond: ((): unknown => []) as (path: string) => unknown,
}));
vi.mock("@/lib/dataforseo/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dataforseo/client")>()),
  archivedResult: async () => null,
  postTask: async (path: string, task: Record<string, unknown>) => {
    upstream.calls.push({ path, task });
    return { data: upstream.respond(path), billing: { path: path.split("/"), costUsd: 0.024 } };
  },
}));
vi.mock("@/lib/dataforseo/metering", async (orig) => ({
  ...(await orig<typeof import("@/lib/dataforseo/metering")>()),
  recordCall: async (row: Record<string, unknown>) => {
    upstream.rows.push(row);
  },
}));

// ─── The session, for the tools layout ──────────────────────────────────────
const who = vi.hoisted(() => ({ member: null as null | { tenantId: string; tenant: { planType: string } }, status: "NONE" }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => who.member }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: async () => null },
    tenant: { findUnique: async () => ({ billingStatus: who.status }) },
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { AUTHORITY_SLUG, LINK_AUTHORITY_SRC, LINK_AUTHORITY_TOOL_PATH } from "@/lib/authority-checker/config";
import { normalizeCheck, parseDomainInput } from "@/lib/authority-checker/domains";
import { AUTHORITY_COPY, authorityLocale, type AuthorityCopy } from "@/lib/authority-checker/copy";
import {
  LINK_AUTHORITY_FEATURE,
  buyLinks,
  buyRanks,
  buyRefDomains,
  cachedLinks,
  cachedRanks,
  linksFromSummary,
  parseBulkRanks,
  refDomainsFromResult,
} from "@/lib/authority-checker/data";
import { linkAuthorityFromPrice } from "@/lib/authority-checker/pricing";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { OWN_CAP_FEATURES } from "@/lib/dataforseo/metering";
import { isSeoSearchFeature } from "@/lib/seo-quota";
import { FREE_TOOLS, ctaHref, freeToolById, freeToolRoutes, hubFreeTools, paidFreeTools } from "@/lib/free-tools";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import { SEO_TOOLS_COPY, dashNav } from "@/lib/i18n/dashboard";
import { TOOL_COPY } from "@/app/[locale]/free-tools/_shared/copy";
import Page from "@/app/[locale]/free-tools/authority-checker/page";
import HubPage from "@/app/[locale]/free-tools/page";
import SeoToolsLayout from "@/app/(dashboard)/visibility/tools/layout";
import { requestDoubleOptIn } from "@/lib/site-crawler/free-result";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

beforeEach(() => {
  kv.clear();
  upstream.calls = [];
  upstream.rows = [];
  upstream.respond = () => [];
  who.member = null;
  who.status = "NONE";
});

describe("input: the registrable domain, via the existing helper", () => {
  it.each([
    ["example.com", "example.com"],
    ["https://www.Example.com/pricing?x=1", "example.com"],
    ["blog.shop.example.co.uk", "example.co.uk"],
    ["WWW.EXAMPLE.FR", "example.fr"],
  ])("%s → %s", (raw, want) => {
    expect(parseDomainInput(raw)).toBe(want);
  });

  it.each(["", "   ", "localhost", "192.168.0.1", "exa mple.com", "-bad.com", "http://", "a".repeat(400)])("refuses %j", (raw) => {
    expect(parseDomainInput(raw)).toBeNull();
  });

  it("keeps up to three distinct competitors, never the checked domain; a bad one is an error", () => {
    expect(normalizeCheck({ domain: "a.com", competitors: ["www.b.com", "", "B.com", "https://a.com/x"] })).toEqual({
      ok: true,
      domain: "a.com",
      competitors: ["b.com"],
    });
    expect(normalizeCheck({ domain: "a.com", competitors: ["b.com", "c.com", "d.com", "e.com"] })).toEqual({ ok: false, error: "too_many_competitors" });
    expect(normalizeCheck({ domain: "a.com", competitors: ["not a domain"] })).toEqual({ ok: false, error: "invalid_competitor" });
    expect(normalizeCheck({ domain: "nope" })).toEqual({ ok: false, error: "invalid_domain" });
  });
});

describe("the DataForSEO purchases, metered to the tenant", () => {
  it("one bulk_ranks call for every uncached domain, on the 0–100 scale, one SeoApiCall row for the tenant", async () => {
    upstream.respond = () => [{ items: [{ target: "www.a.com", rank: 41.6 }, { target: "b.com", rank: 120 }] }];
    const ranks = await buyRanks("tenant-1", ["a.com", "b.com", "c.com"]);
    expect(ranks).toEqual({ "a.com": 42, "b.com": 100, "c.com": null });
    expect(upstream.calls).toEqual([{ path: BACKLINKS.bulkRanks, task: { targets: ["a.com", "b.com", "c.com"], rank_scale: "one_hundred" } }]);
    expect(upstream.rows).toEqual([{ tenantId: "tenant-1", feature: "link_authority", path: BACKLINKS.bulkRanks, costUsd: 0.024, ok: true }]);
    // Cached, a "no rank" included: the next check buys nothing.
    expect(await cachedRanks(["a.com", "c.com", "d.com"])).toEqual({ known: { "a.com": 42, "c.com": null }, missing: ["d.com"] });
  });

  it("the summary gives referring domains, backlinks and the dofollow share, cached per domain", async () => {
    upstream.respond = () => [{ backlinks: 900, referring_domains: 40, referring_domains_nofollow: 10 }];
    expect(await buyLinks("tenant-1", "a.com")).toEqual({ referringDomains: 40, backlinks: 900, dofollowShare: 0.75 });
    expect(upstream.calls[0].path).toBe(BACKLINKS.summary);
    expect(upstream.calls[0].task).toMatchObject({ target: "a.com", rank_scale: "one_hundred" });
    expect(upstream.rows[0]).toMatchObject({ tenantId: "tenant-1", feature: "link_authority" });
    expect(await cachedLinks("a.com")).toEqual({ referringDomains: 40, backlinks: 900, dofollowShare: 0.75 });
    expect(linksFromSummary([{ referring_domains: 0 }]).dofollowShare).toBeNull();
  });

  it("the top 10 referring domains: ten rows bought, strongest first", async () => {
    upstream.respond = () => [{ items: Array.from({ length: 12 }, (_, i) => ({ domain: `www.r${i}.com`, rank: 90 - i, backlinks: i + 1 })) }];
    const rows = await buyRefDomains("tenant-1", "a.com");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ domain: "r0.com", authority: 90, backlinks: 1 });
    expect(upstream.calls[0].task).toMatchObject({ target: "a.com", limit: 10, order_by: ["rank,desc"], rank_scale: "one_hundred" });
    expect(refDomainsFromResult(undefined)).toEqual([]);
    expect(parseBulkRanks(undefined, ["x.com"])).toEqual({ "x.com": null });
  });

  it("its feature is outside the pooled search quota and the shared SEO USD budget: one check, one allowance", () => {
    expect(LINK_AUTHORITY_FEATURE).toBe("link_authority");
    expect(OWN_CAP_FEATURES).toContain("link_authority");
    expect(isSeoSearchFeature("link_authority")).toBe(false);
  });

  it("the anonymous-only code is gone: no internal account, no daily budget, no per-IP limits, no Turnstile", () => {
    const live = [
      "src/lib/authority-checker/config.ts",
      "src/lib/authority-checker/data.ts",
      "src/lib/authority-checker/service.ts",
      "src/app/api/seo/v1/link-authority/route.ts",
      "src/components/seo-tools/link-authority-client.tsx",
    ].map(read).join("\n");
    for (const gone of ["AUTHORITY_TENANT_ID", "free-tools-authority", "AUTHORITY_CHECKER_DAILY_USD", "UNLOCKS_PER_IP_PER_DAY", "CHECKS_PER_IP_PER_DAY", "verifyTurnstile", "consumeDailyLimit", "recordAuthorityLead"]) {
      expect(live, gone).not.toContain(gone);
    }
  });
});

describe("copy: en / fr / de-CH", () => {
  const all = (c: AuthorityCopy) =>
    JSON.stringify(c) +
    c.form.competitorPlaceholder(1) +
    c.ctaButton("$29") +
    c.result.checkedOn("x") +
    c.usage.line(1, 10) +
    c.usage.unlimited(3) +
    c.quota.body(10, 10, "x");

  it("folds the marketing locales", () => {
    expect(["en", "en-CA", "fr", "fr-CA", "de-CH"].map(authorityLocale)).toEqual(["en", "en", "fr", "fr", "de-CH"]);
  });

  it('the tool is "Link Authority Checker" in every locale; the score keeps its label', () => {
    for (const c of Object.values(AUTHORITY_COPY)) expect(c.name).toBe("Link Authority Checker");
    expect(AUTHORITY_COPY.en.result.scoreLabel).toBe("Echorank Authority");
    expect(AUTHORITY_COPY.fr.result.scoreLabel).toBe("Autorité Echorank");
    expect(AUTHORITY_COPY["de-CH"].result.scoreLabel).toBe("Echorank-Autorität");
    for (const locale of ["en", "fr", "de-CH"] as const) {
      expect(SEO_TOOLS_COPY[locale].items.link_authority.name).toBe("Link Authority Checker");
      expect(dashNav[locale][LINK_AUTHORITY_TOOL_PATH]).toBe("Link Authority Checker");
    }
    for (const c of Object.values(AUTHORITY_COPY)) expect(all(c)).not.toMatch(/Website Authority Checker|Website-Autoritäts-Checker|Vérificateur d'autorité de site/);
  });

  it("never uses another vendor's metric name", () => {
    const banned = /domain rating|domain authority|authority score/i;
    const acronyms = /\bDR\b|\bDA\b|\bAS\b/; // case-sensitive: "da" is German
    for (const [locale, c] of Object.entries(AUTHORITY_COPY)) {
      expect(all(c), locale).not.toMatch(banned);
      expect(all(c), locale).not.toMatch(acronyms);
    }
    for (const p of [
      "src/app/[locale]/free-tools/authority-checker/page.tsx",
      "src/app/[locale]/free-tools/authority-checker/client.tsx",
      "src/components/seo-tools/link-authority-client.tsx",
    ]) {
      expect(read(p), p).not.toMatch(/domain rating|domain authority|authority score/i);
    }
  });

  it("labels the score as based on DataForSEO's backlink index", () => {
    for (const c of Object.values(AUTHORITY_COPY)) {
      expect(c.result.scoreSource).toMatch(/DataForSEO/);
      expect(c.intro).toMatch(/DataForSEO/);
      expect(c.faq.some((f) => /DataForSEO/.test(f.a))).toBe(true);
    }
  });

  it("every locale has the same shape; de-CH writes ss; no copy types a plan number", () => {
    for (const c of Object.values(AUTHORITY_COPY)) {
      expect(c.sections).toHaveLength(4);
      expect(c.faq).toHaveLength(AUTHORITY_COPY.en.faq.length);
      expect(c.shows.items).toHaveLength(AUTHORITY_COPY.en.shows.items.length);
      expect(Object.keys(c.errors).sort()).toEqual(Object.keys(AUTHORITY_COPY.en.errors).sort());
      expect(JSON.stringify(c)).not.toMatch(/\$\d|\b(29|79|199|499)\b/);
    }
    expect(all(AUTHORITY_COPY["de-CH"])).not.toContain("ß");
  });
});

describe("registration", () => {
  it("the free-tools URL stays a page in the sitemap, with no hub card, no API, no cost and no limit", () => {
    const tool = freeToolById("authority_checker");
    expect(tool).toMatchObject({ slug: AUTHORITY_SLUG, cost: "none", dailyLimit: null, apiPath: null, jsonLd: "faq", hubHidden: true });
    expect(freeToolRoutes()).toContain("/free-tools/authority-checker");
    expect(hubFreeTools().map((t) => t.id)).not.toContain("authority_checker");
    expect(paidFreeTools().map((t) => t.id)).not.toContain("authority_checker");
    expect(TOOL_COPY.authority_checker.name).toBe(AUTHORITY_COPY.en.name);
    expect(new Set(FREE_TOOLS.map((t) => t.slug)).size).toBe(FREE_TOOLS.length);
    expect(ctaHref(tool, "fr")).toBe(`/fr/pricing?src=${LINK_AUTHORITY_SRC}`);
    // Every other tool keeps its default attribution.
    expect(ctaHref(freeToolById("site_crawler"), "en")).toBe("/en/pricing?src=free-tools-site-crawler");
  });

  it("the free-tools hub has no card for it", async () => {
    const html = renderToStaticMarkup(await HubPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(html).not.toContain("/free-tools/authority-checker");
    expect(html).not.toContain(AUTHORITY_COPY.en.name);
  });

  it("an SEO tools hub card, after Backlinks", () => {
    const tools = SEO_TOOL_GROUPS.find((g) => g.id === "search_marketing")!.tools.map((t) => t.id);
    expect(tools[tools.indexOf("backlinks") + 1]).toBe("link_authority");
    expect(SEO_TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.id === "link_authority")!.href).toBe(LINK_AUTHORITY_TOOL_PATH);
  });

  it("the quota is plan config: 10 / 25 / 100 / 300, Enterprise unlimited", () => {
    expect(PLAN_CONFIGS.AI_VISIBILITY.linkAuthorityChecksPerMonth).toBe(10);
    expect(PLAN_CONFIGS.STARTER.linkAuthorityChecksPerMonth).toBe(25);
    expect(PLAN_CONFIGS.GROWTH.linkAuthorityChecksPerMonth).toBe(100);
    expect(PLAN_CONFIGS.AGENCY.linkAuthorityChecksPerMonth).toBe(300);
    expect(PLAN_CONFIGS.ENTERPRISE.linkAuthorityChecksPerMonth).toBeNull();
    expect(linkAuthorityFromPrice()).toBe(PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice);
  });
});

describe("the landing page", () => {
  const render = async (locale: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) }));
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["en", "fr", "de-CH"] as const)("%s: what it shows, a Sample result, explainer, FAQ + JSON-LD, the from-price CTA", async (locale) => {
    const html = await render(locale);
    const c = AUTHORITY_COPY[locale];
    expect(html).toContain('data-testid="authority-sample"');
    expect(html).toContain(c.sample.badge);
    for (const item of c.shows.items) expect(html).toContain(item.replace(/'/g, "&#x27;"));
    for (const s of c.sections) expect(html).toContain(`<h2>${s.h.replace(/'/g, "&#x27;")}</h2>`);
    expect(html).toContain('"@type":"FAQPage"');
    for (const f of c.faq) expect(html).toContain(JSON.stringify(f.q).slice(1, -1));
    expect(html).toContain(`href="/${locale}/pricing?src=link-authority"`);
    expect(html).toContain(`${c.ctaButton(`$${PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice}`)} →`);
    expect(html).toContain(c.kicker);
    expect(html).not.toContain("/ FREE TOOL");
  });

  it('en says "Sample" and "Included in every plan from $29"', async () => {
    const html = await render("en");
    expect(html).toContain(">Sample<");
    expect(html).toContain("Included in every plan from $29 →");
  });

  it("makes no API call: no form, no input, no /api/ URL, no fetch while rendering, none in its source", async () => {
    const html = await render("en");
    // The page body, from the hero to the footer (the shared nav has its own buttons).
    const body = html.slice(html.indexOf("<h1"), html.lastIndexOf("_footin_"));
    expect(body.length).toBeGreaterThan(1000);
    expect(body).not.toMatch(/<form|<input|<button/);
    expect(html).not.toContain("/api/");
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const p of ["src/app/[locale]/free-tools/authority-checker/page.tsx", "src/app/[locale]/free-tools/authority-checker/client.tsx"]) {
      const src = read(p);
      expect(src, p).not.toMatch(/fetch\(|\/api\/|"use client"|useState|useTurnstile/);
    }
  });
});

describe("the in-app tool's paid gate", () => {
  // createElement, not JSX: this file is .ts.
  const layout = async () => renderToStaticMarkup(await SeoToolsLayout({ children: createElement("p", { "data-testid": "tool" }, "tool") }));

  it("a free tenant gets the upgrade screen, not the tool", async () => {
    who.member = { tenantId: "t1", tenant: { planType: "STARTER" } };
    who.status = "NONE";
    const html = await layout();
    expect(html).not.toContain('data-testid="tool"');
    expect(html).toContain(SEO_TOOLS_COPY.en.hubTitle);
  });

  it("a paid tenant gets the tool", async () => {
    who.member = { tenantId: "t1", tenant: { planType: "AI_VISIBILITY" } };
    who.status = "ACTIVE";
    expect(await layout()).toContain('data-testid="tool"');
  });
});

describe("the crawler's double opt-in still takes another tool's source", () => {
  it("source and landing page are options; the crawler's defaults are unchanged", async () => {
    const env = { ...process.env };
    Object.assign(process.env, { BREVO_API_KEY: "k", BREVO_FREE_TOOLS_LIST_ID: "7", BREVO_DOI_TEMPLATE_ID: "9", NODE_ENV: "production", MAIL_DRY_RUN: "" });
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    try {
      await requestDoubleOptIn("x@y.com", "fr", "a.com", fetchImpl, { source: "reddit-threads", redirectPath: "/free-tools/reddit-threads" });
      await requestDoubleOptIn("x@y.com", "en", "a.com", fetchImpl);
    } finally {
      process.env = env;
    }
    expect(bodies[0]).toMatchObject({ redirectionUrl: expect.stringMatching(/\/fr\/free-tools\/reddit-threads\?subscribed=1$/), attributes: { SOURCE: "reddit-threads" } });
    expect(bodies[1]).toMatchObject({ redirectionUrl: expect.stringMatching(/\/en\/free-tools\/site-crawler\?subscribed=1$/), attributes: { SOURCE: "free-crawler" } });
  });
});
