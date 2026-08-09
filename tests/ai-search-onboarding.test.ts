// tests/ai-search-onboarding.test.ts
//
// The onboarding crawl and the scheduling arithmetic.
//
// THE CRAWL NEVER TOUCHES THE NETWORK HERE. Both the fetcher and the robots
// reader are injected, so the suite exercises the budget, the ordering and the
// robots posture deterministically — which is the only way to assert that a
// 5xx robots.txt stops the crawl, since a real one cannot be made to 5xx.

import { describe, expect, it, vi } from "vitest";
import {
  MAX_PAGES,
  MAX_TOTAL_CHARS,
  crawlSite,
  extractLinks,
  extractPageText,
  linkPriority,
  shouldSkip,
  snapshotToPromptBlock,
} from "@/lib/ai-monitor/onboarding/crawl";
import { mergeCompetitors } from "@/lib/ai-monitor/onboarding/infer";
import {
  FREQUENCY_DAYS,
  FREQUENCY_LADDER,
  deescalate,
  escalate,
  nextRunAt,
  promptFrequencyFor,
  staggeredStart,
} from "@/lib/ai-monitor/schedule";
import type { FetchOutcome } from "@/lib/site-crawler/fetch";
import type { RobotsRules } from "@/lib/site-crawler/robots";

const allowAll: RobotsRules = {
  allowAll: true,
  isAllowed: () => true,
  crawlDelaySeconds: 0,
  sitemaps: [],
};
const denyAll: RobotsRules = {
  allowAll: false,
  isAllowed: () => false,
  crawlDelaySeconds: 0,
  sitemaps: [],
};

function html(body: string, title = "Acme POS"): string {
  return `<html><head><title>${title}</title>
    <meta name="description" content="Point of sale for cafes."></head>
    <body>${body}</body></html>`;
}

function page(url: string, body: string): FetchOutcome {
  return {
    finalUrl: url,
    statusCode: 200,
    redirectTarget: null,
    redirectHops: 0,
    contentType: "text/html",
    html: html(body),
    xRobotsTag: null,
    fetchMs: 5,
    error: null,
  };
}

describe("page extraction", () => {
  it("reads title, meta description, headings and body", () => {
    const extracted = extractPageText(
      html("<main><h1>Fast tills</h1><h2>For cafes</h2><p>We sell a POS system.</p></main>"),
    );
    expect(extracted.title).toBe("Acme POS");
    expect(extracted.metaDescription).toBe("Point of sale for cafes.");
    expect(extracted.headings).toEqual(["Fast tills", "For cafes"]);
    expect(extracted.text).toContain("We sell a POS system.");
  });

  it("strips nav, footer and scripts, so boilerplate is not read twelve times", () => {
    const extracted = extractPageText(
      html(
        "<nav>Home Pricing Contact</nav><main><p>Real content.</p></main>" +
          "<footer>Copyright 2026</footer><script>var x=1</script>",
      ),
    );
    expect(extracted.text).toContain("Real content.");
    expect(extracted.text).not.toContain("Copyright 2026");
    expect(extracted.text).not.toContain("var x=1");
  });

  it("falls back to og:description when there is no meta description", () => {
    const extracted = extractPageText(
      '<html><head><meta property="og:description" content="From OG."></head><body>x</body></html>',
    );
    expect(extracted.metaDescription).toBe("From OG.");
  });
});

describe("link handling", () => {
  it("keeps in-scope links and drops off-site ones", () => {
    const links = extractLinks(
      '<a href="/about">a</a><a href="https://other.com/x">b</a><a href="/pricing">c</a>',
      "https://acme.com/",
      "https://acme.com",
    );
    expect(links).toContain("https://acme.com/about");
    expect(links).toContain("https://acme.com/pricing");
    expect(links.some((l) => l.includes("other.com"))).toBe(false);
  });

  it("skips pages that never describe a business", () => {
    expect(shouldSkip("https://acme.com/privacy-policy")).toBe(true);
    expect(shouldSkip("https://acme.com/login")).toBe(true);
    expect(shouldSkip("https://acme.com/brochure.pdf")).toBe(true);
    expect(shouldSkip("https://acme.com/about")).toBe(false);
  });

  it("ranks the root first, then descriptive pages, then everything else", () => {
    const root = "https://acme.com";
    expect(linkPriority("https://acme.com/", root, 0)).toBe(0);
    expect(linkPriority("https://acme.com/about", root, 1)).toBeLessThan(
      linkPriority("https://acme.com/blog/post-1", root, 1),
    );
  });

  it("prefers a descriptive page deep in the site over a mystery page near the top", () => {
    const root = "https://acme.com";
    expect(linkPriority("https://acme.com/company/about", root, 2)).toBeLessThan(
      linkPriority("https://acme.com/x", root, 1),
    );
  });
});

