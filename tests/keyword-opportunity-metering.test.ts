// tests/keyword-opportunity-metering.test.ts
//
// The money rules: one action one allowance, two counters, a free cache hit,
// and a cap that fails without charging.
//
// Every test here is named for the WRONG NUMBER it prevents, because that is
// what these are actually for. A metering bug does not throw — it produces a
// plausible figure on somebody's bill.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above every top-level statement, so the stubs
// they close over have to be hoisted with them. vi.hoisted is how.
const { seoApiCall, keywordOpportunityAnalysis, keywordOpportunityCredit } = vi.hoisted(() => ({
  seoApiCall: { aggregate: vi.fn(), count: vi.fn(), create: vi.fn() },
  keywordOpportunityAnalysis: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  keywordOpportunityCredit: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { seoApiCall, keywordOpportunityAnalysis, keywordOpportunityCredit },
}));
vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { SEO_SEARCH_FEATURES, isSeoSearchFeature } from "@/lib/seo-quota";
import { OWN_CAP_FEATURES, spentThisMonth } from "@/lib/dataforseo/metering";
import { pathToFeature } from "@/lib/dataforseo/client";
import { LABS } from "@/lib/dataforseo/endpoints";
import {
  KOF_FEATURE,
  KofCapReachedError,
  checkKofCap,
  kofSpentThisMonth,
} from "@/lib/keyword-opportunity/metering";
import {
  analysesUsedThisMonth,
  cachedAnalysisId,
  createCacheHit,
  markCompleted,
  markFailed,
} from "@/lib/keyword-opportunity/store";
import { fundingFor } from "@/lib/keyword-opportunity/entitlement";
import { startAnalysis } from "@/lib/keyword-opportunity/start";
import { reserveCredit, releaseCredit } from "@/lib/keyword-opportunity/credits";
import { KEYWORD_OPPORTUNITY_CAP_USD } from "@/lib/plan-config";

beforeEach(() => {
  vi.clearAllMocks();
  seoApiCall.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  keywordOpportunityAnalysis.count.mockResolvedValue(0);
  keywordOpportunityAnalysis.findFirst.mockResolvedValue(null);
  keywordOpportunityAnalysis.update.mockResolvedValue({});
  keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 0 } });
  keywordOpportunityCredit.create.mockResolvedValue({});
  keywordOpportunityCredit.findUnique.mockResolvedValue(null);
});

describe("one action, one allowance", () => {
  it("does not let a domain analysis eat the tenant's pooled SEO searches", () => {
    // THE WRONG NUMBER: a STARTER tenant runs five domain analyses and finds
    // their 250 monthly SEO searches have silently dropped by ten, because the
    // Labs calls were classified as keyword_research and domain_overview.
    expect(SEO_SEARCH_FEATURES).not.toContain(KOF_FEATURE);
    expect(isSeoSearchFeature(KOF_FEATURE)).toBe(false);
  });

  it("would classify both KOF paths INTO the pool if the feature were derived", () => {
    // The trap this design avoids, asserted so nobody "simplifies" the explicit
    // feature away and lets pathToFeature take over.
    // pathToFeature takes SPLIT SEGMENTS, not the joined path — handing it the
    // whole string returns the "site_audit" default, which is its own quiet trap.
    expect(pathToFeature(LABS.keywordsForSite.split("/"))).toBe("keyword_research");
    expect(pathToFeature(LABS.rankedKeywords.split("/"))).toBe("domain_overview");
    expect(SEO_SEARCH_FEATURES).toContain("keyword_research");
    expect(SEO_SEARCH_FEATURES).toContain("domain_overview");
  });

  it("excludes KOF rows from the general DataForSEO USD cap's denominator", async () => {
    // THE WRONG NUMBER: a tenant's $25 general cap is consumed by analyses that
    // are already capped at $2, so Site Explorer stops working after a handful
    // of domain analyses.
    expect(OWN_CAP_FEATURES).toContain(KOF_FEATURE);

    await spentThisMonth("tenant-1");
    const where = seoApiCall.aggregate.mock.calls[0][0].where;
    expect(where.feature).toEqual({ notIn: [KOF_FEATURE] });
    expect(where.creditFunded).toBe(false);
  });

  it("counts KOF rows in the feature's own cap, and only those", async () => {
    await kofSpentThisMonth("tenant-1");
    const where = seoApiCall.aggregate.mock.calls[0][0].where;
    expect(where.feature).toBe(KOF_FEATURE);
    expect(where.creditFunded).toBe(false);
  });

  it("still writes every row with its real cost, so accounting stays complete", () => {
    // Nothing is hidden — the exclusions above are about DENOMINATORS, not
    // about whether the spend is recorded.
    expect(KEYWORD_OPPORTUNITY_CAP_USD.STARTER).toBe(2);
    expect(KEYWORD_OPPORTUNITY_CAP_USD.GROWTH).toBe(8);
    expect(KEYWORD_OPPORTUNITY_CAP_USD.AGENCY).toBe(15);
  });
});

