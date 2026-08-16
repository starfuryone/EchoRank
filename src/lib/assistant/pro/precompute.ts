// src/lib/assistant/pro/precompute.ts
//
// Phase 7: the weekly read, computed once a night instead of once a question.
//
// WHY PRECOMPUTE AT ALL. "What changed this week and why" is the single most
// expensive question a customer can ask: answered live it is four rollups over
// two windows each, and it is asked by everyone, on Monday, at the same time.
// Computed nightly it is one Redis GET.
//
// ── STORED IN REDIS, NOT IN A TABLE ─────────────────────────────────────────
// This is a cache, and the distinction is not cosmetic. Every field below is
// derived — the inputs are prompt_runs, competitor snapshots and
// visibility audits, all of which are kept — so the summary is recomputable at
// any moment and losing it costs one slow question, not one fact. A table would
// bring a migration, a retention policy, a backfill and a second thing to keep
// in sync with the formula, all for a value that is definitionally disposable.
// The TTL is 14 days: twice the weekly cadence, so ONE missed night degrades to
// a summary that is stale-and-labelled (`computedAt` is part of the payload)
// rather than to a hole, and three missed weeks expire rather than quietly
// answering with month-old numbers.
//
// ── ONLY SCHEDULED SOURCES ARE PRECOMPUTED ──────────────────────────────────
// Three of this product's ingestions run on a clock, and those are the three
// summarised here:
//
//   visibility audits   visibility-monitoring.worker, 15-minute due sweep
//   prompt runs         ai-checkup.worker, sweep
//   competitor rows     signals.worker, daily at 06:30 UTC
//
// Site crawls are NOT summarised, and deliberately: a crawl happens when a
// customer presses a button, so a "weekly crawl delta" would be a comparison
// between two arbitrary moments dressed up as a trend. `getCrawlSummary` reads
// the newest completed crawl live instead — one row plus one grouped count,
// which is cheap enough not to need a cache.
//
// ── THE HEURISTICS ARE PURE ─────────────────────────────────────────────────
// `rootCauses()` is a synchronous function of the summary. No network, no
// database, no model. It is what lets the assistant say WHY something moved
// without paying for reasoning, and it is testable without either.

import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { logger } from "@/infrastructure/observability/logger";
import { clip } from "./evidence";

const KEY_PREFIX = "echorank:assistant:intel";

/** 14 days: two cadences of slack, then a stale summary expires rather than lies. */
const TTL_SECONDS = 14 * 24 * 60 * 60;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A prompt has to have been asked this many times before a rate means anything. */
const MIN_RUNS_FOR_TREND = 3;

export function intelligenceKey(tenantId: string): string {
  return `${KEY_PREFIX}:${tenantId}`;
}

export interface PromptMovement {
  question: string;
  thisWeek: { runs: number; mentioned: number; rate: number };
  lastWeek: { runs: number; mentioned: number; rate: number };
  /** Percentage points. Positive is better. */
  delta: number;
}

export interface CompetitorMovement {
  name: string;
  ratingChange: number | null;
  reviewChange: number | null;
}

export interface IntelligenceSummary {
  computedAt: string;
  windowDays: 7;
  visibility: {
    thisWeek: { runs: number; mentioned: number; rate: number | null };
    lastWeek: { runs: number; mentioned: number; rate: number | null };
    /** Percentage points, null when either week had no runs to compare. */
    delta: number | null;
  };
  /** Prompts that gained the most ground, best first. */
  winners: PromptMovement[];
  /** Prompts that lost the most ground, worst first. */
  losers: PromptMovement[];
  competitors: CompetitorMovement[];
  audit: {
    /** Newest score, or null when this account has never been audited. */
    score: number | null;
    previousScore: number | null;
    /** True when the newest audit scored differently from the one before it. */
    changed: boolean;
    at: string | null;
  };
}

// ─── Compute ────────────────────────────────────────────────────────────────

function rate(mentioned: number, runs: number): number | null {
  return runs > 0 ? Math.round((mentioned / runs) * 100) : null;
}

/**
 * Build one tenant's weekly summary from rows only.
 *
 * TWO EQUAL WINDOWS, both seven days, back to back. Comparing "the last seven
 * days" against "everything before that" is the mistake that makes every
 * established account look like it is collapsing, because the denominators are
 * not comparable.
 */
