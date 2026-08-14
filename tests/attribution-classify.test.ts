// AI attribution — the classification table.
//
// This is the file that decides whether a customer's Bing traffic gets relabeled
// as AI. Every case below is a claim about real traffic, and the table is
// deliberately written as data so a new assistant is a new row rather than a new
// test function.
//
// Pure module: no database, no network, no mocks. classifyReferrer() takes a
// referrer and a landing URL and returns a verdict, and that is the whole
// contract the collector depends on.

import { describe, expect, it } from "vitest";
import {
  classifyReferrer,
  extractUtm,
  landingPathOf,
  storableReferrer,
} from "@/lib/attribution/classify";
import { AI_VISIT_SOURCES, SOURCE_RULES } from "@/lib/attribution/sources";

const SITE = "https://example.com/pricing";

interface Case {
  name: string;
  referrer: string;
  landing?: string;
  expect: string | null;
}

const CASES: Case[] = [
  // ── The five named sources, by referrer ─────────────────────────────
  { name: "chatgpt.com", referrer: "https://chatgpt.com/", expect: "chatgpt" },
  { name: "chat.openai.com (legacy host)", referrer: "https://chat.openai.com/c/abc", expect: "chatgpt" },
  { name: "www.chatgpt.com (www stripped)", referrer: "https://www.chatgpt.com/", expect: "chatgpt" },
  { name: "perplexity.ai", referrer: "https://www.perplexity.ai/search/xyz", expect: "perplexity" },
  { name: "pplx.ai short link", referrer: "https://pplx.ai/abc", expect: "perplexity" },
  { name: "gemini.google.com", referrer: "https://gemini.google.com/app", expect: "gemini" },
  { name: "bard.google.com (legacy)", referrer: "https://bard.google.com/", expect: "gemini" },
  { name: "copilot.microsoft.com", referrer: "https://copilot.microsoft.com/", expect: "copilot" },
  { name: "edgeservices.bing.com", referrer: "https://edgeservices.bing.com/x", expect: "copilot" },
  { name: "claude.ai", referrer: "https://claude.ai/chat/abc", expect: "claude" },
  { name: "claude.com", referrer: "https://claude.com/", expect: "claude" },

  // ── Copilot / Bing disambiguation ───────────────────────────────────
  // The expensive mistake this list exists to prevent: bing.com serves both an
  // ordinary search engine and an assistant, and only one of them is AI traffic.
  { name: "bing.com/chat IS copilot", referrer: "https://www.bing.com/chat?q=x", expect: "copilot" },
  { name: "bing.com/copilotsearch IS copilot", referrer: "https://www.bing.com/copilotsearch?q=x", expect: "copilot" },
  { name: "bing.com/search?showconv=1 IS copilot", referrer: "https://www.bing.com/search?q=x&showconv=1", expect: "copilot" },
  { name: "plain bing.com/search is NOT AI", referrer: "https://www.bing.com/search?q=widgets", expect: null },
  { name: "bare bing.com is NOT AI", referrer: "https://www.bing.com/", expect: null },

  // ── dark_ai: proven assistant, not one of the five ──────────────────
  { name: "you.com", referrer: "https://you.com/search?q=x", expect: "dark_ai" },
  { name: "poe.com", referrer: "https://poe.com/chat/1", expect: "dark_ai" },
  { name: "meta.ai", referrer: "https://www.meta.ai/", expect: "dark_ai" },
  { name: "chat.deepseek.com", referrer: "https://chat.deepseek.com/", expect: "dark_ai" },

  // ── Non-AI referrers ────────────────────────────────────────────────
  { name: "google.com organic", referrer: "https://www.google.com/search?q=x", expect: null },
  { name: "google.com subdomain that is not gemini", referrer: "https://news.google.com/", expect: null },
  { name: "facebook", referrer: "https://www.facebook.com/", expect: null },
  { name: "reddit", referrer: "https://www.reddit.com/r/seo", expect: null },
  { name: "duckduckgo", referrer: "https://duckduckgo.com/?q=x", expect: null },
  { name: "a random blog", referrer: "https://someblog.example/post", expect: null },
  { name: "no referrer at all", referrer: "", expect: null },
  { name: "garbage referrer", referrer: "not-a-url", expect: null },
  { name: "same-origin internal navigation", referrer: "https://example.com/blog", expect: null },
];

describe("classifyReferrer — referrer table", () => {
  it.each(CASES)("$name → $expect", ({ referrer, landing, expect: want }) => {
    const result = classifyReferrer({ referrer, landingUrl: landing ?? SITE });
    expect(result.source).toBe(want);
  });
});

