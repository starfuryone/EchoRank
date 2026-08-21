// src/lib/blog-agent/discover.ts
//
// Candidates in, three topics out. Pure functions over the feed items, so the
// whole selection is testable without a network call.
//
// Three filters in order, and the order is the point: score first (is this even
// about us), then dedupe against what we have already covered, then take the
// top N. Deduping before scoring would waste the comparison on stories that
// were never going to be selected.

import { createHash } from "node:crypto";
import { NEGATIVE_TERMS, TOPIC_MAP } from "./sources";
import type { FeedItem } from "./feeds";

/** A scored, deduped candidate ready to be drafted. */
export interface Topic extends FeedItem {
  score: number;
  /** Stable id for the 30-day dedupe window. See topicHash(). */
  topicHash: string;
}

/**
 * Below this RAW topic score, a story is not about this blog's subject.
 *
 * IT GATES topicScore() ALONE, not the ranked score. That distinction was a bug
 * on the first live run: the floor was applied to
 * `topicScore x weight x recency`, and since recency is at most 1.0 it can only
 * shrink the number — so a perfectly on-topic story published yesterday scored
 * 2.43 against a 2.5 floor and nothing was ever selected. Freshness is already
 * a gate in its own right (recencyFactor returns 0 past MAX_AGE_DAYS); weight
 * and recency decide ORDER among stories that are on topic, not whether they
 * are on topic.
 *
 * 2.0 is the line between "mentions one of our words" and "is about one of our
 * subjects", read off TOPIC_MAP rather than fitted to a day's headlines: it
 * admits a story matching any single GEO-specific signal (llms.txt 3.0, AI
 * crawlers 2.6, answer engines and AI Mode 2.4, AI visibility 2.2, agentic
 * browsing 2.0) and excludes one that matched only a generic term (an engine
 * name 1.6, structured data 1.4, SEO 1.0). A story about ChatGPT is not
 * necessarily a story about AI visibility; a story about answer engines is.
 */
export const MIN_TOPIC_SCORE = 2.0;

/** How far back a story can be published and still count as news. */
export const MAX_AGE_DAYS = 7;

/**
 * Normalize a title for hashing and overlap.
 *
 * Lowercase, strip punctuation, drop stopwords. "Google's New AI Mode: What It
 * Means" and "What Google's new AI mode means" must land on the same tokens, or
 * the same story from two publications gets drafted twice.
 */
const STOPWORDS = new Set([
  "a","an","the","and","or","but","for","of","to","in","on","at","by","with","from","as","is","are",
  "was","were","be","been","it","its","this","that","these","those","what","how","why","when","new",
  "your","you","we","our","us","will","can","do","does","now","just","more","most","about","into",
]);

export function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * The dedupe key: a hash of the normalized token SET, sorted.
 *
 * Sorted because word order varies between outlets reporting the same thing;
 * a set because a repeated word should not change the identity. This is
 * deliberately exact-match — two stories hash the same only if they use the
 * same significant words. Near-duplicates are caught by overlap() below.
 */
export function topicHash(title: string): string {
  const tokens = [...new Set(normalizeTitle(title))].sort();
  return createHash("sha256").update(tokens.join(" ")).digest("hex").slice(0, 32);
}

/** Jaccard overlap of two token sets, 0..1. */
export function overlap(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  return shared / (setA.size + setB.size - shared);
}

/** At or above this, a candidate is "the same subject" as an existing article. */
export const OVERLAP_THRESHOLD = 0.45;

/**
 * Topical fit, from the title and summary.
 *
 * A term counts ONCE however often it appears — otherwise a listicle that says
 * "AI search" eleven times outranks the announcement that actually matters.
 * Negative terms subtract rather than disqualify: "Perplexity raises Series B
 * and ships an AI crawler directive" is still a story about a crawler directive.
 */
export function topicScore(item: Pick<FeedItem, "title" | "summary">): number {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  let score = 0;
  for (const group of TOPIC_MAP) {
    if (group.terms.some((t) => haystack.includes(t))) score += group.weight;
  }
  for (const term of NEGATIVE_TERMS) {
    if (haystack.includes(term)) score -= 1.2;
  }
  return score;
}