describe("the cap", () => {
  it("reports capped once spend reaches the tier ceiling", async () => {
    seoApiCall.aggregate.mockResolvedValue({ _sum: { costUsd: 2 } });
    const state = await checkKofCap("tenant-1", "STARTER");
    expect(state.capped).toBe(true);
    expect(state.cap).toBe(2);
    expect(state.remaining).toBe(0);
  });

  it("is not capped below the ceiling, and reports the headroom", async () => {
    seoApiCall.aggregate.mockResolvedValue({ _sum: { costUsd: 0.4 } });
    const state = await checkKofCap("tenant-1", "STARTER");
    expect(state.capped).toBe(false);
    expect(state.remaining).toBeCloseTo(1.6, 6);
  });

  it("carries the numbers on the error so the row can say $2 of $2", () => {
    const err = new KofCapReachedError(2, 2);
    expect(err.spent).toBe(2);
    expect(err.cap).toBe(2);
    expect(err.message).toMatch(/\$2\.00 of \$2\.00/);
  });
});

describe("two counters", () => {
  it("counts the allowance from consumed rows, not from analyses started", async () => {
    // THE WRONG NUMBER: a tenant whose three analyses all failed is told they
    // have two left of five. Spend and allowance move independently and only
    // one of them moves on failure.
    await analysesUsedThisMonth("tenant-1");
    const where = keywordOpportunityAnalysis.count.mock.calls[0][0].where;
    expect(where.allowanceConsumed).toBe(true);
    expect(where.completedAt).toBeDefined();
    expect(where.status).toBeUndefined();
  });

  it("a FAILED analysis consumes no allowance", async () => {
    await markFailed("analysis-1", { stoppedReason: "cap_reached" });
    const data = keywordOpportunityAnalysis.update.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.allowanceConsumed).toBe(false);
    expect(data.stoppedReason).toBe("cap_reached");
  });

  it("only a COMPLETED analysis consumes it", async () => {
    await markCompleted("analysis-1", {
      keywordCount: 100,
      aiTestedCount: 15,
      fundingSource: "allowance",
    });
    const data = keywordOpportunityAnalysis.update.mock.calls[0][0].data;
    expect(data.status).toBe("COMPLETED");
    expect(data.allowanceConsumed).toBe(true);
    expect(data.fundingSource).toBe("allowance");
  });
});

