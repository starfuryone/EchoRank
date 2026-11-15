// AI memory in Marketing Studio (src/lib/marketing/service.ts generate()):
// recalled facts go into the system prompt and the result-cache key; after
// the call, the BRIEF is queued for memory, never the model's output.

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  callMarketingModel: vi.fn<(...a: unknown[]) => Promise<{ text: string; inputTokens: number; outputTokens: number; cacheReadTokens: number }>>(
    async () => ({
      text: "OUTPUT: we have 40 years of heritage (a claim the business never made)",
      inputTokens: 500,
      outputTokens: 300,
      cacheReadTokens: 0,
    }),
  ),
  recallForPrompt: vi.fn<(...a: unknown[]) => Promise<string[]>>(async () => []),
  rememberLater: vi.fn<(...a: unknown[]) => Promise<boolean>>(async () => true),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { aiApiCall: { create: vi.fn(async () => ({})) } } }));
vi.mock("@/lib/marketing/client", () => ({ callMarketingModel: m.callMarketingModel }));
vi.mock("@/lib/marketing/quota", async (orig) => ({
  ...(await orig<typeof import("@/lib/marketing/quota")>()),
  assertMarketingBudget: vi.fn(async () => {}),
  recordMarketingTokens: vi.fn(async () => {}),
  marketingTokensUsed: vi.fn(async () => 0),
}));
vi.mock("@/lib/marketing/cache", async (orig) => ({
  ...(await orig<typeof import("@/lib/marketing/cache")>()),
  readCachedGeneration: vi.fn(async () => null),
  writeCachedGeneration: vi.fn(async () => {}),
}));
vi.mock("@/lib/memory/recall", async (orig) => ({
  ...(await orig<typeof import("@/lib/memory/recall")>()),
  recallForPrompt: m.recallForPrompt,
  rememberLater: m.rememberLater,
}));

import { generate, memoryBriefFor } from "@/lib/marketing/service";
import { marketingCacheKey } from "@/lib/marketing/cache";
import { findMarketingCategory } from "@/lib/marketing-templates";

const category = findMarketingCategory("positioning")!;
const raw = { PRODUCT: "sourdough bread", AUDIENCE: "busy parents in Lyon", COMPETITOR: "Boulangerie Dupont", THEIR_ANGLE: "tradition" };
const input = { tenantId: "tA", plan: "GROWTH" as const, category, raw, locale: "en" as const, voiceGuide: null, userId: "u1" };
type Call = { system: { text: string }[]; userMessage: string };

beforeEach(() => vi.clearAllMocks());

describe("Marketing Studio with AI memory", () => {
  it("injects recalled facts as a system block, searching with the brief's words", async () => {
    m.recallForPrompt.mockResolvedValueOnce(["Tone is warm and plain, no exclamation marks."]);
    await generate(input);
    expect(m.recallForPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tA", plan: "GROWTH", surface: "marketing_studio", query: expect.stringContaining("sourdough bread") }),
    );
    const call = m.callMarketingModel.mock.calls[0][0] as Call;
    const block = call.system.map((s) => s.text).find((t) => t.startsWith("Known about this business"));
    expect(block).toContain("- Tone is warm and plain, no exclamation marks.");
    expect(call.userMessage).not.toContain("Known about this business");
  });

  it("no memories: the prompt is exactly what it was before memory", async () => {
    await generate(input);
    const call = m.callMarketingModel.mock.calls[0][0] as Call;
    expect(call.system.some((s) => s.text.startsWith("Known about this business"))).toBe(false);
  });

  it("queues the brief for memory, never the model's output", async () => {
    await generate(input);
    expect(m.rememberLater).toHaveBeenCalledTimes(1);
    const arg = m.rememberLater.mock.calls[0][0] as { tenantId: string; surface: string; userId: string; messages: { role: string; content: string }[] };
    expect(arg).toMatchObject({ tenantId: "tA", surface: "marketing_studio", userId: "u1" });
    const content = arg.messages.map((x) => x.content).join("\n");
    expect(content).toBe(memoryBriefFor(category, raw));
    expect(content).toContain("Boulangerie Dupont");
    expect(content).not.toContain("OUTPUT");
    expect(arg.messages.every((x) => x.role === "user")).toBe(true);
  });

  it("a slow or empty memory never blocks the generation", async () => {
    m.recallForPrompt.mockResolvedValueOnce([]);
    m.rememberLater.mockImplementationOnce(() => new Promise(() => {}));
    const r = await generate(input);
    expect(r.output).toContain("OUTPUT");
  });

  it("memories change the cache key; without them the key is the pre-memory key", () => {
    const base = { tenantId: "tA", categoryId: "positioning", values: raw, language: "en", voiceGuide: null };
    const withFacts = marketingCacheKey({ ...base, knownFacts: "Known about this business…\n- Tone is plain." });
    expect(withFacts).not.toBe(marketingCacheKey(base));
    expect(marketingCacheKey({ ...base, knownFacts: null })).toBe(marketingCacheKey(base));
  });
});
