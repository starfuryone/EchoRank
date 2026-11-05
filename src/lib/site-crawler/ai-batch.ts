// src/lib/site-crawler/ai-batch.ts
//
// Crawl with AI in batch mode: the AI step runs after the crawl with no one
// waiting, so Claude and OpenAI prompts go through each provider's batch API
// (50% off input and output on both pricing pages). Gemini stays synchronous.
//
//   claude  Message Batches: POST /v1/messages/batches with
//           requests[{custom_id, params}], GET it until processing_status is
//           "ended", read results_url (JSONL), DELETE the batch.
//   openai  Batch API: upload the JSONL input (Files, purpose "batch"), POST
//           /v1/batches for /v1/responses with a 24h window, GET it until
//           completed / expired / cancelled, read output_file_id (JSONL),
//           delete the files.
//
// Each request body is exactly buildRequest()'s, and each result goes through
// parseResponse(), so a batched answer is stored and metered like a
// synchronous one. Through fetch like ai-prompts.ts (no SDKs); no request,
// page text, output or provider error body is logged or kept. A batch is
// deleted (Anthropic) or its files removed (OpenAI) once its results are
// read: batch inputs and outputs are otherwise stored by the provider (29 days
// at Anthropic, which makes batches ineligible for zero data retention).
//
// The runner (metrics-runner aiTick) owns the timing: it submits, polls on
// later ticks, falls back to the synchronous path when a batch is not
// accepted within BATCH_ACCEPT_MS, and runs anything a batch did not answer
// synchronously.

import "server-only";
import { AiCallError, parseResponse, type AiCallResult, type AiRequest } from "./ai-prompts";

export type BatchProvider = "claude" | "openai";

export const isBatchProvider = (p: string): p is BatchProvider => p === "claude" || p === "openai";

/** A batch not accepted (submitted and reported as processing) within this falls back to the synchronous path. */
export const BATCH_ACCEPT_MS = 2 * 60_000;
/** How often an accepted batch is polled. */
export const BATCH_POLL_MS = 60_000;
/** How soon a failed submission is retried (inside BATCH_ACCEPT_MS). */
export const BATCH_RETRY_MS = 20_000;

export interface BatchItem {
  /** `<pageId>_<promptIndex>`; [A-Za-z0-9_-]{1,64} on both providers. */
  customId: string;
  req: AiRequest;
}

export interface BatchHandle {
  provider: BatchProvider;
  id: string;
  /** OpenAI: the uploaded input file, deleted with the outputs. */
  inputFileId: string | null;
}

export type BatchPoll =
  /** Submitted, not yet accepted (OpenAI "validating"). */
  | { state: "validating" }
  /** Accepted and processing. */
  | { state: "running" }
  /** Refused after submission (OpenAI "failed": the input did not validate). */
  | { state: "failed" }
  /** Done (or expired / cancelled): whatever finished can be read. */
  | { state: "ended"; resultsUrl: string | null; outputFileId: string | null; errorFileId: string | null };

export type BatchLine = { customId: string; ok: true; result: AiCallResult } | { customId: string; ok: false; reason: string };

type Fetch = typeof fetch;
const TIMEOUT_MS = 60_000;
const ANTHROPIC = "https://api.anthropic.com/v1/messages/batches";
const OPENAI = "https://api.openai.com/v1";

export const batchCustomId = (pageId: string, index: number) => `${pageId}_${index}`;

/** [pageId, promptIndex] from a custom_id, or null when it is not one of ours. */
export function parseCustomId(id: string): [string, number] | null {
  const m = /^([A-Za-z0-9-]+)_(\d+)$/.exec(id);
  return m ? [m[1]!, Number(m[2])] : null;
}

