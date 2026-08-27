// src/lib/blog-agent/pipeline.ts
//
// The stages, wired together. The worker calls these; they call everything else.
//
// KILL SWITCH AT EVERY STAGE, per the brief. A repeatable job already in the
// queue still fires after the switch is flipped, and a draft fan-out job can
// sit there for minutes — so `blogAgentEnabled()` is checked on entry to each
// stage rather than once at schedule time. Flipping it to false stops the
// pipeline within one job.

import "server-only";

import {
  blogAgentDailyTarget,
  blogAgentDailyUsd,
  blogAgentEnabled,
  blogAgentMode,
} from "./config";
import { ACTIVE_SOURCES } from "./sources";
import { fetchAllSources, type FeedItem } from "./feeds";
import { selectTopics, type Topic } from "./discover";
import { researchTopic } from "./research";
import { systemPrompt, userMessage } from "./prompt";
import { callDraftModel, extractFenced } from "./client";
import { runGate } from "./gate";
import { renderHero } from "./hero";
import { landDraft } from "./land";
import { notify } from "./notify";
import {
  advanceRun,
  awaitingReview,
  createRun,
  reconcilePublished,
  seenTopicHashes,
  spendTodayUsd,
} from "./store";
import { getAllArticles } from "@/lib/blog/loader";
import { logger } from "@/infrastructure/observability/logger";

/** Thrown when a stage is entered with the agent disabled. Caught by the worker. */
export class BlogAgentDisabled extends Error {
  constructor() {
    super("BLOG_AGENT_ENABLED is not true");
    this.name = "BlogAgentDisabled";
  }
}

function assertEnabled(): void {
  if (!blogAgentEnabled()) throw new BlogAgentDisabled();
}

/** What the discover stage hands each draft job. */
export interface DraftJobPayload {
  runId: string;
  topic: Topic;
  /** The candidate pool, so research can find corroborating coverage. */
  pool: FeedItem[];
}

/**
 * Stage 1 — pick today's topics and open a ledger row for each.
 *
 * Returns FEWER than the target when fewer candidates clear the bar. The brief
 * is explicit and it is the right call: an agent that always produces three
 * articles is an agent that will eventually write about nothing.
 */
export async function runDiscover(now = new Date()): Promise<DraftJobPayload[]> {
  assertEnabled();

  const items = await fetchAllSources(ACTIVE_SOURCES);
  if (!items.length) {
    await notify({
      level: "alert",
      title: "Discover found nothing",
      lines: ["Every configured source returned zero items. Check the source URLs and egress."],
    });
    return [];
  }

  const weights = Object.fromEntries(ACTIVE_SOURCES.map((s) => [s.id, s.weight]));
  const published = getAllArticles("en");
  const [seenHashes] = await Promise.all([seenTopicHashes(now)]);

  const topics = selectTopics({
    items,
    weights,
    seenHashes,
    existingTitles: published.map((a) => a.title),
    limit: blogAgentDailyTarget(),
    now,
  });

  logger.info(
    { candidates: items.length, selected: topics.length },
    "blog-agent: discover complete",
  );

  if (!topics.length) {
    await notify({
      level: "briefing",
      title: "No topics worth drafting today",
      lines: [
        `${items.length} candidates fetched, none cleared the topic score or all were already covered.`,
        "No drafts written. This is the designed behaviour on a thin news day.",
      ],
    });
    return [];
  }

  const payloads: DraftJobPayload[] = [];
  for (const topic of topics) {
    const runId = await createRun({
      topicHash: topic.topicHash,
      topicTitle: topic.title,
      sourceId: topic.sourceId,
      sourceUrls: [topic.url],
    });
    payloads.push({ runId, topic, pool: items as FeedItem[] });
  }
  return payloads;
}

export interface DraftOutcome {
  runId: string;
  slug?: string;
  ok: boolean;
  reason?: string;
  costUsd: number;
}

/**
 * Stage 2 — research, draft, gate, land. One topic, one ledger row.
 *
 * THE BUDGET IS CHECKED BEFORE EACH CALL, not once per run. A retry is a second
 * call, and a cap that is only consulted at the top of the job is a cap that
 * can be exceeded by exactly one retry per concurrent job.
 */
