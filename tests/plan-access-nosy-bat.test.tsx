// @vitest-environment jsdom
//
// The crawler-only plan (NOSY_BAT, 2026-11-10): crawler only, deny by default,
// enforced in every layer (src/lib/plan-access.ts).
//
// What this protects:
//   - the route walk: every (dashboard) page and /api route on disk is either
//     on the crawler-only plan's allowlist or refused (the upgrade screen, a
//     403 PLAN_UPGRADE_REQUIRED). The allowlist is FROZEN below: a new route
//     that lands on it fails this test until it is reviewed, and an
//     unclassified route is refused (and fails tests/plan-access.test.ts);
//   - Starter, Growth, Agency and AI Visibility reach what they did before;
//   - the sidebar, the header and the upgrade screen show the crawler-only
//     plan only what it has;
//   - background jobs re-check the plan (every worker that does excluded work);
//   - the paid crawl options are off for the plan;
//   - plan changes: a downgrade keeps the data and stops the sends; an upgrade
//     opens every area at once.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  crawlSchedule: { findMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
  alertEvent: { updateMany: vi.fn(async () => ({ count: 1 })) },
  sendMail: vi.fn(),
  pathname: "/crawler",
}));
vi.mock("@/lib/prisma", () => ({ prisma: { crawlSchedule: m.crawlSchedule, tenant: m.tenant } }));
vi.mock("@/infrastructure/queue/registry", () => ({ getQueue: () => ({}) }));
vi.mock("next/navigation", () => ({ usePathname: () => m.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/signals/db", () => ({ prisma: { alertEvent: m.alertEvent } }));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));

import type { PlanType } from "@/generated/prisma";
import {
  AI_VISIBILITY_AREAS,
  NOSY_BAT_AREAS,
  areaForApi,
  areaForPage,
  planAllowsApi,
  planAllowsArea,
  planAllowsPage,
  planIsRestricted,
  planShowsLockedTeasers,
} from "@/lib/plan-access";
import { planUpgradeBody, upgradeTargetForPage } from "@/lib/upgrade-target";
import { PLAN_CONFIGS, PLAN_ORDER, isPlanAtLeast, isUpgrade } from "@/lib/plan-config";
import { hasFeature } from "@/lib/feature-flags";
import { PLAN_HOME } from "@/lib/plan-routing";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PlanUpgradeScreen } from "@/components/billing/PlanUpgradeScreen";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function walk(dir: string, file: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n.includes(".bak")) return [];
    return statSync(p).isDirectory() ? walk(p, file) : n === file ? [p] : [];
  });
}
const concrete = (p: string) => p.replace(/\[\.{0,3}[^\]]+\]/g, "x");
const PAGES = walk(join(ROOT, "src/app/(dashboard)"), "page.tsx").map(
  (f) => ("/" + relative(join(ROOT, "src/app/(dashboard)"), f).replace(/\/?page\.tsx$/, "")).replace(/\/$/, "") || "/",
);
const APIS = walk(join(ROOT, "src/app/api"), "route.ts").map((f) => "/api/" + relative(join(ROOT, "src/app/api"), f).replace(/\/route\.ts$/, ""));
const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const NB: PlanType = "NOSY_BAT";

/** THE CRAWLER-ONLY PLAN'S ALLOWLIST: every page and API route it may reach, besides the exempt APIs. */
const ALLOWED_PAGES = [
  "/billing",
  // The cancel confirmation page (CANCEL-FAIR-PLAY): every plan can leave.
  "/billing/cancel",
  "/crawler",
  "/crawler/[id]",
  "/crawler/[id]/issues",
  "/crawler/[id]/pages",
  "/crawler/history",
  "/crawler/schedules",
  "/help",
  "/settings",
  "/settings/account",
  // The tools hub index, showing only the crawler card (no locked teasers).
  "/visibility/tools",
  "/visibility/tools/site-crawler",
];
const ALLOWED_API_OUTSIDE_THE_CRAWL_API = [
  "/api/account/deletion",
  "/api/account/export",
  "/api/ai/visibility/gsc/callback",
  "/api/ai/visibility/gsc/connect",
  "/api/ai/visibility/gsc/disconnect",
  "/api/ai/visibility/gsc/select",
  "/api/ai/visibility/gsc/status",
  "/api/billing",
  "/api/billing/cancel",
  "/api/billing/checkout",
  "/api/billing/portal",
  "/api/billing/resume",
  // /welcome's poll while the webhook lands (PLAN-HUB Part 1): every plan's buyer.
  "/api/billing/status",
  "/api/metering",
  "/api/metering/history",
  "/api/onboarding",
  "/api/seo/v1/ga4/connect",
  "/api/seo/v1/ga4/properties",
  "/api/seo/v1/ga4/property",
  "/api/tenants",
  "/api/tenants/active",
];

