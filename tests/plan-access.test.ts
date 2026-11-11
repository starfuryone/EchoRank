// The plan allowlist (src/lib/plan-access.ts), driven by the route table on
// disk: every (dashboard) page and every /api route must be classified, the
// AI-only plan reaches exactly its areas, and every other plan reaches
// everything it did before. Plus: key auth, the crawl override, a scheduled
// job after a downgrade, pause/resume on plan change, monotonic allowances.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  apiKey: { findUnique: vi.fn(), update: vi.fn(() => Promise.resolve()) },
  tenant: { findUnique: vi.fn() },
  crawlSchedule: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  hasPaidPlan: vi.fn(async () => true),
  rateLimit: vi.fn(async () => ({ success: true })),
  removeRepeatable: vi.fn(),
  syncRepeatable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { apiKey: m.apiKey, tenant: m.tenant, crawlSchedule: m.crawlSchedule } }));
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: m.hasPaidPlan }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/infrastructure/queue/registry", () => ({ getQueue: () => ({}) }));

import type { PlanType } from "@/generated/prisma";
import {
  AI_VISIBILITY_AREAS,
  areaForApi,
  areaForPage,
  planAllowsApi,
  planAllowsArea,
  planAllowsPage,
  planIsRestricted,
} from "@/lib/plan-access";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { authenticatePublicRequest, __testing as keys } from "@/lib/api-keys";
import { getCrawlQuota } from "@/lib/site-crawler/quota";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, file: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n.includes(".bak")) return [];
    return statSync(p).isDirectory() ? walk(p, file) : n === file ? [p] : [];
  });
}
/** "/visibility/tools/[id]" -> "/visibility/tools/x": a concrete path the rules can match. */
const concrete = (p: string) => p.replace(/\[\.{0,3}[^\]]+\]/g, "x");

const PAGES = walk(join(ROOT, "src/app/(dashboard)"), "page.tsx").map(
  (f) => concrete("/" + relative(join(ROOT, "src/app/(dashboard)"), f).replace(/\/?page\.tsx$/, "")).replace(/\/$/, "") || "/",
);
const APIS = walk(join(ROOT, "src/app/api"), "route.ts").map((f) =>
  concrete("/api/" + relative(join(ROOT, "src/app/api"), f).replace(/\/route\.ts$/, "")),
);

const OTHER_PLANS: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

describe("every route is classified", () => {
  it("finds the routes it guards", () => {
    expect(PAGES.length).toBeGreaterThan(50);
    expect(APIS.length).toBeGreaterThan(200);
  });

  it("every (dashboard) page has an area", () => {
    expect(PAGES.filter((p) => areaForPage(p) === null)).toEqual([]);
  });

  it("every /api route has an area, for every method", () => {
    const missing = APIS.flatMap((p) =>
      ["GET", "POST", "PATCH", "DELETE"].filter((verb) => areaForApi(p, verb) === null).map((verb) => `${verb} ${p}`),
    );
    expect(missing).toEqual([]);
  });

  it("an unclassified route is refused for the AI-only plan and open to the rest", () => {
    expect(planAllowsPage("AI_VISIBILITY", "/brand-new-thing")).toBe(false);
    expect(planAllowsPage("STARTER", "/brand-new-thing")).toBe(true);
    expect(planAllowsApi("AI_VISIBILITY", "/api/brand-new-thing")).toBe(false);
  });
});