export async function runDraft(payload: DraftJobPayload, now = new Date()): Promise<DraftOutcome> {
  assertEnabled();
  const { runId, topic } = payload;
  let spent = 0;

  const budget = blogAgentDailyUsd();
  const alreadySpent = await spendTodayUsd(now);
  if (alreadySpent >= budget) {
    await advanceRun(runId, { status: "GATED_FAIL", error: "daily budget exhausted" });
    await notify({
      level: "alert",
      title: "Daily Anthropic budget exhausted",
      lines: [
        `Spent $${alreadySpent.toFixed(4)} of $${budget.toFixed(2)} (BLOG_AGENT_DAILY_USD).`,
        `Skipped: ${topic.title}`,
      ],
    });
    return { runId, ok: false, reason: "budget", costUsd: 0 };
  }

  // ── Research ─────────────────────────────────────────────────────────────
  await advanceRun(runId, { stage: "RESEARCH" });
  const research = await researchTopic(topic, payload.pool);
  if (research.extracts.length < 1) {
    // ZERO readable pages, not "fewer than two". A single-source story is
    // normal — on 2026-08-21 the day's top story was covered by exactly one
    // outlet in the whole source set — and the gate's citation requirement
    // adapts to match. What cannot be written from is nothing at all: a
    // headline is not research, and asking the model to expand one is asking
    // it to invent the article.
    const reason = `no source page could be read`;
    await advanceRun(runId, { status: "GATED_FAIL", error: reason });
    // WARN, not info, and it names the topic — this is the line a human reads
    // when the morning run produced nothing. The per-URL reasons are logged one
    // level down in research.ts; this says which topic they belonged to.
    logger.warn(
      { runId, reason, topic: topic.title, topicUrl: topic.url, source: topic.sourceId },
      "blog-agent: insufficient research",
    );
    return { runId, ok: false, reason, costUsd: 0 };
  }
  const researchUrls = new Set(research.extracts.map((e) => e.url));
  await advanceRun(runId, { sourceUrls: [...researchUrls] });

  // ── Draft, gate, one retry ───────────────────────────────────────────────
  const published = getAllArticles("en");
  const existingSlugs = new Set(published.map((a) => a.slug));
  const promptInput = {
    topicTitle: topic.title,
    extracts: research.extracts,
    existingSlugs: published.map((a) => ({ slug: a.slug, title: a.title, category: a.category })),
  };

  await advanceRun(runId, { stage: "DRAFT" });
  let failures: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && (await spendTodayUsd(now)) >= budget) {
      await advanceRun(runId, { status: "GATED_FAIL", error: "budget exhausted before retry" });
      return { runId, ok: false, reason: "budget", costUsd: spent };
    }

    let reply;
    try {
      reply = await callDraftModel({
        system: systemPrompt(),
        userMessage: userMessage({
          ...promptInput,
          ...(attempt > 0 ? { gateFailures: failures } : {}),
        }),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "model call failed";
      await advanceRun(runId, { status: "GATED_FAIL", error: reason });
      await notify({ level: "alert", title: "Draft call failed", lines: [topic.title, reason] });
      return { runId, ok: false, reason, costUsd: spent };
    }

    spent += reply.costUsd;
    await advanceRun(runId, { addCostUsd: reply.costUsd });

    await advanceRun(runId, { stage: "GATE" });
    const gate = runGate({ raw: extractFenced(reply.text), existingSlugs, researchUrls });

    if (!gate.ok || !gate.draft) {
      failures = gate.failures;
      logger.info({ runId, attempt, failures }, "blog-agent: gate rejected draft");
      continue;
    }

    // ── Land ───────────────────────────────────────────────────────────────
    await advanceRun(runId, { stage: "LAND" });
    const hero = renderHero({ slug: gate.draft.slug, category: gate.draft.category });
    const landed = await landDraft({
      slug: gate.draft.slug,
      markdown: gate.draft.markdown,
      heroSvg: hero,
    });

    // MODE. "auto" is implemented and must stay off — see the comment on
    // BlogAgentMode in config.ts for why. Even in auto the file is written with
    // `status: draft` by the gate; flipping it is a separate, visible edit.
    const mode = blogAgentMode();
    await advanceRun(runId, {
      status: mode === "auto" ? "APPROVED" : "AWAITING_REVIEW",
      slug: gate.draft.slug,
      error: null,
    });

    await notify({
      level: "briefing",
      title: `Draft ready: ${gate.draft.title}`,
      lines: [
        `slug: ${gate.draft.slug}`,
        `category: ${gate.draft.category}`,
        `${gate.draft.wordCount} words, ${gate.draft.readingTime} min read`,
        `sources: ${[...researchUrls].join(", ")}`,
        `gate: passed on attempt ${attempt + 1}`,
        `cost: $${spent.toFixed(4)}`,
        `file: ${landed.markdownPath}`,
        landed.committed ? `commit: ${landed.commitSha}` : "NOT COMMITTED — commit by hand",
        mode === "auto"
          ? "mode=auto: marked APPROVED. The file still says status: draft — flip it to publish."
          : "To publish: change `status: draft` to `status: published` in the file.",
      ],
    });

    return { runId, ok: true, slug: gate.draft.slug, costUsd: spent };
  }

  // Two attempts, both rejected.
  await advanceRun(runId, { status: "GATED_FAIL", error: failures.join(" | ") });
  await notify({
    level: "alert",
    title: `Draft failed the quality gate twice: ${topic.title}`,
    lines: [...failures, `cost: $${spent.toFixed(4)}`],
  });
  return { runId, ok: false, reason: "gate", costUsd: spent };
}

/**
 * Stage 3 — reconcile the ledger with what is on disk and report.
 *
 * It does NOT build. The build needs root (the chown steps), and deploy's sudo
 * is scoped to pm2 alone — widening it for a content pipeline would be the
 * wrong trade. /opt/echorank/bin/publish-blog.sh runs from a root systemd timer
 * and reads the same filesystem this reconciles against.
 */
export async function runPublishCheck(): Promise<{ published: number; waiting: number }> {
  assertEnabled();

  const onDisk = getAllArticles("en");
  const publishedSlugs = new Set(onDisk.map((a) => a.slug));
  const published = await reconcilePublished(publishedSlugs);
  const waiting = await awaitingReview();

  await notify({
    level: "briefing",
    title: "Blog agent daily summary",
    lines: [
      `${published} draft(s) reconciled as published since the last check.`,
      `${waiting.length} awaiting review.`,
      ...waiting.slice(0, 10).map((w) => `  · ${w.slug ?? "(no slug)"} — ${w.topicTitle}`),
      `total published articles on disk: ${onDisk.length}`,
    ],
  });

  return { published, waiting: waiting.length };
}
