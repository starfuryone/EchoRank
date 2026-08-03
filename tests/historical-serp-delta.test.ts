// SERP delta math.
//
// The fixtures at the bottom are the REAL top-10 of two consecutive checks of
// "plumber toronto" (2026-07-29 and 2026-08-03, Test Agency, location 2124).
// The expected values were computed by hand from the stored rows before this
// code existed, so this is a check against reality rather than against itself.
import { describe, it, expect } from "vitest";
import {
  bestByDomain,
  diffSerpChecks,
  normalizeDomain,
  positionOf,
  positionSeries,
  trackedDomains,
} from "@/lib/historical/serp-delta";
import type { SerpResultItem } from "@/lib/serp/types";

const item = (domain: string, position: number, url = `https://${domain}/`): SerpResultItem => ({
  domain,
  position,
  url,
  title: `${domain} title`,
  snippet: "",
});

// ── Real data, 2026-07-29 -> 2026-08-03 ─────────────────────────────────────

const JUL29: SerpResultItem[] = [
  item("www.homestars.com", 1),
  item("www.brothersplumbing.ca", 2),
  item("stores.homedepot.ca", 3),
  item("premierplumbing.ca", 4),
  item("www.torontotoday.ca", 5),
  item("www.rotorooter.com", 6),
  item("drpipe.ca", 7),
  item("urbantasker.com", 8),
  item("www.drainkingplumbers.ca", 9),
  item("www.bark.com", 10),
];

const AUG03: SerpResultItem[] = [
  item("www.homestars.com", 1),
  item("www.brothersplumbing.ca", 2),
  item("ca.indeed.com", 3),
  item("www.rotorooter.com", 4),
  item("premierplumbing.ca", 5),
  item("www.torontotoday.ca", 6),
  item("www.drainkingplumbers.ca", 7),
  item("drpipe.ca", 8),
  item("www.mrrooter.ca", 9),
  item("www.bark.com", 10),
];

describe("real consecutive checks (plumber toronto)", () => {
  const delta = diffSerpChecks(JUL29, AUG03, 10);

  it("finds the two domains that entered", () => {
    expect(delta.entered.map((r) => r.domain).sort()).toEqual(["ca.indeed.com", "mrrooter.ca"]);
  });

  it("finds the two that dropped out", () => {
    expect(delta.dropped.map((r) => r.domain).sort()).toEqual([
      "stores.homedepot.ca",
      "urbantasker.com",
    ]);
  });

  it("finds the five that moved, with the right direction and size", () => {
    const moved = Object.fromEntries(delta.moved.map((r) => [r.domain, r.change]));
    expect(moved).toEqual({
      "rotorooter.com": 2,        // 6 -> 4, up two
      "drainkingplumbers.ca": 2,  // 9 -> 7, up two
      "premierplumbing.ca": -1,   // 4 -> 5, down one
      "torontotoday.ca": -1,      // 5 -> 6, down one
      "drpipe.ca": -1,            // 7 -> 8, down one
    });
  });

  it("finds the three that held", () => {
    expect(delta.held.map((r) => r.domain).sort()).toEqual([
      "bark.com",
      "brothersplumbing.ca",
      "homestars.com",
    ]);
  });

  it("accounts for every domain exactly once", () => {
    // 10 in the newer check plus 2 that dropped out of the older = 12.
    expect(delta.rows).toHaveLength(12);
    expect(new Set(delta.rows.map((r) => r.domain)).size).toBe(12);
  });

  it("orders moved by biggest climb first", () => {
    expect(delta.moved[0].change).toBe(2);
    expect(delta.moved[delta.moved.length - 1].change).toBe(-1);
  });
});

// ── Behaviour on constructed fixtures ───────────────────────────────────────

