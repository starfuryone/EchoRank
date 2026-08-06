// Free tools: the config/route table and the pure computation libraries.
//
// Everything here is deterministic — no Redis, no Postgres, no network. The
// route-level behaviour (limits, cache, cap) lives in free-tools.route.test.ts.
import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";

// share-of-search.ts reaches DataForSEO's metering module, which constructs a
// Prisma client at import time. Nothing in this file touches a database — the
// stub just keeps that import from demanding DATABASE_URL.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { join } from "node:path";
import {
  EXTENSION_CARD_HREF,
  FREE_TOOLS,
  FREE_TOOLS_BASE,
  freeToolById,
  freeToolBySlug,
  freeToolRoutes,
  paidFreeTools,
  signupHref,
} from "@/lib/free-tools";
import { scoreContent, fleschReadingEase, keywordDensity } from "@/lib/free-tools/content-score";
import { breadcrumbFor, previewSnippet, truncateToPixels } from "@/lib/free-tools/serp-preview";
import {
  VOLATILITY_CATEGORIES,
  basketEntries,
  domainOf,
  isKnownLocation,
  keywordChurn,
  overallScore,
  scoreDay,
} from "@/lib/free-tools/volatility";
import { parseRedditSearch } from "@/lib/free-tools/reddit";
import { computeShares, normalizeBrand, parseVolumeRow } from "@/lib/free-tools/share-of-search";
import { secondsUntilUtcMidnight, utcDayStamp } from "@/lib/free-tools/limits";
import { cacheKey } from "@/lib/free-tools/cache";

// ─── Config + route table ───────────────────────────────────────────────────

describe("route table", () => {
  it("has a page for every configured tool", () => {
    for (const tool of FREE_TOOLS) {
      const page = join(process.cwd(), "src", "app", "[locale]", "free-tools", tool.slug, "page.tsx");
      expect(existsSync(page), `${tool.slug} page missing`).toBe(true);
    }
  });

  it("has a hub page", () => {
    expect(
      existsSync(join(process.cwd(), "src", "app", "[locale]", "free-tools", "page.tsx")),
    ).toBe(true);
  });

  it("has an API route for every tool that declares one, and none for the rest", () => {
    for (const tool of FREE_TOOLS) {
      const dir = join(process.cwd(), "src", "app", "api", "free", "v1", tool.slug);
      if (tool.apiPath) {
        expect(existsSync(join(dir, "route.ts")), `${tool.slug} route missing`).toBe(true);
      } else {
        // A client-only tool must not grow a server endpoint by accident —
        // that is how an anonymous LLM bill starts.
        expect(existsSync(dir), `${tool.slug} should have no API route`).toBe(false);
      }
    }
  });

  it("keeps ids and slugs unique", () => {
    expect(new Set(FREE_TOOLS.map((t) => t.id)).size).toBe(FREE_TOOLS.length);
    expect(new Set(FREE_TOOLS.map((t) => t.slug)).size).toBe(FREE_TOOLS.length);
  });

  it("lists the hub and every tool path", () => {
    expect(freeToolRoutes()).toEqual([
      FREE_TOOLS_BASE,
      ...FREE_TOOLS.map((t) => `${FREE_TOOLS_BASE}/${t.slug}`),
    ]);
  });

  it("resolves tools by slug and id", () => {
    for (const tool of FREE_TOOLS) {
      expect(freeToolBySlug(tool.slug)).toBe(tool);
      expect(freeToolById(tool.id)).toBe(tool);
    }
    expect(freeToolBySlug("nope")).toBeUndefined();
  });

  it("gives every spending tool a daily limit", () => {
    // A paid tool without a per-IP cap is an open tab on our card.
    for (const tool of paidFreeTools()) {
      expect(tool.dailyLimit, tool.id).toBeGreaterThan(0);
      expect(tool.apiPath, tool.id).toBeTruthy();
    }
  });

  it("gives client-only tools no route and no limit", () => {
    for (const tool of FREE_TOOLS.filter((t) => t.cost === "none")) {
      expect(tool.apiPath, tool.id).toBeNull();
      expect(tool.dailyLimit, tool.id).toBeNull();
    }
  });

  it("tracks the signup source per tool", () => {
    for (const tool of FREE_TOOLS) {
      expect(signupHref(tool)).toBe(`/register?src=free-tools-${tool.slug}`);
    }
  });

  it("points the extension card at the Caddy-served page", () => {
    // Outside this app, so it is a plain href and not a locale-prefixed route.
    expect(EXTENSION_CARD_HREF).toBe("/extension/download.html");
  });
});

// ─── Content optimizer ──────────────────────────────────────────────────────

