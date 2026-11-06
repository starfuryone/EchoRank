// One Claude model for every Claude TRACKING answer, so a Claude answer means
// the same thing on every surface: the scheduled tracker, the keyword-
// opportunity AI test, and the sidecar's answer_track.py (tracked prompts and
// the partner API's /visibility/query). The free AI Visibility Check asks no
// Claude engine. House calls (analysis, drafting) are tests/model-policy.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRACKING_CLAUDE_MODEL, TRACKING_MAX_TOKENS } from "@/ai/anthropic-request";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { ASK_MAX_TOKENS } from "@/lib/ai-monitor/runner/providers";
import { trackCostCeiling } from "@/lib/partner/service";
import { costUsdFor } from "@/lib/ai-monitor/pricing";

const APP = process.cwd();
const AV = "/opt/echorank/av-service";
const read = (p: string) => readFileSync(p, "utf8");

describe("the Claude tracking model", () => {
  it("is claude-sonnet-5", () => {
    expect(TRACKING_CLAUDE_MODEL).toBe("claude-sonnet-5");
  });

  it("is what the scheduled tracker's Claude engine asks", () => {
    const claude = ENGINE_CATALOGUE.find((e) => e.provider === "CLAUDE");
    expect(claude?.modelName).toBe(TRACKING_CLAUDE_MODEL);
    expect(ASK_MAX_TOKENS).toBe(TRACKING_MAX_TOKENS);
  });

  it("is what the keyword-opportunity AI test asks and meters", () => {
    const src = read(join(APP, "src/lib/keyword-opportunity/runner.ts"));
    const answerCall = src.slice(src.indexOf('purpose: "answer"') - 200, src.indexOf("promptText: prompt.text"));
    expect(answerCall).toContain("model: TRACKING_CLAUDE_MODEL");
    expect(answerCall).not.toContain("JSON_CALL_MODEL");
  });

  it("is what the sidecar's answer_track.py pins, with the same cap", () => {
    const src = read(join(AV, "answer_track.py"));
    expect(src).toContain(`MODEL = "${TRACKING_CLAUDE_MODEL}"`);
    expect(src).toMatch(new RegExp(`MAX_TOKENS = ${TRACKING_MAX_TOKENS}\\b`));
    expect(src).not.toContain("os.environ");
  });

  it("prices the partner API's ceiling at Sonnet 5's rate and the shared cap", () => {
    const promptChars = 400;
    const inputTokens = Math.ceil((200 + promptChars) / 4);
    const expected = costUsdFor(
      "CLAUDE",
      TRACKING_CLAUDE_MODEL,
      { inputTokens, outputTokens: TRACKING_MAX_TOKENS, cachedInputTokens: 0 },
      {} as NodeJS.ProcessEnv,
    ).costUsd;
    expect(trackCostCeiling(TRACKING_CLAUDE_MODEL, promptChars)).toBe(expected);
    // 150 in x $2 + 1,200 out x $10 per MTok.
    expect(expected).toBeCloseTo(0.0123, 6);
  });
});