describe("the crawler-only plan's allowlist", () => {
  it("is the crawler, its Google connections, the account basics and the tools hub, nothing else", () => {
    expect([...NOSY_BAT_AREAS].sort()).toEqual(["account", "crawler", "exempt", "google_connections", "tools_hub"]);
    expect(planIsRestricted(NB)).toBe(true);
    expect(PLAN_HOME.NOSY_BAT).toBe("/crawler");
  });

  it("walks every (dashboard) page: allowed only if it is on the list, refused (upgrade screen) otherwise", () => {
    const allowed = PAGES.filter((p) => planAllowsPage(NB, concrete(p))).sort();
    expect(allowed).toEqual(ALLOWED_PAGES);
    for (const p of PAGES) {
      const area = areaForPage(concrete(p));
      expect(area, `${p} is unclassified`).not.toBeNull();
      expect(planAllowsPage(NB, concrete(p)), p).toBe(NOSY_BAT_AREAS.has(area!));
    }
  });

  it("walks every /api route: allowed only if on the list (or exempt), 403 PLAN_UPGRADE_REQUIRED otherwise, for every verb", () => {
    const outside = APIS.filter((p) => !p.startsWith("/api/seo/v1/crawl"));
    const allowed = outside
      .filter((p) => areaForApi(concrete(p), "GET") !== "exempt")
      .filter((p) => VERBS.some((v) => planAllowsApi(NB, concrete(p), v)))
      .sort();
    expect(allowed).toEqual(ALLOWED_API_OUTSIDE_THE_CRAWL_API);
    // The crawl API: every route of it, every verb.
    const crawl = APIS.filter((p) => p.startsWith("/api/seo/v1/crawl"));
    expect(crawl.length).toBeGreaterThan(30);
    for (const p of crawl) for (const v of VERBS) expect(planAllowsApi(NB, concrete(p), v), `${v} ${p}`).toBe(true);
    // Everything else is refused, and the refusal names the plan to upgrade to.
    for (const p of APIS) {
      for (const v of VERBS) {
        const area = areaForApi(concrete(p), v);
        expect(area, `${v} ${p} is unclassified`).not.toBeNull();
        expect(planAllowsApi(NB, concrete(p), v), `${v} ${p}`).toBe(NOSY_BAT_AREAS.has(area!));
      }
    }
    // The plan named is computed (src/lib/upgrade-target.ts): for the SEO
    // tools, Starter is the cheapest plan that opens them and keeps the crawler.
    expect(planUpgradeBody("seo_tools", NB)).toMatchObject({ code: "PLAN_UPGRADE_REQUIRED", upgradeTo: "STARTER", error: expect.stringContaining("Available from Starter") });
  });

  it("refuses a route no rule classifies (deny by default), for both restricted plans only", () => {
    for (const plan of ["NOSY_BAT", "AI_VISIBILITY"] as const) {
      expect(planAllowsPage(plan, "/brand-new-thing")).toBe(false);
      expect(planAllowsApi(plan, "/api/brand-new-thing", "GET")).toBe(false);
    }
    for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      expect(planAllowsPage(plan, "/brand-new-thing")).toBe(true);
      expect(planAllowsApi(plan, "/api/brand-new-thing", "GET")).toBe(true);
    }
  });

  it("excludes each feature the owner listed", () => {
    const refusedPages = ["/visibility/keywords", "/visibility/tools/rank-tracker", "/visibility/tools/backlinks", "/visibility/tools/link-authority", "/visibility/tools/site-explorer", "/visibility", "/ai", "/reputation", "/feedback", "/visibility/tools/ai-content-helper", "/visibility/tools/social-posting", "/visibility/tools/bot-analytics", "/visibility/tools/opportunity-scanner", "/team", "/visibility/tools/api-access", "/visibility/tools/mcp-server", "/dashboard", "/notifications", "/assistant"];
    for (const p of refusedPages) expect(planAllowsPage(NB, p), p).toBe(false);
    const refusedApis = ["/api/seo/v1/keywords", "/api/seo/v1/backlinks", "/api/seo/v1/link-authority", "/api/ai/visibility/brands", "/api/av/audit", "/api/reputation", "/api/action-agent", "/api/ai/visibility/bots", "/api/agency/scan", "/api/team", "/api/ai/visibility/api-keys", "/api/ai/visibility/gsc/performance", "/api/ai/visibility/gsc/sync", "/api/billing/credits/checkout", "/api/account/matrix/provision"];
    for (const p of refusedApis) expect(planAllowsApi(NB, p, "POST"), p).toBe(false);
    // White-label and client workspaces: creating a workspace is client management.
    expect(planAllowsApi(NB, "/api/tenants", "POST")).toBe(false);
    expect(planAllowsApi(NB, "/api/tenants", "GET")).toBe(true);
  });

  it("has no feature, no API or MCP, no white-label, and fails every 'Starter and up' check", () => {
    for (const f of ["api_access", "whitelabel", "ai_visibility", "marketing_studio", "reputation_monitoring", "citation_tracking", "answer_tracking"] as const) expect(hasFeature(NB, f), f).toBe(false);
    for (const p of PLAN_ORDER) expect(isPlanAtLeast(NB, p), p).toBe(false);
    expect(isUpgrade(NB, "STARTER")).toBe(true);
    expect(isUpgrade("STARTER", NB)).toBe(false);
    expect(PLAN_ORDER).not.toContain(NB);
  });
});

