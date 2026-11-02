// tests/snapshot-sources.test.ts
//
// Snapshot v2: the source → competitor map on fixtures where competitors
// overlap across sources and engines, the "What to do" ranking, the
// classification fallback (call fails → type "unknown", no action), and the
// excerpt window around the first brand/competitor mention.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { absentSources, actionRows, ownedByCompetitor, parseClassification, sourceMap } from "@/lib/snapshot/sources";
import { excerptAround, EXCERPT_RADIUS } from "@/lib/snapshot/match";
import { runSnapshot, type RunDeps } from "@/lib/snapshot/run";
import type { StoredAnswer } from "@/lib/snapshot/report";

const USER = "acmeplumbing.co.uk";
const a = (engine: "openai" | "gemini", promptIndex: number, citedDomains: string[], competitors: string[]): StoredAnswer => ({
  promptIndex,
  engine,
  model: null,
  mentioned: false,
  cited: citedDomains.includes(USER),
  competitors,
  citedDomains,
  excerpt: "",
  error: null,
});

// Pipeworks is named beside checkatrade on both engines; DrainPro beside
// checkatrade and reddit; the user is cited once, beside yell.
const ANSWERS: StoredAnswer[] = [
  a("openai", 0, ["checkatrade.com", "pipeworks.co.uk"], ["Pipeworks Ltd", "DrainPro"]),
  a("openai", 1, ["checkatrade.com", "reddit.com"], ["Pipeworks Ltd"]),
  a("openai", 2, ["yell.com", USER], []),
  a("gemini", 0, ["checkatrade.com"], ["DrainPro", "Pipeworks Ltd"]),
  a("gemini", 1, ["reddit.com", "which.co.uk"], ["DrainPro"]),
  a("gemini", 2, ["checkatrade.com", "checkatrade.com"], ["pipeworks ltd"]),
  { ...a("gemini", 3, ["ignored.example"], ["Ghost"]), error: "HTTP 503" },
];

describe("sourceMap", () => {
  const map = sourceMap(ANSWERS, USER);
  const row = (d: string) => map.find((s) => s.domain === d)!;

  it("counts answers per domain (a domain cited twice in one answer counts once), most-cited first", () => {
    expect(map.map((s) => [s.domain, s.timesCited])).toEqual([
      ["checkatrade.com", 4],
      ["reddit.com", 2],
      [USER, 1],
      ["pipeworks.co.uk", 1],
      ["which.co.uk", 1],
      ["yell.com", 1],
    ]);
    expect(map.some((s) => s.domain === "ignored.example")).toBe(false); // errored answer
  });

  it("collects the competitors named in those answers, merged across spellings and engines", () => {
    expect(row("checkatrade.com").competitors).toEqual([
      { name: "Pipeworks Ltd", count: 4, byEngine: { openai: 2, gemini: 2 } },
      { name: "DrainPro", count: 2, byEngine: { openai: 1, gemini: 1 } },
    ]);
    expect(row("reddit.com").competitors.map((c) => [c.name, c.count])).toEqual([
      ["DrainPro", 1],
      ["Pipeworks Ltd", 1],
    ]);
  });

  it("marks whether the user's domain was cited in the same answers", () => {
    expect(row("yell.com").userCited).toBe(true);
    expect(row(USER).userCited).toBe(true);
    expect(row("checkatrade.com").userCited).toBe(false);
  });
});

