// src/lib/snapshot/engines.ts
//
// The two engines the free check asks, called directly over HTTP:
//   - OpenAI, Responses API with the web_search tool;
//   - Gemini, generateContent with Google Search grounding.
// The sidecar is not involved (it speaks only to Anthropic). Model ids come
// from OPENAI_SNAPSHOT_MODEL / GEMINI_SNAPSHOT_MODEL; an engine whose key or
// model is unset is simply not asked, and the report says so.
//
// COST IS ESTIMATED FROM THE PUBLISHED PRICE, NOT READ FROM A BILL. Neither
// API returns a price. Token counts come back in `usage`; the per-call search
// fee and the per-token rates are the table below (list prices, 2026-11-02),
// overridable per deployment with SNAPSHOT_PRICES_JSON. Gemini's free monthly
// grounding allowance is NOT credited: the cap has to hold on the day the
// allowance runs out.

import "server-only";

import type { SnapshotEngine } from "./types";

export interface EnginePrice {
  /** USD per 1M input / output tokens. */
  inPerM: number;
  outPerM: number;
  /** USD per search-grounded call. */
  perSearch: number;
  /** Input tokens billed per search call on top of usage (OpenAI's mini models bill a fixed 8k block). */
  searchInputTokens?: number;
}

/** Longest matching prefix wins. "*" is the fallback, deliberately pessimistic. */
const DEFAULT_PRICES: Record<SnapshotEngine, Record<string, EnginePrice>> = {
  openai: {
    "gpt-4.1-mini": { inPerM: 0.4, outPerM: 1.6, perSearch: 0.01, searchInputTokens: 8000 },
    "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6, perSearch: 0.01, searchInputTokens: 8000 },
    "gpt-5-mini": { inPerM: 0.25, outPerM: 2.0, perSearch: 0.01 },
    "gpt-5-nano": { inPerM: 0.05, outPerM: 0.4, perSearch: 0.01 },
    "*": { inPerM: 2.0, outPerM: 8.0, perSearch: 0.025 },
  },
  gemini: {
    "gemini-2.5-flash-lite": { inPerM: 0.1, outPerM: 0.4, perSearch: 0.035 },
    "gemini-2.5-flash": { inPerM: 0.3, outPerM: 2.5, perSearch: 0.035 },
    "gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5, perSearch: 0.014 },
    "gemini-3.5-flash-lite": { inPerM: 0.3, outPerM: 2.5, perSearch: 0.014 },
    "gemini-3": { inPerM: 0.75, outPerM: 3.75, perSearch: 0.014 },
    "*": { inPerM: 1.5, outPerM: 7.5, perSearch: 0.035 },
  },
};