describe("classifyReferrer — markers, only when the referrer cannot speak", () => {
  it("attributes a decorated link with no referrer", () => {
    expect(
      classifyReferrer({ referrer: "", landingUrl: `${SITE}?utm_source=chatgpt.com` }).source,
    ).toBe("chatgpt");
  });

  it("reads ref= and source= as well as utm_source", () => {
    expect(classifyReferrer({ referrer: "", landingUrl: `${SITE}?ref=perplexity` }).source).toBe(
      "perplexity",
    );
    expect(classifyReferrer({ referrer: "", landingUrl: `${SITE}?source=claude` }).source).toBe(
      "claude",
    );
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(
      classifyReferrer({ referrer: "", landingUrl: `${SITE}?utm_source=%20ChatGPT%20` }).source,
    ).toBe("chatgpt");
  });

  it("maps an unnamed AI marker to dark_ai", () => {
    expect(classifyReferrer({ referrer: "", landingUrl: `${SITE}?utm_source=poe` }).source).toBe(
      "dark_ai",
    );
  });

  it("attributes a same-origin navigation that still carries the tag", () => {
    // Referrer is the customer's own site, so it proves nothing about arrival.
    expect(
      classifyReferrer({
        referrer: "https://example.com/",
        landingUrl: `${SITE}?utm_source=gemini`,
      }).source,
    ).toBe("gemini");
  });

  it("does NOT let a marker overrule a real non-AI referrer", () => {
    // A mis-tagged campaign is the most likely source of fake AI traffic. The
    // browser said facebook.com; the query string does not get a vote.
    expect(
      classifyReferrer({
        referrer: "https://www.facebook.com/",
        landingUrl: `${SITE}?utm_source=chatgpt`,
      }).source,
    ).toBeNull();
  });

  it("does NOT let a marker rescue an ambiguous host that failed its test", () => {
    // Ordinary Bing search stays ordinary Bing search.
    expect(
      classifyReferrer({
        referrer: "https://www.bing.com/search?q=widgets",
        landingUrl: `${SITE}?utm_source=copilot`,
      }).source,
    ).toBeNull();
  });

  it("never guesses: no referrer and no marker is not AI", () => {
    expect(classifyReferrer({ referrer: "", landingUrl: SITE }).source).toBeNull();
    expect(classifyReferrer({ referrer: "", landingUrl: `${SITE}?utm_source=newsletter` }).source)
      .toBeNull();
  });
});

describe("classifyReferrer — every enum value is reachable", () => {
  it("the five named sources each have a rule, and dark_ai has none", () => {
    const ruled = SOURCE_RULES.map((r) => r.source).sort();
    expect(ruled).toEqual(["chatgpt", "claude", "copilot", "gemini", "perplexity"]);
    expect(AI_VISIT_SOURCES).toContain("dark_ai");
    expect(ruled).not.toContain("dark_ai");
  });

  it("the classification table produces every enum value", () => {
    const produced = new Set(
      CASES.map((c) => classifyReferrer({ referrer: c.referrer, landingUrl: c.landing ?? SITE }).source),
    );
    for (const source of AI_VISIT_SOURCES) {
      expect(produced.has(source), `no test case yields ${source}`).toBe(true);
    }
  });
});

describe("what gets stored", () => {
  it("landingPath drops the query and the fragment", () => {
    expect(landingPathOf("https://example.com/pricing?utm_source=chatgpt#plans")).toBe("/pricing");
    expect(landingPathOf("https://example.com")).toBe("/");
    expect(landingPathOf("nonsense")).toBeNull();
  });

  it("the stored referrer keeps origin+path and drops the query", () => {
    // A referrer query string carries the visitor's search terms and sometimes
    // a session token. Neither is ours to keep.
    expect(storableReferrer("https://www.bing.com/search?q=my+private+search&showconv=1")).toBe(
      "https://www.bing.com/search",
    );
    expect(storableReferrer("")).toBeNull();
  });

  it("utm captures only the utm_* keys that are actually present", () => {
    expect(
      extractUtm("https://example.com/?utm_source=chatgpt&utm_campaign=launch&ref=x"),
    ).toEqual({ utm_source: "chatgpt", utm_campaign: "launch" });
    expect(extractUtm("https://example.com/")).toEqual({});
  });

  it("caps a hostile utm value rather than storing it whole", () => {
    const utm = extractUtm(`https://example.com/?utm_source=${"a".repeat(5000)}`);
    expect(utm.utm_source?.length).toBe(200);
  });
});
