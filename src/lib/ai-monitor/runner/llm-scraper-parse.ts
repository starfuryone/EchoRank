// src/lib/ai-monitor/runner/llm-scraper-parse.ts
//
// The pure half of the ChatGPT and Gemini engines: which DataForSEO endpoints,
// what task to post, and how to read the answer back. No I/O, so the parser is
// tested against real responses (fixtures/dataforseo/v3-ai_optimization-*).
//
// DataForSEO AI Optimization "LLM Scraper": it asks the consumer ChatGPT /
// Gemini web apps the question and returns what a person would have seen.
// Standard queue: task_post (billed, $0.0012 list, dataforseo.com/pricing/
// ai-optimization/llm-scraper read 2026-11-07), then tasks_ready and
// task_get/advanced (free). Real turnaround on 2026-11-07: about a minute.

export const LLM_SCRAPER_SE = { CHATGPT: "chat_gpt", GEMINI: "gemini" } as const;
export type LlmScraperProvider = keyof typeof LLM_SCRAPER_SE;

export function isLlmScraperProvider(provider: string): provider is LlmScraperProvider {
  return provider === "CHATGPT" || provider === "GEMINI";
}

/** Standard-queue list price per task, USD. The billed figure is the envelope's `cost`. */
export const LLM_SCRAPER_LIST_COST_USD = 0.0012;

/** DataForSEO caps the question at 2000 characters. */
export const LLM_SCRAPER_MAX_KEYWORD = 2000;

export function llmScraperPaths(provider: LlmScraperProvider) {
  const base = `v3/ai_optimization/${LLM_SCRAPER_SE[provider]}/llm_scraper`;
  return {
    taskPost: `${base}/task_post`,
    tasksReady: `${base}/tasks_ready`,
    /** The task id is appended. */
    taskGet: `${base}/task_get/advanced`,
  };
}

/** Same location knobs as Google AI Overviews (runner/aio-engine.ts), so every engine is asked from the same place. */
export const TRACKING_LOCATION_ENV = "AI_AIO_LOCATION_CODE";
export const TRACKING_LANGUAGE_ENV = "AI_AIO_LANGUAGE_CODE";

export function trackingLocation(env: NodeJS.ProcessEnv = process.env): { location_code: number; language_code: string } {
  const location = Number(env[TRACKING_LOCATION_ENV]?.trim());
  return {
    location_code: Number.isInteger(location) && location > 0 ? location : 2840,
    language_code: env[TRACKING_LANGUAGE_ENV]?.trim() || "en",
  };
}

/**
 * The task for one monitored question. ChatGPT is told to search the web
 * (force_web_search), as the consumer app does for a "best X near Y" question,
 * so it has sources to cite; Gemini searches on its own and has no such flag.
 */
export function llmScraperTask(
  provider: LlmScraperProvider,
  promptText: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  return {
    keyword: promptText.slice(0, LLM_SCRAPER_MAX_KEYWORD),
    ...trackingLocation(env),
    ...(provider === "CHATGPT" ? { force_web_search: true } : {}),
  };
}

/** ChatGPT tags every cited URL with utm_source=chatgpt.com; it is not part of the source. */
export function cleanSourceUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("utm_source");
    return u.toString();
  } catch {
    return raw;
  }
}

export interface ParsedLlmAnswer {
  answer: string;
  sources: { url: string; title: string | null }[];
  /** What DataForSEO says it asked ("gpt-6", "3.5 Flash-Lite"). */
  servedModel: string | null;
}

interface RawSource {
  url?: string | null;
  title?: string | null;
}
interface RawResult {
  markdown?: string | null;
  model?: string | null;
  sources?: RawSource[] | null;
}

/**
 * The answer in a task_get/advanced result array (`tasks[0].result`), or null
 * when there is none. The answer is the result's own markdown; sources are the
 * ones the engine cited, http(s) only, de-duplicated, tracking tag removed.
 */
export function parseLlmScraperResult(result: unknown): ParsedLlmAnswer | null {
  const first = (Array.isArray(result) ? result[0] : result) as RawResult | null | undefined;
  if (!first || typeof first !== "object") return null;
  const answer = (first.markdown ?? "").trim();
  if (!answer) return null;
  const seen = new Set<string>();
  const sources: ParsedLlmAnswer["sources"] = [];
  for (const s of first.sources ?? []) {
    if (!s?.url || !/^https?:\/\//i.test(s.url)) continue;
    const url = cleanSourceUrl(s.url);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: s.title ?? null });
  }
  return { answer, sources, servedModel: first.model ?? null };
}