describe("the AI-only plan", () => {
  it("reaches exactly its areas: AI visibility, account, home, the Link Authority Checker (and exempt APIs)", () => {
    // Team and notifications were split out of "account" on 2026-11-10; the AI-only plan keeps both.
    // The tools hub index and credit packs got their own areas the same day
    // (they were "ai_visibility" and "account").
    expect([...AI_VISIBILITY_AREAS].sort()).toEqual(["account", "ai_visibility", "credits", "exempt", "home", "link_authority", "notifications", "team", "tools_hub"]);
    expect(planIsRestricted("AI_VISIBILITY")).toBe(true);
    for (const plan of OTHER_PLANS) expect(planIsRestricted(plan), plan).toBe(false);
  });

  it.each([
    "/visibility",
    "/visibility/ai-search",
    "/visibility/ai-search/prompts",
    "/visibility/tools",
    "/visibility/tools/custom-prompts",
    "/visibility/tools/brand-radar",
    "/visibility/tools/ai-lens",
    "/visibility/brand-radar",
    // Cited sources (2026-11-07) and the AI hub, which shows only these.
    "/visibility/tools/citation-finder",
    "/visibility/tools/citation-opportunities",
    // Social posting, by EchoPilot: every paid plan (2026-11-08); the old
    // Social Media Manager URL redirects to it.
    "/visibility/tools/social-posting",
    "/visibility/tools/social-media-manager",
    "/ai",
    "/settings",
    "/settings/account",
    "/billing",
    "/help",
    "/team",
    "/notifications",
  ])("includes the page %s", (path) => expect(planAllowsPage("AI_VISIBILITY", path)).toBe(true));

  it.each([
    "/visibility/keywords",
    "/visibility/tools/site-explorer",
    "/visibility/tools/rank-tracker",
    "/visibility/tools/gsc-insights",
    "/visibility/tools/serp-checker",
    "/visibility/tools/backlinks",
    "/visibility/tools/lighthouse",
    "/visibility/tools/web-analytics",
    "/visibility/tools/bot-analytics",
    "/visibility/tools/content-explorer",
    "/visibility/tools/report-builder",
    "/visibility/tools/action-agent",
    "/visibility/tools/ai-content-helper",
    "/visibility/tools/api-access",
    "/visibility/tools/mcp-server",
    "/visibility/tools/funnels",
    "/visibility/tools/portfolios",
    "/crawler",
    "/crawler/schedules",
    "/reputation",
    "/campaigns",
    "/customers",
    "/feedback",
    "/recovery",
    "/review-links",
    "/monitoring",
    "/intelligence/competitors",
    "/imports",
    "/extension",
    "/assistant",
    // Kept out on purpose (2026-11-07): AI Attribution and the Assistant; the
    // SERP-history tool, whose data comes from SEO rank checks; Share of Voice
    // (Growth+); revenue and the scanner.
    "/visibility/tools/ai-attribution",
    "/visibility/tools/historical",
    "/visibility/tools/share-of-voice",
    "/visibility/tools/revenue",
    "/visibility/tools/opportunity-scanner",
  ])("excludes the page %s", (path) => expect(planAllowsPage("AI_VISIBILITY", path)).toBe(false));

  it.each([
    ["GET", "/api/ai/visibility/report"],
    ["POST", "/api/ai/visibility/prompts"],
    ["POST", "/api/ai-search/brands"],
    ["POST", "/api/av/audit/report"],
    ["POST", "/api/seo/v1/ai-lens/analyze"],
    ["PATCH", "/api/citation-opportunities/abc"],
    ["POST", "/api/echopilot/click"],
    ["GET", "/api/billing"],
    ["GET", "/api/account/export"],
    ["GET", "/api/tenants"],
    ["POST", "/api/webhooks"],
  ])("includes %s %s", (method, path) => expect(planAllowsApi("AI_VISIBILITY", path, method)).toBe(true));

  it.each([
    ["POST", "/api/seo/v1/site-explorer/overview"],
    ["POST", "/api/seo/v1/crawl"],
    ["GET", "/api/ai/visibility/keywords"],
    ["POST", "/api/ai/visibility/api-keys"],
    ["POST", "/api/ai/visibility/marketing/generate"],
    ["POST", "/api/campaigns"],
    ["POST", "/api/customers"],
    ["POST", "/api/review-links"],
    ["POST", "/api/extension/token"],
    ["POST", "/api/imports/csv"],
    ["POST", "/api/tenants"],
    ["POST", "/api/agency/funnels"],
    ["POST", "/api/action-agent/run"],
    ["POST", "/api/assistant/pro/chat"],
    ["GET", "/api/ai/visibility/historical/timeline"],
    ["POST", "/api/ai/visibility/attribution-keys"],
  ])("refuses %s %s", (method, path) => expect(planAllowsApi("AI_VISIBILITY", path, method)).toBe(false));

  it("the /ai hub shows only the cards the plan includes", async () => {
    const { visibleAiGroups, ALL_AI_TOOLS } = await import("@/lib/ai-tools");
    const ids = (plan: "AI_VISIBILITY" | "STARTER") =>
      visibleAiGroups(plan, { ai_search: true }).flatMap((g) => g.tools.map((t) => t.id));
    expect(ids("AI_VISIBILITY")).toEqual(["ai_visibility", "ai_search", "custom_prompts", "citation_finder", "citation_opportunities"]);
    // Every other plan sees every card, as before (locked ones render their own upgrade state).
    expect(ids("STARTER")).toEqual(ALL_AI_TOOLS.map((t) => t.id));
  });

  it("the citation tools are on every plan from AI Visibility up, Share of Voice stays Growth+", async () => {
    const { hasFeature } = await import("@/lib/feature-flags");
    for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      expect(hasFeature(plan, "citation_tracking"), plan).toBe(true);
    }
    expect(hasFeature("STARTER", "advanced_analytics")).toBe(false);
    expect(hasFeature("AI_VISIBILITY", "advanced_analytics")).toBe(false);
    for (const f of [
      "src/app/(dashboard)/visibility/tools/citation-finder/page.tsx",
      "src/app/(dashboard)/visibility/tools/citation-opportunities/page.tsx",
    ]) {
      expect(read(f), f).toContain('hasFeature(membership.tenant.planType, "citation_tracking")');
    }
    expect(read("src/app/api/citation-opportunities/[id]/route.ts")).toContain('requireFeature("citation_tracking")');
    expect(read("src/app/(dashboard)/visibility/tools/share-of-voice/page.tsx")).toContain('"advanced_analytics"');
  });
});

