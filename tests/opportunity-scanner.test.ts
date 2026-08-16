// tests/opportunity-scanner.test.ts
//
// The pure half: list parsing, the SSRF rejections, grade banding, the gap
// extraction, and the CSV shape. No Prisma and no Redis in this file — every
// module under test here is dependency-free by design, which is most of why
// they were written that way.
//
// The rejection tests are the ones that matter. This is the only feature in the
// app that points a server-side fetch at a list of domains a customer typed in
// bulk, so "what does it refuse" is the security property, and it is asserted
// case by case rather than by trusting that url-guard is called.

import { describe, expect, it } from "vitest";

import {
  parseDomainList,
  normalizeCandidate,
  tokenize,
  MAX_BATCH_ROWS,
  MAX_INPUT_BYTES,
} from "@/lib/opportunity-scanner/parse";
import { BANDS, gradeFor, gradeRank, topGaps } from "@/lib/opportunity-scanner/grade";
import { SCAN_CSV_COLUMNS } from "@/lib/opportunity-scanner/csv";
import { brandQuery, estimateBatchUsd } from "@/lib/opportunity-scanner/estimate";
import { toCsv, csvHeader, csvRow } from "@/lib/csv-export";
import { PLACES_TEXTSEARCH_USD } from "@/lib/explain/cost";
import type { ScanRowDto } from "@/lib/opportunity-scanner/store";

// ─── Tokenising ─────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("splits on every separator an agency's export might use", () => {
    expect(tokenize("a.com\nb.com")).toEqual(["a.com", "b.com"]);
    expect(tokenize("a.com,b.com")).toEqual(["a.com", "b.com"]);
    expect(tokenize("a.com;b.com")).toEqual(["a.com", "b.com"]);
    expect(tokenize("a.com\tb.com")).toEqual(["a.com", "b.com"]);
    expect(tokenize("a.com|b.com")).toEqual(["a.com", "b.com"]);
    expect(tokenize("a.com\r\nb.com")).toEqual(["a.com", "b.com"]);
  });

  it("strips the quoting a single-column CSV arrives with", () => {
    expect(tokenize('"a.com"\n"b.com"')).toEqual(["a.com", "b.com"]);
    expect(tokenize("'a.com'")).toEqual(["a.com"]);
  });

  it("drops empty runs rather than emitting blank tokens", () => {
    expect(tokenize("a.com\n\n\n,,,\nb.com\n")).toEqual(["a.com", "b.com"]);
  });
});

// ─── Normalising and the guard ──────────────────────────────────────────────

describe("normalizeCandidate", () => {
  it("reduces every shape of the same site to one registrable domain", () => {
    for (const input of [
      "example.com",
      "www.example.com",
      "https://example.com",
      "https://www.example.com/pricing?utm=x",
      "HTTP://EXAMPLE.COM",
      "example.com/",
      "blog.example.com",
    ]) {
      const result = normalizeCandidate(input);
      expect(result, input).toEqual({ ok: true, domain: "example.com" });
    }
  });

  it("keeps a multi-label public suffix intact", () => {
    expect(normalizeCandidate("shop.acme.co.uk")).toEqual({ ok: true, domain: "acme.co.uk" });
  });

  // ── EVERY IP LITERAL IS REFUSED ────────────────────────────────────────
  //
  // The reason label varies and is not asserted, deliberately. registrableDomain
  // shortens an IPv4 literal to its last two labels ("127.0.0.1" -> "0.1"), and
  // WHATWG URL then re-expands that to a full address ("0.0.0.1") — so which of
  // `private_host` and `ip_literal` comes back depends on where the shortened
  // form lands in the address space. What matters, and what is asserted, is
  // that none of them is ever accepted.
  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "192.168.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "255.255.255.255",
    "8.8.8.8", // public, and still refused: a prospect is named by a domain
    "[::1]",
    "http://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1:4500/audit",
  ])("refuses the IP literal %s", (input) => {
    expect(normalizeCandidate(input).ok, input).toBe(false);
  });

  it.each([
    ["file:///etc/passwd", "not_a_domain"], // no hostname survives the parse
    ["javascript:alert(1)", "not_a_domain"],
    ["localhost", "not_a_domain"],
    ["intranet", "not_a_domain"],
    ["router.local", "private_host"],
    ["db.internal", "private_host"],
    ["box.lan", "private_host"],
    ["thing.test", "private_host"],
    ["site.invalid", "private_host"],
    ["a.example", "private_host"],
    ["not a domain at all", "not_a_domain"],
    ["", "not_a_url"],
    ["   ", "not_a_url"],
  ])("rejects %s as %s", (input, reason) => {
    const result = normalizeCandidate(input);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe(reason);
  });

  // ── Normalising DISCARDS the dangerous parts rather than rejecting on them
  //
  // This is the property that makes the whole ingest safe, and it is stronger
  // than a rejection would be. A scheme, credentials, a port and a path cannot
  // survive registrableDomain() — it keeps the hostname and nothing else — so
  // by the time the guard runs there is nothing left for it to catch, and by
  // the time the worker fetches, the only thing it can fetch is
  // https://<registrable-domain>. `bad_scheme`, `has_credentials` and
  // `bad_port` are therefore unreachable from this path by construction, not
  // by the guard happening to be called.
  //
  // Accepting these is also the right product behaviour: a messy agency export
  // full of "http://acme.com:80/index.html" is a list of real prospects.
  it.each([
    ["ftp://example.com", "example.com"],
    ["http://user:pass@example.com", "example.com"],
    ["http://example.com:8080", "example.com"],
    ["http://example.com:22", "example.com"],
    ["https://user:pass@www.example.com:8443/a/b?c=d#e", "example.com"],
  ])("strips %s down to %s rather than refusing it", (input, domain) => {
    expect(normalizeCandidate(input)).toEqual({ ok: true, domain });
  });
});

