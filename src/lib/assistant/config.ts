// src/lib/assistant/config.ts
//
// Every knob the public AI Assistant reads from the environment, in one place.
//
// READ AT CALL TIME, NEVER AT MODULE LOAD. Module-level capture freezes whatever
// was in the environment when the first request happened to warm this module —
// the same trap documented in src/lib/marketing/client.ts. Reading per call means
// a `pm2 restart` picks up a rotated key or a flipped kill switch immediately.
//
// MODEL IDS COME FROM THE ENVIRONMENT. The defaults below exist so a deployment
// that has not set them still runs; they are not business logic and nothing in
// this module branches on a model id.

/** Env var names, exported so tests and the delivery report can name them. */
export const ENV = {
  enabled: "AI_ASSISTANT_ENABLED",
  fastModel: "AI_ASSISTANT_MODEL_FAST",
  reasoningModel: "AI_ASSISTANT_MODEL_REASONING",
  chatLimit: "AI_ASSISTANT_CHAT_LIMIT_PER_DAY",
  scanLimit: "AI_ASSISTANT_SCAN_LIMIT_PER_DAY",
  maxOutputTokens: "AI_ASSISTANT_MAX_OUTPUT_TOKENS",
} as const;

/** Haiku class — classification and short explanation. */
const DEFAULT_FAST_MODEL = "claude-haiku-4-5";
/** Sonnet class — investigation and synthesis over scan evidence. */
const DEFAULT_REASONING_MODEL = "claude-sonnet-5";

/** Aligned with the existing free-audit quota: one real site fetch a day. */
const DEFAULT_SCAN_LIMIT = 1;
const DEFAULT_CHAT_LIMIT = 10;
const DEFAULT_MAX_OUTPUT_TOKENS = 1000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  // A typo in an env var must not silently disable the assistant or hand every
  // visitor an unbounded allowance, so anything unparseable falls back.
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

/**
 * The kill switch. Checked server-side on every request.
 *
 * Default ON: a feature that ships dark unless an operator discovers an
 * undocumented flag is a feature nobody turns on. Set the var to "false" (or
 * "0") to take the assistant offline without a rebuild.
 */
export function assistantEnabled(): boolean {
  const raw = process.env.AI_ASSISTANT_ENABLED?.trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

/**
 * The build-time twin of the switch above, for hiding the nav link.
 *
 * COSMETIC AND BUILD-TIME ONLY. Next inlines NEXT_PUBLIC_* by literal match at
 * build time, so flipping this needs a rebuild — which is why it is not the
 * kill switch. `assistantEnabled()` above is, and it is the one the route
 * enforces. Explicit property access, not a computed key: a dynamic lookup
 * yields undefined in the browser bundle (see src/lib/assistant-hours.ts).
 */
export function assistantLinkVisible(): boolean {
  const raw = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED?.trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function fastModel(): string {
  return process.env.AI_ASSISTANT_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL;
}

export function reasoningModel(): string {
  return process.env.AI_ASSISTANT_MODEL_REASONING?.trim() || DEFAULT_REASONING_MODEL;
}

export interface AssistantLimits {
  /** LLM-backed replies per IP per UTC day. */
  chatPerDay: number;
  /** Live domain scans per IP per UTC day. A cache hit costs nothing. */
  scanPerDay: number;
  /** Ceiling on a single turn's output tokens. */
  maxOutputTokens: number;
}

export function assistantLimits(): AssistantLimits {
  return {
    chatPerDay: positiveInt(process.env.AI_ASSISTANT_CHAT_LIMIT_PER_DAY, DEFAULT_CHAT_LIMIT),
    scanPerDay: positiveInt(process.env.AI_ASSISTANT_SCAN_LIMIT_PER_DAY, DEFAULT_SCAN_LIMIT),
    maxOutputTokens: positiveInt(
      process.env.AI_ASSISTANT_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_TOKENS,
    ),
  };
}

/** Support address the assistant deflects pricing/billing edge cases to. */
export const SUPPORT_EMAIL = "support@echorank360.com";