describe("every other plan reaches everything it did before", () => {
  it.each(OTHER_PLANS)("%s: every page and every API route", (plan) => {
    expect(PAGES.filter((p) => !planAllowsPage(plan, p))).toEqual([]);
    expect(APIS.filter((p) => !planAllowsApi(plan, p, "POST"))).toEqual([]);
  });
});

describe("the gates read the allowlist", () => {
  it("the proxy answers 403 PLAN_UPGRADE_REQUIRED for an excluded API route", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain("if (plan !== undefined && !planAllowsApi(plan, pathname, method)) {");
    expect(proxy).toContain("return NextResponse.json(planUpgradeBody(area), { status: 403 });");
    // Only a failed read (undefined) skips the gate; a null plan is still judged.
    expect(proxy).toMatch(/await sessionPlan\([\s\S]{0,120}?\)\.catch\(/);
  });

  it("the (dashboard) layout renders the upgrade screen server-side, and sends /dashboard home", () => {
    const layout = read("src/app/(dashboard)/layout.tsx");
    // The screen names what the plan has (the AI-only or the crawler-only plan).
    expect(layout).toContain("{excluded ? <PlanUpgradeScreen locale={locale} plan={plan} /> : children}");
    expect(layout).toContain('if (pathname === "/dashboard") redirect(PLAN_HOME[plan]);');
    expect(read("src/lib/plan-routing.ts")).toContain('AI_VISIBILITY: "/visibility",');
  });

  it("the sidebar and the tools hub derive from it", () => {
    expect(read("src/components/layout/sidebar.tsx")).toContain("!planAllowsPage(plan, item.href)");
    expect(read("src/app/(dashboard)/visibility/tools/page.tsx")).toContain("const allowed = planAllowsPage(plan, tool.href);");
  });
});

describe("public API v1 and MCP", () => {
  const key = `${keys.KEY_PREFIX}${"a".repeat(16)}.${"b".repeat(64)}`;
  beforeEach(() => {
    vi.clearAllMocks();
    m.apiKey.findUnique.mockResolvedValue({ id: "k1", tenantId: "t1", keyHash: keys.sha256("b".repeat(64)), revokedAt: null, scopes: ["public"] });
  });
  const call = () => authenticatePublicRequest(new Request("https://echorank360.com/api/public/v1/visibility/summary", { headers: { authorization: `Bearer ${key}` } }));

  it("rejects an AI Visibility tenant's key with 403 PLAN_UPGRADE_REQUIRED", async () => {
    m.tenant.findUnique.mockResolvedValue({ planType: "AI_VISIBILITY" });
    const out = await call();
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.response.status).toBe(403);
    expect((await out.response.json()).code).toBe("PLAN_UPGRADE_REQUIRED");
    expect(m.rateLimit).not.toHaveBeenCalled();
  });

  it("accepts the same key on Starter", async () => {
    m.tenant.findUnique.mockResolvedValue({ planType: "STARTER" });
    expect((await call()).ok).toBe(true);
  });

  it("key creation refuses the AI-only plan", () => {
    const route = read("src/app/api/ai/visibility/api-keys/route.ts");
    expect(route).toMatch(/if \(!planAllowsArea\(membership\.tenant\.planType, "public_api"\)\) \{\s*return NextResponse\.json\(planUpgradeBody\("public_api"\), \{ status: 403 \}\);/);
  });
});