export function priceFor(engine: SnapshotEngine, model: string): EnginePrice {
  let table = DEFAULT_PRICES[engine];
  try {
    const extra = process.env.SNAPSHOT_PRICES_JSON ? JSON.parse(process.env.SNAPSHOT_PRICES_JSON) : null;
    if (extra?.[engine]) table = { ...table, ...extra[engine] };
  } catch {
    // A malformed override falls back to the list prices; the cap still holds.
  }
  const key = Object.keys(table)
    .filter((k) => k !== "*" && model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return table[key ?? "*"];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export function costOf(engine: SnapshotEngine, model: string, usage: Usage, searched: boolean): number {
  const p = priceFor(engine, model);
  const input = usage.inputTokens + (searched ? (p.searchInputTokens ?? 0) : 0);
  return (input * p.inPerM + usage.outputTokens * p.outPerM) / 1e6 + (searched ? p.perSearch : 0);
}

/**
 * What one call is assumed to cost BEFORE it is made, for the cap. Generous on
 * tokens (2k in, 1.2k out) so a run cannot creep past the cap on estimates.
 */
export function estimateCall(engine: SnapshotEngine, model: string, searched: boolean): number {
  return costOf(engine, model, { inputTokens: 2000, outputTokens: 1200 }, searched);
}

export interface EngineConfig {
  engine: SnapshotEngine;
  model: string;
  apiKey: string;
}

/** The engines this deployment can ask, in report order. */
export function configuredEngines(env: NodeJS.ProcessEnv = process.env): EngineConfig[] {
  const out: EngineConfig[] = [];
  if (env.OPENAI_API_KEY && env.OPENAI_SNAPSHOT_MODEL)
    out.push({ engine: "openai", model: env.OPENAI_SNAPSHOT_MODEL, apiKey: env.OPENAI_API_KEY });
  if (env.GEMINI_API_KEY && env.GEMINI_SNAPSHOT_MODEL)
    out.push({ engine: "gemini", model: env.GEMINI_SNAPSHOT_MODEL, apiKey: env.GEMINI_API_KEY });
  return out;
}

export interface Answer {
  text: string;
  /** Source URLs, cited or consulted, in the order the engine gave them. */
  sourceUrls: string[];
  usage: Usage;
  model: string;
  /** Read from the shared answer cache (src/lib/answer-cache.ts): no call was made, nothing was spent. */
  shared?: boolean;
}

const OPENAI_URL = () => process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const GEMINI_URL = () => process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 90_000;

class EngineError extends Error {}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  if (!res.ok) throw new EngineError(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new EngineError("invalid JSON from provider");
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads, parsed defensively */

/** Parse a Responses API payload: output_text + url_citation annotations + web_search_call sources. */
export function parseOpenAi(data: any, model: string): Answer {
  const urls: string[] = [];
  let text = "";
  for (const item of data?.output ?? []) {
    if (item?.type === "web_search_call") {
      for (const s of item?.action?.sources ?? []) if (typeof s?.url === "string") urls.push(s.url);
    }
    if (item?.type === "message") {
      for (const c of item?.content ?? []) {
        if (c?.type !== "output_text") continue;
        text += (text ? "\n" : "") + String(c.text ?? "");
        for (const a of c?.annotations ?? []) if (a?.type === "url_citation" && typeof a.url === "string") urls.push(a.url);
      }
    }
  }
  return {
    text,
    sourceUrls: [...new Set(urls)],
    usage: { inputTokens: Number(data?.usage?.input_tokens ?? 0), outputTokens: Number(data?.usage?.output_tokens ?? 0) },
    model: String(data?.model ?? model),
  };
}

/**
 * Parse a generateContent payload. Grounding chunk URIs are Google redirect
 * links; the chunk TITLE is the source's domain, so that is what is kept.
 */
export function parseGemini(data: any, model: string): Answer {
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
  const urls: string[] = [];
  for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) {
    const title = String(ch?.web?.title ?? "").trim();
    const uri = String(ch?.web?.uri ?? "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(title)) urls.push(`https://${title}`);
    else if (uri && !/vertexaisearch\.cloud\.google\.com/.test(uri)) urls.push(uri);
  }
  const u = data?.usageMetadata ?? {};
  return {
    text,
    sourceUrls: [...new Set(urls)],
    usage: {
      inputTokens: Number(u.promptTokenCount ?? 0) + Number(u.toolUsePromptTokenCount ?? 0),
      outputTokens: Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0),
    },
    model: String(data?.modelVersion ?? model),
  };
}

/** Ask one question with search on. Throws on a provider error. */
export async function askEngine(cfg: EngineConfig, prompt: string): Promise<Answer> {
  if (cfg.engine === "openai") {
    const data = await postJson(
      `${OPENAI_URL()}/responses`,
      { Authorization: `Bearer ${cfg.apiKey}` },
      {
        model: cfg.model,
        input: prompt,
        tools: [{ type: "web_search" }],
        // The check is about what the engine says when it looks things up.
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: 1200,
      },
    );
    return parseOpenAi(data, cfg.model);
  }
  const data = await postJson(
    `${GEMINI_URL()}/models/${encodeURIComponent(cfg.model)}:generateContent`,
    { "x-goog-api-key": cfg.apiKey },
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 1200 },
    },
  );
  return parseGemini(data, cfg.model);
}

/**
 * One no-search JSON call on the engine's own model. Used for the competitor
 * extraction. Returns the parsed object and its usage.
 */
export async function askJson(
  cfg: EngineConfig,
  instructions: string,
  input: string,
  schema: Record<string, unknown>,
): Promise<{ value: unknown; usage: Usage }> {
  if (cfg.engine === "openai") {
    const data: any = await postJson(
      `${OPENAI_URL()}/responses`,
      { Authorization: `Bearer ${cfg.apiKey}` },
      {
        model: cfg.model,
        instructions,
        input,
        text: { format: { type: "json_schema", name: "result", schema, strict: true } },
        max_output_tokens: 2000,
      },
    );
    const a = parseOpenAi(data, cfg.model);
    return { value: JSON.parse(a.text || "null"), usage: a.usage };
  }
  const data: any = await postJson(
    `${GEMINI_URL()}/models/${encodeURIComponent(cfg.model)}:generateContent`,
    { "x-goog-api-key": cfg.apiKey },
    {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: 2000 },
    },
  );
  const a = parseGemini(data, cfg.model);
  return { value: JSON.parse(a.text || "null"), usage: a.usage };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