// ─── The list ───────────────────────────────────────────────────────────────

describe("parseDomainList", () => {
  it("dedupes on the registrable domain, not the typed string", () => {
    const parsed = parseDomainList("example.com\nwww.example.com\nhttps://example.com/pricing");
    expect(parsed.domains).toEqual(["example.com"]);
    expect(parsed.rejected.filter((r) => r.reason === "duplicate")).toHaveLength(2);
  });

  it("preserves first-seen order", () => {
    const parsed = parseDomainList("c.com\na.com\nb.com");
    expect(parsed.domains).toEqual(["c.com", "a.com", "b.com"]);
  });

  it("reports every rejection rather than silently dropping it", () => {
    const parsed = parseDomainList("good.com\n127.0.0.1\nnot a domain\ngood.com");
    expect(parsed.domains).toEqual(["good.com"]);
    expect(parsed.rejected).toHaveLength(3);
    expect(parsed.rejected.map((r) => r.reason).sort()).toEqual([
      "duplicate",
      "not_a_domain",
      "private_host",
    ]);
  });

  it("drops a header row, but only when it is first and is not a domain", () => {
    expect(parseDomainList("domain\na.com").domains).toEqual(["a.com"]);
    expect(parseDomainList("website\na.com").domains).toEqual(["a.com"]);
    // A real domain first is never eaten.
    expect(parseDomainList("a.com\nb.com").domains).toEqual(["a.com", "b.com"]);
    // "domain" anywhere but first is just a bad line, reported as such.
    const mid = parseDomainList("a.com\ndomain\nb.com");
    expect(mid.domains).toEqual(["a.com", "b.com"]);
    expect(mid.rejected).toHaveLength(1);
  });

  it("dedupes BEFORE applying the row cap", () => {
    // 1,400 lines that are 700 unique domains is a normal export with
    // duplicates in it, and must not be refused for being "over 1000".
    const unique = Array.from({ length: 700 }, (_, i) => `site${i}.com`);
    const raw = [...unique, ...unique].join("\n");
    const parsed = parseDomainList(raw);
    expect(parsed.domains).toHaveLength(700);
    expect(parsed.rejected.every((r) => r.reason === "duplicate")).toBe(true);
  });

  it("caps at MAX_BATCH_ROWS and says so on the overflow", () => {
    const raw = Array.from({ length: MAX_BATCH_ROWS + 25 }, (_, i) => `site${i}.com`).join("\n");
    const parsed = parseDomainList(raw);
    expect(parsed.domains).toHaveLength(MAX_BATCH_ROWS);
    expect(parsed.rejected.filter((r) => r.reason === "over_limit")).toHaveLength(25);
  });

  it("refuses an oversized paste on length alone, before tokenising", () => {
    const parsed = parseDomainList("x".repeat(MAX_INPUT_BYTES + 1));
    expect(parsed.domains).toHaveLength(0);
    expect(parsed.rejected).toEqual([{ input: "", reason: "over_limit" }]);
    expect(parsed.seen).toBe(0);
  });

  it("caps the echoed input so a whole pasted row is not reflected back", () => {
    const long = "not-a-domain-".repeat(40);
    const parsed = parseDomainList(long);
    expect(parsed.rejected[0].input.length).toBeLessThanOrEqual(120);
  });

  it("handles an empty submission without throwing", () => {
    expect(parseDomainList("").domains).toEqual([]);
    expect(parseDomainList("\n\n,,\n").domains).toEqual([]);
  });
});

// ─── Grade banding ──────────────────────────────────────────────────────────

