// src/lib/bot-analytics/verdict.ts
//
// Turns one robots.txt rule plus one probe result into the single word the UI
// shows for a bot. Pure, so the interesting cases are testable without a network.
//
// Precedence is the whole design, and it is: ROBOTS FIRST.
// If robots.txt disallows a bot, that is the answer regardless of what the
// homepage returned. A well-behaved crawler reads robots.txt and leaves; the
// fact that a request we sent got a 200 only proves the origin serves anyone who
// asks, not that the bot will ask. Reporting "allowed" there would be actively
// misleading — it is the one combination where the two signals disagree and the
// weaker one looks better.
//
// The reverse disagreement is the money case: robots.txt allows, the probe is
// refused. That is `blocked_http`, and it is invisible to every robots.txt-only
// checker on the market.

/** Robots.txt outcome for one token, as the sidecar's parser reports it. */
export type RobotsRule = "ALLOWED" | "BLOCKED";

export type BotVerdict =
  | "allowed"
  | "blocked_robots"
  | "blocked_http"
  | "challenged"
  /**
   * The probe did not produce a usable answer — timeout, DNS failure, connection
   * reset. Deliberately its own verdict rather than being folded into
   * `blocked_http`: "we could not tell" and "you are being refused" are
   * different facts, and a tenant acting on the second when it was the first
   * would go hunting for a WAF rule that does not exist.
   */
  | "unknown";

export interface ProbeOutcome {
  /** HTTP status, or null when the request never completed. */
  httpStatus: number | null;
  /** Set when the request failed outright. */
  error?: string;
}

/**
 * Statuses that mean "a human-verification or rate-limit interstitial", not a
 * flat refusal. Cloudflare's managed challenge is 403 with a body, but its
 * JS/interstitial paths are 503 and its rate limiter is 429; Akamai and
 * PerimeterX use 429 too. These are worth distinguishing from 401/403 because
 * the fix is different — a challenge is usually a bot-management setting, a 403
 * is usually an explicit deny rule.
 */
const CHALLENGE_STATUSES = new Set([429, 503]);

/** Flat refusals. */
const REFUSAL_STATUSES = new Set([401, 403, 407, 451]);

export function deriveVerdict(
  robotsRule: RobotsRule,
  probe: ProbeOutcome | null,
): BotVerdict {
  // Robots first — see the header note.
  if (robotsRule === "BLOCKED") return "blocked_robots";

  // Preference tokens pass null: robots.txt is the complete answer for them.
  if (probe === null) return "allowed";

  const { httpStatus } = probe;
  if (httpStatus === null) return "unknown";
  if (CHALLENGE_STATUSES.has(httpStatus)) return "challenged";
  if (REFUSAL_STATUSES.has(httpStatus)) return "blocked_http";

  // 2xx and 3xx are reachable. A 404 on the homepage is a site problem, not a
  // bot-access problem, so it is not reported as a block — but nor is it
  // "allowed" proof, so anything outside 2xx/3xx that is not a known refusal
  // reads as unknown rather than green.
  if (httpStatus >= 200 && httpStatus < 400) return "allowed";
  return "unknown";
}

/** Verdicts that should read as a problem in the UI and in the summary count. */
const PROBLEM_VERDICTS = new Set<BotVerdict>([
  "blocked_robots",
  "blocked_http",
  "challenged",
]);

export function isProblem(verdict: BotVerdict): boolean {
  return PROBLEM_VERDICTS.has(verdict);
}

/** Chip colour band. Kept here so the UI never re-derives severity. */
export function verdictTone(verdict: BotVerdict): "good" | "warn" | "bad" | "muted" {
  switch (verdict) {
    case "allowed":
      return "good";
    case "challenged":
      return "warn";
    case "blocked_robots":
    case "blocked_http":
      return "bad";
    case "unknown":
      return "muted";
  }
}

/**
 * How long a stored check stays authoritative. A day: robots.txt and WAF rules
 * change on human timescales, and re-probing a customer's origin more often
 * than that is cost without information.
 */
export const CHECK_TTL_MS = 24 * 60 * 60 * 1_000;

/** True when a stored check is recent enough to serve instead of re-probing. */
export function isCheckFresh(checkedAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - checkedAt.getTime();
  // A negative age means a clock skew or a row stamped in the future; treat it
  // as stale rather than trusting it forever.
  return age >= 0 && age < CHECK_TTL_MS;
}
