// Sentiment: topics by name matching first, the house Claude model only for
// the tone (src/ai/pipelines/sentiment.ts).
import { describe, expect, it, vi } from "vitest";
import { SentimentPipeline, SENTIMENT_MODEL } from "@/ai/pipelines/sentiment";
import type { AiProvider, InferenceRequest } from "@/ai/providers/base";

const REVIEW =
  "The staff were rude and the delivery took forever, but honestly the food was not bad at all.";

function stubProvider(content: string) {
  const requests: InferenceRequest[] = [];
  const provider = {
    name: "anthropic",
    isMock: false,
    infer: vi.fn(async (request: InferenceRequest) => {
      requests.push(request);
      return {
        content,
        promptTokens: 180,
        completionTokens: 40,
        modelId: SENTIMENT_MODEL,
        provider: "anthropic",
        isMock: false,
      };
    }),
    healthCheck: async () => true,
  } as unknown as AiProvider;
  return { provider, requests };
}

describe("sentiment pipeline", () => {
  it("runs on the house model, Haiku 5.5", () => {
    expect(SENTIMENT_MODEL).toBe("claude-haiku-5-5");
  });

  it("asks the model for the tone only, and takes topics from name matching", async () => {
    const { provider, requests } = stubProvider(
      '{"label":"mixed","score":-0.3,"emotions":["frustration"],"confidence":0.8,"topics":["invented"]}',
    );
    const pipeline = new SentimentPipeline(() => provider);
    const { result, usage } = await pipeline.analyzeWithUsage(REVIEW, {
      customerName: "Jane Doe",
      rating: 2,
      source: "google",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].modelId).toBe("claude-haiku-5-5");
    expect(requests[0].temperature).toBeUndefined();
    // The prompt does not ask for topics, and no customer name is sent.
    expect(requests[0].systemPrompt).not.toMatch(/topics/i);
    expect(requests[0].userPrompt).not.toContain("Jane Doe");

    // The tone is the model's...
    expect(result.label).toBe("mixed");
    expect(result.score).toBe(-0.3);
    expect(result.emotions).toEqual(["frustration"]);
    // ...the topics are the name matches, never what the model invented.
    expect(result.topics).toEqual(
      expect.arrayContaining(["customer service", "delivery", "food", "wait time"]),
    );
    expect(result.topics).not.toContain("invented");
    expect(usage).toEqual({ promptTokens: 180, completionTokens: 40, modelId: "claude-haiku-5-5" });
  });

  it("falls back to the heuristic tone on a malformed reply, and still reports the spend", async () => {
    const { provider } = stubProvider("I think it is mostly negative.");
    const pipeline = new SentimentPipeline(() => provider);
    const { result, usage } = await pipeline.analyzeWithUsage(REVIEW, { rating: 2 });
    expect(result).toEqual(pipeline.heuristicAnalysis(REVIEW, 2));
    expect(usage?.promptTokens).toBe(180);
  });

  it("reads a tone object wrapped in a fence", () => {
    const pipeline = new SentimentPipeline(() => null);
    expect(
      pipeline.parseTone('```json\n{"label":"positive","score":0.9,"emotions":[],"confidence":0.9}\n```'),
    ).toEqual({ label: "positive", score: 0.9, emotions: [], confidence: 0.9 });
  });

  it("calls no model and meters nothing without a key", async () => {
    const pipeline = new SentimentPipeline(() => null);
    const { result, usage } = await pipeline.analyzeWithUsage(REVIEW, { rating: 2 });
    expect(usage).toBeNull();
    expect(result.topics).toEqual(pipeline.heuristicAnalysis(REVIEW, 2).topics);
  });
});
