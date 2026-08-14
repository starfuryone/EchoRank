// tests/citation-finder.test.ts
//
// The pure half of Citation Finder: domain normalisation and classification,
// the rollup arithmetic, and the accumulate-on-merge contract the nightly job
// depends on.
//
// EVERY EXPECTED NUMBER IS A HAND-COMPUTED LITERAL, never a recomputation from
// the code under test — the convention tests/sov-weighting.test.ts sets and for
// the same reason: writing the assertion in terms of the implementation makes
// it pass whatever the implementation becomes.
//
// The database-facing half is tests/citation-finder-store.test.ts.

import { describe, expect, it } from "vitest";
import { classifyDomain, CITATION_KINDS, KNOWN_DOMAINS } from "@/lib/citations/classify";
import { registrableDomain } from "@/lib/registrable-domain";
import {
  aggregateCitations,
  mergeRollup,
  type CitationObservation,
  type SourceRollupRow,
} from "@/lib/citations/aggregate";

const AT = new Date("2026-08-01T12:00:00.000Z");

function obs(over: Partial<CitationObservation> = {}): CitationObservation {
  return {
    domain: "g2.com",
    engine: "CLAUDE",
    brandMentioned: false,
    competitors: [],
    createdAt: AT,
    ...over,
  };
}

// ─── Domain normalization ───────────────────────────────────────────────────

describe("domain normalization", () => {
  // The join key between Citation.domain and Source.domain. If any cell here
  // changes, the two tables stop joining and this table is where it gets
  // argued about.
  it.each([
    ["https://www.g2.com/products/foo/reviews", "g2.com"],
    ["http://G2.COM/x", "g2.com"],
    ["www.g2.com", "g2.com"],
    ["g2.com", "g2.com"],
    ["g2.com.", "g2.com"],
    ["g2.com:8443", "g2.com"],
    ["blog.example.co.uk", "example.co.uk"],
    ["a.b.c.example.com", "example.com"],
    ["https://sub.gov.uk/page", "sub.gov.uk"],
    ["example.gc.ca", "example.gc.ca"],
  ])("%s → %s", (input, expected) => {
    expect(registrableDomain(input)).toBe(expected);
  });

  it("normalises before classifying, so a URL and its host agree", () => {
    expect(classifyDomain("https://www.G2.com/products/x?utm=1")).toBe("REVIEW_SITE");
    expect(classifyDomain("g2.com")).toBe("REVIEW_SITE");
  });

  it("is OTHER for input with no resolvable host rather than throwing", () => {
    expect(classifyDomain("")).toBe("OTHER");
    expect(classifyDomain("   ")).toBe("OTHER");
  });
});

// ─── Classification ─────────────────────────────────────────────────────────

describe("classifyDomain", () => {
  it("prefers the curated list over any heuristic", () => {
    // "reviews" is a REVIEW_SITE heuristic, but the curated entry wins and this
    // is the ordering guarantee the module's header promises.
    expect(KNOWN_DOMAINS["trustpilot.com"]).toBe("REVIEW_SITE");
    expect(classifyDomain("trustpilot.com")).toBe("REVIEW_SITE");
    // wikipedia.org is curated to OTHER precisely so nothing below claims it.
    expect(classifyDomain("en.wikipedia.org")).toBe("OTHER");
  });

  it.each([
    ["sec.gov", "GOV"],
    ["www.irs.gov", "GOV"],
    ["gov.uk", "GOV"],
    ["hmrc.gov.uk", "GOV"],
    ["canada.gc.ca", "GOV"],
    ["admin.ch", "GOV"],
    ["service-public.gouv.fr", "GOV"],
  ])("%s is %s by suffix", (domain, kind) => {
    expect(classifyDomain(domain)).toBe(kind);
  });

  it("does not let a .gov suffix match a domain that merely ends in those letters", () => {
    // The dot anchor is the whole point: "notagov.com" is not a government.
    expect(classifyDomain("notagov.com")).toBe("OTHER");
    expect(classifyDomain("govern.com")).toBe("OTHER");
  });

  it("treats .org as open registration, never as government", () => {
    // .org is deliberately absent from TLD_RULES. A regression that adds it
    // would misfile a large fraction of the web.
    expect(classifyDomain("somerandomcharity.org")).toBe("OTHER");
  });

  it.each([
    ["capterra-reviews.com", "REVIEW_SITE"],
    ["local-directory.com", "DIRECTORY"],
    ["saas-news.com", "NEWS"],
    ["the-blog.io", "BLOG"],
    ["dev-forum.net", "SOCIAL"],
  ])("%s falls to the %s heuristic", (domain, kind) => {
    expect(classifyDomain(domain)).toBe(kind);
  });

  it("returns OTHER rather than guessing at an unknown domain", () => {
    expect(classifyDomain("acmewidgets.com")).toBe("OTHER");
  });

  it("only ever returns a kind the UI can render", () => {
    const kinds = new Set(CITATION_KINDS);
    for (const domain of Object.keys(KNOWN_DOMAINS)) {
      expect(kinds.has(classifyDomain(domain))).toBe(true);
    }
  });
});