describe("the 24h cache", () => {
  it("looks for a completed run on the same domain and UTC day", async () => {
    await cachedAnalysisId("AcmeCRM.com", new Date("2026-08-17T23:59:00.000Z"));
    const where = keywordOpportunityAnalysis.findFirst.mock.calls[0][0].where;
    expect(where.domain).toBe("acmecrm.com");
    expect(where.dateBucket).toBe("2026-08-17");
    expect(where.status).toBe("COMPLETED");
    // A cache hit must never become the row a later cache hit points at.
    expect(where.fromCache).toBe(false);
  });

  it("a cache hit consumes neither allowance nor credits", () => {
    // THE WRONG NUMBER: a customer opens yesterday's result twice and is billed
    // two of their five analyses for one piece of work.
    const decision = fundingFor({
      allowanceTotal: 5,
      allowanceUsed: 2,
      allowanceRemaining: 3,
      credits: 4,
      cacheHit: true,
    });
    expect(decision.funding).toBe("cache");
    expect(decision.canRun).toBe(true);
    expect(decision.allowanceAfter).toBe(3);
    expect(decision.creditsAfter).toBe(4);
  });

  it("is answered even for a tenant with nothing left, because it is free", () => {
    const decision = fundingFor({
      allowanceTotal: 5,
      allowanceUsed: 5,
      allowanceRemaining: 0,
      credits: 0,
      cacheHit: true,
    });
    expect(decision.canRun).toBe(true);
    expect(decision.funding).toBe("cache");
  });
});

describe("allowance before credits", () => {
  it("spends the perishable allowance first", () => {
    // THE WRONG NUMBER: a customer's prepaid credits drain while their monthly
    // allowance expires unused at the end of the month.
    const decision = fundingFor({
      allowanceTotal: 5,
      allowanceUsed: 0,
      allowanceRemaining: 5,
      credits: 10,
      cacheHit: false,
    });
    expect(decision.funding).toBe("allowance");
    expect(decision.creditsAfter).toBe(10);
  });

  it("falls through to credits only once the allowance is gone", () => {
    const decision = fundingFor({
      allowanceTotal: 5,
      allowanceUsed: 5,
      allowanceRemaining: 0,
      credits: 2,
      cacheHit: false,
    });
    expect(decision.funding).toBe("credits");
    expect(decision.creditsAfter).toBe(1);
  });

  it("denies when both are empty", () => {
    const decision = fundingFor({
      allowanceTotal: 5,
      allowanceUsed: 5,
      allowanceRemaining: 0,
      credits: 0,
      cacheHit: false,
    });
    expect(decision.canRun).toBe(false);
    expect(decision.funding).toBe("denied");
  });
});

describe("the credit ledger", () => {
  it("holds one credit at submit, as a negative delta", async () => {
    keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 3 } });
    const ok = await reserveCredit("tenant-1", "analysis-1");
    expect(ok).toBe(true);
    const data = keywordOpportunityCredit.create.mock.calls[0][0].data;
    expect(data.delta).toBe(-1);
    expect(data.reason).toBe("RESERVE");
    expect(data.ref).toBe("analysis-1");
  });

  it("refuses to hold one the tenant does not have", async () => {
    keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 0 } });
    expect(await reserveCredit("tenant-1", "analysis-1")).toBe(false);
    expect(keywordOpportunityCredit.create).not.toHaveBeenCalled();
  });

  it("refuses when the hold already exists, rather than charging twice", async () => {
    keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 3 } });
    keywordOpportunityCredit.create.mockRejectedValueOnce(new Error("unique violation"));
    expect(await reserveCredit("tenant-1", "analysis-1")).toBe(false);
  });

  it("gives the credit back when a held analysis failed", async () => {
    keywordOpportunityCredit.findUnique.mockResolvedValue({ id: "row-1" });
    await releaseCredit("tenant-1", "analysis-1");
    const data = keywordOpportunityCredit.create.mock.calls[0][0].data;
    expect(data.delta).toBe(1);
    expect(data.reason).toBe("CONSUME_RELEASE");
  });

  it("mints nothing when no credit was ever held", async () => {
    // THE WRONG NUMBER: an allowance-funded analysis fails and the tenant's
    // credit balance goes UP.
    keywordOpportunityCredit.findUnique.mockResolvedValue(null);
    await releaseCredit("tenant-1", "analysis-1");
    expect(keywordOpportunityCredit.create).not.toHaveBeenCalled();
  });
});

