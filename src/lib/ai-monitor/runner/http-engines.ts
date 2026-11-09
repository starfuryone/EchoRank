// src/lib/ai-monitor/runner/http-engines.ts
//
// The ChatGPT and Gemini adapters for the scheduled tracker, called directly
// over HTTP — the same two endpoints the free AI Visibility Check already
// calls (src/lib/snapshot/engines.ts), whose payload parsers are reused here so
// one engine's answer is read the same way on both products.
//
// SEARCH IS THE ENGINE'S CHOICE, NOT FORCED. The free check sets
// tool_choice "required" because it is a one-off look at what an engine finds;
// the tracker observes what the engine says to an ordinary person, and the
// consumer products decide for themselves when to search. That also means a
// call that did not search does not pay a search fee.
//
// EVERY SEARCH IS COUNTED FROM THE PAYLOAD, because it is billed per call:
//   - OpenAI: one `web_search_call` output item per call ($/1k calls);
//   - Gemini 3: per search QUERY ("a request … may result in one or more
//     queries … charged for each individual search query"), read from
//     groundingMetadata.webSearchQueries. A grounded answer that lists no
//     queries is counted as one, so the count can only err high.
//
// AN EMPTY ANSWER IS RETURNED, METERED, THEN REFUSED by the port (ports.ts),
// so the run is FAILED, never scored: "" scored as an answer reads as "the
// engine did not mention the brand", which is a finding. A reasoning model
// that spends its whole output budget thinking returns exactly that.

import "server-only";

import { parseGemini, parseOpenAi } from "@/lib/snapshot/engines";
import { archiveLlmAnswer } from "@/lib/purchase-archive/llm";

export interface HttpAsk {
  provider: "CHATGPT" | "GEMINI";
  model: string;
  systemPrompt: string;
  promptText: string;
  maxOutputTokens: number;
}

export interface HttpAnswer {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  searchCalls: number;
  sources: { url: string }[];
  model: string;
}

export interface HttpDeps {
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

const TIMEOUT_MS = 90_000;

/** The key env var per adapter — the same names engines.ts checks for availability. */
const KEY_ENV = { CHATGPT: "OPENAI_API_KEY", GEMINI: "GEMINI_API_KEY" } as const;

async function postJson(
  doFetch: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  // The status and a short head of the body only: enough to tell a 429 from a
  // 400 in the ledger's error column, never a header (the key travels there).
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON from provider");
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads, parsed defensively */

/** Billed web-search calls in a Responses API payload. */
export function openAiSearchCalls(data: any): number {
  return (data?.output ?? []).filter((item: any) => item?.type === "web_search_call").length;
}

/** Billed search queries in a generateContent payload (Gemini 3 bills per query). */
export function geminiSearchQueries(data: any): number {
  const meta = data?.candidates?.[0]?.groundingMetadata;
  if (!meta) return 0;
  const queries = Array.isArray(meta.webSearchQueries) ? meta.webSearchQueries.length : 0;
  const grounded = queries > 0 || (meta.groundingChunks?.length ?? 0) > 0 || !!meta.searchEntryPoint;
  return queries > 0 ? queries : grounded ? 1 : 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ask ChatGPT or Gemini one monitored question. Throws on any provider error. */
export async function askHttpEngine(request: HttpAsk, deps: HttpDeps = {}): Promise<HttpAnswer> {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? fetch;
  const apiKey = env[KEY_ENV[request.provider]]?.trim();
  if (!apiKey) throw new Error(`${KEY_ENV[request.provider]} is not set`);

  let parsed: ReturnType<typeof parseOpenAi>;
  let searchCalls: number;
  let archived: { endpoint: string; data: unknown };

  if (request.provider === "CHATGPT") {
    const base = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const data = await postJson(
      doFetch,
      `${base}/responses`,
      { Authorization: `Bearer ${apiKey}` },
      {
        model: request.model,
        instructions: request.systemPrompt,
        input: request.promptText,
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        max_output_tokens: request.maxOutputTokens,
        // Low effort keeps a reasoning model's thinking inside the output
        // budget; at the default the answer can come back empty.
        reasoning: { effort: "low" },
        // Not kept on OpenAI's side: the answer is stored in our ledger only.
        store: false,
      },
    );
    parsed = parseOpenAi(data, request.model);
    searchCalls = openAiSearchCalls(data);
    archived = { endpoint: "responses", data };
  } else {
    const base = env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
    const data = await postJson(
      doFetch,
      `${base}/models/${encodeURIComponent(request.model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.promptText }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: request.maxOutputTokens },
      },
    );
    parsed = parseGemini(data, request.model);
    searchCalls = geminiSearchQueries(data);
    archived = { endpoint: "generate_content", data };
  }

  // The purchase archive (ECHORANK-DATA-ARCHIVE.md). Never awaited; the cost
  // is metered by the caller, so it is left unknown here.
  archiveLlmAnswer({
    provider: request.provider === "CHATGPT" ? "openai" : "gemini",
    endpoint: archived.endpoint,
    request: { model: request.model, instructions: request.systemPrompt, input: request.promptText, max_output_tokens: request.maxOutputTokens },
    response: archived.data,
    costUsd: null,
    tenantId: null,
    purpose: "ai_tracking",
  });

  // An empty answer is NOT thrown here: its tokens and searches were billed,
  // and a throw inside meteredAiCall records the row with zero usage. The
  // runner's port meters it first, then refuses to score it (see ports.ts).
  return {
    answer: parsed.text,
    inputTokens: parsed.usage.inputTokens,
    outputTokens: parsed.usage.outputTokens,
    searchCalls,
    sources: parsed.sourceUrls.map((url) => ({ url })),
    model: parsed.model,
  };
}
