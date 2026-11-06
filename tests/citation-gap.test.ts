// The citation gap (src/lib/citation-gap.ts): domains cited by answers that
// named a competitor and not you, ranked, typed; top 3 in the free check.
import { describe, expect, it } from "vitest";
import { citationGap, gapSourceType, FREE_GAP_ROWS } from "@/lib/citation-gap";
import { buildReport } from "@/lib/snapshot/report";

const answer = (brandMentioned: boolean, competitorsNamed: string[], citedDomains: string[]) => ({
  brandMentioned,
  competitorsNamed,
  citedDomains,
});

describe("citation gap", () => {
  it("counts only answers that named a competitor and not you, ranked by frequency", () => {
    const rows = citationGap(
      [
        answer(false, ["Pipeworks"], ["https://www.yelp.com/biz/p", "https://reddit.com/r/x", "https://www.yelp.com/other"]),
        answer(false, ["Pipeworks", "Leeds Drains"], ["yelp.com", "bbc.co.uk"]),
        answer(true, ["Pipeworks"], ["g2.com"]), // you were named: not a gap
        answer(false, [], ["capterra.com"]), // nobody named: not a gap
        answer(false, ["Leeds Drains"], ["acmeplumbing.co.uk", "reddit.com"]),
      ],
      "https://www.acmeplumbing.co.uk",
    );
    expect(rows.map((r) => [r.domain, r.count])).toEqual([
      ["reddit.com", 2],
      ["yelp.com", 2], // two URLs in one answer count once
      ["acmeplumbing.co.uk", 1],
      ["bbc.co.uk", 1],
    ]);
    expect(rows.find((r) => r.domain === "yelp.com")?.competitors).toEqual(["Pipeworks", "Leeds Drains"]);
  });

  it("types sources without a model", () => {
    expect(gapSourceType("www.trustpilot.com", null)).toBe("review_site");
    expect(gapSourceType("www.yellowpages.com", null)).toBe("directory");
    expect(gapSourceType("reddit.com", null)).toBe("forum");
    // Typed on the registrable domain (subdomains collapse into it).
    expect(gapSourceType("www.travel-forum.com", null)).toBe("forum");
    expect(gapSourceType("https://www.nytimes.com/2026/x", null)).toBe("news");
    expect(gapSourceType("https://www.acme.co.uk/x", "acme.co.uk")).toBe("own_site");
    expect(gapSourceType("some-blog.example", null)).toBe("other");
  });
});

describe("the free check report", () => {
  it("carries the top three gap rows", () => {
    const answers = ["a.com", "b.com", "c.com", "d.com"].flatMap((d, i) =>
      Array.from({ length: 4 - i }, (_, k) => ({
        promptIndex: k,
        engine: "openai" as const,
        model: "m",
        mentioned: false,
        cited: false,
        competitors: ["Rival"],
        citedDomains: [d],
        excerpt: "",
        error: null,
      })),
    );
    const report = buildReport({
      brand: "Acme",
      domain: "acme.com",
      category: "plumber",
      location: null,
      engines: ["openai"],
      prompts: [{ kind: "best", text: "q" }],
      answers,
      actions: [],
      capped: false,
      now: new Date("2026-11-06T00:00:00Z"),
    } as Parameters<typeof buildReport>[0]);
    expect(FREE_GAP_ROWS).toBe(3);
    expect(report.citationGap?.map((r) => r.domain)).toEqual(["a.com", "b.com", "c.com"]);
  });
});
