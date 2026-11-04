// tests/site-crawler-4c-config.test.ts — Phase 4c plan caps (schedules + cadences).
import { describe, expect, it } from "vitest";
import { planConfig } from "@/lib/plan-config";
import { scheduleCapsForPlan } from "@/lib/site-crawler/quota";

describe("plan caps (crawlSchedules / crawlScheduleCadences)", () => {
  it.each([
    ["STARTER", 1, ["monthly"]],
    ["GROWTH", 2, ["weekly", "monthly"]],
    ["AGENCY", 10, ["daily", "weekly", "monthly"]],
    ["ENTERPRISE", 10, ["daily", "weekly", "monthly"]],
  ] as const)("%s: %i schedules, cadences %j", (plan, n, cadences) => {
    expect(scheduleCapsForPlan(plan)).toEqual({ scheduleCap: n, scheduleCadences: cadences });
    expect(planConfig(plan)).toMatchObject({ crawlSchedules: n, crawlScheduleCadences: cadences });
  });
});
