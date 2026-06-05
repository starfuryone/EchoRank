// DOM utilities shared by content scripts. Defensive by design — review-site
// DOM changes frequently, so every scraper combines these helpers with
// multiple fallback selectors and never assumes a node exists.

/** Resolve once an element matching any selector appears, or timeout → null. */
export function waitForSelector(
  selectors: string[],
  timeoutMs = 8000,
): Promise<Element | null> {
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

/**
 * Scroll a container (or the window) repeatedly to trigger lazy-loaded reviews,
 * stopping when the item count stops growing or maxRounds is hit.
 */
export async function autoScroll(
  countItems: () => number,
  options: { scroller?: Element | null; maxRounds?: number; pauseMs?: number } = {},
): Promise<void> {
  const { scroller = null, maxRounds = 25, pauseMs = 700 } = options;
  let previous = -1;
  for (let round = 0; round < maxRounds; round++) {
    const current = countItems();
    if (current === previous) break; // no new items loaded
    previous = current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight });
    else window.scrollTo({ top: document.body.scrollHeight });
    await sleep(pauseMs);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Parse a numeric rating from an aria-label or text like "Rated 4 out of 5". */
export function parseRating(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/([0-5](?:[.,]\d)?)\s*(?:out of|\/|stars?|von|sur)?\s*5?/i);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : undefined;
}
