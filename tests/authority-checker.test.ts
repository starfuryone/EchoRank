// The free Website Authority Checker: input, copy rules, the DataForSEO
// purchases and their cache, the budget alert, registration and the page.
// Routes and the unlock flow: tests/authority-checker-routes.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Redis (GET / SET with EX and NX) ───────────────────────────────────────
const kv = vi.hoisted(() => new Map<string, string>());
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    get: async (k: string) => kv.get(k) ?? null,
    set: async (k: string, v: string, ...args: unknown[]) => {
      if (args.includes("NX") && kv.has(k)) return null;
      kv.set(k, v);
      return "OK";
    },
  }),
}));

// ─── The metered DataForSEO call and the ledger ─────────────────────────────
const metered = vi.hoisted(() => ({
  calls: [] as { tenantId: string; path: string; task: Record<string, unknown> }[],
  respond: ((): unknown => []) as (path: string) => unknown,
}));
vi.mock("@/lib/dataforseo/metering", () => ({
  seoMeteredCallResult: async (tenantId: string, path: string, task: Record<string, unknown>) => {
    metered.calls.push({ tenantId, path, task });
    return { data: metered.respond(path), billing: { path: path.split("/"), costUsd: 0.024 } };
  },
}));
const ledger = vi.hoisted(() => ({ spent: 0, where: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    seoApiCall: {
      aggregate: async (q: { where: unknown }) => {
        ledger.where = q.where;
        return { _sum: { costUsd: ledger.spent } };
      },
    },
  },
}));
const matrix = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock("@/lib/matrix/alert", () => ({
  postMatrixAlert: async (line: string) => {
    matrix.lines.push(line);
    return true;
  },
}));

import {
  AUTHORITY_SLUG,
  AUTHORITY_TENANT_ID,
  CHECKS_PER_IP_PER_DAY,
  DEFAULT_DAILY_BUDGET_USD,
  dailyBudgetUsd,
} from "@/lib/authority-checker/config";
import { normalizeCheck, parseDomainInput } from "@/lib/authority-checker/domains";
import { AUTHORITY_COPY, authorityLocale, type AuthorityCopy } from "@/lib/authority-checker/copy";
import {
  alertIfNearBudget,
  budgetAlertLine,
  budgetState,
  buyLinks,
  buyRanks,
  buyRefDomains,
  cachedLinks,
  cachedRanks,
  linksFromSummary,
  parseBulkRanks,
  refDomainsFromResult,
} from "@/lib/authority-checker/data";
import { authorityPdfPayload, pdfLang } from "@/lib/authority-checker/pdf";
import { toView } from "@/lib/authority-checker/store";
import type { StoredCheck } from "@/lib/authority-checker/types";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { FREE_TOOLS, freeToolById, freeToolRoutes, paidFreeTools } from "@/lib/free-tools";
import { TOOL_COPY } from "@/app/[locale]/free-tools/_shared/copy";
import Page from "@/app/[locale]/free-tools/authority-checker/page";
import { requestDoubleOptIn } from "@/lib/site-crawler/free-result";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