/**
 * Recency multiplier: 1.0 today, decaying to 0 at MAX_AGE_DAYS.
 *
 * An item with NO date scores 0.5 rather than 1.0. Some feeds omit dates, and
 * treating "unknown" as "brand new" would let an undated evergreen page beat
 * this morning's announcement every single day, forever.
 */
export function recencyFactor(publishedAt: string | null, now: Date): number {
  if (!publishedAt) return 0.5;
  const ageMs = now.getTime() - new Date(publishedAt).getTime();
  if (ageMs < 0) return 1; // clock skew at the publisher; not a reason to punish
  const ageDays = ageMs / 86_400_000;
  if (ageDays > MAX_AGE_DAYS) return 0;
  return 1 - ageDays / MAX_AGE_DAYS;
}

export interface SelectInput {
  items: readonly FeedItem[];
  /** Source weights by id, from the config. */
  weights: Readonly<Record<string, number>>;
  /** topicHashes seen in the last 30 days, from blog_agent_runs. */
  seenHashes: ReadonlySet<string>;
  /** Titles of articles already in content/blog/, for overlap. */
  existingTitles: readonly string[];
  limit: number;
  now: Date;
}

/**
 * Score, dedupe and select.
 *
 * Returns FEWER than `limit` when fewer candidates clear the bar, and that is
 * the intended behaviour — the brief is explicit that a thin day produces fewer
 * drafts rather than padding with filler. An agent that always emits three
 * articles is an agent that will publish something about nothing.
 */
export function selectTopics(input: SelectInput): Topic[] {
  const existingTokens = input.existingTitles.map(normalizeTitle);

  const scored: Topic[] = [];
  for (const item of input.items) {
    // TWO INDEPENDENT GATES, and keeping them separate is the whole point —
    // see MIN_TOPIC_SCORE. `raw` decides whether the story is about us;
    // `recency` decides whether it is still news; the product of the two with
    // the source weight decides only the ORDER of what survives both.
    const raw = topicScore(item);
    if (raw < MIN_TOPIC_SCORE) continue;
    const recency = recencyFactor(item.publishedAt, input.now);
    if (recency <= 0) continue;
    scored.push({
      ...item,
      score: raw * (input.weights[item.sourceId] ?? 1) * recency,
      topicHash: topicHash(item.title),
    });
  }
  scored.sort((a, b) => b.score - a.score);

  const selected: Topic[] = [];
  const takenTokens: string[][] = [];

  for (const candidate of scored) {
    if (selected.length >= input.limit) break;
    // Covered before, inside the 30-day window.
    if (input.seenHashes.has(candidate.topicHash)) continue;

    const tokens = normalizeTitle(candidate.title);
    // Already an article about this.
    if (existingTokens.some((t) => overlap(tokens, t) >= OVERLAP_THRESHOLD)) continue;
    // Two outlets covering the same story in this same run: keep the higher
    // score, which is the first one seen because the list is sorted.
    if (takenTokens.some((t) => overlap(tokens, t) >= OVERLAP_THRESHOLD)) continue;

    selected.push(candidate);
    takenTokens.push(tokens);
  }

  return selected;
}

/**
 * Corroborating items for a topic: other outlets on the same story.
 *
 * Used by research to gather up to three more pages without following links
 * into the open web — a same-story item from a feed we already trust is a
 * better second source than whatever the first page happened to link to.
 */
export function corroborating(topic: Topic, items: readonly FeedItem[], limit = 3): FeedItem[] {
  const tokens = normalizeTitle(topic.title);
  return items
    .filter((i) => i.url !== topic.url)
    .map((i) => ({ item: i, o: overlap(tokens, normalizeTitle(i.title)) }))
    // A lower bar than OVERLAP_THRESHOLD on purpose: here we WANT the adjacent
    // coverage that dedupe rejects, because a second angle is what stops the
    // draft being a rewrite of one press release.
    .filter((x) => x.o >= 0.2)
    .sort((a, b) => b.o - a.o)
    .slice(0, limit)
    .map((x) => x.item);
}
