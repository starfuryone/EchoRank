// Topic selection: scoring, the 30-day dedupe, and the "fewer, never filler"
// rule that stops the agent writing about nothing on a thin news day.
//
// Every function under test is pure, so none of this touches the network.

import { describe, expect, it } from "vitest";
import {
  MIN_TOPIC_SCORE,
  OVERLAP_THRESHOLD,
  corroborating,
  normalizeTitle,
  overlap,
  recencyFactor,
  selectTopics,
  topicHash,
  topicScore,
} from "@/lib/blog-agent/discover";
import type { FeedItem } from "@/lib/blog-agent/feeds";

const NOW = new Date("2026-08-21T05:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function item(over: Partial<FeedItem> = {}): FeedItem {
  return {
    title: "Google ships a new AI crawler directive for llms.txt",
    url: "https://searchengineland.com/a",
    sourceId: "search_engine_land",
    sourceName: "Search Engine Land",
    publishedAt: hoursAgo(4),
    summary: "A change to how AI crawlers are directed.",
    ...over,
  };
}

const BASE = {
  weights: { search_engine_land: 1, google_search_central: 1.4, hn_geo: 0.7 },
  seenHashes: new Set<string>(),
  existingTitles: [] as string[],
  limit: 3,
  now: NOW,
};

describe("normalization", () => {
  it("drops stopwords, punctuation and case", () => {
    expect(normalizeTitle("What Google's NEW AI Mode Means for You")).toEqual([
      "google", "mode", "means",
    ]);
  });

  it("folds accents so the same word matches either way", () => {
    expect(normalizeTitle("référencement")).toEqual(["referencement"]);
  });
});

describe("topicHash", () => {
  it("is stable across word order and punctuation", () => {
    // Two outlets, same story, different headline shape. If these hashed
    // differently the agent would draft the same story twice in one morning.
    expect(topicHash("Google's new AI Mode: what it means")).toBe(
      topicHash("What Google's new AI mode means!"),
    );
  });

  it("differs for genuinely different stories", () => {
    expect(topicHash("Google ships an AI crawler directive")).not.toBe(
      topicHash("Perplexity publishes a citations report"),
    );
  });
});

describe("overlap", () => {
  it("is 1 for identical token sets and 0 for disjoint ones", () => {
    expect(overlap(["a", "b"], ["b", "a"])).toBe(1);
    expect(overlap(["a"], ["b"])).toBe(0);
  });

  it("is 0 when either side is empty rather than dividing by zero", () => {
    expect(overlap([], ["a"])).toBe(0);
  });
});

describe("topicScore", () => {
  it("scores an on-topic story above the selection floor", () => {
    expect(topicScore({ title: "llms.txt and AI crawlers", summary: "" })).toBeGreaterThan(
      MIN_TOPIC_SCORE,
    );
  });

  it("scores an off-topic story below it", () => {
    expect(
      topicScore({ title: "Our team is hiring three engineers", summary: "Join us" }),
    ).toBeLessThan(MIN_TOPIC_SCORE);
  });

  it("counts a term once however often it repeats", () => {
    // Otherwise a listicle saying "AI search" eleven times outranks the
    // announcement that actually matters.
    const once = topicScore({ title: "AI search", summary: "" });
    const many = topicScore({ title: "AI search", summary: "AI search AI search AI search" });
    expect(many).toBe(once);
  });

  it("subtracts for a story that is about something else", () => {
    const plain = topicScore({ title: "Perplexity ships an AI crawler directive", summary: "" });
    const funding = topicScore({
      title: "Perplexity ships an AI crawler directive",
      summary: "The announcement came alongside a series b funding round.",
    });
    expect(funding).toBeLessThan(plain);
  });
});