describe("gradeFor", () => {
  it("matches the sidecar's bands exactly", () => {
    // These five numbers are copied from ai_visibility_audit.py's grade(). If
    // one moves there and not here, /free-audit and this scanner give the same
    // site two different letters.
    expect(BANDS).toEqual([
      [85, "A"],
      [70, "B"],
      [55, "C"],
      [40, "D"],
      [0, "F"],
    ]);
  });

  it.each([
    [100, "A"], [90, "A"], [85, "A"],
    [84, "B"], [70, "B"],
    [69, "C"], [55, "C"],
    [54, "D"], [40, "D"],
    [39, "F"], [1, "F"], [0, "F"],
  ])("scores %i as %s", (score, letter) => {
    expect(gradeFor(score)).toBe(letter);
  });

  it("clamps out-of-range scores rather than returning undefined", () => {
    expect(gradeFor(150)).toBe("A");
    expect(gradeFor(-10)).toBe("F");
  });

  it("grades an unusable score F, not A", () => {
    // NaN and Infinity both mean "that was not a score". An F is visibly wrong
    // to whoever reads the table; an A quietly tells an agency a broken site is
    // fine, and that one ends up in front of a prospect.
    expect(gradeFor(Number.NaN)).toBe("F");
    expect(gradeFor(Number.POSITIVE_INFINITY)).toBe("F");
    expect(gradeFor(Number.NEGATIVE_INFINITY)).toBe("F");
  });

  it("rounds rather than truncating at a band edge", () => {
    expect(gradeFor(84.6)).toBe("A");
    expect(gradeFor(84.4)).toBe("B");
  });
});

describe("gradeRank", () => {
  it("puts the worst prospects first, which is what the table is for", () => {
    const sorted = ["A", "C", "F", "B", "D"].sort((a, b) => gradeRank(a) - gradeRank(b));
    expect(sorted).toEqual(["F", "D", "C", "B", "A"]);
  });

  it("sorts an ungraded row last, not first", () => {
    const sorted = [null, "F", "A"].sort((a, b) => gradeRank(a) - gradeRank(b));
    expect(sorted).toEqual(["F", "A", null]);
    expect(gradeRank(undefined)).toBeGreaterThan(gradeRank("A"));
  });
});

// ─── Gap extraction ─────────────────────────────────────────────────────────

const CHECKS = [
  ["robots.txt AI access", 12, 20, "3/6 AI crawlers blocked", "Unblock GPTBot."],
  ["Rendering", 0, 15, "Client-rendered shell", "Server-render the main content."],
  ["Structured data", 5, 20, "No Organization JSON-LD", "Add an Organization block."],
  ["Sitemap", 5, 5, "Present", ""],
  ["Metadata", 8, 10, "Thin description", "Write a real description."],
];

describe("topGaps", () => {
  it("takes the three biggest point losses, worst first", () => {
    const gaps = topGaps(CHECKS);
    expect(gaps.map((g) => g.category)).toEqual([
      // Rendering and Structured data both lost 15; the tie breaks
      // alphabetically so the order is stable across two scans of one site.
      "Rendering",
      "Structured data",
      "robots.txt AI access", // lost 8
    ]);
    expect(gaps[0].lost).toBe(15);
  });

  it("ranks by points lost, not by ratio", () => {
    // 10/20 loses more than 0/4, even though the second is worse as a share —
    // and "recover up to +N points" is the number the report prints.
    const gaps = topGaps([
      ["Big", 10, 20, "half", ""],
      ["Small", 0, 4, "none", ""],
    ]);
    expect(gaps[0].category).toBe("Big");
  });

  it("never reports a check at full marks", () => {
    expect(topGaps(CHECKS).some((g) => g.category === "Sitemap")).toBe(false);
  });

  it("never reports a zero-max check, which would say 'recover up to +0'", () => {
    expect(topGaps([["Informational", 0, 0, "n/a", ""]])).toEqual([]);
  });

  it("is stable: the same audit twice gives the same three in the same order", () => {
    expect(topGaps(CHECKS)).toEqual(topGaps([...CHECKS].reverse()));
  });

  it("degrades on junk rather than throwing", () => {
    expect(topGaps(null)).toEqual([]);
    expect(topGaps(undefined)).toEqual([]);
    expect(topGaps("nope")).toEqual([]);
    expect(topGaps([null, 42, "x", [], ["only-a-name"]])).toEqual([]);
    // A well-formed entry among junk still survives.
    expect(topGaps([null, ["Rendering", 0, 10, "bad", "fix"], "x"])).toHaveLength(1);
  });

  it("accepts a three-element check, because the loss is real without the prose", () => {
    // A thinner upstream response must still produce gaps. Requiring all five
    // elements would render an empty section, which reads as "no problems
    // found" on a site that has them.
    const gaps = topGaps([["Rendering", 0, 10]]);
    expect(gaps).toEqual([{ category: "Rendering", status: "", recommendation: "", lost: 10 }]);
  });
});