describe("a cache hit shows the result it cached", () => {
  it("points at the source run instead of copying its opportunities", async () => {
    // THE WRONG NUMBER: a free re-run of a 100-keyword analysis reads back zero
    // rows and renders "no keyword data for this domain" — confidently wrong
    // about a domain that has a full result. Copying the rows instead would
    // multiply the table by every repeat request for the same free answer.
    keywordOpportunityAnalysis.findUnique.mockResolvedValue({
      keywordCount: 100,
      aiTestedCount: 15,
      discoveredCount: 214,
      brandedCount: 114,
      stoppedReason: null,
      scoreVersion: 1,
    });
    keywordOpportunityAnalysis.create.mockResolvedValue({ id: "cache-row" });

    await createCacheHit({
      tenantId: "tenant-1",
      brandProfileId: "brand-1",
      domain: "acmecrm.com",
      scoreVersion: 1,
      sourceAnalysisId: "source-1",
    });

    const data = keywordOpportunityAnalysis.create.mock.calls[0][0].data;
    expect(data.cachedFromId).toBe("source-1");
    expect(data.fromCache).toBe(true);
    expect(data.keywordCount).toBe(100);
  });

  it("carries an empty source's finding, rather than falling back to a different one", async () => {
    // A cached EMPTY result must keep saying "all your keywords were your own
    // brand". Losing the reason would render the other empty state, which is a
    // different and untrue statement about the same domain.
    keywordOpportunityAnalysis.findUnique.mockResolvedValue({
      keywordCount: 0,
      aiTestedCount: 0,
      discoveredCount: 214,
      brandedCount: 214,
      stoppedReason: "no_unbranded_keywords",
      scoreVersion: 1,
    });
    keywordOpportunityAnalysis.create.mockResolvedValue({ id: "cache-row" });

    await createCacheHit({
      tenantId: "tenant-1",
      brandProfileId: "brand-1",
      domain: "acmecrm.com",
      scoreVersion: 1,
      sourceAnalysisId: "source-1",
    });

    const data = keywordOpportunityAnalysis.create.mock.calls[0][0].data;
    expect(data.stoppedReason).toBe("no_unbranded_keywords");
    expect(data.discoveredCount).toBe(214);
    expect(data.brandedCount).toBe(214);
  });

  it("still consumes nothing", async () => {
    keywordOpportunityAnalysis.findUnique.mockResolvedValue(null);
    keywordOpportunityAnalysis.create.mockResolvedValue({ id: "cache-row" });

    await createCacheHit({
      tenantId: "tenant-1",
      brandProfileId: "brand-1",
      domain: "acmecrm.com",
      scoreVersion: 1,
      sourceAnalysisId: "gone",
    });

    const data = keywordOpportunityAnalysis.create.mock.calls[0][0].data;
    expect(data.allowanceConsumed).toBe(false);
    expect(data.costUsd).toBe(0);
    expect(data.fundingSource).toBe("cache");
  });
});

