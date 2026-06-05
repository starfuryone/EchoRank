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

  // content/facebook.ts
  var RECOMMEND_RE = /\brecommends?\b/i;
  var NOT_RECOMMEND_RE = /\b(doesn['’]?t|does not)\s+recommend/i;
  function detectRecommendation(blockText) {
    if (NOT_RECOMMEND_RE.test(blockText)) return "not_recommended";
    if (RECOMMEND_RE.test(blockText)) return "recommended";
    return null;
  }
  function extractCard(card) {
    const blockText = text(card);
    const status = detectRecommendation(blockText);
    const reviewerName = text(card.querySelector('a[role="link"] strong, h3 a, strong')) || void 0;
    let reviewText;
    const candidates = Array.from(card.querySelectorAll('div[dir="auto"], span[dir="auto"]')).map((n) => text(n)).filter((t) => t.length > 20 && !RECOMMEND_RE.test(t));
    if (candidates.length) reviewText = candidates.sort((a, b) => b.length - a.length)[0];
    const reviewDate = text(card.querySelector('a[role="link"] span[aria-label], abbr')) || void 0;
    if (!reviewText && !status) return null;
    return {
      platform: "FACEBOOK",
      reviewerName,
      rating: null,
      recommendationStatus: status,
      reviewText: reviewText ?? null,
      reviewDate: reviewDate ?? null,
      sourceUrl: location.href,
      externalId: null
      // no stable public id; server fingerprints
    };
  }
  async function scrapeFacebook() {
    await waitForSelector(['div[role="article"]', 'div[role="feed"]'], 8e3);
    const countCards = () => document.querySelectorAll('div[role="article"]').length;
    await autoScroll(countCards, { maxRounds: 30, pauseMs: 900 });
    const cards = Array.from(document.querySelectorAll('div[role="article"]'));
    const seen = /* @__PURE__ */ new Set();
    const reviews = [];
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
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SCRAPE_ACTIVE_TAB") {
      scrapeFacebook().then(
        (reviews) => sendResponse({
          type: "SCRAPE_RESULT",
          reviews,
          pageUrl: location.href,
          businessName: text(document.querySelector("h1")) || null,
          platform: "FACEBOOK"
        })
      ).catch((err) => {
        console.error("[EchoRank] Facebook scrape error", err);
        sendResponse({
          type: "SCRAPE_RESULT",
          reviews: [],
          pageUrl: location.href,
          businessName: null,
          platform: "FACEBOOK"
        });
      });
      return true;
    }
  });
})();
//# sourceMappingURL=facebook.js.map