describe("recency", () => {
  it("decays from 1 today to 0 at the age limit", () => {
    expect(recencyFactor(hoursAgo(0), NOW)).toBeCloseTo(1, 2);
    expect(recencyFactor(hoursAgo(24 * 7), NOW)).toBe(0);
    expect(recencyFactor(hoursAgo(24 * 10), NOW)).toBe(0);
  });

  it("treats a missing date as middling, never as brand new", () => {
    // An undated evergreen page scoring 1.0 would beat this morning's
    // announcement every day, forever.
    expect(recencyFactor(null, NOW)).toBe(0.5);
    expect(recencyFactor(null, NOW)).toBeLessThan(recencyFactor(hoursAgo(1), NOW));
  });

  it("does not punish a publisher whose clock is ahead", () => {
    expect(recencyFactor(new Date(NOW.getTime() + 3_600_000).toISOString(), NOW)).toBe(1);
  });
});

describe("selection", () => {
  it("returns the highest-scoring candidates, newest first by score", () => {
    const picked = selectTopics({
      ...BASE,
      items: [
        item({ title: "A hiring announcement from an agency", url: "https://searchengineland.com/1" }),
        item({ title: "llms.txt becomes an AI crawler standard", url: "https://searchengineland.com/2" }),
      ],
    });
    expect(picked.map((p) => p.url)).toEqual(["https://searchengineland.com/2"]);
  });

  it("weights a first-party source above the trade press", () => {
    const picked = selectTopics({
      ...BASE,
      limit: 2,
      items: [
        item({ title: "AI crawler rules change for llms.txt", url: "https://a/1", sourceId: "search_engine_land" }),
        item({ title: "Answer engines change AI citation behaviour", url: "https://b/2", sourceId: "google_search_central" }),
      ],
    });
    expect(picked[0].sourceId).toBe("google_search_central");
  });

  it("skips a topic already covered inside the 30-day window", () => {
    const covered = item({ title: "llms.txt becomes an AI crawler standard" });
    const picked = selectTopics({
      ...BASE,
      items: [covered],
      seenHashes: new Set([topicHash(covered.title)]),
    });
    expect(picked).toEqual([]);
  });

  it("skips a topic that overlaps an article already on the blog", () => {
    const picked = selectTopics({
      ...BASE,
      items: [item({ title: "How to measure AI search visibility properly" })],
      existingTitles: ["How to measure AI search visibility without guessing"],
    });
    expect(picked).toEqual([]);
  });

  it("collapses two outlets covering the same story within one run", () => {
    // Both clear the bar; only the higher-scoring one is drafted. Without this
    // the agent publishes the same news twice on the same morning.
    const picked = selectTopics({
      ...BASE,
      items: [
        item({ title: "Google ships an AI crawler directive for llms.txt", url: "https://a/1" }),
        item({ title: "Google's llms.txt AI crawler directive ships", url: "https://b/2" }),
      ],
    });
    expect(picked).toHaveLength(1);
  });

  it("returns FEWER than the limit rather than padding with filler", () => {
    // The brief is explicit, and it is the difference between an agent that
    // writes when there is something to say and one that always writes.
    const picked = selectTopics({
      ...BASE,
      limit: 3,
      items: [item({ title: "llms.txt becomes an AI crawler standard" })],
    });
    expect(picked).toHaveLength(1);
  });

  it("gates on the RAW topic score, never on the ranked one", () => {
    // REGRESSION, found on the first live run (2026-08-21). The floor used to
    // be applied to `topicScore x weight x recency`. Recency is at most 1.0, so
    // that product can only be SMALLER than the topic score — a perfectly
    // on-topic story published yesterday scored 2.43 against a 2.5 floor and
    // the agent selected nothing, from any source, ever.
    //
    // A story well above the floor, from the lowest-weighted source, a few days
    // old — every multiplier working against it — must still be selected.
    const picked = selectTopics({
      ...BASE,
      weights: { hn_geo: 0.7 },
      items: [
        item({
          // One signal, comfortably above the floor at 2.4 raw.
          title: "How answer engines pick which page to name",
          sourceId: "hn_geo",
          publishedAt: hoursAgo(24 * 4),
        }),
      ],
    });
    expect(picked).toHaveLength(1);
    // …and its ranked score is genuinely below the floor, which is the whole
    // point: if this assertion ever fails the test has stopped proving anything.
    expect(picked[0].score).toBeLessThan(MIN_TOPIC_SCORE);
  });

  it("still excludes anything past the age limit, however on-topic", () => {
    // Freshness stays a gate in its own right — it just is not the same gate.
    const picked = selectTopics({
      ...BASE,
      items: [item({ title: "llms.txt becomes an AI crawler standard", publishedAt: hoursAgo(24 * 9) })],
    });
    expect(picked).toEqual([]);
  });

  it("admits a single GEO-specific signal and rejects a generic one", () => {
    // The floor sits between "mentions one of our words" and "is about one of
    // our subjects". A story about ChatGPT is not necessarily about AI
    // visibility; a story about answer engines is.
    expect(topicScore({ title: "Answer engines change how AI Mode works", summary: "" })).toBeGreaterThanOrEqual(MIN_TOPIC_SCORE);
    expect(topicScore({ title: "ChatGPT gets a new interface", summary: "" })).toBeLessThan(MIN_TOPIC_SCORE);
  });

  it("returns nothing at all when no candidate clears the bar", () => {
    const picked = selectTopics({
      ...BASE,
      items: [
        item({ title: "Agency announces a webinar", summary: "Register now" }),
        item({ title: "Quarterly earnings beat expectations", summary: "Stock rose" }),
      ],
    });
    expect(picked).toEqual([]);
  });

  it("never exceeds the limit", () => {
    // Genuinely distinct SUBJECTS, not the same headline with a numeral: a
    // numeral is dropped by normalizeTitle, so "story 1" and "story 2" collapse
    // into one topic — which is the in-run dedupe working, not a bug.
    const subjects = [
      "llms.txt adoption across publisher sites",
      "GPTBot rules land in a major CDN preset",
      "Answer engines start citing product documentation",
      "Perplexity changes how AI citations are attributed",
      "Server rendering returns for AI crawler accessibility",
      "Structured data guidance shifts for generative results",
    ];
    const items = subjects.map((title, i) => item({ title, url: `https://a/${i}` }));
    expect(selectTopics({ ...BASE, items, limit: 3 })).toHaveLength(3);
  });
});

