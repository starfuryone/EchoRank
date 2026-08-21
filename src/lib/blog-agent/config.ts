// src/lib/blog-agent/config.ts
//
// Every knob the blog agent reads from the environment, in one place.
//
// READ AT CALL TIME, NEVER AT MODULE LOAD. Module-level capture freezes
// whatever was in the environment when the first job happened to warm this
// module — the trap that made the av-service keep serving a rotated key after a
// restart, and the same reason src/lib/marketing/client.ts reads its key per
// call. Reading per call means `pm2 restart echorank360-workers` picks up a new
// key, a flipped kill switch or a raised budget immediately.
//
// FAILS CLOSED, BY NAME. A missing key throws an error that names the env var,
// because the one thing worse than an agent that will not run is an agent that
// runs and silently produces nothing while the logs say "completed".

/** Thrown when a required variable is absent. Always names the variable. */
export class BlogAgentConfigError extends Error {
  constructor(public readonly envVar: string, detail?: string) {
    super(`${envVar} is not set${detail ? ` — ${detail}` : ""}`);
    this.name = "BlogAgentConfigError";
  }
}

/**
 * Publishing mode.
 *
 * "review" — the agent writes `status: draft` and stops. A human flips the
 * status. This is the DEFAULT and the shipped posture.
 *
 * "auto" — the agent writes `status: published` when the gate passes.
 * Implemented, off, and it should stay off. The blog's entire proposition is
 * GEO expertise: Google's scaled-content-abuse policy targets exactly
 * "many pages generated for search rankings with little human oversight", and
 * this repo's own copy rules (no generic AI intros, cite what you claim,
 * original examples, label recommendations as recommendations) are not things
 * a deterministic gate can fully verify. Three gated drafts a day cost about
 * ten minutes of review; three ungated ones risk the rankings and the
 * credibility the blog exists to build. Turning this on is a business
 * decision, not a config tidy-up.
 */
export type BlogAgentMode = "review" | "auto";

/** Default model. Overridable so an upgrade is a config change, not a deploy. */
export const DEFAULT_BLOG_AGENT_MODEL = "claude-haiku-4-5";

/**
 * Per-million-token prices for the default model, USD.
 *
 * Used only to compute the spend we log and cap on. They are a local copy of a
 * published price and will drift if the model changes — which is why
 * BLOG_AGENT_MODEL changing away from the default makes the cost figure an
 * ESTIMATE, and why costUsd is stored per run rather than recomputed later.
 */
export const HAIKU_PRICE_PER_MTOK = { input: 1.0, output: 5.0 } as const;

/** Articles drafted per discover run when enough worthy topics exist. */
export const DEFAULT_DAILY_TARGET = 3;

/** Daily Anthropic spend ceiling, USD, when BLOG_AGENT_DAILY_USD is unset. */
export const DEFAULT_DAILY_USD = 0.5;

function raw(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/**
 * The kill switch, checked at EVERY stage rather than once at schedule time.
 *
 * A repeatable job that is already queued still fires after the switch is
 * flipped, and a draft fan-out job can sit in the queue for minutes. Checking
 * per stage means flipping this to false stops the pipeline within one job
 * rather than within one day.
 *
 * Defaults to FALSE. An agent that writes files and spends money should require
 * someone to have said yes, not require someone to have said no.
 */
export function blogAgentEnabled(): boolean {
  return raw("BLOG_AGENT_ENABLED")?.toLowerCase() === "true";
}

export function blogAgentMode(): BlogAgentMode {
  return raw("BLOG_AGENT_MODE")?.toLowerCase() === "auto" ? "auto" : "review";
}

export function blogAgentModel(): string {
  return raw("BLOG_AGENT_MODEL") ?? DEFAULT_BLOG_AGENT_MODEL;
}

/**
 * The drafting key.
 *
 * DELIBERATELY NOT ANTHROPIC_API_KEY. That variable is what Marketing Studio
 * and the assistant read, and a key shared across surfaces means one leaked or
 * rotated credential takes all of them down together. A separate variable is a
 * separate blast radius; it costs one line in .env.
 */
export function blogAgentApiKey(): string {
  const key = raw("BLOG_AGENT_ANTHROPIC_KEY");
  if (!key) {
    throw new BlogAgentConfigError(
      "BLOG_AGENT_ANTHROPIC_KEY",
      "the blog agent needs its own Anthropic key, separate from ANTHROPIC_API_KEY",
    );
  }
  return key;
}

/**
 * Daily spend ceiling in USD.
 *
 * A malformed value is a HARD failure rather than a silent fall back to the
 * default: "BLOG_AGENT_DAILY_USD=5o0" should stop the agent, not quietly cap it
 * at fifty cents while someone believes it is capped at five dollars.
 */
export function blogAgentDailyUsd(): number {
  const v = raw("BLOG_AGENT_DAILY_USD");
  if (v === undefined) return DEFAULT_DAILY_USD;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new BlogAgentConfigError("BLOG_AGENT_DAILY_USD", `not a non-negative number: "${v}"`);
  }
  return n;
}

/** Articles to draft per run. Bounded so a typo cannot order a hundred. */
export function blogAgentDailyTarget(): number {
  const v = raw("BLOG_AGENT_DAILY_TARGET");
  if (v === undefined) return DEFAULT_DAILY_TARGET;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new BlogAgentConfigError("BLOG_AGENT_DAILY_TARGET", `not an integer in 1..10: "${v}"`);
  }
  return n;
}

/** USD cost of one call, from the token counts the API reports back. */
export function callCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_PRICE_PER_MTOK.input +
    (outputTokens / 1_000_000) * HAIKU_PRICE_PER_MTOK.output
  );
}