describe("quotas and overrides never open an excluded area", () => {
  it("a staff URL-cap override does not unlock the crawler for the AI-only plan", async () => {
    m.tenant.findUnique.mockResolvedValue({ crawlUrlCapOverride: 5000, crawlsKeptOverride: null, crawlConcurrencyOverride: null });
    const q = await getCrawlQuota("t1", "AI_VISIBILITY");
    expect(q.locked).toBe(true);
    expect(q.allowed).toBe(false);
  });

  it("every SEO / crawl / reputation allowance is 0 on the AI-only plan (and 0 refuses)", () => {
    const c = PLAN_CONFIGS.AI_VISIBILITY;
    expect([c.seoSearchesPerMonth, c.trackedKeywords, c.crawlUrlCap, c.crawlsPerMonth, c.keywordOpportunityAnalysesPerMonth]).toEqual([0, 0, 0, 0, 0]);
    expect([c.quotaDefaults.maxRequestsPerMonth, c.quotaDefaults.maxEmailsPerMonth, c.quotaDefaults.maxSmsPerMonth, c.quotaDefaults.maxApiRequestsPerDay]).toEqual([0, 0, 0, 0]);
  });
});

describe("background jobs re-check the plan when they run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a scheduled crawl set up on Starter does nothing after a downgrade, and says why", async () => {
    const { runScheduledCrawl } = await import("@/lib/site-crawler/schedule-service");
    m.crawlSchedule.findUnique.mockResolvedValue({ id: "s1", tenantId: "t1", enabled: true, cadence: "weekly", hourUtc: 3, config: {}, tenant: { planType: "AI_VISIBILITY" } });
    m.tenant.findUnique.mockResolvedValue({ crawlUrlCapOverride: null, crawlsKeptOverride: null, crawlConcurrencyOverride: null });
    expect(await runScheduledCrawl("s1")).toEqual({ status: "skipped", reason: "locked" });
  });

  it.each([
    ["src/infrastructure/queue/workers/email-delivery.worker.ts", "reputation"],
    ["src/infrastructure/queue/workers/sms-delivery.worker.ts", "reputation"],
    ["src/infrastructure/queue/workers/feedback-routing.worker.ts", "reputation"],
    ["src/infrastructure/queue/workers/visibility-monitoring.worker.ts", "seo_tools"],
    ["src/lib/signals/competitors.ts", "reputation"],
  ])("%s re-checks %s", (file, area) => {
    expect(read(file)).toContain(`tenantAllowsArea(`);
    expect(read(file)).toContain(`"${area}"`);
  });

  it("the citation-opportunity pass re-reads the plan and spends only for citation_tracking", () => {
    const src = read("src/infrastructure/queue/workers/citation-opportunities.worker.ts");
    expect(src).toContain("const plan = await tenantPlan(tenantId);");
    expect(src).toContain('if (!plan || !hasFeature(plan, "citation_tracking")) {');
  });

  it("the Keyword Opportunity run refuses before spending", () => {
    expect(read("src/lib/keyword-opportunity/runner.ts")).toMatch(/if \(!planAllowsArea\(plan, "seo_tools"\)\) \{[\s\S]{0,200}return fail\(\{ stoppedReason: "plan_excludes_area" \}\);/);
  });
});