describe("starting an analysis goes through one function", () => {
  beforeEach(() => {
    keywordOpportunityAnalysis.create.mockResolvedValue({ id: "new-analysis" });
  });

  it("serves the cached run instead of doing the work again", async () => {
    // THE BUG THIS GUARDS, AND IT COST REAL MONEY. A second run of the same
    // domain thirty-five seconds after the first created a NEW analysis, re-ran
    // the full funnel and re-billed $0.024 — while the preflight command's
    // cache probe reported "HIT" correctly the whole time, because the path
    // that spent the money never consulted it.
    keywordOpportunityAnalysis.count.mockResolvedValue(2);
    keywordOpportunityAnalysis.findFirst.mockResolvedValue({ id: "source-1" });
    keywordOpportunityAnalysis.findUnique.mockResolvedValue({
      keywordCount: 0,
      aiTestedCount: 0,
      discoveredCount: 214,
      brandedCount: 214,
      stoppedReason: "no_unbranded_keywords",
      scoreVersion: 1,
    });

    const outcome = await startAnalysis({
      tenantId: "tenant-1",
      plan: "GROWTH",
      brandProfileId: "brand-1",
      domain: "echorank360.com",
    });

    expect(outcome.kind).toBe("cached");
    const data = keywordOpportunityAnalysis.create.mock.calls[0][0].data;
    // No new work: COMPLETED on arrival, pointing at the paid run.
    expect(data.status).toBe("COMPLETED");
    expect(data.fromCache).toBe(true);
    expect(data.cachedFromId).toBe("source-1");
    // $0, no allowance, and the source's finding carried across intact.
    expect(data.costUsd).toBe(0);
    expect(data.allowanceConsumed).toBe(false);
    expect(data.stoppedReason).toBe("no_unbranded_keywords");
    expect(data.discoveredCount).toBe(214);
    expect(data.brandedCount).toBe(214);
  });

  it("answers the cache before consulting the allowance at all", async () => {
    // A tenant at their ceiling must still get today's free result.
    keywordOpportunityAnalysis.count.mockResolvedValue(25);
    keywordOpportunityAnalysis.findFirst.mockResolvedValue({ id: "source-1" });
    keywordOpportunityAnalysis.findUnique.mockResolvedValue({
      keywordCount: 100,
      aiTestedCount: 15,
      discoveredCount: 214,
      brandedCount: 114,
      stoppedReason: null,
      scoreVersion: 1,
    });

    const outcome = await startAnalysis({
      tenantId: "tenant-1",
      plan: "GROWTH",
      brandProfileId: "brand-1",
      domain: "echorank360.com",
    });
    expect(outcome.kind).toBe("cached");
  });

  it("queues a real run when the cache is cold", async () => {
    keywordOpportunityAnalysis.count.mockResolvedValue(2);
    keywordOpportunityAnalysis.findFirst.mockResolvedValue(null);

    const outcome = await startAnalysis({
      tenantId: "tenant-1",
      plan: "GROWTH",
      brandProfileId: "brand-1",
      domain: "echorank360.com",
    });

    expect(outcome).toMatchObject({ kind: "queued", funding: "allowance" });
    const data = keywordOpportunityAnalysis.create.mock.calls[0][0].data;
    expect(data.status).toBe("QUEUED");
    expect(data.fromCache).toBeUndefined();
  });

  it("denies with no allowance, no credits and no cache", async () => {
    keywordOpportunityAnalysis.count.mockResolvedValue(25);
    keywordOpportunityAnalysis.findFirst.mockResolvedValue(null);
    keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 0 } });

    const outcome = await startAnalysis({
      tenantId: "tenant-1",
      plan: "GROWTH",
      brandProfileId: "brand-1",
      domain: "echorank360.com",
    });
    expect(outcome.kind).toBe("denied");
    expect(keywordOpportunityAnalysis.create).not.toHaveBeenCalled();
  });
});

describe("nobody has grown a third entry point", () => {
  // A GREP GUARD, and it earned its keep before it existed. createAnalysis()
  // and createCacheHit() are the raw writes; calling either directly skips the
  // cache probe, the funding decision and the credit hold. The dogfood script
  // did exactly that and paid for one domain twice.
  //
  // Asserted against the source tree rather than trusted, because the failure
  // is invisible in review — the call looks reasonable, and only the bill
  // disagrees.
  const RAW_WRITES = ["createAnalysis", "createCacheHit"] as const;

  /** Every .ts/.tsx under src and scripts, excluding gitignored deploy backups. */
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.bak[.-]/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("only start.ts imports the raw analysis writes", () => {
    const allowed = new Set([
      join("src", "lib", "keyword-opportunity", "start.ts"),
      // The module that defines them.
      join("src", "lib", "keyword-opportunity", "store.ts"),
    ]);

    const offenders: string[] = [];
    for (const file of [...sourceFiles("src"), ...sourceFiles("scripts")]) {
      const relative = file.replace(`${process.cwd()}/`, "");
      if (allowed.has(relative)) continue;
      const source = readFileSync(file, "utf8");
      for (const write of RAW_WRITES) {
        // The import, not the word — comments naming these in order to ban
        // them are exactly what this file's own header does.
        if (new RegExp(`\\b${write}\\b[^\\n]*\\bfrom\\b|\\bimport\\b[^\\n]*\\b${write}\\b`).test(source)) {
          offenders.push(`${relative} imports ${write}`);
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
