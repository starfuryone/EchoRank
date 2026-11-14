// Which plan a locked thing is "included in" (src/lib/upgrade-target.ts): the
// cheapest plan that includes it AND everything the tenant's plan has.
// Computed from the area and feature gates, never typed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanType } from "@/generated/prisma";
import { getFeaturesForPlan, hasFeature } from "@/lib/feature-flags";
import { ALL_AREAS, planAllowsArea } from "@/lib/plan-access";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { ALL_REPUTATION_TOOLS } from "@/lib/reputation-tools";
import {
  PAGE_GATES,
  PLANS_BY_PRICE,
  pageNeed,
  pageState,
  planMeets,
  planUpgradeBody,
  upgradeTarget,
  upgradeTargetForPage,
} from "@/lib/upgrade-target";

const PLANS = Object.keys(PLAN_CONFIGS) as PlanType[];
const DASH = join(process.cwd(), "src", "app", "(dashboard)");

/** Every (dashboard) page route on disk, as a path. */
function dashboardPages(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "page.tsx") {
        const route = "/" + relative(DASH, dir).split("/").filter((s) => !s.startsWith("(")).join("/");
        out.push(route.replace(/\[[^\]]+\]/g, "x"));
      }
    }
  };
  walk(DASH);
  return out;
}

function keeps(candidate: PlanType, current: PlanType): boolean {
  return (
    ALL_AREAS.every((a) => !planAllowsArea(current, a) || planAllowsArea(candidate, a)) &&
    getFeaturesForPlan(current).every((f) => hasFeature(candidate, f))
  );
}

describe("PLANS_BY_PRICE", () => {
  it("orders PLAN_CONFIGS by monthly price, custom-priced last", () => {
    const priced = PLANS_BY_PRICE.filter((p) => !PLAN_CONFIGS[p].isCustomPricing).map((p) => PLAN_CONFIGS[p].monthlyPrice);
    expect(priced).toEqual([...priced].sort((a, b) => a - b));
    expect(PLANS_BY_PRICE.at(-1)).toBe("ENTERPRISE");
    expect([...PLANS_BY_PRICE].sort()).toEqual([...PLANS].sort());
  });
});

describe("the rule, on every plan × every dashboard page", () => {
  const pages = dashboardPages();

  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThan(40);
  });

  it("names a plan that includes the page, keeps everything, and nothing cheaper does both", () => {
    for (const current of PLANS) {
      for (const page of pages) {
        const need = pageNeed(page);
        const target = upgradeTargetForPage(current, page);
        if (planMeets(current, need)) {
          expect(target, `${current} ${page}`).toBeNull();
          continue;
        }
        expect(target, `${current} ${page}`).not.toBeNull();
        expect(planMeets(target!, need), `${current} ${page} → ${target}`).toBe(true);
        expect(keeps(target!, current), `${current} ${page} → ${target} is sideways`).toBe(true);
        const cheaper = PLANS_BY_PRICE.slice(0, PLANS_BY_PRICE.indexOf(target!)).filter(
          (p) => p !== current && planMeets(p, need) && keeps(p, current),
        );
        expect(cheaper, `${current} ${page}`).toEqual([]);
      }
    }
  });

  it("is never sideways: AI Visibility on the crawler sees Starter, not Nosy Bat", () => {
    expect(upgradeTargetForPage("AI_VISIBILITY", "/crawler")).toBe("STARTER");
    expect(upgradeTargetForPage("NOSY_BAT", "/visibility")).toBe("STARTER");
  });

  it("names the tool's own plan, not Starter, where Starter does not unlock it", () => {
    expect(upgradeTargetForPage("NOSY_BAT", "/visibility/tools/funnels")).toBe("AGENCY");
    expect(upgradeTargetForPage("AI_VISIBILITY", "/visibility/tools/opportunity-scanner")).toBe("AGENCY");
    expect(upgradeTargetForPage("AI_VISIBILITY", "/visibility/tools/share-of-voice")).toBe("GROWTH");
    expect(upgradeTargetForPage("STARTER", "/visibility/tools/api-access")).toBe("AGENCY");
    expect(upgradeTargetForPage("STARTER", "/monitoring")).toBe("AGENCY");
    expect(upgradeTargetForPage("STARTER", "/intelligence")).toBe("GROWTH");
  });

  it("the API refusal body names the computed plan", () => {
    expect(planUpgradeBody("crawler", "AI_VISIBILITY")).toMatchObject({ upgradeTo: "STARTER", error: expect.stringContaining("Available from Starter") });
    expect(planUpgradeBody("client_management", "NOSY_BAT")).toMatchObject({ upgradeTo: "STARTER" });
    expect(upgradeTarget("ENTERPRISE", { features: ["sso"] })).toBeNull();
  });
});

describe("rollouts hide, never lock", () => {
  const off = { ai_search: false, kof: false, assistant: false };
  it("a page behind an off switch is hidden on every plan, Enterprise included", () => {
    for (const plan of PLANS) {
      for (const page of ["/visibility/ai-search", "/visibility/tools/keyword-opportunities", "/assistant"]) {
        expect(pageState(plan, page, off).state, `${plan} ${page}`).toBe("hidden");
      }
    }
  });
  it("and follows the plan when the switch is on", () => {
    const on = { ai_search: true, kof: true, assistant: true };
    expect(pageState("STARTER", "/visibility/tools/keyword-opportunities", on).state).toBe("open");
    expect(pageState("NOSY_BAT", "/visibility/tools/keyword-opportunities", on)).toEqual({ state: "locked", upgradeTo: "STARTER" });
  });
});

describe("PAGE_GATES mirror the routes' own checks", () => {
  const src = (page: string) => readFileSync(join(DASH, page, "page.tsx"), "utf8");
  for (const gate of PAGE_GATES) {
    if (!gate.prefix.startsWith("/visibility/tools/")) continue;
    it(`${gate.prefix}`, () => {
      // Marketing Studio checks its feature in its service's plan gate, not
      // in the page (the page renders the client's locked card).
      const code =
        gate.prefix === "/visibility/tools/ai-content-helper"
          ? readFileSync(join(process.cwd(), "src", "lib", "marketing", "quota.ts"), "utf8")
          : src(gate.prefix);
      for (const f of gate.features ?? []) {
        if (f === "api_access") expect(code).toContain("planIncludesApi(");
        else expect(code).toContain(`"${f}"`);
      }
      if (gate.rollout === "kof") expect(code).toContain("kofEnabledFor(");
    });
  }

  it("the reputation hub's features are the same gates", () => {
    for (const tool of ALL_REPUTATION_TOOLS) {
      expect(pageNeed(tool.href).features ?? [], tool.id).toEqual(tool.feature ? [tool.feature] : []);
    }
  });

  it("AI Search Intelligence reads the ai_search switch", () => {
    expect(readFileSync(join(DASH, "visibility", "ai-search", "page.tsx"), "utf8")).toMatch(/aiSearchEnabledFor\(|notFound\(/);
  });
});
