// The redirect-chain walker, on its own.
//
// Everything else aggregation does is SQL (duplicate groups, canonical,
// hreflang and pagination targets, SimHash banding) and is tested against a
// real Postgres in tests/site-crawler-aggregate.db.test.ts: an in-memory fake
// would test the fake.
import { describe, expect, it, vi } from "vitest";
import { MAX_CHAIN_WALK } from "@/lib/site-crawler/constants";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));

const { walkChain } = await import("@/lib/site-crawler/aggregate");

// ─── The chain walker ───────────────────────────────────────────────────────

describe("walkChain", () => {
  const map = (pairs: [string, string][]) =>
    new Map(pairs.map(([from, to]) => [from, { target: to }]));

  it("reports a single hop as a chain of one", () => {
    const walk = walkChain("a", map([["a", "b"]]));
    expect(walk.hops).toBe(1);
    expect(walk.looped).toBe(false);
    expect(walk.path).toEqual(["a", "b"]);
  });

  it("follows a multi-page chain", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "c"], ["c", "d"]]));
    expect(walk.hops).toBe(3);
    expect(walk.path).toEqual(["a", "b", "c", "d"]);
    expect(walk.looped).toBe(false);
  });

  it("detects a two-URL loop", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "a"]]));
    expect(walk.looped).toBe(true);
  });

  it("detects a self-redirect", () => {
    expect(walkChain("a", map([["a", "a"]])).looped).toBe(true);
  });

  it("detects a longer cycle", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "c"], ["c", "a"]]));
    expect(walk.looped).toBe(true);
  });

  it("stops at the hop budget instead of walking forever", () => {
    // A very long non-cyclic chain must terminate.
    const pairs: [string, string][] = Array.from({ length: 50 }, (_, i) => [`u${i}`, `u${i + 1}`]);
    const walk = walkChain("u0", map(pairs));
    expect(walk.hops).toBeLessThanOrEqual(MAX_CHAIN_WALK);
    expect(walk.truncated).toBe(true);
  });

  it("returns zero hops for a URL that does not redirect", () => {
    expect(walkChain("a", map([])).hops).toBe(0);
  });
});
