import type { ScrapedReview, Message } from "../shared/types";
import { waitForSelector, autoScroll, text } from "../shared/dom";

/**
 * Facebook recommendations/reviews scraper.
 *
 * ⚠️ SELECTOR MAINTENANCE + ToS: Facebook uses randomized class names and
 * aggressively rate-limits/obfuscates. There are NO stable review ids in the
 * public DOM, so dedup relies on the server-side content fingerprint. Selectors
 * here are best-effort structural heuristics and WILL need validation against
 * the live DOM. Facebook has no star rating — only "recommends / doesn't
 * recommend", mapped to recommendationStatus.
 */

const RECOMMEND_RE = /\brecommends?\b/i;
const NOT_RECOMMEND_RE = /\b(doesn['’]?t|does not)\s+recommend/i;

function detectRecommendation(blockText: string): ScrapedReview["recommendationStatus"] {
  if (NOT_RECOMMEND_RE.test(blockText)) return "not_recommended";
  if (RECOMMEND_RE.test(blockText)) return "recommended";
  return null;
}

function extractCard(card: Element): ScrapedReview | null {
  const blockText = text(card);
  const status = detectRecommendation(blockText);

  // Reviewer name: first strong/link inside the card (heuristic).
  const reviewerName =
    text(card.querySelector('a[role="link"] strong, h3 a, strong')) || undefined;

  // Body text: longest paragraph-like node, excluding the header line.
  let reviewText: string | undefined;
  const candidates = Array.from(card.querySelectorAll('div[dir="auto"], span[dir="auto"]'))
    .map((n) => text(n))
    .filter((t) => t.length > 20 && !RECOMMEND_RE.test(t));
  if (candidates.length) reviewText = candidates.sort((a, b) => b.length - a.length)[0];

  const reviewDate = text(card.querySelector('a[role="link"] span[aria-label], abbr')) || undefined;

  if (!reviewText && !status) return null;

  return {
    platform: "FACEBOOK",
    reviewerName,
    rating: null,
    recommendationStatus: status,
    reviewText: reviewText ?? null,
    reviewDate: reviewDate ?? null,
    sourceUrl: location.href,
    externalId: null, // no stable public id; server fingerprints
  };
}

export async function scrapeFacebook(): Promise<ScrapedReview[]> {
  // Reviews live under a feed-like container; wait for any article/recommendation.
  await waitForSelector(['div[role="article"]', 'div[role="feed"]'], 8000);

  const countCards = () => document.querySelectorAll('div[role="article"]').length;
  await autoScroll(countCards, { maxRounds: 30, pauseMs: 900 });

  const cards = Array.from(document.querySelectorAll('div[role="article"]'));
  const seen = new Set<string>();
  const reviews: ScrapedReview[] = [];
  for (const card of cards) {
    const r = extractCard(card);
    if (!r) continue;
    const key = `${r.reviewerName}|${(r.reviewText ?? "").slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reviews.push(r);
  }
  return reviews;
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === "SCRAPE_ACTIVE_TAB") {
    scrapeFacebook()
      .then((reviews) =>
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "FACEBOOK",
        } satisfies Message),
      )
      .catch((err) => {
        console.error("[EchoRank] Facebook scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "FACEBOOK",
        } satisfies Message);
      });
    return true;
  }
});
