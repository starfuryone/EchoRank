import type { ScrapedReview, Message } from "../shared/types";
import { waitForSelector, autoScroll, text, parseRating } from "../shared/dom";

/**
 * Google review scraper (Maps place panel + Business Profile).
 *
 * ⚠️ SELECTOR MAINTENANCE: Google obfuscates class names and reskins the
 * reviews panel often. The selectors below are layered (newest known first,
 * with structural fallbacks) and MUST be validated against the live DOM before
 * shipping — see docs/browser-extension.md §Troubleshooting. The scraping
 * STRUCTURE (wait → expand → scroll → per-card extract) is stable; only the
 * selector strings are fragile.
 */

const REVIEW_CARD_SELECTORS = [
  "div[data-review-id]", // most stable: each review card carries a native id
  ".jftiEf", // legacy Maps review card class (validate)
  "div[jscontroller][data-review-id]",
];

const SCROLLER_SELECTORS = [
  'div[role="main"] div[tabindex="-1"]',
  ".m6QErb.DxyBCb.kA9KIf.dS8AEf", // legacy reviews scroll container (validate)
  'div[aria-label*="review" i]',
];

function expandTruncated(root: ParentNode): void {
  // Click "More" buttons so full text is in the DOM before extraction.
  root.querySelectorAll<HTMLElement>('button[aria-label*="More" i], button[jsaction*="review"]').forEach((b) => {
    if (/more/i.test(b.textContent ?? "") || /more/i.test(b.getAttribute("aria-label") ?? "")) {
      try {
        b.click();
      } catch {
        /* ignore */
      }
    }
  });
}

function extractCard(card: Element): ScrapedReview | null {
  const reviewerName =
    text(card.querySelector('.d4r55, [class*="title"] , div[role="button"] > span')) || undefined;

  const ratingEl = card.querySelector('[role="img"][aria-label], span[aria-label*="star" i]');
  const rating = parseRating(ratingEl?.getAttribute("aria-label") ?? undefined);

  const reviewText =
    text(card.querySelector(".wiI7pd, .MyEned, span[jsname]")) || undefined;

  const reviewDate =
    text(card.querySelector(".rsqaWe, .dehysf, span[class*='date' i]")) || undefined;

  const ownerResponse =
    text(card.querySelector('.CDe7pd, div[class*="owner" i]')) || undefined;

  const externalId = card.getAttribute("data-review-id") ?? undefined;

  if (!reviewText && rating == null) return null;

  return {
    platform: "GOOGLE",
    reviewerName,
    rating: rating ?? null,
    reviewText: reviewText ?? null,
    reviewDate: reviewDate ?? null,
    ownerResponse: ownerResponse ?? null,
    sourceUrl: location.href,
    externalId: externalId ?? null,
  };
}

export async function scrapeGoogle(): Promise<ScrapedReview[]> {
  await waitForSelector(REVIEW_CARD_SELECTORS, 8000);

  const scroller =
    SCROLLER_SELECTORS.map((s) => document.querySelector(s)).find(Boolean) ?? null;

  const countCards = () => {
    for (const sel of REVIEW_CARD_SELECTORS) {
      const n = document.querySelectorAll(sel).length;
      if (n) return n;
    }
    return 0;
  };

  await autoScroll(countCards, { scroller, maxRounds: 30, pauseMs: 800 });
  expandTruncated(document);

  const cards: Element[] = [];
  for (const sel of REVIEW_CARD_SELECTORS) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length) {
      cards.push(...found);
      break;
    }
  }

  const seen = new Set<string>();
  const reviews: ScrapedReview[] = [];
  for (const card of cards) {
    const r = extractCard(card);
    if (!r) continue;
    const key = r.externalId ?? `${r.reviewerName}|${(r.reviewText ?? "").slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reviews.push(r);
  }
  return reviews;
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === "SCRAPE_ACTIVE_TAB") {
    scrapeGoogle()
      .then((reviews) =>
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "GOOGLE",
        } satisfies Message),
      )
      .catch((err) => {
        console.error("[EchoRank] Google scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "GOOGLE",
        } satisfies Message);
      });
    return true; // async response
  }
});
