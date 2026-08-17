// tests/visibility-audit-hydrate.test.ts
//
// The /visibility results panel dereferences audit.score, .grade, .url,
// .checks.map, .robots.bots and .rendering.likely_csr with NO optional
// chaining. So the loader that rehydrates a stored audit has exactly one job
// beyond fetching: never hand that panel an object it will throw on.
//
// `raw` is a nullable column written only since d332e72, so a row with no raw —
// or a raw from an older sidecar shape — is a real state, not a hypothetical.
// Every case below is "would the panel survive this?", and null is the correct
// answer whenever it would not: the page then looks exactly as it did before
// the loader existed, which is empty rather than broken.

import { describe, expect, it } from "vitest";
import { hydratableAudit } from "@/lib/visibility-audit-hydrate";

const ROW = { url: "https://echorank360.com", score: 71, grade: "B" };

/** A complete blob, matching what the sidecar's serialize() actually returns. */
function complete(over: Record<string, unknown> = {}) {
  return {
    url: "https://echorank360.com",
    score: 71,
    grade: "B",
    checks: [
      { category: "robots.txt AI access", points: 8, max: 10, status: "ok", recommendation: "" },
    ],
    robots: { present: true, sitemaps: [], bots: { GPTBot: { status: "ALLOWED", detail: "" } } },
    jsonld: { types: ["Organization"], blocks: 1, errors: 0 },
    rendering: { likely_csr: false, text_len: 4200, framework: null },
    llms_txt: true,
    ...over,
  };
}

describe("hydratableAudit", () => {
  it("passes a complete sidecar blob through", () => {
    const out = hydratableAudit(complete(), ROW);
    expect(out).not.toBeNull();
    expect(out!.score).toBe(71);
    expect(out!.grade).toBe("B");
    expect(Array.isArray(out!.checks)).toBe(true);
    expect((out!.robots as { bots: object }).bots).toBeTruthy();
    expect((out!.rendering as { likely_csr: boolean }).likely_csr).toBe(false);
  });

  it("rejects a null or absent raw — the pre-d332e72 rows", () => {
    expect(hydratableAudit(null, ROW)).toBeNull();
    expect(hydratableAudit(undefined, ROW)).toBeNull();
  });

  it("rejects non-objects, including an array", () => {
    // Prisma Json can hold an array; spreading one would produce {0:…} and the
    // panel would render an audit with no fields at all.
    expect(hydratableAudit([], ROW)).toBeNull();
    expect(hydratableAudit("{}", ROW)).toBeNull();
    expect(hydratableAudit(42, ROW)).toBeNull();
  });

  it("rejects a blob missing any field the panel dereferences", () => {
    for (const field of ["score", "checks", "rendering", "robots"]) {
      const blob = complete();
      delete (blob as Record<string, unknown>)[field];
      expect(hydratableAudit(blob, ROW), `${field} missing must not hydrate`).toBeNull();
    }
  });

  it("rejects robots present but without bots — the shape the panel indexes", () => {
    expect(hydratableAudit(complete({ robots: { present: true, sitemaps: [] } }), ROW)).toBeNull();
    expect(hydratableAudit(complete({ robots: { bots: null } }), ROW)).toBeNull();
  });

  it("rejects checks that is not an array, so .map cannot throw", () => {
    expect(hydratableAudit(complete({ checks: {} }), ROW)).toBeNull();
    expect(hydratableAudit(complete({ checks: null }), ROW)).toBeNull();
  });

  it("rejects a non-numeric score rather than rendering NaN/100", () => {
    expect(hydratableAudit(complete({ score: "71" }), ROW)).toBeNull();
  });

  it("falls back to the columns for url and grade when raw omits them", () => {
    // The columns are what MonitorCard and the benchmark queries read, so the
    // panel agreeing with them matters more than raw's own copy.
    const out = hydratableAudit(complete({ url: "", grade: "" }), ROW);
    expect(out!.url).toBe(ROW.url);
    expect(out!.grade).toBe(ROW.grade);
  });

  it("keeps raw's url and grade when it has them", () => {
    const out = hydratableAudit(complete({ url: "https://other.test", grade: "A" }), ROW);
    expect(out!.url).toBe("https://other.test");
    expect(out!.grade).toBe("A");
  });
});
