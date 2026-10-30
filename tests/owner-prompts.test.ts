// tests/owner-prompts.test.ts — the owner tenant's seed list stays usable:
// 25 prompts (the AGENCY cap), 13 + 12 across the two brands, no duplicates,
// valid lengths for the prompts API, and no prompt that names its own answer.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWNER_BRANDS, OWNER_PROMPTS, planOwnerSeed } from "@/lib/owner-prompts/seed";

describe("owner prompt seed", () => {
  it("holds 25 prompts, 13 Echorank360 and 12 EchoPilot", () => {
    expect(OWNER_PROMPTS).toHaveLength(25);
    expect(OWNER_PROMPTS.filter((p) => p.brand === "echorank360")).toHaveLength(13);
    expect(OWNER_PROMPTS.filter((p) => p.brand === "echopilot")).toHaveLength(12);
  });

  it("fits the AGENCY active-prompt cap the prompts API enforces", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/ai/visibility/prompts/route.ts"), "utf8");
    const cap = Number(/planType === "AGENCY"\) return (\d+)/.exec(route)?.[1]);
    expect(OWNER_PROMPTS.length).toBeLessThanOrEqual(cap);
  });

  it("has unique, API-valid texts that name neither brand", () => {
    const texts = OWNER_PROMPTS.map((p) => p.text);
    expect(new Set(texts.map((t) => t.toLowerCase())).size).toBe(texts.length);
    const brandTerms = OWNER_BRANDS.flatMap((b) => [b.name, ...b.aliases]);
    for (const t of texts) {
      expect(t.length, t).toBeGreaterThanOrEqual(5);
      expect(t.length, t).toBeLessThanOrEqual(300);
      expect(t, t).toBe(t.trim().replace(/\s+/g, " "));
      for (const term of brandTerms) expect(t.toLowerCase(), t).not.toContain(term.toLowerCase());
    }
  });

  it("pauses everything else by default and deletes it only with prune", () => {
    const existing = [
      { id: "a", text: "best plumber in montreal", active: true },
      { id: "b", text: OWNER_PROMPTS[0].text, active: false },
      { id: "c", text: "old paused prompt", active: false },
    ];
    const plan = planOwnerSeed(existing);
    expect(plan.upsert).toHaveLength(25);
    expect(plan.pause).toEqual(["a"]);
    expect(plan.remove).toEqual([]);
    const pruned = planOwnerSeed(existing, true);
    expect(pruned.pause).toEqual([]);
    expect(pruned.remove.sort()).toEqual(["a", "c"]);
  });

  it("is re-applied by `npm run prompts:seed-owner` with the server-only strategy", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.scripts["prompts:seed-owner"]).toMatch(/--conditions=react-server/);
    expect(pkg.scripts["prompts:seed-owner"]).toMatch(/scripts\/seed-owner-prompts\.ts/);
  });

  it("the prompt runner counts a mention of any declared brand", () => {
    const worker = readFileSync(
      join(process.cwd(), "src/infrastructure/queue/workers/visibility-monitoring.worker.ts"),
      "utf8",
    );
    expect(worker).toMatch(/brandProfile\.findMany\(\{\s*where: \{ tenantId \}/);
    expect(worker).toMatch(/\[b\.name, \.\.\.b\.aliases\]/);
  });
});
