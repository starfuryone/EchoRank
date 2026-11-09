// src/lib/purchase-archive/llm.ts — the wrapper for AI-engine answers we pay
// for and call directly (not through DataForSEO, whose LLM Scraper and AI
// Overviews are archived by the DataForSEO wrapper):
//
//   anthropic  the AI visibility tracker's Claude answer (ai-monitor/runner/providers.ts)
//   openai     the free AI Visibility Check's ChatGPT answer (snapshot/engines.ts askEngine),
//              and the tracker's direct adapter (runner/http-engines.ts, kept but off)
//   gemini     the same two, for Gemini
//
// TRACKING ANSWERS ONLY. Our own generation (blog agent, assistant, Marketing
// Studio, Action Agent, crawl AI, embeddings, the snapshot's competitor and
// source classification) is not purchased data and carries customer content;
// calls on a customer's own key are theirs. None of those call this.
//
// Every answer may name people, so every object is personalData. The request
// is the body we sent; keys travel in headers and never reach this module.

import "server-only";

import { archivePurchase, type CaptureDeps } from "./capture";
import { PROVIDERS } from "./config";
import { logger } from "@/infrastructure/observability/logger";

export type LlmArchiveProvider = (typeof PROVIDERS)["openai" | "gemini" | "anthropic"];

export interface LlmAnswerCapture {
  provider: LlmArchiveProvider;
  /** "responses", "generate_content", "messages". */
  endpoint: string;
  request: unknown;
  response: unknown;
  costUsd: number | null;
  tenantId: string | null;
  purpose: string;
}

function responseId(provider: LlmArchiveProvider, response: unknown): string | null {
  const r = response as { id?: unknown; responseId?: unknown } | null;
  const id = provider === PROVIDERS.gemini ? r?.responseId : r?.id;
  return typeof id === "string" && id ? id : null;
}

/** Never throws, never awaits. */
export function archiveLlmAnswer(p: LlmAnswerCapture, deps?: CaptureDeps): void {
  try {
    void archivePurchase(
      {
        provider: p.provider,
        endpoint: p.endpoint,
        request: p.request,
        response: p.response,
        costUsd: p.costUsd,
        providerTaskId: responseId(p.provider, p.response),
        tenantId: p.tenantId,
        purpose: p.purpose,
      },
      { personalData: true },
      deps,
    );
  } catch (err) {
    logger.debug({ err }, "purchase-archive: llm capture skipped");
  }
}
