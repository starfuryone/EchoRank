// tests/ai-search-json-call.test.ts
//
// The strict-JSON layer every LLM analysis call in the module goes through.
//
// THE CONTRACT UNDER TEST IS "NEVER THROWS". A worker that dies because a model
// returned prose stops processing every other tenant's jobs, so the retry, the
// give-up and the transport failure all have to come back as values.

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  MAX_ATTEMPTS,
  extractJson,
  parseStrictJson,
  repairPrompt,
  strictJsonCall,
  unfence,
} from "@/lib/ai-monitor/json-call";
import type { AnthropicProvider } from "@/ai/providers/anthropic";
import type { InferenceRequest } from "@/ai/providers/base";

const schema = z.object({ verdict: z.string(), score: z.number().min(0).max(1) });

/**
 * A provider that replays a scripted list of responses.
 *
 * Requests are recorded as they arrive, because the retry test asserts on what
 * the SECOND prompt contained — a retry that merely repeats the first prompt is
 * a retry that cannot fix anything, and that is the regression worth catching.
 */
function scriptedProvider(responses: string[]) {
  const requests: InferenceRequest[] = [];
  const infer = vi.fn(async (request: InferenceRequest) => {
    requests.push(request);
    return {
      content: responses.shift() ?? "",
      promptTokens: 100,
      completionTokens: 20,
      modelId: "claude-haiku-4-5",
      provider: "anthropic",
      isMock: false,
    };
  });
  return { provider: { infer } as unknown as AnthropicProvider, infer, requests };
}

describe("extracting JSON from a model's reply", () => {
  it("takes a bare object", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("unwraps a markdown fence", () => {
    expect(unfence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('survives "Here is the JSON:" preambles, which cost real money in retries', () => {
    expect(extractJson('Sure! Here is the JSON:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it("stops at the matching brace, not the last one in the string", () => {
    // A greedy regex would span both objects and produce invalid JSON.
    expect(extractJson('{"a":1} and then {"b":2}')).toBe('{"a":1}');
  });

  it("keeps nested objects whole", () => {
    expect(extractJson('{"a":{"b":{"c":1}}}')).toBe('{"a":{"b":{"c":1}}}');
  });

  it("ignores braces inside string literals", () => {
    // The bug this prevents: truncating at a `}` that is part of a quoted value,
    // which yields invalid JSON and burns the retry for no reason.
    expect(extractJson('{"a":"} not the end {","b":2}')).toBe('{"a":"} not the end {","b":2}');
  });

  it("ignores an escaped quote inside a string", () => {
    expect(extractJson('{"a":"say \\"} hi\\"","b":2}')).toBe('{"a":"say \\"} hi\\"","b":2}');
  });

  it("handles a top-level array", () => {
    expect(extractJson("[1, 2, 3]")).toBe("[1, 2, 3]");
  });

  it("returns null when there is no JSON at all", () => {
    expect(extractJson("I cannot help with that request.")).toBeNull();
  });

  it("returns null on an unterminated object rather than guessing", () => {
    expect(extractJson('{"a":1')).toBeNull();
  });
});

describe("validation", () => {
  it("accepts a well-formed object", () => {
    const result = parseStrictJson('{"verdict":"ok","score":0.5}', schema);
    expect(result.value).toEqual({ verdict: "ok", score: 0.5 });
    expect(result.problem).toBeNull();
  });

  it("reports a missing field by name, so the retry can fix it", () => {
    const result = parseStrictJson('{"verdict":"ok"}', schema);
    expect(result.value).toBeNull();
    expect(result.problem).toContain("score");
  });

  it("reports an out-of-range value", () => {
    const result = parseStrictJson('{"verdict":"ok","score":9}', schema);
    expect(result.value).toBeNull();
    expect(result.problem).toContain("score");
  });

  it("distinguishes malformed JSON from a schema mismatch", () => {
    expect(parseStrictJson("{not json}", schema).problem).toContain("invalid JSON");
    expect(parseStrictJson('{"verdict":1,"score":0.5}', schema).problem).toContain(
      "schema mismatch",
    );
  });

  it("names the offending path for a nested field", () => {
    const nested = z.object({ inner: z.object({ n: z.number() }) });
    expect(parseStrictJson('{"inner":{"n":"x"}}', nested).problem).toContain("inner.n");
  });
});

describe("the retry", () => {
  it("returns on the first attempt when the reply is valid", async () => {
    const { provider, infer } = scriptedProvider(['{"verdict":"ok","score":0.5}']);
    const result = await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider,
      label: "test",
    });

    expect(result.value).toEqual({ verdict: "ok", score: 0.5 });
    expect(result.attempts).toBe(1);
    expect(infer).toHaveBeenCalledTimes(1);
  });

  it("retries once, carrying the validation error back to the model", async () => {
    const { provider, requests } = scriptedProvider([
      '{"verdict":"ok"}',
      '{"verdict":"ok","score":0.5}',
    ]);
    const result = await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider,
      label: "test",
    });

    expect(result.value).toEqual({ verdict: "ok", score: 0.5 });
    expect(result.attempts).toBe(2);
    // The second prompt must contain the correction, not just repeat the first.
    const secondPrompt = requests[1]?.userPrompt ?? "";
    expect(secondPrompt).toContain("Your previous reply was rejected");
    expect(secondPrompt).toContain("score");
  });

  it("gives up after MAX_ATTEMPTS without throwing", async () => {
    const { provider, infer } = scriptedProvider(["nope", "still nope"]);
    const result = await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider,
      label: "test",
    });

    expect(result.value).toBeNull();
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.error).toBeTruthy();
    expect(infer).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("accumulates tokens across attempts, so the retry reaches the meter", async () => {
    // Under-counting here would systematically under-bill exactly the tenants
    // whose responses are hardest to parse.
    const { provider } = scriptedProvider(['{"verdict":"ok"}', '{"verdict":"ok","score":0.5}']);
    const result = await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider,
      label: "test",
    });

    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(40);
  });

  it("returns a transport failure rather than throwing, keeping the spend so far", async () => {
    const infer = vi
      .fn()
      .mockResolvedValueOnce({
        content: "not json",
        promptTokens: 100,
        completionTokens: 20,
        modelId: "claude-haiku-4-5",
        provider: "anthropic",
        isMock: false,
      })
      .mockRejectedValueOnce(new Error("upstream 529"));

    const result = await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider: { infer } as unknown as AnthropicProvider,
      label: "test",
    });

    expect(result.value).toBeNull();
    expect(result.error).toContain("529");
    expect(result.inputTokens).toBe(100);
  });

  it("does not retry a transport failure — BullMQ owns that backoff", async () => {
    const infer = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await strictJsonCall({
      schema,
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 100,
      provider: { infer } as unknown as AnthropicProvider,
      label: "test",
    });
    expect(infer).toHaveBeenCalledTimes(1);
  });
});

describe("the repair prompt", () => {
  it("clips a runaway previous reply instead of resending all of it", () => {
    const huge = "x".repeat(10_000);
    expect(repairPrompt(huge, "bad").length).toBeLessThan(3_000);
  });

  it("states the problem and demands bare JSON", () => {
    const repair = repairPrompt("{}", "score: Required");
    expect(repair).toContain("score: Required");
    expect(repair).toContain("ONLY the JSON object");
  });
});
