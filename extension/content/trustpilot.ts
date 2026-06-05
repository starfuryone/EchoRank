import type { ScrapedReview, Message } from "../shared/types";
import { waitForSelector, autoScroll, text, parseRating } from "../shared/dom";

/**
 * Trustpilot review scraper.
 *
 * ⚠️ SELECTOR MAINTENANCE: Trustpilot ships hashed class names (e.g.
 * `styles_reviewCard__xxxx`) that change on deploys, but also exposes stable
 * `data-service-review-*` attributes which we prefer. Trustpilot paginates
 * (page 2, 3, …) rather than infinite-scroll; this scraper handles the CURRENT
 * page. Multi-page crawl is listed as remaining work in the docs.
 */

const CARD_SELECTORS = [
  "article[data-service-review-card-paper]",
  'section[class*="reviews" i] article',
  "article",
];

function extractCard(card: Element): ScrapedReview | null {
  const reviewerName =
    text(card.querySelector('[data-consumer-name-typography], span[class*="consumerName" i]')) ||
    undefined;

  // Rating is exposed via the star image alt/aria or a data attribute.
  const ratingImg = card.querySelector('div[data-service-review-rating] img, img[alt*="Rated" i]');
  const rating =
    parseRating(ratingImg?.getAttribute("alt") ?? undefined) ??
    (() => {
      const dr = card.querySelector("[data-service-review-rating]")?.getAttribute(
        "data-service-review-rating",
      );
      const n = dr ? parseInt(dr, 10) : NaN;
      return Number.isFinite(n) ? n : undefined;
    })();

  const reviewText =
    text(
      card.querySelector(
        '[data-service-review-text-typography], p[class*="reviewContent" i], section p',
      ),
    ) || undefined;

  const reviewDate =
    (card.querySelector("time")?.getAttribute("datetime") ??
      text(card.querySelector("time"))) ||
    undefined;

  const ownerResponse =
    text(card.querySelector('[data-service-review-business-reply-text-typography]')) || undefined;

  // Native id from the review permalink, if present.
  const link = card.querySelector<HTMLAnchorElement>('a[href*="/reviews/"]');
  const externalId = link?.href.match(/\/reviews\/([A-Za-z0-9]+)/)?.[1] ?? undefined;

  if (!reviewText && rating == null) return null;

  return {
    platform: "TRUSTPILOT",
    reviewerName,
    rating: rating ?? null,
    reviewText: reviewText ?? null,
    reviewDate: reviewDate ?? null,
    ownerResponse: ownerResponse ?? null,
    sourceUrl: location.href,
    externalId: externalId ?? null,
  };
}

export async function scrapeTrustpilot(): Promise<ScrapedReview[]> {
  await waitForSelector(CARD_SELECTORS, 8000);

  const countCards = () => {
    for (const sel of CARD_SELECTORS) {
      const n = document.querySelectorAll(sel).length;
      if (n) return n;
    }
    return 0;
  };
  // Trustpilot lazy-loads some content on scroll even within a page.
  await autoScroll(countCards, { maxRounds: 10, pauseMs: 600 });

  let cards: Element[] = [];
  for (const sel of CARD_SELECTORS) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length) {
      cards = found;
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
    scrapeTrustpilot()
      .then((reviews) =>
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "TRUSTPILOT",
        } satisfies Message),
      )
      .catch((err) => {
        console.error("[EchoRank] Trustpilot scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "TRUSTPILOT",
        } satisfies Message);
      });
    return true;
  }
});