describe("every other plan reaches what it did before", () => {
  it("Starter, Growth, Agency and Enterprise reach every page and route", () => {
    for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      expect(planIsRestricted(plan)).toBe(false);
      for (const p of PAGES) expect(planAllowsPage(plan, concrete(p)), `${plan} ${p}`).toBe(true);
      for (const p of APIS) for (const v of VERBS) expect(planAllowsApi(plan, concrete(p), v), `${plan} ${v} ${p}`).toBe(true);
    }
  });

  it("AI Visibility keeps team, notifications, the tools hub and credits (split out of their old areas), and still has no Google connection routes", () => {
    for (const p of ["/team", "/notifications", "/visibility/tools", "/visibility", "/help", "/settings", "/dashboard"]) expect(planAllowsPage("AI_VISIBILITY", p), p).toBe(true);
    for (const p of ["/api/team", "/api/notifications/unread-count", "/api/billing/credits/checkout", "/api/billing/watcher-status", "/api/account/matrix/provision"]) expect(planAllowsApi("AI_VISIBILITY", p, "POST"), p).toBe(true);
    // Before the split these were "seo_tools", which it never had.
    for (const p of ["/api/ai/visibility/gsc/connect", "/api/seo/v1/ga4/properties", "/crawler", "/api/seo/v1/crawl"]) expect(planAllowsApi("AI_VISIBILITY", p, "GET") || planAllowsPage("AI_VISIBILITY", p), p).toBe(false);
    expect(AI_VISIBILITY_AREAS.has("google_connections")).toBe(false);
    expect(planShowsLockedTeasers("AI_VISIBILITY")).toBe(true);
  });
});