export async function computeIntelligence(
  tenantId: string,
  now: Date = new Date(),
): Promise<IntelligenceSummary> {
  const thisWeekStart = new Date(now.getTime() - WEEK_MS);
  const lastWeekStart = new Date(now.getTime() - 2 * WEEK_MS);

  const [runs, competitors, audits] = await Promise.all([
    prisma.promptRun.findMany({
      where: {
        tenantId,
        createdAt: { gte: lastWeekStart },
        // A run that errored measured nothing. Counting it as "not mentioned"
        // is how an outage on our side becomes a visibility drop on a chart.
        error: null,
      },
      select: {
        promptId: true,
        brandMentioned: true,
        createdAt: true,
        prompt: { select: { text: true } },
      },
    }),
    prisma.competitor.findMany({
      where: { tenantId, active: true },
      select: {
        name: true,
        snapshots: {
          where: { day: { gte: lastWeekStart } },
          orderBy: { day: "desc" },
          select: { day: true, rating: true, reviewCount: true },
        },
      },
    }),
    prisma.visibilityAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { score: true, createdAt: true },
    }),
  ]);

  // ── Visibility, overall and per prompt ──
  const perPrompt = new Map<
    string,
    { text: string; thisRuns: number; thisHit: number; lastRuns: number; lastHit: number }
  >();
  let thisRuns = 0;
  let thisHit = 0;
  let lastRuns = 0;
  let lastHit = 0;

  for (const run of runs) {
    const recent = run.createdAt >= thisWeekStart;
    const entry = perPrompt.get(run.promptId) ?? {
      text: run.prompt?.text ?? "",
      thisRuns: 0,
      thisHit: 0,
      lastRuns: 0,
      lastHit: 0,
    };
    if (recent) {
      thisRuns += 1;
      entry.thisRuns += 1;
      if (run.brandMentioned) {
        thisHit += 1;
        entry.thisHit += 1;
      }
    } else {
      lastRuns += 1;
      entry.lastRuns += 1;
      if (run.brandMentioned) {
        lastHit += 1;
        entry.lastHit += 1;
      }
    }
    perPrompt.set(run.promptId, entry);
  }

  const movements: PromptMovement[] = [];
  for (const entry of perPrompt.values()) {
    // Both windows need enough runs for the comparison to mean anything. One
    // run against one run is a coin flip rendered as a 100-point swing.
    if (entry.thisRuns < MIN_RUNS_FOR_TREND || entry.lastRuns < MIN_RUNS_FOR_TREND) continue;
    const nowRate = Math.round((entry.thisHit / entry.thisRuns) * 100);
    const thenRate = Math.round((entry.lastHit / entry.lastRuns) * 100);
    if (nowRate === thenRate) continue;
    movements.push({
      // Customer-typed. Clipped here so the stored summary is bounded too.
      question: clip(entry.text, 240),
      thisWeek: { runs: entry.thisRuns, mentioned: entry.thisHit, rate: nowRate },
      lastWeek: { runs: entry.lastRuns, mentioned: entry.lastHit, rate: thenRate },
      delta: nowRate - thenRate,
    });
  }
  movements.sort((a, b) => b.delta - a.delta);

  // ── Competitor movement ──
  const competitorMovement: CompetitorMovement[] = [];
  for (const competitor of competitors) {
    const latest = competitor.snapshots[0];
    // The oldest row still inside the two-week window is the baseline. Using
    // "seven days ago exactly" would find nothing on a competitor whose daily
    // snapshot failed that one night.
    const earliest = competitor.snapshots[competitor.snapshots.length - 1];
    if (!latest || !earliest || latest === earliest) continue;
    const ratingChange =
      latest.rating !== null && earliest.rating !== null
        ? Number((latest.rating - earliest.rating).toFixed(2))
        : null;
    const reviewChange =
      latest.reviewCount !== null && earliest.reviewCount !== null
        ? latest.reviewCount - earliest.reviewCount
        : null;
    if (ratingChange === 0 && (reviewChange === 0 || reviewChange === null)) continue;
    competitorMovement.push({
      name: clip(competitor.name, 160),
      ratingChange,
      reviewChange,
    });
  }
  competitorMovement.sort((a, b) => Math.abs(b.reviewChange ?? 0) - Math.abs(a.reviewChange ?? 0));

  return {
    computedAt: now.toISOString(),
    windowDays: 7,
    visibility: {
      thisWeek: { runs: thisRuns, mentioned: thisHit, rate: rate(thisHit, thisRuns) },
      lastWeek: { runs: lastRuns, mentioned: lastHit, rate: rate(lastHit, lastRuns) },
      delta:
        thisRuns > 0 && lastRuns > 0
          ? Math.round((thisHit / thisRuns) * 100) - Math.round((lastHit / lastRuns) * 100)
          : null,
    },
    winners: movements.filter((m) => m.delta > 0).slice(0, 5),
    losers: movements.filter((m) => m.delta < 0).slice(-5).reverse(),
    competitors: competitorMovement.slice(0, 5),
    audit: {
      score: audits[0]?.score ?? null,
      previousScore: audits[1]?.score ?? null,
      changed:
        audits.length === 2 && audits[0].score !== audits[1].score,
      at: audits[0]?.createdAt.toISOString() ?? null,
    },
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────

export async function writeIntelligence(
  tenantId: string,
  summary: IntelligenceSummary,
): Promise<void> {
  try {
    await getRedisConnection().set(
      intelligenceKey(tenantId),
      JSON.stringify(summary),
      "EX",
      TTL_SECONDS,
    );
  } catch (err) {
    logger.warn({ tenantId, err: String(err) }, "assistant precompute: write failed");
  }
}

/** Null when no summary has been computed, or Redis is unreachable. */
export async function readIntelligence(tenantId: string): Promise<IntelligenceSummary | null> {
  try {
    const raw = await getRedisConnection().get(intelligenceKey(tenantId));
    return raw ? (JSON.parse(raw) as IntelligenceSummary) : null;
  } catch {
    return null;
  }
}

// ─── Root-cause heuristics ──────────────────────────────────────────────────

export type CauseId =
  | "no_data"
  | "tracking_paused"
  | "prompt_losses_concentrated"
  | "prompt_gains_concentrated"
  | "broad_visibility_drop"
  | "broad_visibility_gain"
  | "competitor_review_surge"
  | "competitor_rating_gain"
  | "audit_regressed"
  | "audit_improved";

export interface RootCause {
  id: CauseId;
  /** 0–100. Relative confidence within this summary, not a probability. */
  score: number;
  /** One sentence of fact. What the model explains — never what it invents. */
  evidence: string;
}

/**
 * Score candidate explanations for what the summary shows.
 *
 * PURE, DETERMINISTIC, AND IT NEVER GUESSES. Every branch below fires on a
 * number that is present in the summary and says what that number is. Nothing
 * here concludes causation — "your rivals gained 40 reviews in the same week
 * you lost ground" is an observation a human can act on; "your rivals caused
 * it" is a claim we cannot support and do not make.
 *
 * Scores are ORDERING, not probability: they exist so the assistant leads with
 * the biggest signal rather than the first one the code happened to check.
 */
export function rootCauses(summary: IntelligenceSummary): RootCause[] {
  const causes: RootCause[] = [];
  const { visibility, winners, losers, competitors, audit } = summary;

  if (visibility.thisWeek.runs === 0 && visibility.lastWeek.runs === 0) {
    causes.push({
      id: "no_data",
      score: 100,
      evidence:
        "No prompt runs completed in either of the last two weeks, so there is no visibility trend to explain yet.",
    });
    return causes;
  }

  if (visibility.thisWeek.runs === 0 && visibility.lastWeek.runs > 0) {
    causes.push({
      id: "tracking_paused",
      score: 95,
      evidence: `Tracking ran ${visibility.lastWeek.runs} times the week before last and 0 times this week, so any apparent change is missing measurement rather than lost visibility.`,
    });
    return causes;
  }

  const delta = visibility.delta;

  if (delta !== null && delta <= -5) {
    // Concentrated or broad? If the losing prompts account for most of the
    // drop it is a few questions; otherwise it is everywhere.
    const lostPoints = losers.reduce((sum, l) => sum + Math.abs(l.delta), 0);
    causes.push(
      losers.length > 0 && lostPoints >= Math.abs(delta) * 2
        ? {
            id: "prompt_losses_concentrated",
            score: 80,
            evidence: `Overall mention rate fell ${Math.abs(delta)} points, and the drop is concentrated in ${losers.length} question${losers.length === 1 ? "" : "s"} — the largest being "${losers[0].question}", down ${Math.abs(losers[0].delta)} points.`,
          }
        : {
            id: "broad_visibility_drop",
            score: 70,
            evidence: `Overall mention rate fell ${Math.abs(delta)} points (${visibility.lastWeek.rate}% → ${visibility.thisWeek.rate}%) without concentrating in any one question.`,
          },
    );
  }

  if (delta !== null && delta >= 5) {
    const gainedPoints = winners.reduce((sum, w) => sum + w.delta, 0);
    causes.push(
      winners.length > 0 && gainedPoints >= delta * 2
        ? {
            id: "prompt_gains_concentrated",
            score: 75,
            evidence: `Overall mention rate rose ${delta} points, driven mainly by "${winners[0].question}", up ${winners[0].delta} points.`,
          }
        : {
            id: "broad_visibility_gain",
            score: 65,
            evidence: `Overall mention rate rose ${delta} points (${visibility.lastWeek.rate}% → ${visibility.thisWeek.rate}%) across the tracked set rather than in one question.`,
          },
    );
  }

  const surging = competitors.filter((c) => (c.reviewChange ?? 0) >= 10);
  if (surging.length > 0) {
    causes.push({
      id: "competitor_review_surge",
      score: 55,
      evidence: `${surging.map((c) => `${c.name} (+${c.reviewChange} reviews)`).join(", ")} gained reviews over the same window. Observed alongside, not shown to be the cause.`,
    });
  }

  const rising = competitors.filter((c) => (c.ratingChange ?? 0) >= 0.1);
  if (rising.length > 0) {
    causes.push({
      id: "competitor_rating_gain",
      score: 45,
      evidence: `${rising.map((c) => `${c.name} (+${c.ratingChange})`).join(", ")} improved their rating over the same window.`,
    });
  }

  if (audit.changed && audit.score !== null && audit.previousScore !== null) {
    const drop = audit.score < audit.previousScore;
    causes.push({
      id: drop ? "audit_regressed" : "audit_improved",
      score: drop ? 85 : 50,
      evidence: `The AI-visibility audit score moved from ${audit.previousScore} to ${audit.score}${audit.at ? ` (last audited ${audit.at.slice(0, 10)})` : ""}.`,
    });
  }

  return causes.sort((a, b) => b.score - a.score);
}
