// tests/site-crawler-4e-caps.test.ts — Phase 4e plan caps and the AI key shape check.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { planConfig } from "@/lib/plan-config";
import { renderFeatureCapsForPlan } from "@/lib/site-crawler/quota";
import { plausibleAiKey } from "@/lib/site-crawler/ai-keys";

describe("plan caps (crawlJsSnippets / crawlAiPages)", () => {
  it.each([
    ["STARTER", 1, 20],
    ["GROWTH", 3, 100],
    ["AGENCY", 5, 500],
    ["ENTERPRISE", 5, 500],
  ] as const)("%s: %i snippets, %i AI pages", (plan, js, ai) => {
    expect(renderFeatureCapsForPlan(plan)).toEqual({ jsSnippetCap: js, aiPageCap: ai });
    expect(planConfig(plan)).toMatchObject({ crawlJsSnippets: js, crawlAiPages: ai });
  });
});

describe("plausibleAiKey", () => {
  it.each([
    ["sk-" + "x".repeat(40), true],
    ["AIza" + "y".repeat(35), true],
    ["short", false],
    ["has space " + "x".repeat(30), false],
    ["line\nbreak" + "x".repeat(30), false],
    ["x".repeat(257), false],
  ])("%#", (key, ok) => expect(plausibleAiKey(key)).toBe(ok));
});