describe("normalizeDomain", () => {
  it("strips www and lowercases", () => {
    expect(normalizeDomain("WWW.Example.com")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("treats www and bare as one site", () => {
    const delta = diffSerpChecks([item("www.a.com", 3)], [item("a.com", 3)]);
    expect(delta.held).toHaveLength(1);
    expect(delta.entered).toHaveLength(0);
    expect(delta.dropped).toHaveLength(0);
  });

  it("survives null and empty", () => {
    expect(normalizeDomain(null)).toBe("");
    expect(normalizeDomain(undefined)).toBe("");
  });
});

describe("bestByDomain", () => {
  it("keeps the best position when a domain ranks twice", () => {
    const best = bestByDomain([item("a.com", 7), item("a.com", 3), item("b.com", 5)], 10);
    expect(best.get("a.com")?.position).toBe(3);
  });

  it("respects the depth window", () => {
    const best = bestByDomain([item("a.com", 3), item("b.com", 11)], 10);
    expect([...best.keys()]).toEqual(["a.com"]);
  });

  it("ignores items with no numeric position", () => {
    const broken = [{ domain: "a.com", url: "u", title: "t", snippet: "" }] as unknown as SerpResultItem[];
    expect(bestByDomain(broken, 10).size).toBe(0);
  });
});

describe("diffSerpChecks edges", () => {
  it("reports everything as entered against an empty older check", () => {
    const delta = diffSerpChecks([], AUG03, 10);
    expect(delta.entered).toHaveLength(10);
    expect(delta.dropped).toHaveLength(0);
  });

  it("reports everything as dropped against an empty newer check", () => {
    const delta = diffSerpChecks(JUL29, [], 10);
    expect(delta.dropped).toHaveLength(10);
    expect(delta.entered).toHaveLength(0);
  });

  it("is empty for two empty checks", () => {
    expect(diffSerpChecks([], []).rows).toHaveLength(0);
  });

  it("finds nothing changed when a check is compared to itself", () => {
    const delta = diffSerpChecks(JUL29, JUL29, 10);
    expect(delta.held).toHaveLength(10);
    expect(delta.moved).toHaveLength(0);
    expect(delta.entered).toHaveLength(0);
    expect(delta.dropped).toHaveLength(0);
  });

  it("honours a narrower depth", () => {
    // At depth 3 the Aug check's ca.indeed.com at #3 pushed homedepot out.
    const delta = diffSerpChecks(JUL29, AUG03, 3);
    expect(delta.entered.map((r) => r.domain)).toEqual(["ca.indeed.com"]);
    expect(delta.dropped.map((r) => r.domain)).toEqual(["stores.homedepot.ca"]);
  });

  it("signs change so that up-the-page is positive", () => {
    const up = diffSerpChecks([item("a.com", 9)], [item("a.com", 2)]);
    expect(up.moved[0].change).toBe(7);
    const down = diffSerpChecks([item("a.com", 2)], [item("a.com", 9)]);
    expect(down.moved[0].change).toBe(-7);
  });
});

describe("position series", () => {
  const checks = [
    { id: "c1", createdAt: new Date("2026-07-29T01:32:23Z"), items: JUL29 },
    { id: "c2", createdAt: new Date("2026-08-03T08:29:41Z"), items: AUG03 },
  ];

  it("tracks one domain across checks", () => {
    expect(positionSeries(checks, "www.rotorooter.com", 10).map((p) => p.position)).toEqual([6, 4]);
  });

  it("returns null where the domain was outside the window", () => {
    expect(positionSeries(checks, "ca.indeed.com", 10).map((p) => p.position)).toEqual([null, 3]);
  });

  it("carries the check id and an ISO timestamp", () => {
    const [first] = positionSeries(checks, "homestars.com", 10);
    expect(first.checkId).toBe("c1");
    expect(first.at).toBe("2026-07-29T01:32:23.000Z");
  });

  it("positionOf agrees with the series", () => {
    expect(positionOf(AUG03, "www.mrrooter.ca", 10)).toBe(9);
    expect(positionOf(AUG03, "not-here.com", 10)).toBeNull();
  });

  it("lists every domain seen in any check, deduped and sorted", () => {
    const domains = trackedDomains(checks, 10);
    expect(domains).toContain("homestars.com");
    expect(domains).toContain("ca.indeed.com");
    expect(domains).toContain("urbantasker.com");
    expect(new Set(domains).size).toBe(domains.length);
    expect([...domains]).toEqual([...domains].sort());
  });
});
