// Config integrity for the 12 Marketing Studio categories.
import { describe, it, expect } from "vitest";
import {
  MARKETING_CATEGORIES,
  MARKETING_MODEL,
  categoryVariables,
  findMarketingCategory,
  templateText,
} from "@/lib/marketing-templates";
import { hasFeature } from "@/lib/feature-flags";
import { MARKETING_MONTHLY_OUTPUT_TOKENS } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";

describe("category config", () => {
  it("has exactly 12 categories", () => {
    expect(MARKETING_CATEGORIES).toHaveLength(12);
  });

  it("numbers them 01..12 with unique ids", () => {
    expect(MARKETING_CATEGORIES.map((c) => c.num)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
    const ids = MARKETING_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("uses only valid modes", () => {
    for (const c of MARKETING_CATEGORIES) {
      expect(["generate", "heuristic", "hybrid"]).toContain(c.mode);
    }
  });

  it("assigns the modes the cost doctrine calls for", () => {
    const byMode = (m: string) => MARKETING_CATEGORIES.filter((c) => c.mode === m).map((c) => c.id);
    // 08 is the only zero-API category; the three hybrids each have a heuristic
    // half plus one optional button.
    expect(byMode("heuristic")).toEqual(["voice"]);
    expect(byMode("hybrid").sort()).toEqual(["analytics", "social", "voc"]);
    expect(byMode("generate")).toHaveLength(8);
  });

  it("gives every variable key a unique name within its category", () => {
    for (const c of MARKETING_CATEGORIES) {
      const keys = categoryVariables(c).map((v) => v.k);
      expect(new Set(keys).size, `duplicate variable key in ${c.id}`).toBe(keys.length);
    }
  });

  it("declares at least one variable per category", () => {
    for (const c of MARKETING_CATEGORIES) {
      expect(categoryVariables(c).length, `${c.id} has no variables`).toBeGreaterThan(0);
    }
  });

  it("marks the pasted-data fields multiline", () => {
    // These are the three fields that carry a corpus and must never be sent to
    // the API — a single-line input would be a UI lie about that.
    const multiline = MARKETING_CATEGORIES.flatMap((c) =>
      categoryVariables(c).filter((v) => v.multiline).map((v) => `${c.id}.${v.k}`),
    );
    expect(multiline.sort()).toEqual([
      "analytics.DATA",
      "voc.RAW_FEEDBACK",
      "voice.WRITING_SAMPLES",
    ]);
  });

  it("gives every AI-calling category a token ceiling, and the heuristic none", () => {
    for (const c of MARKETING_CATEGORIES) {
      if (c.mode === "heuristic") {
        expect(c.maxTokens, `${c.id} is heuristic and needs no ceiling`).toBeUndefined();
      } else {
        expect(c.maxTokens, `${c.id} has no maxTokens`).toBeGreaterThan(0);
      }
    }
  });

  it("uses the higher ceiling only where the brief asks for it", () => {
    const byId = Object.fromEntries(MARKETING_CATEGORIES.map((c) => [c.id, c]));
    expect(byId.email.maxTokens).toBe(2500);
    expect(byId.campaign.maxTokens).toBe(2500);
    // Everything else generative stays at the 1500 default.
    for (const c of MARKETING_CATEGORIES) {
      if (c.mode === "generate" && !["email", "campaign"].includes(c.id)) {
        expect(c.maxTokens, `${c.id}`).toBe(1500);
      }
    }
  });

  it("pins one model and never names Sonnet", () => {
    expect(MARKETING_MODEL).toBe("claude-haiku-4-5");
    const serialized = JSON.stringify(MARKETING_CATEGORIES);
    expect(serialized).not.toMatch(/sonnet/i);
    // No per-category model field — one constant, as specified.
    for (const c of MARKETING_CATEGORIES) {
      expect(c).not.toHaveProperty("model");
    }
  });

  it("renders template text with every variable as a placeholder", () => {
    for (const c of MARKETING_CATEGORIES) {
      const text = templateText(c);
      for (const v of categoryVariables(c)) {
        expect(text, `${c.id} missing {${v.k}}`).toContain(`{${v.k}}`);
      }
    }
  });

  it("resolves ids and rejects unknown ones", () => {
    expect(findMarketingCategory("voice")?.num).toBe("08");
    expect(findMarketingCategory("nope")).toBeNull();
    expect(findMarketingCategory(undefined)).toBeNull();
    expect(findMarketingCategory(42)).toBeNull();
    // A prompt-injection attempt is just an unknown id.
    expect(findMarketingCategory("../../etc/passwd")).toBeNull();
  });
});

describe("tier gating", () => {
  const PAID: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

  it("grants marketing_studio to STARTER and up", () => {
    for (const plan of PAID) {
      expect(hasFeature(plan, "marketing_studio"), plan).toBe(true);
    }
  });

  it("withholds it from AI_VISIBILITY", () => {
    // The whole point of the flag: AI_VISIBILITY is a standalone product, not
    // the bottom rung.
    expect(hasFeature("STARTER", "marketing_studio")).toBe(true);
  });

  it("gives every plan a monthly output-token budget", () => {
    const plans: PlanType[] = [...PAID];
    for (const plan of plans) {
      expect(plan in MARKETING_MONTHLY_OUTPUT_TOKENS, plan).toBe(true);
    }
    expect(MARKETING_MONTHLY_OUTPUT_TOKENS.STARTER).toBe(200_000);
    expect(MARKETING_MONTHLY_OUTPUT_TOKENS.GROWTH).toBe(500_000);
    expect(MARKETING_MONTHLY_OUTPUT_TOKENS.AGENCY).toBe(2_000_000);
    // Unlimited, not zero — a hard stop is the wrong failure mode on a
    // contract-priced tier.
    expect(MARKETING_MONTHLY_OUTPUT_TOKENS.ENTERPRISE).toBeNull();
  });

  it("orders the budgets by tier", () => {
    const { STARTER, GROWTH, AGENCY } = MARKETING_MONTHLY_OUTPUT_TOKENS;
    expect(STARTER!).toBeLessThan(GROWTH!);
    expect(GROWTH!).toBeLessThan(AGENCY!);
  });
});
