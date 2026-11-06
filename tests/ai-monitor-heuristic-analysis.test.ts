// The heuristic analysis pass (src/lib/ai-monitor/analysis/heuristic.ts):
// entities and position from the text, tone from an en/fr/de lexicon, and a
// model call only for an unsure tone.
import { describe, expect, it, vi } from "vitest";
import { extractEntitiesHeuristic, lexiconTone } from "@/lib/ai-monitor/analysis/heuristic";
import { analysisMode, analyzeResponse, type BrandContext } from "@/lib/ai-monitor/analysis/analyze-response";
import type { AnthropicProvider } from "@/ai/providers/anthropic";
import type { InferenceRequest } from "@/ai/providers/base";

const BRAND: BrandContext = {
  brand: "Acme Plumbing",
  domain: "acmeplumbing.co.uk",
  brandVariations: ["Acme"],
  competitors: ["Pipeworks Ltd", "Leeds Drains"],
};
const CTX = { tenantId: "t1", plan: "GROWTH" as const, checkupId: "c1" };

function recorder(reply = '{"sentiment":"NEGATIVE"}') {
  const requests: InferenceRequest[] = [];
  const provider = {
    infer: vi.fn(async (r: InferenceRequest) => {
      requests.push(r);
      return { content: reply, promptTokens: 120, completionTokens: 8, modelId: r.modelId, provider: "anthropic", isMock: false };
    }),
  } as unknown as AnthropicProvider;
  const meter = vi.fn(async (_ctx: unknown, _spec: unknown, fn: () => Promise<{ value: unknown }>) => (await fn()).value);
  return { provider, meter: meter as never, requests, meterMock: meter };
}

describe("entities from the text", () => {
  it("reads the names that open list items, bold, linked or before a colon", () => {
    const answer = [
      "Here are good options in Leeds:",
      "",
      "1. **Pipeworks Ltd** – fast emergency call-outs.",
      "2. [Acme Plumbing](https://acmeplumbing.co.uk) – well reviewed.",
      "3. Leeds Drains: specialists in blockages.",
      "",
      "Also worth a look: **FlowRight**.",
    ].join("\n");
    expect(extractEntitiesHeuristic(answer, ["Acme Plumbing", "Acme", "Pipeworks Ltd"])).toEqual([
      "Pipeworks Ltd",
      "Acme Plumbing",
      "Leeds Drains",
      "FlowRight",
    ]);
  });

  it("skips advice items that are not names", () => {
    const answer = "1. Check reviews: look for recent ones.\n2. Compare quotes: get three.\n3. **Acme Plumbing**: reliable.";
    expect(extractEntitiesHeuristic(answer, [])).toEqual(["Acme Plumbing"]);
  });

  it("adds known names from prose in the order they appear, without doubling a longer form", () => {
    const answer = "Most people call Leeds Drains first, though Acme Plumbing is cheaper. Acme also does boilers.";
    expect(extractEntitiesHeuristic(answer, ["Acme Plumbing", "Acme", "Leeds Drains"])).toEqual([
      "Leeds Drains",
      "Acme Plumbing",
    ]);
  });
});

describe("tone from the lexicon", () => {
  const names = ["Acme Plumbing", "Acme"];

  it("is sure when the words agree", () => {
    expect(lexiconTone("Acme Plumbing is reliable and highly recommended.", names, false).sentiment).toBe("POSITIVE");
    expect(lexiconTone("Évitez Acme : trop cher et lent.", names, false).sentiment).toBe("NEGATIVE");
    expect(lexiconTone("Acme ist nicht empfehlenswert.", names, false).sentiment).toBe("NEGATIVE");
  });

  it("calls a listed brand with nothing said against it a recommendation, prose with nothing said neutral", () => {
    expect(lexiconTone("1. Acme Plumbing\n2. Pipeworks", names, true).sentiment).toBe("POSITIVE");
    expect(lexiconTone("Acme Plumbing operates in Leeds.", names, false).sentiment).toBe("NEUTRAL");
  });

  it("is unsure when both kinds of words are close", () => {
    expect(lexiconTone("Acme is reliable but expensive.", names, false).sentiment).toBeNull();
  });

  it("knows when the brand is not there", () => {
    expect(lexiconTone("Pipeworks is great.", names, false).sentiment).toBe("NOT_MENTIONED");
  });
});

describe("analyzeResponse, heuristic mode", () => {
  it("is the default; AI_ANALYSIS_MODE=llm restores the ranking pass", () => {
    expect(analysisMode({} as NodeJS.ProcessEnv)).toBe("heuristic");
    expect(analysisMode({ AI_ANALYSIS_MODE: "llm" } as unknown as NodeJS.ProcessEnv)).toBe("llm");
  });

  it("makes no model call when the lexicon is sure, and ranks from the list", async () => {
    const { provider, meter, meterMock } = recorder();
    const answer = "1. **Pipeworks Ltd** – fast.\n2. **Acme Plumbing** – reliable.\n3. **Leeds Drains**";
    const r = await analyzeResponse({ answer, promptText: "best plumber in Leeds" }, BRAND, CTX, { meter, provider });
    expect(meterMock).not.toHaveBeenCalled();
    expect(r.brandMentioned).toBe(true);
    expect(r.brandPosition).toBe(2);
    expect(r.competitors.map((c) => [c.name, c.position])).toEqual([
      ["Pipeworks Ltd", 1],
      ["Leeds Drains", 3],
    ]);
    expect(r.sentiment).toBe("POSITIVE");
    expect(r.extraction).toMatchObject({ ok: true, inputTokens: 0, outputTokens: 0, model: "heuristic" });
  });

  it("asks the house model for the tone alone when the lexicon is unsure, metered", async () => {
    const { provider, meter, meterMock, requests } = recorder('{"sentiment":"NEGATIVE"}');
    const r = await analyzeResponse(
      { answer: "Acme Plumbing is reliable but expensive.", promptText: "q" },
      BRAND,
      CTX,
      { meter, provider },
    );
    expect(meterMock).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].modelId).toBe("claude-haiku-5-5");
    expect(requests[0].systemPrompt).toMatch(/sentiment/);
    expect(requests[0].systemPrompt).not.toMatch(/entities/);
    expect(r.sentiment).toBe("NEGATIVE");
    expect(r.extraction).toMatchObject({ ok: true, inputTokens: 120, outputTokens: 8 });
  });

  it("makes no call for an answer that never names the brand", async () => {
    const { provider, meter, meterMock } = recorder();
    const r = await analyzeResponse({ answer: "Pipeworks is great.", promptText: "q" }, BRAND, CTX, { meter, provider });
    expect(meterMock).not.toHaveBeenCalled();
    expect(r.brandMentioned).toBe(false);
    expect(r.sentiment).toBe("NOT_MENTIONED");
  });
});
