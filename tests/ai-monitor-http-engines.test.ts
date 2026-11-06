// tests/ai-monitor-http-engines.test.ts
//
// The ChatGPT and Gemini adapters for the scheduled tracker, and the per-search
// half of their pricing. Every call goes to a fake fetch: nothing here spends.

import { describe, expect, it, vi } from "vitest";
import { askEngine } from "@/lib/ai-monitor/runner/providers";
import { geminiSearchQueries, openAiSearchCalls } from "@/lib/ai-monitor/runner/http-engines";
import { costUsdFor, searchFeeFor } from "@/lib/ai-monitor/pricing";

const KEY = "test-key-not-real";
const ENV = { OPENAI_API_KEY: KEY, GEMINI_API_KEY: KEY } as unknown as NodeJS.ProcessEnv;

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), { status }));
}

const OPENAI_PAYLOAD = {
  model: "gpt-5-2025-08-07",
  output: [
    { type: "reasoning" },
    { type: "web_search_call", action: { sources: [{ url: "https://a.example/x" }] } },
    { type: "web_search_call", action: { sources: [{ url: "https://b.example/y" }] } },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Try Echorank360 or Acme.",
          annotations: [{ type: "url_citation", url: "https://c.example/z" }],
        },
      ],
    },
  ],
  usage: { input_tokens: 2100, output_tokens: 640 },
};

const GEMINI_PAYLOAD = {
  modelVersion: "gemini-3.8-flash",
  candidates: [
    {
      content: { parts: [{ text: "Echorank360 is one option." }] },
      groundingMetadata: {
        webSearchQueries: ["best ai visibility tool", "echorank360 review"],
        groundingChunks: [{ web: { title: "example.org", uri: "https://vertexaisearch.cloud.google.com/r/1" } }],
      },
    },
  ],
  usageMetadata: { promptTokenCount: 900, toolUsePromptTokenCount: 300, candidatesTokenCount: 500, thoughtsTokenCount: 200 },
};

describe("ChatGPT adapter", () => {
  it("asks the Responses API with web search left to the engine, and reads the answer", async () => {
    const doFetch = fakeFetch(OPENAI_PAYLOAD);
    const result = await askEngine(
      { provider: "CHATGPT", model: "gpt-5", promptText: "best ai visibility tool?" },
      { fetch: doFetch as unknown as typeof fetch, env: ENV },
    );

    const [url, init] = doFetch.mock.calls[0];
    expect(String(url)).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("gpt-5");
    expect(body.tools).toEqual([{ type: "web_search" }]);
    // Not forced: the tracker observes what the engine does on its own.
    expect(body.tool_choice).toBeUndefined();
    expect(body.input).toBe("best ai visibility tool?");
    expect(body.instructions).toBeTruthy();
    expect(body.store).toBe(false);

    expect(result.answer).toBe("Try Echorank360 or Acme.");
    expect(result.searchCalls).toBe(2);
    expect(result.inputTokens).toBe(2100);
    expect(result.outputTokens).toBe(640);
    expect(result.model).toBe("gpt-5-2025-08-07");
    expect(result.sources?.map((s) => s.url)).toEqual([
      "https://a.example/x",
      "https://b.example/y",
      "https://c.example/z",
    ]);
    // The key goes in the header and nowhere else.
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("counts zero searches when the engine answered without one", () => {
    expect(openAiSearchCalls({ output: [{ type: "message", content: [] }] })).toBe(0);
  });
});

describe("Gemini adapter", () => {
  it("asks generateContent with Google Search grounding and counts every query", async () => {
    const doFetch = fakeFetch(GEMINI_PAYLOAD);
    const result = await askEngine(
      { provider: "GEMINI", model: "gemini-3.8-flash", promptText: "best ai visibility tool?" },
      { fetch: doFetch as unknown as typeof fetch, env: ENV },
    );

    const [url, init] = doFetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(String(init?.body));
    expect(body.tools).toEqual([{ google_search: {} }]);

    expect(result.answer).toBe("Echorank360 is one option.");
    // Gemini 3 bills per search QUERY, not per prompt.
    expect(result.searchCalls).toBe(2);
    // Tool-use prompt tokens and thinking tokens are both billed.
    expect(result.inputTokens).toBe(1200);
    expect(result.outputTokens).toBe(700);
    expect(result.sources?.map((s) => s.url)).toEqual(["https://example.org"]);
  });

  it("counts a grounded answer that lists no queries as one search, and an ungrounded one as none", () => {
    expect(geminiSearchQueries({ candidates: [{ groundingMetadata: { groundingChunks: [{}] } }] })).toBe(1);
    expect(geminiSearchQueries({ candidates: [{ content: { parts: [] } }] })).toBe(0);
  });
});

describe("adapter failures", () => {
  it("throws on an HTTP error, with the status", async () => {
    const doFetch = fakeFetch({ error: { message: "rate limited" } }, 429);
    await expect(
      askEngine(
        { provider: "GEMINI", model: "gemini-3.8-flash", promptText: "q" },
        { fetch: doFetch as unknown as typeof fetch, env: ENV },
      ),
    ).rejects.toThrow(/HTTP 429/);
  });

  it("throws without its key rather than sending an unauthenticated request", async () => {
    const doFetch = fakeFetch(OPENAI_PAYLOAD);
    await expect(
      askEngine(
        { provider: "CHATGPT", model: "gpt-5", promptText: "q" },
        { fetch: doFetch as unknown as typeof fetch, env: {} as NodeJS.ProcessEnv },
      ),
    ).rejects.toThrow(/OPENAI_API_KEY/);
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe("per-search pricing", () => {
  const priced = {
    AI_RATES_CHATGPT: "1.25,10,0.125",
    AI_SEARCH_FEE_CHATGPT: "0.01",
  } as unknown as NodeJS.ProcessEnv;

  it("adds the search fee per call on top of tokens", () => {
    const { costUsd, priced: ok } = costUsdFor(
      "CHATGPT",
      "gpt-5",
      { inputTokens: 2000, outputTokens: 800, cachedInputTokens: 0, searchCalls: 2 },
      priced,
    );
    // 2000 × 1.25/M + 800 × 10/M + 2 × 0.01 = 0.0025 + 0.008 + 0.02
    expect(ok).toBe(true);
    expect(costUsd).toBeCloseTo(0.0305, 6);
  });

  it("flags a call that searched but has no fee configured as unpriced", () => {
    const tokenOnly = { AI_RATES_CHATGPT: "1.25,10,0.125" } as unknown as NodeJS.ProcessEnv;
    const result = costUsdFor(
      "CHATGPT",
      "gpt-5",
      { inputTokens: 2000, outputTokens: 800, cachedInputTokens: 0, searchCalls: 1 },
      tokenOnly,
    );
    expect(result.priced).toBe(false);
  });

  it("leaves token-only callers exactly as they were", () => {
    const claude = costUsdFor("CLAUDE", "claude-haiku-4-5", {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cachedInputTokens: 0,
    }, {} as NodeJS.ProcessEnv);
    expect(claude).toEqual({ costUsd: 1, priced: true });
  });

  it("reads the fee from env only, and never treats garbage as free", () => {
    expect(searchFeeFor("GEMINI", {} as NodeJS.ProcessEnv)).toBeNull();
    expect(searchFeeFor("GEMINI", { AI_SEARCH_FEE_GEMINI: "0.014" } as unknown as NodeJS.ProcessEnv)).toBe(0.014);
    expect(searchFeeFor("GEMINI", { AI_SEARCH_FEE_GEMINI: "free" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
