// The request rules every Claude call shares (src/ai/anthropic-request.ts) and the
// shared provider that applies them: no temperature, no prefill, thinking off
// on a house call, the model's own defaults on a tracking answer, and a price
// for every model the house runs on — so nothing meters at $0.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertNoPrefill,
  claudeCostUsd,
  claudeIsAdaptive,
  claudeMaxTokens,
  houseClaudeControls,
} from "@/ai/anthropic-request";
import { AnthropicProvider } from "@/ai/providers/anthropic";
import { estimateCost } from "@/ai/config";
import { costUsdFor } from "@/lib/ai-monitor/pricing";

const BARE = {} as NodeJS.ProcessEnv;

function captureFetch() {
  const bodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        model: "claude-haiku-5-5",
        // A thinking block first: the text is read by type, not position.
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "{\"ok\":true}" },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return bodies;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("houseClaudeControls", () => {
  it("turns thinking off and restates the cap on Haiku 5.5", () => {
    expect(houseClaudeControls("claude-haiku-5-5", 900)).toEqual({
      max_tokens: 1170,
      thinking: { type: "disabled" },
    });
  });

  it("leaves Haiku 4.5 as it was: no thinking field, the cap unchanged", () => {
    expect(houseClaudeControls("claude-haiku-4-5", 900)).toEqual({ max_tokens: 900 });
  });

  it("never disables thinking on Sonnet 5.5, which rejects it", () => {
    expect(houseClaudeControls("claude-sonnet-5-5", 100).thinking).toBeUndefined();
  });

  it("knows which models think by default", () => {
    expect(claudeIsAdaptive("claude-haiku-5-5")).toBe(true);
    expect(claudeIsAdaptive("claude-sonnet-5")).toBe(true);
    expect(claudeIsAdaptive("claude-haiku-4-5")).toBe(false);
    expect(claudeIsAdaptive("claude-haiku-4-5-20251001")).toBe(false);
    expect(claudeMaxTokens("claude-sonnet-5", 1000)).toBe(1300);
  });
});

describe("assertNoPrefill", () => {
  it("rejects a request that ends on an assistant turn", () => {
    expect(() =>
      assertNoPrefill([
        { role: "user" },
        { role: "assistant" },
      ]),
    ).toThrow(/prefill/);
    expect(() => assertNoPrefill([{ role: "user" }])).not.toThrow();
  });
});

describe("AnthropicProvider request body", () => {
  it("sends no temperature even when a caller passes one", async () => {
    const bodies = captureFetch();
    const provider = new AnthropicProvider("test-key");
    await provider.infer({
      systemPrompt: "s",
      userPrompt: "u",
      temperature: 0.1,
      maxTokens: 512,
      modelId: "claude-haiku-5-5",
    });
    expect(bodies[0]).not.toHaveProperty("temperature");
    expect(bodies[0]).not.toHaveProperty("top_p");
    expect(bodies[0]).not.toHaveProperty("top_k");
  });

  it("ends on the user's turn: no prefill", async () => {
    const bodies = captureFetch();
    await new AnthropicProvider("test-key").infer({
      systemPrompt: "s",
      userPrompt: "u",
      responseFormat: "json",
      modelId: "claude-haiku-5-5",
    });
    const messages = bodies[0].messages as Array<{ role: string }>;
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("turns thinking off on a house call and reads the text block by type", async () => {
    const bodies = captureFetch();
    const result = await new AnthropicProvider("test-key").infer({
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 900,
      modelId: "claude-haiku-5-5",
    });
    expect(bodies[0].thinking).toEqual({ type: "disabled" });
    expect(bodies[0].max_tokens).toBe(1170);
    expect(result.content).toBe("{\"ok\":true}");
  });

  it("leaves a tracking answer on the model's own defaults", async () => {
    const bodies = captureFetch();
    await new AnthropicProvider("test-key").infer({
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 1200,
      modelId: "claude-sonnet-5",
      mode: "observe",
    });
    expect(bodies[0]).not.toHaveProperty("thinking");
    expect(bodies[0]).not.toHaveProperty("temperature");
    expect(bodies[0].max_tokens).toBe(1200);
  });
});

describe("prices", () => {
  it("meters Haiku 5.5 at a non-zero cost on every price table", () => {
    const usage = { inputTokens: 1_200, outputTokens: 400, cachedInputTokens: 0 };
    const monitor = costUsdFor("CLAUDE", "claude-haiku-5-5", usage, BARE);
    expect(monitor.priced).toBe(true);
    expect(monitor.costUsd).toBeGreaterThan(0);
    expect(estimateCost("claude-haiku-5-5", 1_200, 400)).toBeGreaterThan(0);
    // $0.10 / $0.50 per MTok.
    expect(claudeCostUsd("claude-haiku-5-5", usage)).toBeCloseTo(0.00032, 9);
  });

  it("switches Haiku 5.5 to the long-prompt card above 100K prompt tokens", () => {
    const at = (inputTokens: number, cachedInputTokens = 0) =>
      costUsdFor("CLAUDE", "claude-haiku-5-5", { inputTokens, outputTokens: 1_000_000, cachedInputTokens }, BARE)
        .costUsd;
    expect(at(100_000)).toBeCloseTo(0.01 + 0.5, 6);
    // The ledger stores six decimals (Decimal(10,6)), so compare at five.
    expect(at(100_001)).toBeCloseTo(0.0500005 + 2.5, 5);
    // Cached input counts toward the prompt's length.
    expect(at(60_000, 50_000)).toBeCloseTo(0.03 + 0.0025 + 2.5, 5);
    expect(estimateCost("claude-haiku-5-5", 200_000, 0)).toBeCloseTo(0.1, 9);
  });

  it("prices Sonnet 5 at $2 / $10, not the cancelled $3 / $15", () => {
    const { costUsd } = costUsdFor(
      "CLAUDE",
      "claude-sonnet-5",
      { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 },
      BARE,
    );
    expect(costUsd).toBe(12);
    expect(estimateCost("claude-sonnet-5", 1_000_000, 1_000_000)).toBe(12);
  });
});
