// src/lib/ai-monitor/json-call.ts
//
// One way to ask a model for JSON and get back something the database will
// accept — or a clean refusal.
//
// EVERY LLM ANALYSIS CALL IN THIS MODULE GOES THROUGH HERE. Phases 1, 2, 4 and
// 7 each need "prompt strictly, validate with zod, retry once, then give up
// without taking the queue with you". Written four times that is four sets of
// retry semantics and four opinions about what a malformed response means.
//
// THE CONTRACT: NEVER THROWS. A worker that dies on a model returning prose
// instead of JSON is a worker that stops processing every OTHER tenant's jobs.
// Failure comes back as `value: null` with the raw text and the reason, and the
// caller decides whether that quarantines a row or is simply a null column.
//
// RETRY ONCE, AND ONLY ON A VALIDATION FAILURE. A transport error is retried by
// BullMQ at the job level, where the backoff lives; retrying it here as well
// would multiply the attempts. What is retried here is the model getting the
// SHAPE wrong, which BullMQ cannot fix by waiting — so the second attempt is
// not a repeat, it carries the validation errors back to the model.
//
// THE INPUT IS UNTRUSTED. Same posture as analysis/llm.ts: text produced by
// someone else's model, or scraped from a page a competitor controls, is data
// to be described and never instructions to follow. Callers fence it; this
// module refuses to build a prompt without a system prompt that says so.

import type { z } from "zod";
import { AnthropicProvider } from "@/ai/providers/anthropic";
import { logger } from "@/infrastructure/observability/logger";

/**
 * Pinned, for the same reason ANALYSIS_MODEL is: these calls are part of a
 * score, and a score that moves because an env var changed is not a measurement.
 */
export const JSON_CALL_MODEL = "claude-haiku-4-5";

/** Attempts in total. One retry, carrying the validation errors back. */
export const MAX_ATTEMPTS = 2;

export interface StrictJsonRequest<T> {
  schema: z.ZodType<T>;
  /** Must state that fenced input is data, never instructions. */
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  /** Overridable so a genuinely harder judgement can buy a bigger model. */
  model?: string;
  /** Injectable for tests. */
  provider?: AnthropicProvider;
  /** Appears in logs so a quarantine can be traced to the pass that caused it. */
  label: string;
}

export interface StrictJsonResult<T> {
  /** Null when nothing valid came back after every attempt. */
  value: T | null;
  /** The last raw response, kept for the quarantine record. */
  raw: string;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  /** Why it failed. Absent on success. */
  error?: string;
}

/** Strip a ```json fence if the model wrapped its object in one. */
export function unfence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Pull the first balanced {...} or [...] out of a response.
 *
 * Models prepend "Here is the JSON:" often enough that refusing those costs
 * real money in retries. Balanced-brace scanning rather than a greedy regex,
 * because a greedy match spanning two objects produces invalid JSON and a
 * lazy one truncates at the first nested closing brace. String literals are
 * tracked so a `}` inside a quoted value does not end the scan early.
 */
export function extractJson(text: string): string | null {
  const source = unfence(text);
  const start = source.search(/[{[]/);
  if (start === -1) return null;

  const opener = source[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === opener) depth += 1;
    else if (char === closer) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

/** Compact zod issues into something worth sending back to the model. */
export function describeIssues(error: z.ZodError, limit = 8): string {
  return error.issues
    .slice(0, limit)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export interface ParseAttempt<T> {
  value: T | null;
  /** Null on success. */
  problem: string | null;
}

/** Parse and validate one response. Pure — the tests drive this directly. */
export function parseStrictJson<T>(raw: string, schema: z.ZodType<T>): ParseAttempt<T> {
  const candidate = extractJson(raw);
  if (candidate === null) return { value: null, problem: "no JSON object found in the response" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return {
      value: null,
      problem: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { value: null, problem: `schema mismatch: ${describeIssues(result.error)}` };
  }
  return { value: result.data, problem: null };
}

/** The correction sent on the second attempt. */
export function repairPrompt(previous: string, problem: string): string {
  return [
    "Your previous reply was rejected.",
    `Problem: ${problem}`,
    "",
    "Previous reply:",
    previous.slice(0, 2_000),
    "",
    "Reply again with ONLY the JSON object, matching the schema exactly.",
    "No prose, no markdown fence, no trailing commentary.",
  ].join("\n");
}

/**
 * Ask for JSON, validate it, retry once, give up quietly.
 *
 * Token counts are ACCUMULATED ACROSS ATTEMPTS. The retry is real spend and
 * has to reach the meter, or the monthly cap would systematically under-count
 * exactly the tenants whose responses are hardest to parse.
 */
export async function strictJsonCall<T>(
  request: StrictJsonRequest<T>,
): Promise<StrictJsonResult<T>> {
  const provider = request.provider ?? new AnthropicProvider();
  const model = request.model ?? JSON_CALL_MODEL;

  let inputTokens = 0;
  let outputTokens = 0;
  let raw = "";
  let problem = "no attempt completed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const userPrompt =
      attempt === 1 ? request.userPrompt : `${request.userPrompt}\n\n${repairPrompt(raw, problem)}`;

    let content: string;
    try {
      const result = await provider.infer({
        systemPrompt: request.systemPrompt,
        userPrompt,
        responseFormat: "json",
        maxTokens: request.maxTokens,
        modelId: model,
      });
      content = result.content;
      inputTokens += result.promptTokens;
      outputTokens += result.completionTokens;
    } catch (err) {
      // Transport failure. BullMQ owns retrying this; returning lets the caller
      // record what was spent so far rather than losing it to a throw.
      return {
        value: null,
        raw,
        attempts: attempt,
        inputTokens,
        outputTokens,
        model,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    raw = content;
    const parsed = parseStrictJson(content, request.schema);
    if (parsed.value !== null) {
      return { value: parsed.value, raw, attempts: attempt, inputTokens, outputTokens, model };
    }
    problem = parsed.problem ?? "unknown validation failure";

    logger.warn(
      { label: request.label, attempt, problem, model },
      "strict JSON call rejected a response",
    );
  }

  return {
    value: null,
    raw,
    attempts: MAX_ATTEMPTS,
    inputTokens,
    outputTokens,
    model,
    error: problem,
  };
}