// ─── The rollup ─────────────────────────────────────────────────────────────

describe("aggregateCitations", () => {
  it("groups by domain and counts every citation", () => {
    const rows = aggregateCitations(
      [obs(), obs(), obs({ domain: "capterra.com" })],
      "Us",
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.domain === "g2.com")!.citationCount).toBe(2);
    expect(rows.find((r) => r.domain === "capterra.com")!.citationCount).toBe(1);
  });

  it("counts engines per domain and derives distinctEngines from the map", () => {
    const rows = aggregateCitations(
      [
        obs({ engine: "CLAUDE" }),
        obs({ engine: "CLAUDE" }),
        obs({ engine: "PERPLEXITY" }),
      ],
      "Us",
    );

    expect(rows[0].enginesSeen).toEqual({ CLAUDE: 2, PERPLEXITY: 1 });
    expect(rows[0].distinctEngines).toBe(2);
  });

  it("folds engine case, so a legacy lowercase row is not a second engine", () => {
    // PromptRun.engine defaults to the lowercase "claude" on pre-checkup rows.
    // Without the fold this would report two Claudes.
    const rows = aggregateCitations([obs({ engine: "claude" }), obs({ engine: "CLAUDE" })], "Us");

    expect(rows[0].enginesSeen).toEqual({ CLAUDE: 2 });
    expect(rows[0].distinctEngines).toBe(1);
  });

  it("credits the brand when the ANSWER named it, whatever the citation was about", () => {
    const rows = aggregateCitations(
      [obs({ brandMentioned: true, competitors: ["Rival"] })],
      "Us",
    );

    expect(rows[0].brandCitations).toBe(1);
    // The either/or: an answer that named us is not also a competitor citation,
    // or "never mentions you" would match sources that mention us constantly.
    expect(rows[0].competitorCitations).toBe(0);
    expect(rows[0].citesCompetitors).toEqual({});
    expect(rows[0].brandsSupported).toEqual(["Us"]);
  });

  it("credits the rivals only when the answer did NOT name the brand", () => {
    const rows = aggregateCitations(
      [obs({ brandMentioned: false, competitors: ["Rival A", "Rival B"] })],
      "Us",
    );

    expect(rows[0].brandCitations).toBe(0);
    expect(rows[0].citesCompetitors).toEqual({ "Rival A": 1, "Rival B": 1 });
    // ONE citation went to the competition, not two. This is the invariant the
    // cites-you/cites-them ratio is read against.
    expect(rows[0].competitorCitations).toBe(1);
  });

  it("keeps brandCitations + competitorCitations at or below citationCount", () => {
    const rows = aggregateCitations(
      [
        obs({ brandMentioned: true }),
        obs({ brandMentioned: false, competitors: ["A", "B", "C"] }),
        obs({ brandMentioned: false, competitors: [] }),
      ],
      "Us",
    );

    const row = rows[0];
    expect(row.citationCount).toBe(3);
    expect(row.brandCitations).toBe(1);
    expect(row.competitorCitations).toBe(1);
    expect(row.brandCitations + row.competitorCitations).toBeLessThanOrEqual(row.citationCount);
  });

  it("counts a rival named four times in one answer once", () => {
    const rows = aggregateCitations(
      [obs({ competitors: ["Rival", "Rival", "Rival", "Rival"] })],
      "Us",
    );

    expect(rows[0].citesCompetitors).toEqual({ Rival: 1 });
  });

  it("never counts the tracked brand as its own rival", () => {
    // A CompetitorMention row naming the brand itself is a classifier miss, and
    // it must not turn into "Us cites Us instead of Us".
    const rows = aggregateCitations([obs({ competitors: ["Us", "Rival"] })], "Us");

    expect(rows[0].citesCompetitors).toEqual({ Rival: 1 });
  });

  it("ignores blank rival names", () => {
    const rows = aggregateCitations([obs({ competitors: ["", "  ", "Rival"] })], "Us");

    expect(rows[0].citesCompetitors).toEqual({ Rival: 1 });
  });

  it("drops a citation with no domain rather than inventing an empty source", () => {
    const rows = aggregateCitations([obs({ domain: "" }), obs()], "Us");

    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("g2.com");
  });

  it("tracks first and last sighting across an unordered batch", () => {
    // Both sit outside AT (2026-08-01T12:00Z), which is the middle sighting.
    const early = new Date("2026-01-01T00:00:00.000Z");
    const late = new Date("2026-08-20T00:00:00.000Z");
    const rows = aggregateCitations(
      [obs({ createdAt: late }), obs({ createdAt: early }), obs({ createdAt: AT })],
      "Us",
    );

    expect(rows[0].firstSeenAt).toEqual(early);
    expect(rows[0].lastSeenAt).toEqual(late);
  });

  it("classifies each domain once, on the way in", () => {
    const rows = aggregateCitations(
      [obs({ domain: "g2.com" }), obs({ domain: "sec.gov" }), obs({ domain: "acme.com" })],
      "Us",
    );

    expect(rows.map((r) => [r.domain, r.kind])).toEqual([
      ["g2.com", "REVIEW_SITE"],
      ["sec.gov", "GOV"],
      ["acme.com", "OTHER"],
    ]);
  });

  it("returns nothing for an empty batch", () => {
    expect(aggregateCitations([], "Us")).toEqual([]);
  });
});