describe("crawling a site", () => {
  it("reads the root and follows priority links first", async () => {
    const fetched: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      fetched.push(url);
      if (url === "https://acme.com/") {
        return page(url, '<a href="/blog/x">blog</a><a href="/about">about</a><p>Home page.</p>');
      }
      return page(url, "<p>Some content about the company and what it sells.</p>");
    });

    const snapshot = await crawlSite("https://acme.com", {
      fetchImpl,
      robotsImpl: async () => allowAll,
      maxPages: 2,
    });

    expect(snapshot.failure).toBeNull();
    expect(snapshot.pages.length).toBe(2);
    expect(fetched[0]).toBe("https://acme.com/");
    expect(fetched[1]).toBe("https://acme.com/about");
  });

  it("obeys a robots.txt that disallows the root", async () => {
    const fetchImpl = vi.fn(async (url: string) => page(url, "<p>secret</p>"));
    const snapshot = await crawlSite("https://acme.com", {
      fetchImpl,
      robotsImpl: async () => denyAll,
    });

    expect(snapshot.failure).toBe("robots_disallowed");
    expect(snapshot.robotsBlocked).toBe(true);
    expect(snapshot.pages).toEqual([]);
    // The point: nothing was fetched at all, not merely nothing kept.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an unusable URL without fetching", async () => {
    const fetchImpl = vi.fn();
    const snapshot = await crawlSite("not a url", {
      fetchImpl: fetchImpl as never,
      robotsImpl: async () => allowAll,
    });
    expect(snapshot.failure).toBe("invalid_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports unreachable rather than throwing when every fetch fails", async () => {
    const snapshot = await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) => ({
        ...page(url, ""),
        html: null,
        statusCode: null,
        error: "TimeoutError",
      }),
    });
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.failure).toBe("no_readable_pages");
  });

  it("does not spend the budget on empty shell pages", async () => {
    const snapshot = await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) => ({
        ...page(url, "<div id='root'></div>"),
        html: "<html><head></head><body><div id='root'></div></body></html>",
      }),
    });
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.failure).toBe("no_readable_pages");
  });

  it("stops at the page budget", async () => {
    const body =
      '<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a><a href="/d">d</a>' +
      "<p>Plenty of text describing the business in detail here.</p>";
    const snapshot = await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) => page(url, body),
      maxPages: 3,
    });
    expect(snapshot.pages.length).toBe(3);
  });

  it("stops at the total character budget", async () => {
    const long = "word ".repeat(3_000);
    const snapshot = await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) =>
        page(url, `<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a><p>${long}</p>`),
      maxPages: MAX_PAGES,
    });

    const total = snapshot.pages.reduce((sum, p) => sum + p.text.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
  });

  it("respects the wall clock", async () => {
    let clock = 0;
    const snapshot = await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) => {
        clock += 20_000;
        return page(url, '<a href="/a">a</a><p>Content describing the business.</p>');
      },
      now: () => clock,
      maxDurationMs: 30_000,
      maxPages: 10,
    });
    expect(snapshot.pages.length).toBeLessThan(10);
  });

  it("never visits the same URL twice", async () => {
    const fetched: string[] = [];
    await crawlSite("https://acme.com", {
      robotsImpl: async () => allowAll,
      fetchImpl: async (url: string) => {
        fetched.push(url);
        return page(url, '<a href="/about">a</a><a href="/about">a</a><p>Content here now.</p>');
      },
      maxPages: 5,
    });
    expect(new Set(fetched).size).toBe(fetched.length);
  });

  it("fences the snapshot for the prompt, labelling each page", () => {
    const block = snapshotToPromptBlock({
      rootUrl: "https://acme.com",
      pages: [
        {
          url: "https://acme.com/",
          title: "Acme",
          metaDescription: "POS",
          headings: ["Fast tills"],
          text: "We sell a POS.",
          depth: 0,
        },
      ],
      robotsBlocked: false,
      failure: null,
      fetched: 1,
      durationMs: 10,
    });
    expect(block).toContain("URL: https://acme.com/");
    expect(block).toContain("Headings: Fast tills");
  });
});

