// tests/site-crawler-4g-caps.test.ts — Phase 4g plan caps.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { planConfig } from "@/lib/plan-config";
import { parityCapsForPlan } from "@/lib/site-crawler/quota";

describe("plan caps (crawlSemanticPages / crawlInspectionPages)", () => {
  it.each([
    ["STARTER", 500, 50],
    ["GROWTH", 2000, 200],
    ["AGENCY", 5000, 500],
    ["ENTERPRISE", 5000, 500],
  ] as const)("%s: %i semantic pages, %i inspected pages", (plan, sem, ins) => {
    expect(parityCapsForPlan(plan)).toEqual({ semanticCap: sem, inspectionCap: ins });
    expect(planConfig(plan)).toMatchObject({ crawlSemanticPages: sem, crawlInspectionPages: ins });
  });
});