describe("corroborating coverage", () => {
  it("finds adjacent coverage below the dedupe threshold", () => {
    // Deliberately a LOWER bar than dedupe: here we want the second angle that
    // dedupe rejects, because it is what stops the draft being a rewrite of one
    // press release.
    const topic = { ...item({ title: "Google ships an AI crawler directive" }), score: 9, topicHash: "x" };
    const found = corroborating(topic, [
      item({ title: "Google's crawler directive, explained", url: "https://b/2" }),
      item({ title: "A completely unrelated story about pricing", url: "https://c/3" }),
    ]);
    expect(found.map((f) => f.url)).toEqual(["https://b/2"]);
  });

  it("never returns the topic's own page", () => {
    const topic = { ...item(), score: 9, topicHash: "x" };
    expect(corroborating(topic, [item()])).toEqual([]);
  });

  it("caps at the requested number", () => {
    const topic = { ...item({ title: "Google AI crawler directive ships" }), score: 9, topicHash: "x" };
    const pool = Array.from({ length: 6 }, (_, i) =>
      item({ title: "Google AI crawler directive ships", url: `https://x/${i}` }),
    );
    expect(corroborating(topic, pool, 3)).toHaveLength(3);
  });
});

describe("the thresholds are the ones the code uses", () => {
  it("exposes them rather than hiding magic numbers in the selector", () => {
    expect(MIN_TOPIC_SCORE).toBeGreaterThan(0);
    expect(OVERLAP_THRESHOLD).toBeGreaterThan(0);
    expect(OVERLAP_THRESHOLD).toBeLessThan(1);
  });
});