describe("merging competitors", () => {
  it("puts the brand's own comparison-page rivals ahead of the model's guesses", () => {
    const merged = mergeCompetitors("Acme", ["Toast"], [{ name: "Square" }, { name: "Clover" }]);
    expect(merged[0]).toBe("Toast");
  });

  it("removes the brand itself, however it is spelled", () => {
    // A model listing the brand among its own competitors would have the
    // analyser counting every self-mention as a competitor mention.
    const merged = mergeCompetitors("Echorank360", [], [
      { name: "echorank 360" },
      { name: "Semrush" },
    ]);
    expect(merged).toEqual(["Semrush"]);
  });

  it("deduplicates across the two sources", () => {
    expect(mergeCompetitors("Acme", ["Toast"], [{ name: "toast" }])).toEqual(["Toast"]);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Rival ${i}` }));
    expect(mergeCompetitors("Acme", [], many, 3).length).toBe(3);
  });

  it("drops blank names rather than producing a matcher that matches everything", () => {
    expect(mergeCompetitors("Acme", ["  ", "!!!"], [{ name: "Square" }])).toEqual(["Square"]);
  });
});

describe("scheduling", () => {
  it("maps every tier cadence to a per-prompt frequency", () => {
    expect(promptFrequencyFor("daily")).toBe("DAILY");
    expect(promptFrequencyFor("weekly")).toBe("WEEKLY");
    expect(promptFrequencyFor("custom")).toBe("WEEKLY");
    expect(promptFrequencyFor("none")).toBe("MONTHLY");
  });

  it("does not turn twice-weekly into daily", () => {
    // Rounding up would multiply a GROWTH tenant's spend by three and a half
    // without anyone asking for it.
    expect(promptFrequencyFor("twice_weekly")).toBe("WEEKLY");
  });

  it("escalates and de-escalates along the ladder, stopping at the ends", () => {
    expect(escalate("MONTHLY")).toBe("BIWEEKLY");
    expect(escalate("WEEKLY")).toBe("DAILY");
    expect(escalate("DAILY")).toBe("DAILY");
    expect(deescalate("MONTHLY")).toBe("MONTHLY");
    expect(deescalate("DAILY")).toBe("WEEKLY");
  });

  it("orders the ladder from least to most frequent", () => {
    const days = FREQUENCY_LADDER.map((f) => FREQUENCY_DAYS[f]);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it("runs a never-run prompt immediately", () => {
    const now = new Date("2026-08-09T12:00:00Z");
    expect(nextRunAt("WEEKLY", null, now)).toEqual(now);
  });

  it("measures from the last run, not from now, so the schedule cannot drift", () => {
    const lastRun = new Date("2026-08-09T09:00:00Z");
    const now = new Date("2026-08-09T09:20:00Z");
    // Twenty minutes late today must not push tomorrow's run twenty minutes
    // later as well, or a daily prompt is asked at noon by month's end.
    expect(nextRunAt("DAILY", lastRun, now)).toEqual(new Date("2026-08-10T09:00:00Z"));
  });

  it("does not schedule into the past after a long pause", () => {
    const lastRun = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-08-09T12:00:00Z");
    expect(nextRunAt("DAILY", lastRun, now)).toEqual(now);
  });

  it("staggers a new project's prompts across the interval", () => {
    const now = new Date("2026-08-09T00:00:00Z");
    const starts = [0, 1, 2, 3].map((i) => staggeredStart(i, 4, now).getTime());
    expect(starts[0]).toBe(now.getTime());
    expect(new Set(starts).size).toBe(4);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // Nothing lands beyond the first interval.
    expect(starts[3] - starts[0]).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("is deterministic, so a retried onboarding does not double-book the queue", () => {
    const now = new Date("2026-08-09T00:00:00Z");
    expect(staggeredStart(2, 5, now)).toEqual(staggeredStart(2, 5, now));
  });

  it("runs a single prompt immediately rather than dividing by zero", () => {
    const now = new Date("2026-08-09T00:00:00Z");
    expect(staggeredStart(0, 1, now)).toEqual(now);
  });
});