describe("plan changes pause and resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crawlSchedule.findMany.mockResolvedValue([
      { id: "s1", cadence: "weekly", hourUtc: 3, enabled: true },
      { id: "s2", cadence: "monthly", hourUtc: 4, enabled: true },
    ]);
  });
  const crawlQueue = {
    getRepeatableJobs: vi.fn(async () => [{ key: "k-s1", id: "crawl-schedule-s1" }, { key: "k-s2", id: "crawl-schedule-s2" }]),
    removeRepeatableByKey: vi.fn(async () => true),
    add: vi.fn(async () => ({})),
  };
  const job = (tenantId: string) => ({ data: { tenantId }, remove: vi.fn(async () => {}) });

  it("a downgrade to AI Visibility pauses crawl schedules and stops only this tenant's pending sends", async () => {
    const { onPlanChange } = await import("@/lib/plan-change");
    const mine = [job("t1"), job("t1")];
    const theirs = job("t2");
    const out = await onPlanChange("t1", "STARTER", "AI_VISIBILITY", {
      crawlQueue: crawlQueue as never,
      sendQueues: [{ getJobs: async () => [mine[0], theirs] }, { getJobs: async () => [mine[1]] }],
    });
    expect(out).toEqual({ direction: "pause", crawlSchedules: 2, sendsStopped: 2 });
    expect(mine.every((j) => j.remove.mock.calls.length === 1)).toBe(true);
    expect(theirs.remove).not.toHaveBeenCalled();
  });

  it("an upgrade resumes the crawl schedules", async () => {
    const { onPlanChange } = await import("@/lib/plan-change");
    const out = await onPlanChange("t1", "AI_VISIBILITY", "GROWTH", { crawlQueue: crawlQueue as never, sendQueues: [] });
    expect(out).toEqual({ direction: "resume", crawlSchedules: 2, sendsStopped: 0 });
    expect(crawlQueue.add).toHaveBeenCalledTimes(2);
  });

  it("a move between unrestricted plans touches nothing", async () => {
    const { onPlanChange } = await import("@/lib/plan-change");
    expect((await onPlanChange("t1", "STARTER", "GROWTH")).direction).toBe("none");
    expect(m.crawlSchedule.findMany).not.toHaveBeenCalled();
  });

  it("never throws: the plan change stands", async () => {
    const { onPlanChange } = await import("@/lib/plan-change");
    m.crawlSchedule.findMany.mockRejectedValue(new Error("db down"));
    await expect(onPlanChange("t1", "GROWTH", "AI_VISIBILITY", { crawlQueue: crawlQueue as never, sendQueues: [] })).resolves.toEqual({ direction: "none", crawlSchedules: 0, sendsStopped: 0 });
  });

  it("the webhook calls it after writing the plan", () => {
    expect(read("src/app/api/webhooks/route.ts")).toMatch(/if \(planType && planType !== tenant\.planType\) \{\s*await onPlanChange\(tenant\.id, tenant\.planType, planType\);/);
  });
});

describe("allowances rise with the ladder", () => {
  const FREQ = { none: 0, weekly: 1, twice_weekly: 2, daily: 3, custom: 4 } as const;
  const engines = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);

  it("every higher plan is ≥ every lower plan on prompts, engines and frequency", () => {
    // The ladder of plans with AI visibility: the crawler-only plan has none.
    const ladder = PLAN_ORDER.filter((p) => planAllowsArea(p, "ai_visibility"));
    expect(ladder).not.toContain("NOSY_BAT");
    for (let i = 1; i < ladder.length; i++) {
      const lo = PLAN_CONFIGS[ladder[i - 1]!].aiCheckup;
      const hi = PLAN_CONFIGS[ladder[i]!].aiCheckup;
      const pair = `${ladder[i - 1]} -> ${ladder[i]}`;
      expect(hi.prompts, pair).toBeGreaterThanOrEqual(lo.prompts);
      expect(engines(hi.providers), pair).toBeGreaterThanOrEqual(engines(lo.providers));
      expect(FREQ[hi.frequency], pair).toBeGreaterThanOrEqual(FREQ[lo.frequency]);
      expect(hi.repetitions, pair).toBeGreaterThanOrEqual(lo.repetitions);
    }
  });

  it("the decided allowances", () => {
    const shape = (p: PlanType) => PLAN_CONFIGS[p].aiCheckup;
    expect(shape("AI_VISIBILITY")).toEqual({ frequency: "daily", providers: 3, prompts: 10, repetitions: 1 });
    expect(shape("STARTER")).toEqual({ frequency: "daily", providers: 4, prompts: 15, repetitions: 1 });
    expect(shape("GROWTH")).toEqual({ frequency: "daily", providers: 4, prompts: 15, repetitions: 2 });
    expect(shape("AGENCY")).toEqual({ frequency: "daily", providers: 4, prompts: 20, repetitions: 3 });
    expect([PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice, PLAN_CONFIGS.AI_VISIBILITY.annualPrice * 12]).toEqual([29, 276]);
    expect(planAllowsArea("AI_VISIBILITY", "ai_visibility")).toBe(true);
  });
});
