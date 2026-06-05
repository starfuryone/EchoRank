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

  // content/google.ts
  var REVIEW_CARD_SELECTORS = [
    "div[data-review-id]",
    // most stable: each review card carries a native id
    ".jftiEf",
    // legacy Maps review card class (validate)
    "div[jscontroller][data-review-id]"
  ];
  var SCROLLER_SELECTORS = [
    'div[role="main"] div[tabindex="-1"]',
    ".m6QErb.DxyBCb.kA9KIf.dS8AEf",
    // legacy reviews scroll container (validate)
    'div[aria-label*="review" i]'
  ];
  function expandTruncated(root) {
    root.querySelectorAll('button[aria-label*="More" i], button[jsaction*="review"]').forEach((b) => {
      if (/more/i.test(b.textContent ?? "") || /more/i.test(b.getAttribute("aria-label") ?? "")) {
        try {
          b.click();
        } catch {
        }
      }
    });
  }
  function extractCard(card) {
    const reviewerName = text(card.querySelector('.d4r55, [class*="title"] , div[role="button"] > span')) || void 0;
    const ratingEl = card.querySelector('[role="img"][aria-label], span[aria-label*="star" i]');
    const rating = parseRating(ratingEl?.getAttribute("aria-label") ?? void 0);
    const reviewText = text(card.querySelector(".wiI7pd, .MyEned, span[jsname]")) || void 0;
    const reviewDate = text(card.querySelector(".rsqaWe, .dehysf, span[class*='date' i]")) || void 0;
    const ownerResponse = text(card.querySelector('.CDe7pd, div[class*="owner" i]')) || void 0;
    const externalId = card.getAttribute("data-review-id") ?? void 0;
    if (!reviewText && rating == null) return null;
    return {
      platform: "GOOGLE",
      reviewerName,
      rating: rating ?? null,
      reviewText: reviewText ?? null,
      reviewDate: reviewDate ?? null,
      ownerResponse: ownerResponse ?? null,
      sourceUrl: location.href,
      externalId: externalId ?? null
    };
  }
  async function scrapeGoogle() {
    await waitForSelector(REVIEW_CARD_SELECTORS, 8e3);
    const scroller = SCROLLER_SELECTORS.map((s) => document.querySelector(s)).find(Boolean) ?? null;
    const countCards = () => {
      for (const sel of REVIEW_CARD_SELECTORS) {
        const n = document.querySelectorAll(sel).length;
        if (n) return n;
      }
      return 0;
    };
    await autoScroll(countCards, { scroller, maxRounds: 30, pauseMs: 800 });
    expandTruncated(document);
    const cards = [];
    for (const sel of REVIEW_CARD_SELECTORS) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length) {
        cards.push(...found);
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
      scrapeGoogle().then(
        (reviews) => sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "GOOGLE"
        })
      ).catch((err) => {
        console.error("[EchoRank] Google scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "GOOGLE"
        });
      });
      return true;
    }
  });
})();
//# sourceMappingURL=google.js.map
