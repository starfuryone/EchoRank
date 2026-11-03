// The bounded HEAD checks: caps, the per-crawl cache, inconclusive statuses,
// the SSRF guard, and which of them go through the politeness limiter.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { attachHeadChecks, type HeadResult } from "@/lib/site-crawler/head-checks";
import { EXTERNAL_CHECKS_PER_PAGE } from "@/lib/site-crawler/constants";
import { doc, page } from "./crawl-rules/harness";

function deps(answers: Record<string, HeadResult>) {
  const store = new Map<string, string>();
  const calls: string[] = [];
  const acquire = vi.fn(async () => {});
  return {
    calls,
    acquire,
    d: {
      redis: {
        hget: async (_k: string, f: string) => store.get(f) ?? null,
        hset: async (_k: string, f: string, v: string) => (store.set(f, v), 1),
        expire: async () => 1,
      } as never,
      cacheKey: "crawl:j:head",
      limiter: { acquire },
      headFn: async (url: string) => (calls.push(url), answers[url] ?? { status: 200, bytes: 1000 }),
    },
  };
}

const links = (hrefs: string[]) => hrefs.map((h) => `<a href="${h}">x</a>`).join("");

describe("attachHeadChecks", () => {
  it("counts external 4xx, 5xx and redirects; 403 and 405 are inconclusive", async () => {
    const p = page(doc("", links(["https://a.org/gone", "https://b.org/err", "https://c.org/moved", "https://d.org/bot", "https://e.org/nohead", "https://f.org/ok"])));
    const { d } = deps({
      "https://a.org/gone": { status: 404, bytes: null },
      "https://b.org/err": { status: 503, bytes: null },
      "https://c.org/moved": { status: 301, bytes: null },
      "https://d.org/bot": { status: 403, bytes: null },
      "https://e.org/nohead": { status: 405, bytes: null },
    });
    await attachHeadChecks(p, "https://example.com/", d);
    expect(p.externalLinkChecks).toEqual({ checked: 6, clientErrors: 1, serverErrors: 1, redirects: 1, sample: "https://a.org/gone" });
  });

  it("caps external checks per page and skips private addresses", async () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://site${i}.org/`);
    const p = page(doc("", links([...many, "http://127.0.0.1/admin"])));
    const { d, calls } = deps({});
    await attachHeadChecks(p, "https://example.com/", d);
    expect(calls).toHaveLength(EXTERNAL_CHECKS_PER_PAGE);
    expect(calls.some((c) => c.includes("127.0.0.1"))).toBe(false);
  });

  it("checks same-host images through the limiter, cached across pages", async () => {
    const html = doc("", '<img src="/big.jpg" alt=""><img src="/missing.png" alt=""><img src="https://cdn.other.org/x.jpg" alt="">');
    const { d, calls, acquire } = deps({
      "https://example.com/big.jpg": { status: 200, bytes: 300_000 },
      "https://example.com/missing.png": { status: 404, bytes: null },
    });
    const p1 = page(html);
    await attachHeadChecks(p1, "https://example.com/", d);
    expect(p1.imageChecks).toMatchObject({ checked: 2, broken: 1, oversize: 1 });
    expect(acquire).toHaveBeenCalledTimes(2);

    const p2 = page(html);
    await attachHeadChecks(p2, "https://example.com/", d);
    expect(p2.imageChecks).toMatchObject({ checked: 2, broken: 1, oversize: 1 });
    // Second page: answered from the cache, no new requests.
    expect(calls.filter((c) => c.includes("example.com"))).toHaveLength(2);
  });

  it("leaves a page without links or images untouched", async () => {
    const p = page(doc("", "<p>text</p>"));
    await attachHeadChecks(p, "https://example.com/", deps({}).d);
    expect(p.externalLinkChecks).toBeUndefined();
    expect(p.imageChecks).toBeUndefined();
  });
});