beforeEach(() => {
  kv.clear();
  metered.calls = [];
  metered.respond = () => [];
  ledger.spent = 0;
  matrix.lines = [];
  delete process.env.AUTHORITY_CHECKER_DAILY_USD;
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

  it("keeps up to three distinct competitors, never the visitor's own domain; a bad one is an error", () => {
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

describe("the daily budget is config, default $3", () => {
  it("defaults, overrides, and 0 switches new checks off", () => {
    expect(DEFAULT_DAILY_BUDGET_USD).toBe(3);
    const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
    expect(dailyBudgetUsd(env({}))).toBe(3);
    expect(dailyBudgetUsd(env({ AUTHORITY_CHECKER_DAILY_USD: "5.5" }))).toBe(5.5);
    expect(dailyBudgetUsd(env({ AUTHORITY_CHECKER_DAILY_USD: "0" }))).toBe(0);
    expect(dailyBudgetUsd(env({ AUTHORITY_CHECKER_DAILY_USD: "-1" }))).toBe(3);
    expect(dailyBudgetUsd(env({ AUTHORITY_CHECKER_DAILY_USD: "lots" }))).toBe(3);
  });

  it("sums only this tool's ledger rows since UTC midnight", async () => {
    ledger.spent = 1.25;
    const s = await budgetState(new Date("2026-11-07T15:00:00Z"));
    expect(s).toEqual({ spent: 1.25, budget: 3, exhausted: false });
    expect(ledger.where).toEqual({ tenantId: AUTHORITY_TENANT_ID, createdAt: { gte: new Date("2026-11-07T00:00:00Z") } });
    ledger.spent = 3;
    expect((await budgetState()).exhausted).toBe(true);
    process.env.AUTHORITY_CHECKER_DAILY_USD = "0";
    ledger.spent = 0;
    expect((await budgetState()).exhausted).toBe(true);
  });

  it("alerts Matrix once a day, from 80% of the budget", async () => {
    const day = new Date("2026-11-07T10:00:00Z");
    ledger.spent = 2.3;
    expect(await alertIfNearBudget(day)).toBe(false);
    ledger.spent = 2.4;
    expect(await alertIfNearBudget(day)).toBe(true);
    expect(await alertIfNearBudget(day)).toBe(false);
    expect(matrix.lines).toEqual([budgetAlertLine(2.4, 3)]);
    expect(matrix.lines[0]).toContain("80%");
    expect(matrix.lines[0]).toContain("$2.40 of $3.00");
    expect(await alertIfNearBudget(new Date("2026-11-08T10:00:00Z"))).toBe(true);
  });
});

describe("the DataForSEO purchases", () => {
  it("one bulk_ranks call for every uncached domain, on the 0–100 scale, metered to the tool's own id", async () => {
    metered.respond = () => [{ items: [{ target: "www.a.com", rank: 41.6 }, { target: "b.com", rank: 120 }] }];
    const ranks = await buyRanks(["a.com", "b.com", "c.com"]);
    expect(ranks).toEqual({ "a.com": 42, "b.com": 100, "c.com": null });
    expect(metered.calls).toEqual([
      { tenantId: AUTHORITY_TENANT_ID, path: BACKLINKS.bulkRanks, task: { targets: ["a.com", "b.com", "c.com"], rank_scale: "one_hundred" } },
    ]);
    expect(BACKLINKS.bulkRanks).toBe("v3/backlinks/bulk_ranks/live");
    // Cached, a "no rank" included: the next check buys nothing.
    expect(await cachedRanks(["a.com", "c.com", "d.com"])).toEqual({ known: { "a.com": 42, "c.com": null }, missing: ["d.com"] });
  });

  it("the summary gives referring domains, backlinks and the dofollow share, cached per domain", async () => {
    metered.respond = () => [{ backlinks: 900, referring_domains: 40, referring_domains_nofollow: 10 }];
    expect(await buyLinks("a.com")).toEqual({ referringDomains: 40, backlinks: 900, dofollowShare: 0.75 });
    expect(metered.calls[0].path).toBe(BACKLINKS.summary);
    expect(metered.calls[0].task).toMatchObject({ target: "a.com", rank_scale: "one_hundred" });
    expect(await cachedLinks("a.com")).toEqual({ referringDomains: 40, backlinks: 900, dofollowShare: 0.75 });
    expect(linksFromSummary([{ referring_domains: 0 }]).dofollowShare).toBeNull();
  });

  it("the top 10 referring domains: ten rows bought, strongest first", async () => {
    metered.respond = () => [{ items: Array.from({ length: 12 }, (_, i) => ({ domain: `www.r${i}.com`, rank: 90 - i, backlinks: i + 1 })) }];
    const rows = await buyRefDomains("a.com");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ domain: "r0.com", authority: 90, backlinks: 1 });
    expect(metered.calls[0].task).toMatchObject({ target: "a.com", limit: 10, order_by: ["rank,desc"], rank_scale: "one_hundred" });
    expect(refDomainsFromResult(undefined)).toEqual([]);
    expect(parseBulkRanks(undefined, ["x.com"])).toEqual({ "x.com": null });
  });
});

describe("copy: en / fr / de-CH", () => {
  const all = (c: AuthorityCopy) =>
    JSON.stringify(c) +
    c.form.competitorPlaceholder(1) +
    [0, 1, 3].map((n) => c.gate.body(n)).join(" ") +
    c.result.checkedOn("x");

  it("folds the marketing locales", () => {
    expect(["en", "en-CA", "fr", "fr-CA", "de-CH"].map(authorityLocale)).toEqual(["en", "en", "fr", "fr", "de-CH"]);
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
    ]) {
      expect(read(p), p).not.toMatch(/domain rating|domain authority|authority score/i);
    }
  });

  it("names the score Echorank Authority and labels it as based on DataForSEO's backlink index", () => {
    expect(AUTHORITY_COPY.en.result.scoreLabel).toBe("Echorank Authority");
    for (const c of Object.values(AUTHORITY_COPY)) {
      expect(c.result.scoreSource).toMatch(/DataForSEO/);
      expect(c.intro).toMatch(/DataForSEO/);
      expect(c.faq.some((f) => /DataForSEO/.test(f.a))).toBe(true);
    }
  });

  it("every locale has the four explainer sections and the same FAQ count; de-CH writes ss", () => {
    for (const c of Object.values(AUTHORITY_COPY)) {
      expect(c.sections).toHaveLength(4);
      expect(c.faq).toHaveLength(AUTHORITY_COPY.en.faq.length);
      expect(Object.keys(c.errors).sort()).toEqual(Object.keys(AUTHORITY_COPY.en.errors).sort());
    }
    expect(all(AUTHORITY_COPY["de-CH"])).not.toContain("ß");
    expect(AUTHORITY_COPY.en.ctaButton).toBe("Track it monthly");
  });
});

