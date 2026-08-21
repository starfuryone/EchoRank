// The sources config, the feed parsers and the fetch guard.
//
// NOTHING HERE TOUCHES THE NETWORK. The live checks that produced this config
// were run once, by hand, on 2026-08-21 and are recorded in sources.ts. What
// this suite protects is everything downstream of them: that the config stays
// internally consistent, that BOTH feed shapes parse, and that the guard
// refuses what it is there to refuse.

import { describe, expect, it } from "vitest";
import {
  ACTIVE_SOURCES,
  DISABLED_SOURCES,
  NEGATIVE_TERMS,
  TOPIC_MAP,
  allowedFeedOrigins,
} from "@/lib/blog-agent/sources";
import { parseFeed, parseHn } from "@/lib/blog-agent/feeds";
import { robotsAllows } from "@/lib/blog-agent/fetch";
import { extractReadable } from "@/lib/blog-agent/research";

const SRC = { id: "test", name: "Test Source" };

describe("sources config", () => {
  it("gives every source a unique id", () => {
    const ids = ACTIVE_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses https everywhere and a parseable URL", () => {
    for (const s of ACTIVE_SOURCES) {
      if (s.kind !== "rss") continue;
      expect(() => new URL(s.url), s.id).not.toThrow();
      expect(new URL(s.url).protocol, s.id).toBe("https:");
    }
  });

  it("weights every source positively", () => {
    for (const s of ACTIVE_SOURCES) expect(s.weight, s.id).toBeGreaterThan(0);
  });

  it("never lists a source that was recorded as dead", () => {
    // The whole point of DISABLED_SOURCES is that nobody re-adds Reddit without
    // reading why it was removed. This is the check that enforces it.
    const active = new Set(ACTIVE_SOURCES.map((s) => s.id));
    for (const dead of DISABLED_SOURCES) {
      expect(active.has(dead.id), `${dead.id} is disabled but present in ACTIVE_SOURCES`).toBe(false);
    }
  });

  it("records why each disabled source is disabled, and when", () => {
    for (const dead of DISABLED_SOURCES) {
      expect(dead.attempted.length, dead.id).toBeGreaterThan(0);
      expect(dead.reason.length, dead.id).toBeGreaterThan(40);
      expect(dead.verifiedAt, dead.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("derives the fetch allowlist from the config rather than a hand list", () => {
    const origins = allowedFeedOrigins();
    for (const s of ACTIVE_SOURCES) {
      if (s.kind === "rss") expect(origins, s.id).toContain(new URL(s.url).origin);
    }
    expect(origins).toContain("https://hn.algolia.com");
  });

  it("keeps the topic map lowercase, so matching is case-insensitive in one place", () => {
    for (const group of TOPIC_MAP) {
      for (const term of group.terms) expect(term, term).toBe(term.toLowerCase());
    }
    for (const term of NEGATIVE_TERMS) expect(term, term).toBe(term.toLowerCase());
  });
});

describe("RSS 2.0", () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title>Google ships an AI crawler directive</title>
      <link>https://searchengineland.com/story-1</link>
      <pubDate>Thu, 21 Aug 2026 09:00:00 +0000</pubDate>
      <description>&lt;p&gt;A change to how crawlers are directed.&lt;/p&gt;</description>
    </item>
  </channel></rss>`;

  it("reads title, link, date and summary", () => {
    const [only] = parseFeed(rss, SRC);
    expect(only.title).toBe("Google ships an AI crawler directive");
    expect(only.url).toBe("https://searchengineland.com/story-1");
    expect(only.publishedAt).toBe("2026-08-21T09:00:00.000Z");
    expect(only.summary).toBe("A change to how crawlers are directed.");
  });
});

describe("Atom", () => {
  // Google Search Central — the most authoritative source in the set — is Atom,
  // and its link is an ATTRIBUTE. An RSS-only parser returns entries with an
  // empty url and silently drops the feed that matters most.
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>A note about AI crawler access</title>
      <link rel="alternate" href="https://developers.google.com/search/blog/2026/08/note"/>
      <published>2026-08-20T12:00:00Z</published>
      <summary>Guidance for site owners.</summary>
    </entry>
  </feed>`;

  it("reads the link from the href attribute, not the element text", () => {
    const [only] = parseFeed(atom, SRC);
    expect(only.url).toBe("https://developers.google.com/search/blog/2026/08/note");
    expect(only.title).toBe("A note about AI crawler access");
    expect(only.publishedAt).toBe("2026-08-20T12:00:00.000Z");
  });

  it("falls back to updated when published is absent", () => {
    const noPublished = atom.replace(/<published>.*?<\/published>/, "<updated>2026-08-19T08:00:00Z</updated>");
    expect(parseFeed(noPublished, SRC)[0].publishedAt).toBe("2026-08-19T08:00:00.000Z");
  });
});

describe("feed parsing edge cases", () => {
  it("returns nothing rather than throwing on junk", () => {
    expect(parseFeed("not xml at all", SRC)).toEqual([]);
    expect(parseFeed("", SRC)).toEqual([]);
  });

  it("drops an item with no title or no link", () => {
    const partial = `<rss><channel>
      <item><title>Has no link</title></item>
      <item><link>https://x.example/a</link></item>
    </channel></rss>`;
    expect(parseFeed(partial, SRC)).toEqual([]);
  });

  it("leaves publishedAt null rather than defaulting to now", () => {
    // A missing date defaulting to `new Date()` would make every undated item
    // look like breaking news and win the recency score forever.
    const undated = `<rss><channel><item><title>T</title><link>https://x.example/a</link></item></channel></rss>`;
    expect(parseFeed(undated, SRC)[0].publishedAt).toBeNull();
  });

  it("leaves publishedAt null for an unparseable date", () => {
    const bad = `<rss><channel><item><title>T</title><link>https://x.example/a</link><pubDate>soon</pubDate></item></channel></rss>`;
    expect(parseFeed(bad, SRC)[0].publishedAt).toBeNull();
  });
});

describe("Hacker News", () => {
  it("maps hits and keeps a text post pointed at its discussion", () => {
    const json = JSON.stringify({
      hits: [
        { title: "llms.txt in the wild", url: "https://example.com/post", created_at: "2026-08-21T04:00:00Z", objectID: "1" },
        { title: "Ask HN: does llms.txt help?", url: null, story_text: "Wondering.", created_at: "2026-08-21T03:00:00Z", objectID: "2" },
      ],
    });
    const items = parseHn(json, SRC);
    expect(items[0].url).toBe("https://example.com/post");
    expect(items[1].url).toBe("https://news.ycombinator.com/item?id=2");
  });

  it("returns nothing rather than throwing on malformed JSON", () => {
    expect(parseHn("{not json", SRC)).toEqual([]);
    expect(parseHn("{}", SRC)).toEqual([]);
  });
});

describe("robots.txt", () => {
  it("allows everything when there is no file", () => {
    expect(robotsAllows(null, "/anything")).toBe(true);
  });

  it("honours a wildcard disallow", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /private", "/private/x")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /private", "/public/x")).toBe(true);
  });

  it("treats an empty Disallow as permission, not as a block on everything", () => {
    // "Disallow:" with no value means "nothing is disallowed". Reading it as a
    // zero-length prefix match would block the entire site.
    expect(robotsAllows("User-agent: *\nDisallow:", "/anything")).toBe(true);
  });

  it("lets the longest matching rule win, and Allow win a tie", () => {
    const txt = "User-agent: *\nDisallow: /blog\nAllow: /blog/public";
    expect(robotsAllows(txt, "/blog/private")).toBe(false);
    expect(robotsAllows(txt, "/blog/public/a")).toBe(true);
  });

  it("prefers a group naming us over the wildcard", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: echorank-blogagent\nAllow: /";
    expect(robotsAllows(txt, "/anything")).toBe(true);
  });

  it("shares one rule block across consecutive user-agent lines", () => {
    const txt = "User-agent: googlebot\nUser-agent: echorank-blogagent\nDisallow: /nope";
    expect(robotsAllows(txt, "/nope")).toBe(false);
  });

  it("ignores comments", () => {
    expect(robotsAllows("# Disallow: /\nUser-agent: *\nAllow: /", "/x")).toBe(true);
  });
});

describe("readable extraction", () => {
  it("keeps article paragraphs and drops the furniture", () => {
    const html = `<html><body>
      <nav><p>Home About Contact Subscribe now for more updates from our newsletter</p></nav>
      <article>
        <p>${"This is a real sentence of article prose that is comfortably over the length floor. ".repeat(2)}</p>
        <p>${"A second paragraph of genuine article text, also well over the minimum length. ".repeat(2)}</p>
      </article>
      <footer><p>Copyright notice and a long list of unrelated footer links for the site</p></footer>
    </body></html>`;
    const text = extractReadable(html);
    expect(text).toContain("real sentence of article prose");
    expect(text).toContain("second paragraph");
    expect(text).not.toContain("Subscribe now");
    expect(text).not.toContain("Copyright notice");
  });

  it("drops short paragraphs that are captions or bylines", () => {
    const html = `<html><body><article><p>By A. Writer</p><p>${"Real prose that clears the forty character floor easily. ".repeat(3)}</p></article></body></html>`;
    expect(extractReadable(html)).not.toContain("By A. Writer");
  });

  it("returns empty rather than throwing on a page with no prose", () => {
    expect(extractReadable("<html><body><div>hi</div></body></html>")).toBe("");
  });
});