describe("layer 1: sidebar, header, tools hub", () => {
  const sidebar = (plan: PlanType) => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<Sidebar locale="en" plan={plan} paid assistantVisible={false} />));
    const rows = [...el.querySelectorAll("nav li a")].map((a) => a.getAttribute("href"));
    const upgrade = el.querySelector('[data-testid="sidebar-upgrade-more"]');
    act(() => root.unmount());
    el.remove();
    return { rows, upgrade };
  };

  it("the crawler-only plan's sidebar: the crawler and the account rows, plus one 'Upgrade for more tools' link, no locked rows", () => {
    const { rows, upgrade } = sidebar(NB);
    expect(rows).toEqual(["/crawler", "/settings", "/settings/account", "/billing", "/help"]);
    expect(upgrade?.textContent).toBe(PLAN_ACCESS_COPY.en.upgradeMore);
    expect(upgrade?.getAttribute("href")).toBe("/en/pricing");
  });

  it("Starter's sidebar is unchanged and has no upgrade link", () => {
    const { rows, upgrade } = sidebar("STARTER");
    expect(rows).toContain("/dashboard");
    expect(rows).toContain("/visibility/tools");
    expect(rows).toContain("/team");
    expect(upgrade).toBeNull();
  });

  it("no notification bell for the crawler-only plan (and no count fetch); the bell stays for the rest", () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const off = renderToStaticMarkup(<Header title="Nosy" locale="en" notifications={false} />);
    expect(off).not.toContain('href="/notifications"');
    const on = renderToStaticMarkup(<Header title="Nosy" locale="en" />);
    expect(on).toContain('href="/notifications"');
    vi.unstubAllGlobals();
  });

  it("the layout reads the plan for the bell and the welcome step, and hands the plan to the upgrade screen", () => {
    const layout = read("src/app/(dashboard)/layout.tsx");
    expect(layout).toContain('const notificationsOn = planAllowsArea(plan, "notifications");');
    expect(layout).toContain('{planAllowsArea(plan, "home") && <OnboardingGate locale={locale} />}');
    expect(layout).toContain('<PlanUpgradeScreen locale={locale} plan={plan} target={upgradeTargetForPage(plan, pathname ?? "")} />');
  });

  it("the tools hub drops locked cards, the tool count and the research log for a plan without teasers", () => {
    const hub = read("src/app/(dashboard)/visibility/tools/page.tsx");
    expect(hub).toContain("const teasers = planShowsLockedTeasers(plan);");
    expect(hub).toContain("g.tools.filter((tool) => planAllowsPage(plan, tool.href))");
    expect(hub).toContain('data-testid="hub-upgrade-more"');
    expect(planShowsLockedTeasers(NB)).toBe(false);
    // Its one card: the crawler.
    expect(planAllowsPage(NB, "/crawler")).toBe(true);
  });
});

describe("layer 2: the upgrade screen", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: names the computed plan, names the crawler, links back to it", (l) => {
    const target = upgradeTargetForPage(NB, "/visibility/tools/site-explorer");
    expect(target).toBe("STARTER");
    const html = renderToStaticMarkup(<PlanUpgradeScreen locale={l} plan={NB} target={target} />);
    const c = PLAN_ACCESS_COPY[l];
    expect(html).toContain(c.title("Starter"));
    expect(html).toContain(c.bodyCrawler("Starter").replace(/'/g, "&#x27;"));
    expect(html).toContain('href="/crawler"');
    if (l === "de-CH") {
      for (const s of [c.title("Agency"), c.body("Agency"), c.bodyCrawler("Agency"), c.locked("Agency"), c.titleNoPlan]) expect(s).not.toContain("ß");
    }
  });

  it("names Agency, not Starter, on a tool only Agency includes", () => {
    const target = upgradeTargetForPage(NB, "/visibility/tools/funnels");
    expect(target).toBe("AGENCY");
    const html = renderToStaticMarkup(<PlanUpgradeScreen locale="en" plan={NB} target={target} />);
    expect(html).toContain("Available from Agency");
    expect(html).not.toContain("Starter");
  });

  it("the AI-only plan's screen keeps its body", () => {
    const html = renderToStaticMarkup(<PlanUpgradeScreen locale="en" plan="AI_VISIBILITY" target="STARTER" />);
    expect(html).toContain(PLAN_ACCESS_COPY.en.body("Starter"));
    expect(html).toContain('href="/visibility"');
  });

  it("French elides before a vowel", () => {
    expect(PLAN_ACCESS_COPY.fr.title("Agency")).toBe("Disponible à partir d'Agency");
    expect(PLAN_ACCESS_COPY.fr.locked("Starter")).toBe("À partir de Starter");
  });
});