// ─── The Places estimate ────────────────────────────────────────────────────

describe("estimateBatchUsd", () => {
  it("is zero when the lookup is off — the default", () => {
    expect(estimateBatchUsd(1000, false)).toBe(0);
    expect(estimateBatchUsd(0, true)).toBe(0);
  });

  it("prices a batch at the text-search rate, not the details rate", () => {
    expect(estimateBatchUsd(1000, true)).toBeCloseTo(1000 * PLACES_TEXTSEARCH_USD, 2);
    expect(estimateBatchUsd(1000, true)).toBe(32);
  });

  it("rounds UP, because a quote that undershoots the bill is the worse error", () => {
    // 1 x 0.032 = 0.032 -> 0.04, never 0.03.
    expect(estimateBatchUsd(1, true)).toBe(0.04);
    expect(estimateBatchUsd(10, true)).toBe(0.32);
  });
});

describe("brandQuery", () => {
  it("takes the domain stem and makes it look like a business name", () => {
    expect(brandQuery("acme-dental.com")).toBe("acme dental");
    expect(brandQuery("northside_legal.co.uk")).toBe("northside legal");
    expect(brandQuery("example.com")).toBe("example");
  });

  it("returns empty for a domain with no stem, so no call is made", () => {
    expect(brandQuery("")).toBe("");
    expect(brandQuery(".com")).toBe("");
  });
});

// ─── CSV shape ──────────────────────────────────────────────────────────────

function row(over: Partial<ScanRowDto> = {}): ScanRowDto {
  return {
    id: "row_1",
    domain: "example.com",
    score: 41,
    grade: "D",
    topGaps: [
      { category: "Structured data", status: "No JSON-LD", recommendation: "Add it", lost: 14 },
      { category: "Rendering", status: "CSR shell", recommendation: "SSR it", lost: 12 },
    ],
    place: { name: "Example", rating: 4.3, reviewCount: 112 },
    status: "done",
    error: null,
    completedAt: null,
    ...over,
  };
}

describe("scan CSV", () => {
  it("has a stable header, in the order a salesperson reads it", () => {
    expect(csvHeader(SCAN_CSV_COLUMNS)).toBe(
      "Domain,Grade,Score,Top gaps,Gap 1,Gap 1 detail,Gap 2,Gap 2 detail," +
        "Gap 3,Gap 3 detail,Google rating,Google reviews,Status,Error",
    );
  });

  it("keeps every column on a failed row, so two exports never disagree on shape", () => {
    const failed = csvRow(
      row({ score: null, grade: null, topGaps: [], place: null, status: "failed", error: "timeout" }),
      SCAN_CSV_COLUMNS,
    );
    expect(failed.split(",")).toHaveLength(SCAN_CSV_COLUMNS.length);
    expect(failed).toBe("example.com,,,,,,,,,,,,failed,timeout");
  });

  it("writes the gaps both joined and split, for reading and for mail merge", () => {
    const line = csvRow(row(), SCAN_CSV_COLUMNS);
    expect(line).toContain("Structured data; Rendering");
    expect(line).toContain("No JSON-LD");
  });

  it("leaves the third gap's columns empty when there are only two", () => {
    const line = csvRow(row(), SCAN_CSV_COLUMNS).split(",");
    // Gap 3 and Gap 3 detail are indices 8 and 9.
    expect(line[8]).toBe("");
    expect(line[9]).toBe("");
  });

  it("neutralises a formula that arrived in a crawled string", () => {
    // The status text came off a stranger's website. csv-export's guard runs on
    // every column, so this must be inert without csv.ts doing anything.
    const line = csvRow(
      row({
        domain: "=cmd|'/c calc'!A1",
        topGaps: [{ category: "@SUM(1+1)", status: "+1+1", recommendation: "", lost: 5 }],
      }),
      SCAN_CSV_COLUMNS,
    );
    expect(line).toContain("'=cmd|'/c calc'!A1");
    expect(line).toContain("'@SUM(1+1)");
    expect(line).toContain("'+1+1");
  });

  it("does NOT guard a real number, so ratings and scores stay numeric", () => {
    const line = csvRow(row({ score: 41 }), SCAN_CSV_COLUMNS).split(",");
    expect(line[2]).toBe("41");
    expect(line).toContain("4.3");
    expect(line).toContain("112");
  });

  it("writes a BOM so Excel reads accented company names correctly", () => {
    const csv = toCsv([row({ domain: "société-générale.fr" })], SCAN_CSV_COLUMNS);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("société-générale.fr");
  });

  it("uses CRLF line endings", () => {
    const csv = toCsv([row()], SCAN_CSV_COLUMNS);
    expect(csv).toContain("\r\n");
  });
});
