// One Claude model for every Claude TRACKING answer, without web search, so a
// Claude answer means the same thing on every surface: the scheduled tracker,
// the keyword-opportunity AI test, and the sidecar's answer_track.py (tracked
// prompts and the partner API's /visibility/query). The free AI Visibility
// Check asks no Claude engine. House calls (analysis, drafting) are
// tests/model-policy.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TRACKING_CLAUDE_MODEL, TRACKING_MAX_TOKENS } from "@/ai/anthropic-request";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { askEngine } from "@/lib/ai-monitor/runner/providers";
import { trackCostCeiling } from "@/lib/partner/service";
import { costUsdFor } from "@/lib/ai-monitor/pricing";
import type { AnthropicProvider } from "@/ai/providers/anthropic";
import type { InferenceRequest } from "@/ai/providers/base";

const APP = process.cwd();
const AV = "/opt/echorank/av-service";
const read = (p: string) => readFileSync(p, "utf8");

describe("the Claude tracking model", () => {
  it("is claude-haiku-5-5", () => {
    expect(TRACKING_CLAUDE_MODEL).toBe("claude-haiku-5-5");
  });

  it("is what the scheduled tracker's Claude engine asks, without web search", () => {
    const claude = ENGINE_CATALOGUE.find((e) => e.provider === "CLAUDE");
    expect(claude?.modelName).toBe(TRACKING_CLAUDE_MODEL);
    expect(claude?.supportsSearch).toBe(false);
  });

  it("is asked with the shared cap, the model's own defaults and no tools", async () => {
    const requests: InferenceRequest[] = [];
    const anthropic = {
      infer: vi.fn(async (r: InferenceRequest) => {
        requests.push(r);
        return { content: "An answer.", promptTokens: 10, completionTokens: 5, modelId: r.modelId, provider: "anthropic", isMock: false };
      }),
    } as unknown as AnthropicProvider;
    await askEngine({ provider: "CLAUDE", model: TRACKING_CLAUDE_MODEL, promptText: "q" }, { anthropic });
    expect(requests[0]).toMatchObject({ modelId: TRACKING_CLAUDE_MODEL, maxTokens: TRACKING_MAX_TOKENS, mode: "observe" });
    expect(requests[0]).not.toHaveProperty("tools");
  });

  it("is what the keyword-opportunity AI test asks and meters", () => {
    const src = read(join(APP, "src/lib/keyword-opportunity/runner.ts"));
    expect(src).toContain('{ provider: "CLAUDE", model: TRACKING_CLAUDE_MODEL, purpose: "answer" }');
    expect(src).toMatch(/askEngine\(\{\s*provider: "CLAUDE",\s*model: TRACKING_CLAUDE_MODEL,/);
    expect(src).not.toMatch(/model: JSON_CALL_MODEL, purpose: "answer"/);
  });

  it("is what the sidecar's answer_track.py pins, with the same cap", () => {
    const src = read(join(AV, "answer_track.py"));
    expect(src).toContain(`MODEL = "${TRACKING_CLAUDE_MODEL}"`);
    expect(src).toMatch(new RegExp(`MAX_TOKENS = ${TRACKING_MAX_TOKENS}\\b`));
    expect(src).not.toContain("os.environ");
    expect(src).not.toMatch(/tools\s*=/);
  });

  it("prices the partner API's ceiling at Haiku 5.5's rate and the shared cap", () => {
    const promptChars = 400;
    const inputTokens = Math.ceil((200 + promptChars) / 4);
    const expected = costUsdFor(
      "CLAUDE",
      TRACKING_CLAUDE_MODEL,
      { inputTokens, outputTokens: TRACKING_MAX_TOKENS, cachedInputTokens: 0 },
      {} as NodeJS.ProcessEnv,
    ).costUsd;
    expect(trackCostCeiling(TRACKING_CLAUDE_MODEL, promptChars)).toBe(expected);
    // 150 in x $0.10 + 2,000 out x $0.50 per MTok.
    expect(expected).toBeCloseTo(0.001015, 6);
  });
});