describe("content optimizer", () => {
  const longText = `# Running shoes guide\n\n${"Running shoes matter for comfort and speed. ".repeat(
    60,
  )}\n## How do I choose?\n## What size?\n### Fit`;

  it("scores a well-formed draft highly", () => {
    const r = scoreContent({
      text: longText,
      keyword: "running shoes",
      title: "Running shoes: the complete guide",
      metaDescription: "x".repeat(140),
    });
    expect(r.score).toBeGreaterThan(60);
    expect(r.checks.find((c) => c.id === "keyword_in_title")!.status).toBe("pass");
  });

  it("fails keyword stuffing rather than rewarding it", () => {
    const stuffed = `${"running shoes ".repeat(200)}`;
    const r = scoreContent({ text: stuffed, keyword: "running shoes" });
    expect(r.density).toBeGreaterThan(4);
    expect(r.checks.find((c) => c.id === "keyword_density")!.status).toBe("fail");
  });

  it("flags a missing keyword in the first 100 words", () => {
    const r = scoreContent({
      text: `${"filler word ".repeat(120)} running shoes`,
      keyword: "running shoes",
    });
    expect(r.checks.find((c) => c.id === "keyword_first_100")!.status).toBe("fail");
  });

  it("flags a too-short draft and a missing meta", () => {
    const r = scoreContent({ text: "Short.", keyword: "x" });
    expect(r.checks.find((c) => c.id === "word_count")!.status).toBe("fail");
    expect(r.checks.find((c) => c.id === "meta_length")!.status).toBe("fail");
  });

  it("computes density as a percentage of words", () => {
    expect(keywordDensity("a b c d shoes", "shoes")).toBe(20);
    expect(keywordDensity("", "shoes")).toBe(0);
  });

  it("keeps readability inside 0–100", () => {
    expect(fleschReadingEase("The cat sat.")).toBeLessThanOrEqual(100);
    expect(fleschReadingEase("")).toBe(0);
    expect(
      fleschReadingEase("Notwithstanding the aforementioned considerations regarding implementation."),
    ).toBeGreaterThanOrEqual(0);
  });

  it("never returns a score outside 0–100", () => {
    for (const text of ["", "x", "word ".repeat(5000)]) {
      const r = scoreContent({ text, keyword: "word" });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

// ─── SERP simulator ─────────────────────────────────────────────────────────

describe("serp simulator", () => {
  it("leaves a short title untouched", () => {
    const r = truncateToPixels("Short title", 580, 20);
    expect(r.truncated).toBe(false);
    expect(r.display).toBe("Short title");
  });

  it("truncates a long title with an ellipsis", () => {
    const r = truncateToPixels("A".repeat(200), 580, 20);
    expect(r.truncated).toBe(true);
    expect(r.display.endsWith("…")).toBe(true);
    expect(r.width).toBeLessThanOrEqual(580);
  });

  it("measures pixels, not characters — that is the whole point", () => {
    // Same character count, very different rendered width.
    const narrow = truncateToPixels("i".repeat(60), 580, 20);
    const wide = truncateToPixels("W".repeat(60), 580, 20);
    expect(narrow.width).toBeLessThan(wide.width);
    expect(narrow.truncated).toBe(false);
    expect(wide.truncated).toBe(true);
  });

  it("cuts mobile earlier than desktop", () => {
    const title = "A reasonably long page title that sits near the desktop limit yes";
    const desktop = previewSnippet({ title, description: "d", url: "example.com" }, "desktop");
    const mobile = previewSnippet({ title, description: "d", url: "example.com" }, "mobile");
    expect(mobile.title.limit).toBeLessThan(desktop.title.limit);
  });

  it("renders the breadcrumb Google shows instead of the URL", () => {
    expect(breadcrumbFor("https://www.example.com/shoes/running")).toBe(
      "example.com › shoes › running",
    );
    expect(breadcrumbFor("example.com")).toBe("example.com");
    expect(breadcrumbFor("")).toBe("");
  });
});

// ─── Volatility ─────────────────────────────────────────────────────────────

describe("volatility", () => {
  const ten = (start: number) =>
    Array.from({ length: 10 }, (_, i) => `d${start + i}.com`);

  it("samples a fixed 30-keyword basket across five categories", () => {
    expect(VOLATILITY_CATEGORIES).toHaveLength(5);
    expect(basketEntries()).toHaveLength(30);
    expect(new Set(basketEntries().map((e) => e.keyword)).size).toBe(30);
  });

  it("samples a location the app already validates", () => {
    expect(isKnownLocation()).toBe(true);
  });

  it("scores an unchanged SERP as zero", () => {
    expect(keywordChurn(ten(1), ten(1))).toBe(0);
  });

  it("scores a completely replaced SERP near the top of the scale", () => {
    expect(keywordChurn(ten(1), ten(100))).toBeGreaterThan(5);
  });

  it("scores a single swap as small but non-zero", () => {
    const before = ten(1);
    const after = [...before];
    [after[0], after[1]] = [after[1]!, after[0]!];
    const score = keywordChurn(before, after);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("never exceeds the 0–10 scale", () => {
    expect(keywordChurn(ten(1), ten(500))).toBeLessThanOrEqual(10);
  });

  it("returns 0 when either day is missing rather than inventing churn", () => {
    expect(keywordChurn([], ten(1))).toBe(0);
    expect(keywordChurn(ten(1), [])).toBe(0);
  });

  it("reports null for a category with no comparable pair", () => {
    // "no data" and "nothing moved" must not look the same.
    const scores = scoreDay(
      [{ keyword: "a", category: "tech", topDomains: ten(1) }],
      [],
    );
    expect(scores.tech).toBeNull();
    expect(overallScore(scores)).toBeNull();
  });

  it("averages only the categories that have data", () => {
    const scores = scoreDay(
      [{ keyword: "a", category: "tech", topDomains: ten(1) }],
      [{ keyword: "a", category: "tech", topDomains: ten(1) }],
    );
    expect(scores.tech).toBe(0);
    expect(overallScore(scores)).toBe(0);
  });

  it("reduces URLs to bare domains", () => {
    expect(domainOf("https://www.Example.com/a/b")).toBe("example.com");
    expect(domainOf("not a url")).toBe("");
  });
});

// ─── Reddit parsing ─────────────────────────────────────────────────────────

describe("reddit parsing", () => {
  const child = (over: Record<string, unknown> = {}) => ({
    data: {
      id: "abc",
      title: "A thread",
      subreddit: "seo",
      score: 12,
      num_comments: 3,
      created_utc: 1_700_000_000,
      permalink: "/r/seo/comments/abc/a_thread/",
      author: "someone",
      is_self: true,
      ...over,
    },
  });

  it("maps the fields the card renders", () => {
    const [t] = parseRedditSearch({ data: { children: [child()] } }, new Date(1_700_003_600_000));
    expect(t!.title).toBe("A thread");
    expect(t!.subreddit).toBe("seo");
    expect(t!.permalink.startsWith("https://www.reddit.com/")).toBe(true);
    expect(t!.ageSeconds).toBe(3600);
  });

  it("drops stickied posts — subreddit furniture, not discussion", () => {
    expect(parseRedditSearch({ data: { children: [child({ stickied: true })] } })).toHaveLength(0);
  });

  it("drops entries without a title or permalink", () => {
    expect(parseRedditSearch({ data: { children: [child({ title: "" })] } })).toHaveLength(0);
  });

  it("returns nothing for a malformed payload rather than throwing", () => {
    for (const body of [null, {}, { data: {} }, { data: { children: "no" } }]) {
      expect(() => parseRedditSearch(body)).not.toThrow();
      expect(parseRedditSearch(body)).toEqual([]);
    }
  });
});

// ─── Share of search ────────────────────────────────────────────────────────

describe("share of search", () => {
  it("computes percentage shares that sum to about 100", () => {
    const r = computeShares([
      { brand: "a", volume: 750, monthly: null, cached: true },
      { brand: "b", volume: 250, monthly: null, cached: true },
    ]);
    expect(r.brands[0]!.share).toBe(75);
    expect(r.brands[1]!.share).toBe(25);
    expect(r.total).toBe(1000);
  });

  it("reports fullyCached only when nothing was bought", () => {
    expect(
      computeShares([{ brand: "a", volume: 1, monthly: null, cached: true }]).fullyCached,
    ).toBe(true);
    expect(
      computeShares([{ brand: "a", volume: 1, monthly: null, cached: false }]).fullyCached,
    ).toBe(false);
  });

  it("does not divide by zero when every brand has no volume", () => {
    const r = computeShares([{ brand: "a", volume: 0, monthly: null, cached: true }]);
    expect(r.brands[0]!.share).toBe(0);
  });

  it("normalizes brands so cache keys collapse spelling noise", () => {
    expect(normalizeBrand("  Nike  Air ")).toBe("nike air");
  });

  it("keeps a monthly series when the API returns one", () => {
    const parsed = parseVolumeRow({
      search_volume: 100,
      monthly_searches: [{ year: 2026, month: 1, search_volume: 90 }],
    });
    expect(parsed.volume).toBe(100);
    expect(parsed.monthly).toHaveLength(1);
  });

  it("returns null monthly rather than an empty array", () => {
    expect(parseVolumeRow({ search_volume: 5 }).monthly).toBeNull();
    expect(parseVolumeRow({ search_volume: 5, monthly_searches: [] }).monthly).toBeNull();
  });
});

// ─── Key helpers ────────────────────────────────────────────────────────────

describe("limit + cache keys", () => {
  it("rolls the day stamp at UTC midnight", () => {
    expect(utcDayStamp(new Date("2026-08-06T23:59:59Z"))).toBe("2026-08-06");
    expect(utcDayStamp(new Date("2026-08-07T00:00:01Z"))).toBe("2026-08-07");
  });

  it("counts the seconds to the next UTC midnight", () => {
    expect(secondsUntilUtcMidnight(new Date("2026-08-06T23:59:00Z"))).toBe(60);
    expect(secondsUntilUtcMidnight(new Date("2026-08-06T00:00:00Z"))).toBe(86_400);
  });

  it("collapses case and whitespace so one query is one cache entry", () => {
    expect(cacheKey("t", "  New   York ")).toBe(cacheKey("t", "new york"));
  });

  it("escapes colons so a keyword cannot cross tool namespaces", () => {
    expect(cacheKey("t", "a:b")).not.toContain("t:a:b");
  });
});