describe("What to do", () => {
  const map = sourceMap(ANSWERS, USER);
  const absent = absentSources(map, USER);
  const competitors = ["Pipeworks Ltd", "DrainPro"];

  it("lists the sources the user is absent from, most-cited first", () => {
    expect(absent.map((s) => s.domain)).toEqual(["checkatrade.com", "reddit.com", "pipeworks.co.uk", "which.co.uk"]);
  });

  it("types and actions each row; competitor-owned ones carry no action", () => {
    const classified = parseClassification({
      domains: [
        { domain: "checkatrade.com", type: "review_site" },
        { domain: "reddit.com", type: "forum" },
        { domain: "which.co.uk", type: "publisher" },
        // The classifier is overruled where the domain is a competitor's name.
        { domain: "pipeworks.co.uk", type: "directory" },
        { domain: "bogus.com", type: "not-a-type" },
      ],
    });
    expect(actionRows(absent, competitors, classified)).toEqual([
      { domain: "checkatrade.com", timesCited: 4, type: "directory", action: "claim_profile" },
      { domain: "reddit.com", timesCited: 2, type: "forum", action: "join_discussion" },
      { domain: "pipeworks.co.uk", timesCited: 1, type: "competitor", action: null },
      { domain: "which.co.uk", timesCited: 1, type: "publisher", action: "pitch_comparison" },
    ]);
  });

  it("classification failed: every row is unknown with no action (competitor-owned still recognised)", () => {
    expect(actionRows(absent, competitors, null)).toEqual([
      { domain: "checkatrade.com", timesCited: 4, type: "unknown", action: null },
      { domain: "reddit.com", timesCited: 2, type: "unknown", action: null },
      { domain: "pipeworks.co.uk", timesCited: 1, type: "competitor", action: null },
      { domain: "which.co.uk", timesCited: 1, type: "unknown", action: null },
    ]);
  });

  it("shows the top 5 only", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ domain: `d${i}.com`, timesCited: 8 - i, competitors: [], userCited: false }));
    expect(actionRows(many, [], null)).toHaveLength(5);
  });

  it("competitor-owned matching is by name, not by any shared word", () => {
    expect(ownedByCompetitor("pipeworks.co.uk", ["Pipeworks Ltd"])).toBe(true);
    expect(ownedByCompetitor("drainpro-leeds.com", ["DrainPro"])).toBe(true);
    expect(ownedByCompetitor("checkatrade.com", ["Pipeworks Ltd", "DrainPro"])).toBe(false);
    expect(ownedByCompetitor("bbc.co.uk", ["BBC"])).toBe(false); // too short to trust
  });

  it("end to end: a classification call that throws gives unknown rows, and the run still completes", async () => {
    const deps: RunDeps = {
      engines: [{ engine: "openai", model: "gpt-4.1-mini", apiKey: "k" }],
      capUsd: 1,
      ask: async () => ({ text: "DrainPro is good.", sourceUrls: ["https://reddit.com/r/x"], usage: { inputTokens: 1, outputTokens: 1 }, model: "m" }),
      askJson: vi.fn(async (_c, instructions: string) => {
        if (instructions.startsWith("Classify")) throw new Error("HTTP 500");
        return { value: { answers: [{ index: 0, competitors: ["DrainPro"] }] }, usage: { inputTokens: 1, outputTokens: 1 } };
      }),
      cost: () => 0.001,
      estimate: () => 0.001,
      loadAnswers: async () => [],
      saveAnswer: async () => undefined,
      saveAnalysis: async () => undefined,
    };
    const r = await runSnapshot(
      { id: "s", brand: "Acme", domain: USER, category: "plumber", location: null, prompts: [{ kind: "best", text: "q" }] },
      deps,
    );
    expect(r.report.actions).toEqual([{ domain: "reddit.com", timesCited: 1, type: "unknown", action: null }]);
    expect(r.allErrored).toBe(false);
  });
});

describe("excerpt", () => {
  const pad = (n: number) => "lorem ipsum ".repeat(n);

  it("centres ±200 chars on the first brand OR competitor mention, whichever comes first", () => {
    const text = `${pad(60)}Pipeworks Ltd answers fast. ${pad(10)}Acme Plumbing too. ${pad(60)}`;
    const ex = excerptAround(text, "Acme Plumbing", USER, ["Pipeworks Ltd"]);
    expect(ex.startsWith("…")).toBe(true);
    expect(ex.endsWith("…")).toBe(true);
    expect(ex).toContain("Pipeworks Ltd answers fast.");
    expect(ex.length).toBeLessThanOrEqual(2 * EXCERPT_RADIUS + 2);
    const at = ex.indexOf("Pipeworks");
    expect(at).toBeGreaterThan(EXCERPT_RADIUS - 20);
  });

  it("falls back to the first 300 characters when nobody is named", () => {
    const ex = excerptAround(pad(60), "Acme Plumbing", USER, ["Pipeworks Ltd"]);
    expect(ex.startsWith("lorem ipsum")).toBe(true);
    expect(ex.length).toBeLessThanOrEqual(301);
  });

  it("a mention near the start has no leading ellipsis", () => {
    expect(excerptAround("Acme Plumbing is great.", "Acme Plumbing", USER, [])).toBe("Acme Plumbing is great.");
  });
});