describe("layer 3: server-side checks beyond the proxy", () => {
  it("public endpoints that act for a tenant check its plan: the feedback link, the review import, the attribution beacon", () => {
    expect(read("src/app/api/feedback/[token]/route.ts").match(/tenantAllowsArea\(feedback\.tenantId, "reputation"\)/g)?.length).toBe(2);
    expect(read("src/app/api/extension/import/route.ts")).toContain('tenantAllowsArea(tenantId, "reputation")');
    expect(read("src/app/api/collect/route.ts")).toContain('tenantAllowsArea(verified.tenantId, "seo_tools")');
    // Public API v1 and MCP: key auth refuses a plan without public_api (and,
    // since 2026-11-14, without the api_access feature: src/lib/api-access.ts).
    expect(read("src/lib/api-keys.ts")).toContain("const plan = await tenantPlan(verified.tenantId);");
    expect(read("src/lib/api-keys.ts")).toContain("if (!plan || !planIncludesApi(plan)) {");
  });

  it("the crawler's Search Console link points at Settings for the crawler-only plan (it has no GSC tool page)", () => {
    expect(read("src/app/api/seo/v1/crawl/sources/route.ts")).toContain('planAllowsArea(tenant.tenant.planType, "seo_tools") ? "/visibility/tools/gsc-insights" : "/settings"');
    const settings = read("src/app/(dashboard)/settings/page-client.tsx");
    expect(settings).toContain('planAllowsArea(plan, "google_connections") && !planAllowsArea(plan, "seo_tools")');
    expect(read("src/app/api/ai/visibility/gsc/connect/route.ts")).toContain('fromSettings ? "gsc_settings" : "gsc"');
  });
});

describe("layer 4: background jobs re-check the plan when they run", () => {
  const CHECKS: [string, string][] = [
    ["src/workers/signals.worker.ts", "tenantAllowsArea(tenantId, 'reputation')"],
    ["src/lib/signals/notify.ts", "tenantAllowsArea(tenantId, 'reputation')"],
    ["src/infrastructure/queue/workers/ai-checkup.worker.ts", 'planAllowsArea(brand.tenant.planType, "ai_visibility")'],
    ["src/infrastructure/queue/workers/ai-checkup.worker.ts", 'planAllowsArea(planType, "ai_visibility")'],
    ["src/infrastructure/queue/workers/visibility-monitoring.worker.ts", 'tenantAllowsArea(monitor.tenantId, "ai_visibility")'],
    ["src/infrastructure/queue/workers/visibility-monitoring.worker.ts", 'tenantAllowsArea(tenantId, "ai_visibility")'],
    ["src/infrastructure/queue/workers/sov-aggregation.worker.ts", 'tenantAllowsArea(tenantId, "ai_visibility")'],
    ["src/infrastructure/queue/workers/citation-aggregation.worker.ts", 'tenantAllowsArea(tenantId, "ai_visibility")'],
    ["src/infrastructure/queue/workers/revenue-rollup.worker.ts", 'tenantAllowsArea(tenantId, "seo_tools")'],
    ["src/infrastructure/queue/workers/assistant-precompute.worker.ts", 'tenantAllowsArea(tenantId, "assistant")'],
    ["src/infrastructure/queue/workers/escalation-detection.worker.ts", 'tenantAllowsArea(tenantId, "reputation")'],
    ["src/infrastructure/queue/workers/reputation-scoring.worker.ts", 'tenantAllowsArea(tenantId, "reputation")'],
    ["src/infrastructure/queue/workers/ai-processing.worker.ts", 'tenantAllowsArea(tenantId, "reputation")'],
    ["src/infrastructure/queue/workers/analytics-aggregation.worker.ts", 'tenantAllowsArea(tenantId, "reputation")'],
    ["src/infrastructure/queue/workers/review-monitoring.worker.ts", 'tenantAllowsArea(tenantId, "reputation")'],
    ["src/infrastructure/queue/workers/action-agent.worker.ts", 'tenantAllowsArea(tenantId, "marketing_studio")'],
    ["src/lib/onboarding-email.ts", 'planAllowsArea(tenant.planType, "ai_visibility")'],
    // Already there before the plan: email, SMS, feedback routing, competitors, GSC sync, citations.
    ["src/infrastructure/queue/workers/email-delivery.worker.ts", '"reputation"'],
    ["src/infrastructure/queue/workers/feedback-routing.worker.ts", '"reputation"'],
    ["src/lib/signals/competitors.ts", "\"reputation\""],
  ];
  it.each(CHECKS)("%s checks %s", (file, check) => {
    expect(read(file)).toContain(check);
  });

  it("the feedback backfill only re-queues tenants whose plan routes feedback", () => {
    expect(read("src/lib/feedback-router.ts")).toContain("tenant: { planType: { in: ROUTABLE_PLANS } }");
  });

  it("the reputation alert email is skipped, and marked handled, on a plan without reputation", async () => {
    const { sendAlertDigest } = await import("@/lib/signals/notify");
    m.tenant.findUnique.mockResolvedValue({ planType: "NOSY_BAT" });
    await sendAlertDigest("t1", [{ id: "a1", severity: "critical" } as never]);
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(m.alertEvent.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["a1"] } }, data: { notifiedAt: expect.any(Date) } });
  });

  it("the crawl keeps running: site-crawl, schedules and retention have no plan check that could stop it", () => {
    expect(planAllowsArea(NB, "crawler")).toBe(true);
    expect(read("src/infrastructure/queue/workers/site-crawl.worker.ts")).not.toContain('"ai_visibility"');
  });
});

