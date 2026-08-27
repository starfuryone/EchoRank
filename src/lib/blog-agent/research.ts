// src/lib/blog-agent/research.ts
//
// Turning a selected topic into the text the model will actually read.
//
// EXTRACTION IS DELIBERATELY CRUDE. A full readability port scores every node
// by link density and text length; what follows takes the densest article-ish
// container and drops the furniture. That is enough here because the input is
// four known publications' article pages, and because a bad extraction is
// visible immediately — the gate rejects a draft with no external sources, and
// a draft built from a nav menu will not have them.
//
// The corroborating pages come from OTHER FEED ITEMS on the same story, not
// from links on the first page. That keeps the fetch allowlist closed: every
// URL fetched came from a feed we configured, so there is no path from "a page
// we read" to "a host we contact".

import * as cheerio from "cheerio";
import { logger } from "@/infrastructure/observability/logger";
import { guardedFetch } from "./fetch";
import { allowedFeedOrigins } from "./sources";
import type { FeedItem } from "./feeds";
import type { Topic } from "./discover";
import { corroborating } from "./discover";

/** Per-page extract handed to the prompt builder. */
export interface Extract {
  url: string;
  sourceName: string;
  title: string;
  /** Plain text, already capped. */
  text: string;
}

export interface Research {
  topic: Topic;
  extracts: Extract[];
}

/** Elements that are never the article. */
const FURNITURE = [
  "script","style","noscript","nav","header","footer","aside","form","iframe","svg",
  "figure figcaption",".advertisement",".ad",".newsletter",".related",".share",".comments",
  "[aria-hidden='true']","[role='navigation']","[role='banner']","[role='contentinfo']",
];

/** Containers most likely to hold the body, best first. */
const CANDIDATES = ["article", "main", "[role='main']", ".post-content", ".entry-content", "body"];

/** Max characters of extracted prose per page. Roughly 1,500 tokens. */
const MAX_EXTRACT_CHARS = 6_000;

/**
 * HTML to readable text.
 *
 * Exported and pure: the suite feeds it fixture HTML rather than fetching a
 * live page, which is the only way this stays testable as those pages change.
 */
export function extractReadable(html: string): string {
  const $ = cheerio.load(html);
  $(FURNITURE.join(",")).remove();

  let best = "";
  for (const selector of CANDIDATES) {
    const node = $(selector).first();
    if (!node.length) continue;
    // Paragraphs only. A container's raw text() concatenates menu items and
    // button labels into the prose; <p> is where publications put sentences.
    const text = node
      .find("p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 40)
      .join("\n\n");
    if (text.length > best.length) best = text;
    // A container that already yielded a real article is good enough; carrying
    // on to "body" would only ever add furniture back.
    if (best.length > 1_200) break;
  }
  return best.slice(0, MAX_EXTRACT_CHARS);
}

/**
 * Fetch and extract one page. Returns null on any refusal — never throws.
 *
 * EVERY REFUSAL IS LOGGED, AT WARN, WITH THE URL. The 05:00 run on 2026-08-27
 * reported "insufficient research — no source page could be read" and nothing
 * else: four pages had been refused, and which ones, and why, was not
 * recoverable from the logs. A silent null per page turns four distinct causes —
 * a 403, a robots block, a paywall stub, a host that would not resolve — into
 * one indistinguishable outcome. The shape mirrors feeds.ts so the two stages
 * read the same way.
 */
async function extractOne(item: FeedItem): Promise<Extract | null> {
  const origins = [...allowedFeedOrigins(), safeOrigin(item.url)].filter(Boolean) as string[];
  const res = await guardedFetch(item.url, {
    allowedOrigins: origins,
    accept: "text/html,application/xhtml+xml",
  });
  if (!res.ok || !res.body) {
    logger.warn(
      {
        url: item.url,
        source: item.sourceName,
        reason: res.reason,
        status: res.status,
        detail: res.detail,
      },
      "blog-agent: source page could not be fetched",
    );
    return null;
  }
  if (res.contentType && !res.contentType.includes("html")) {
    logger.warn(
      { url: res.url, source: item.sourceName, status: res.status, contentType: res.contentType },
      "blog-agent: source page is not html",
    );
    return null;
  }

  const text = extractReadable(res.body);
  // Under ~400 characters this is a paywall stub, a cookie wall or a redirect
  // page. Passing it to the model produces a draft with nothing behind it.
  if (text.length < 400) {
    logger.warn(
      {
        url: res.url,
        source: item.sourceName,
        status: res.status,
        bytes: res.body.length,
        chars: text.length,
      },
      "blog-agent: source page yielded too little prose (paywall, cookie wall or redirect)",
    );
    return null;
  }

  return { url: res.url, sourceName: item.sourceName, title: item.title, text };
}

/**
 * The origin of a feed ITEM, which is not always its feed's origin — Search
 * Engine Land syndicates, HN links out. Parsed defensively: a malformed URL
 * yields null and the item is simply not fetchable.
 *
 * This is the one place the allowlist widens beyond the configured feeds, and
 * it widens by exactly one origin per item, taken from a URL a configured feed
 * published. Arbitrary input never reaches it.
 */
function safeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Gather the source page plus up to three corroborating pages.
 *
 * A topic whose own page cannot be extracted still proceeds if a corroborating
 * page worked — the story is real, we just could not read one outlet's version
 * of it. A topic with NO extracts at all returns an empty list, and the caller
 * skips it rather than asking the model to write from a headline.
 */
export async function researchTopic(
  topic: Topic,
  pool: readonly FeedItem[],
): Promise<Research> {
  const others = corroborating(topic, pool, 3);
  const attempted = [topic, ...others];
  const settled = await Promise.allSettled(attempted.map((i) => extractOne(i)));

  // extractOne is written not to throw, so a rejection here is a bug rather
  // than a dead page — and it would otherwise be swallowed by the flatMap.
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.warn(
        { url: attempted[i].url, source: attempted[i].sourceName, err: String(r.reason) },
        "blog-agent: source extraction threw",
      );
    }
  });

  const extracts = settled
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    // Two outlets can syndicate the same wire copy; one URL each is enough.
    .filter((e, i, all) => all.findIndex((x) => x.url === e.url) === i);

  logger.info(
    { topic: topic.title, attempted: attempted.length, extracted: extracts.length },
    "blog-agent: research complete",
  );

  return { topic, extracts };
}