// ─── Upsert accumulation ────────────────────────────────────────────────────

describe("mergeRollup", () => {
  const stored = {
    citationCount: 10,
    enginesSeen: { CLAUDE: 7, PERPLEXITY: 3 },
    brandCitations: 4,
    competitorCitations: 6,
    citesCompetitors: { "Rival A": 5, "Rival B": 1 },
    brandsSupported: ["Us", "Rival A", "Rival B"],
    firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-07-01T00:00:00.000Z"),
  };

  const fresh: SourceRollupRow = {
    domain: "g2.com",
    kind: "REVIEW_SITE",
    citationCount: 3,
    enginesSeen: { CLAUDE: 1, GEMINI: 2 },
    distinctEngines: 2,
    brandCitations: 1,
    competitorCitations: 2,
    citesCompetitors: { "Rival A": 1, "Rival C": 1 },
    brandsSupported: ["Us", "Rival A", "Rival C"],
    firstSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-08-14T00:00:00.000Z"),
  };

  it("adds every counter, because the job aggregates a delta not a window", () => {
    const merged = mergeRollup(stored, fresh);

    expect(merged.citationCount).toBe(13);
    expect(merged.brandCitations).toBe(5);
    expect(merged.competitorCitations).toBe(8);
  });

  it("merges the engine map key-wise and recomputes distinctEngines from it", () => {
    const merged = mergeRollup(stored, fresh);

    expect(merged.enginesSeen).toEqual({ CLAUDE: 8, PERPLEXITY: 3, GEMINI: 2 });
    expect(merged.distinctEngines).toBe(3);
  });

  it("merges the rival map key-wise", () => {
    const merged = mergeRollup(stored, fresh);

    expect(merged.citesCompetitors).toEqual({ "Rival A": 6, "Rival B": 1, "Rival C": 1 });
  });

  it("keeps the earliest first sighting and the latest last sighting", () => {
    const merged = mergeRollup(stored, fresh);

    expect(merged.firstSeenAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(merged.lastSeenAt).toEqual(new Date("2026-08-14T00:00:00.000Z"));
  });

  it("does not move lastSeenAt backwards when the fresh batch is older", () => {
    const older: SourceRollupRow = {
      ...fresh,
      firstSeenAt: new Date("2025-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2025-02-01T00:00:00.000Z"),
    };
    const merged = mergeRollup(stored, older);

    expect(merged.firstSeenAt).toEqual(new Date("2025-01-01T00:00:00.000Z"));
    expect(merged.lastSeenAt).toEqual(new Date("2026-07-01T00:00:00.000Z"));
  });

  it("unions brandsSupported without duplicating", () => {
    const merged = mergeRollup(stored, fresh);

    expect([...merged.brandsSupported].sort()).toEqual([
      "Rival A",
      "Rival B",
      "Rival C",
      "Us",
    ]);
  });

  it("re-classifies from the fresh row, so a rule change lands without a backfill", () => {
    const merged = mergeRollup(stored, { ...fresh, kind: "DIRECTORY" });

    expect(merged.kind).toBe("DIRECTORY");
  });

  it("does not mutate the stored maps it was handed", () => {
    const storedEngines = { ...stored.enginesSeen };
    const storedRivals = { ...stored.citesCompetitors };
    mergeRollup(stored, fresh);

    expect(stored.enginesSeen).toEqual(storedEngines);
    expect(stored.citesCompetitors).toEqual(storedRivals);
  });
});