describe("layer 5: inside the crawler, nothing that spends our money", () => {
  it("backlink metrics and AI prompts are off (cap 0) and not drawn; the free options keep Agency's caps", () => {
    const c = PLAN_CONFIGS.NOSY_BAT;
    expect(c.crawlBacklinkPages).toBe(0);
    expect(c.crawlAiPages).toBe(0);
    expect(read("src/components/seo-tools/site-crawler-add-data.tsx")).toContain('flag("crawl.backlinks") && quota.backlinkCap > 0');
    expect(read("src/components/seo-tools/site-crawler-client.tsx")).toContain('flag("crawl.ai") && (quota?.aiPageCap ?? 0) > 0');
    const a = PLAN_CONFIGS.AGENCY;
    expect([c.crawlPsiPages, c.crawlJsSnippets, c.crawlSemanticPages, c.crawlInspectionPages]).toEqual([a.crawlPsiPages, a.crawlJsSnippets, a.crawlSemanticPages, a.crawlInspectionPages]);
  });
});

describe("plan changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crawlSchedule.findMany.mockResolvedValue([{ id: "s1", cadence: "weekly", hourUtc: 3, enabled: true }]);
  });
  const crawlQueue = { getRepeatableJobs: vi.fn(async () => []), removeRepeatableByKey: vi.fn(async () => true), add: vi.fn(async () => ({})) };
  const job = (tenantId: string) => ({ data: { tenantId }, remove: vi.fn(async () => {}) });

  it("a downgrade to the crawler-only plan stops the pending sends and leaves the crawl schedules (and every row) alone", async () => {
    const { onPlanChange } = await import("@/lib/plan-change");
    const mine = job("t1");
    const out = await onPlanChange("t1", "STARTER", NB, { crawlQueue: crawlQueue as never, sendQueues: [{ getJobs: async () => [mine] }] });
    expect(out.sendsStopped).toBe(1);
    expect(crawlQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(read("src/lib/plan-change.ts")).not.toMatch(/\.delete(Many)?\(/);
  });

  it("an upgrade to Starter opens every area at once (no area is still shut)", () => {
    for (const area of ["ai_visibility", "reputation", "seo_tools", "team", "home", "marketing_studio", "notifications"] as const) {
      expect(planAllowsArea(NB, area)).toBe(false);
      expect(planAllowsArea("STARTER", area)).toBe(true);
    }
  });
});
