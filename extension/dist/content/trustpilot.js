"use strict";
(() => {
  // shared/dom.ts
  function waitForSelector(selectors, timeoutMs = 8e3) {
    const find = () => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };
    const immediate = find();
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const el = find();
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(find());
      }, timeoutMs);
    });
  }
  async function autoScroll(countItems, options = {}) {
    const { scroller = null, maxRounds = 25, pauseMs = 700 } = options;
    let previous = -1;
    for (let round = 0; round < maxRounds; round++) {
      const current = countItems();
      if (current === previous) break;
      previous = current;
      if (scroller) scroller.scrollTo({ top: scroller.scrollHeight });
      else window.scrollTo({ top: document.body.scrollHeight });
      await sleep(pauseMs);
    }
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function text(el) {
    return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  function parseRating(raw) {
    if (!raw) return void 0;
    const m = raw.match(/([0-5](?:[.,]\d)?)\s*(?:out of|\/|stars?|von|sur)?\s*5?/i);
    if (!m) return void 0;
    const n = parseFloat(m[1].replace(",", "."));
    return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : void 0;
  }

  // content/trustpilot.ts
  var CARD_SELECTORS = [
    "article[data-service-review-card-paper]",
    'section[class*="reviews" i] article',
    "article"
  ];
  function extractCard(card) {
    const reviewerName = text(card.querySelector('[data-consumer-name-typography], span[class*="consumerName" i]')) || void 0;
    const ratingImg = card.querySelector('div[data-service-review-rating] img, img[alt*="Rated" i]');
    const rating = parseRating(ratingImg?.getAttribute("alt") ?? void 0) ?? (() => {
      const dr = card.querySelector("[data-service-review-rating]")?.getAttribute(
        "data-service-review-rating"
      );
      const n = dr ? parseInt(dr, 10) : NaN;
      return Number.isFinite(n) ? n : void 0;
    })();
    const reviewText = text(
      card.querySelector(
        '[data-service-review-text-typography], p[class*="reviewContent" i], section p'
      )
    ) || void 0;
    const reviewDate = (card.querySelector("time")?.getAttribute("datetime") ?? text(card.querySelector("time"))) || void 0;
    const ownerResponse = text(card.querySelector("[data-service-review-business-reply-text-typography]")) || void 0;
    const link = card.querySelector('a[href*="/reviews/"]');
    const externalId = link?.href.match(/\/reviews\/([A-Za-z0-9]+)/)?.[1] ?? void 0;
    if (!reviewText && rating == null) return null;
    return {
      platform: "TRUSTPILOT",
      reviewerName,
      rating: rating ?? null,
      reviewText: reviewText ?? null,
      reviewDate: reviewDate ?? null,
      ownerResponse: ownerResponse ?? null,
      sourceUrl: location.href,
      externalId: externalId ?? null
    };
  }
  async function scrapeTrustpilot() {
    await waitForSelector(CARD_SELECTORS, 8e3);
    const countCards = () => {
      for (const sel of CARD_SELECTORS) {
        const n = document.querySelectorAll(sel).length;
        if (n) return n;
      }
      return 0;
    };
    await autoScroll(countCards, { maxRounds: 10, pauseMs: 600 });
    let cards = [];
    for (const sel of CARD_SELECTORS) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length) {
        cards = found;
        break;
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const reviews = [];
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
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SCRAPE_ACTIVE_TAB") {
      scrapeTrustpilot().then(
        (reviews) => sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "TRUSTPILOT"
        })
      ).catch((err) => {
        console.error("[EchoRank] Trustpilot scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "TRUSTPILOT"
        });
      });
      return true;
    }
  });
})();
//# sourceMappingURL=trustpilot.js.map