describe("registration in the /free-tools hub", () => {
  it("is a paid free tool with its 10-a-day limit, a route and a hub card", () => {
    const tool = freeToolById("authority_checker");
    expect(tool).toMatchObject({ slug: AUTHORITY_SLUG, cost: "paid_api", dailyLimit: CHECKS_PER_IP_PER_DAY, apiPath: "/api/free/v1/authority-checker", jsonLd: "faq" });
    expect(CHECKS_PER_IP_PER_DAY).toBe(10);
    expect(freeToolRoutes()).toContain("/free-tools/authority-checker");
    expect(paidFreeTools().map((t) => t.id)).toContain("authority_checker");
    expect(TOOL_COPY.authority_checker.name).toBe(AUTHORITY_COPY.en.name);
    expect(new Set(FREE_TOOLS.map((t) => t.slug)).size).toBe(FREE_TOOLS.length);
  });
});

describe("the page", () => {
  const render = async (locale: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) }));

  it.each(["en", "fr", "de-CH"] as const)("%s: form, explainer, FAQ + FAQPage JSON-LD, Track it monthly → /pricing?src=authority-checker", async (locale) => {
    const html = await render(locale);
    const c = AUTHORITY_COPY[locale];
    expect(html).toContain('data-testid="authority-form"');
    for (const s of c.sections) expect(html).toContain(`<h2>${s.h.replace(/'/g, "&#x27;")}</h2>`);
    expect(html).toContain('"@type":"FAQPage"');
    for (const f of c.faq) expect(html).toContain(JSON.stringify(f.q).slice(1, -1));
    expect(html).toContain(`href="/${locale}/pricing?src=authority-checker"`);
    expect(html).toContain(`${c.ctaButton} →`);
  });
});

describe("views, the PDF payload and the lead's double opt-in", () => {
  const check: StoredCheck = {
    token: "t".repeat(22),
    createdAt: "2026-11-07T10:00:00.000Z",
    domain: "a.com",
    competitors: ["b.com"],
    authority: { "a.com": 40, "b.com": 55 },
    links: { referringDomains: 10, backlinks: 100, dofollowShare: 0.5 },
    full: {
      referringDomains: [{ domain: "r.com", authority: 70, backlinks: 3 }],
      comparison: [
        { domain: "a.com", authority: 40, referringDomains: 10, backlinks: 100, dofollowShare: 0.5 },
        { domain: "b.com", authority: 55, referringDomains: 20, backlinks: 300, dofollowShare: 0.6 },
      ],
      at: "2026-11-07T10:05:00.000Z",
    },
  };

  it("a locked view never carries the full section", () => {
    expect(toView(check, false)).toMatchObject({ authority: 40, unlocked: false, full: null, fullPending: false });
    expect(toView(check, true).full).toEqual(check.full);
    expect(toView({ ...check, full: null }, true).fullPending).toBe(true);
  });

  it("the PDF gets the stored numbers, the CTA with its src, and de-CH reads the de catalog", () => {
    const p = authorityPdfPayload(check, "de-CH");
    expect(p).toMatchObject({ lang: "de", domain: "a.com", authority: 40, referringDomains: check.full!.referringDomains, comparison: check.full!.comparison });
    expect(p.ctaUrl).toMatch(/\/de-CH\/pricing\?src=authority-checker$/);
    expect(["en", "en-CA", "fr-CA"].map(pdfLang)).toEqual(["en", "en", "fr"]);
  });

  it("Brevo's double opt-in carries the checker's source and landing page (the crawler's defaults unchanged)", async () => {
    const env = { ...process.env };
    Object.assign(process.env, { BREVO_API_KEY: "k", BREVO_FREE_TOOLS_LIST_ID: "7", BREVO_DOI_TEMPLATE_ID: "9", NODE_ENV: "production", MAIL_DRY_RUN: "" });
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    try {
      await requestDoubleOptIn("x@y.com", "fr", "a.com", fetchImpl, { source: "authority-checker", redirectPath: "/free-tools/authority-checker" });
      await requestDoubleOptIn("x@y.com", "en", "a.com", fetchImpl);
    } finally {
      process.env = env;
    }
    expect(bodies[0]).toMatchObject({ redirectionUrl: expect.stringMatching(/\/fr\/free-tools\/authority-checker\?subscribed=1$/), attributes: { SOURCE: "authority-checker" } });
    expect(bodies[1]).toMatchObject({ redirectionUrl: expect.stringMatching(/\/en\/free-tools\/site-crawler\?subscribed=1$/), attributes: { SOURCE: "free-crawler" } });
  });
});