function authHeaders(provider: BatchProvider, key: string): Record<string, string> {
  return provider === "claude" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { authorization: `Bearer ${key}` };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads, parsed defensively */
async function call(f: Fetch, method: string, url: string, headers: Record<string, string>, body?: BodyInit, json = true): Promise<any> {
  const res = await f(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new AiCallError(`HTTP ${res.status}`, res.status);
  }
  if (!json) return res.text();
  return res.json().catch(() => {
    throw new AiCallError("invalid JSON", res.status);
  });
}

/** Submit every item as one batch. Throws AiCallError (no body) when the provider does not take it. */
export async function submitBatch(provider: BatchProvider, key: string, items: BatchItem[], f: Fetch = fetch): Promise<BatchHandle> {
  if (items.length === 0) throw new AiCallError("empty batch", null);
  const auth = authHeaders(provider, key);
  if (provider === "claude") {
    const d = await call(f, "POST", ANTHROPIC, { ...auth, "content-type": "application/json" }, JSON.stringify({ requests: items.map((i) => ({ custom_id: i.customId, params: i.req.body })) }));
    if (typeof d?.id !== "string") throw new AiCallError("no batch id", null);
    return { provider, id: d.id, inputFileId: null };
  }
  const jsonl = items.map((i) => JSON.stringify({ custom_id: i.customId, method: "POST", url: "/v1/responses", body: i.req.body })).join("\n") + "\n";
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([jsonl], { type: "application/jsonl" }), "crawl-ai.jsonl");
  const file = await call(f, "POST", `${OPENAI}/files`, auth, form);
  if (typeof file?.id !== "string") throw new AiCallError("no file id", null);
  try {
    const d = await call(f, "POST", `${OPENAI}/batches`, { ...auth, "content-type": "application/json" }, JSON.stringify({ input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h" }));
    if (typeof d?.id !== "string") throw new AiCallError("no batch id", null);
    return { provider, id: d.id, inputFileId: file.id };
  } catch (err) {
    await call(f, "DELETE", `${OPENAI}/files/${encodeURIComponent(file.id)}`, auth).catch(() => undefined);
    throw err;
  }
}

export async function pollBatch(key: string, h: BatchHandle, f: Fetch = fetch): Promise<BatchPoll> {
  const auth = authHeaders(h.provider, key);
  if (h.provider === "claude") {
    const d = await call(f, "GET", `${ANTHROPIC}/${encodeURIComponent(h.id)}`, auth);
    if (d?.processing_status === "ended") return { state: "ended", resultsUrl: typeof d.results_url === "string" ? d.results_url : null, outputFileId: null, errorFileId: null };
    return { state: "running" };
  }
  const d = await call(f, "GET", `${OPENAI}/batches/${encodeURIComponent(h.id)}`, auth);
  switch (d?.status) {
    case "validating":
      return { state: "validating" };
    case "failed":
      return { state: "failed" };
    case "completed":
    case "expired":
    case "cancelled":
      return { state: "ended", resultsUrl: null, outputFileId: d.output_file_id ?? null, errorFileId: d.error_file_id ?? null };
    default:
      // in_progress, finalizing, cancelling
      return { state: "running" };
  }
}

/** Every line the batch answered. Lines that errored, expired or were cancelled come back ok: false. */
export async function batchResults(key: string, h: BatchHandle, ended: Extract<BatchPoll, { state: "ended" }>, model: string, f: Fetch = fetch): Promise<BatchLine[]> {
  const auth = authHeaders(h.provider, key);
  const lines: BatchLine[] = [];
  const each = (text: string, fn: (row: any) => void) => {
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      let row: any;
      try {
        row = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof row?.custom_id === "string") fn(row);
    }
  };
  const answered = (customId: string, provider: BatchProvider, body: any) => {
    try {
      lines.push({ customId, ok: true, result: parseResponse(provider, model, body) });
    } catch (err) {
      lines.push({ customId, ok: false, reason: err instanceof Error ? err.message : "failed" });
    }
  };
  if (h.provider === "claude") {
    if (!ended.resultsUrl) return lines;
    each(await call(f, "GET", ended.resultsUrl, auth, undefined, false), (row) => {
      const r = row.result;
      if (r?.type === "succeeded") answered(row.custom_id, "claude", r.message);
      else lines.push({ customId: row.custom_id, ok: false, reason: String(r?.type ?? "failed") });
    });
    return lines;
  }
  for (const fileId of [ended.outputFileId, ended.errorFileId]) {
    if (!fileId) continue;
    each(await call(f, "GET", `${OPENAI}/files/${encodeURIComponent(fileId)}/content`, auth, undefined, false), (row) => {
      if (row.response?.status_code === 200 && !row.error) answered(row.custom_id, "openai", row.response.body);
      else lines.push({ customId: row.custom_id, ok: false, reason: `HTTP ${row.response?.status_code ?? "error"}` });
    });
  }
  return lines;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ask the provider to stop a batch (best effort: its partial results may still come). */
export async function cancelBatch(key: string, h: BatchHandle, f: Fetch = fetch): Promise<void> {
  const auth = authHeaders(h.provider, key);
  const url = h.provider === "claude" ? `${ANTHROPIC}/${encodeURIComponent(h.id)}/cancel` : `${OPENAI}/batches/${encodeURIComponent(h.id)}/cancel`;
  await call(f, "POST", url, auth).catch(() => undefined);
}

/** Remove what the provider stored for this batch, once its results are read. Best effort. */
export async function removeBatch(key: string, h: BatchHandle, ended: Extract<BatchPoll, { state: "ended" }> | null, f: Fetch = fetch): Promise<void> {
  const auth = authHeaders(h.provider, key);
  if (h.provider === "claude") {
    await call(f, "DELETE", `${ANTHROPIC}/${encodeURIComponent(h.id)}`, auth).catch(() => undefined);
    return;
  }
  for (const id of [h.inputFileId, ended?.outputFileId, ended?.errorFileId]) {
    if (id) await call(f, "DELETE", `${OPENAI}/files/${encodeURIComponent(id)}`, auth).catch(() => undefined);
  }
}
