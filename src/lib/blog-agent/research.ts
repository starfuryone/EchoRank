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

/** Fetch and extract one page. Returns null on any refusal — never throws. */
async function extractOne(item: FeedItem): Promise<Extract | null> {
  const origins = [...allowedFeedOrigins(), safeOrigin(item.url)].filter(Boolean) as string[];
  const res = await guardedFetch(item.url, {
    allowedOrigins: origins,
    accept: "text/html,application/xhtml+xml",
  });
  if (!res.ok || !res.body) return null;
  if (res.contentType && !res.contentType.includes("html")) return null;

  const text = extractReadable(res.body);
  // Under ~400 characters this is a paywall stub, a cookie wall or a redirect
  // page. Passing it to the model produces a draft with nothing behind it.
  if (text.length < 400) return null;

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
  const settled = await Promise.allSettled([topic, ...others].map((i) => extractOne(i)));
  const extracts = settled
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    // Two outlets can syndicate the same wire copy; one URL each is enough.
    .filter((e, i, all) => all.findIndex((x) => x.url === e.url) === i);

  return { topic, extracts };
}
