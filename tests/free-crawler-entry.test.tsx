// tests/free-crawler-entry.test.tsx — the free public crawler's entry points
// (commit 4), all behind crawl.free: the "Try it free" strip on /site-crawler,
// above the pricing strip; the feature table's Free column ("100 URLs · raw
// HTML · full rule library · 7-day results"); the free-tools hub card; the
// route table / sitemap entry. Flag off → none of them.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ free: true }));
vi.mock("@/lib/flags", async (orig) => {
  const real = await orig<typeof import("@/lib/flags")>();
  return { ...real, flag: (name: string, f?: unknown) => (name === "crawl.free" ? flags.free : real.flag(name as never, f as never)) };
});

const CrawlerPage = (await import("@/app/[locale]/site-crawler/page")).default;
const HubPage = (await import("@/app/[locale]/free-tools/page")).default;
const { freeToolRoutes } = await import("@/lib/free-tools");
const { FREE_COLUMN, FREE_TRY_STRIP } = await import("@/lib/site-crawler/marketing-copy");

const crawler = async (locale: string) => renderToStaticMarkup(await CrawlerPage({ params: Promise.resolve({ locale }) }));
const hub = async (locale: string) => renderToStaticMarkup(await HubPage({ params: Promise.resolve({ locale }) }));
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

beforeEach(() => {
  flags.free = true;
});

describe("/site-crawler", () => {
  it("shows the Try it free strip above the pricing strip, pointing at the free tool", async () => {
    const html = await crawler("en");
    const strip = html.indexOf('data-testid="try-free-strip"');
    const pricing = html.indexOf('id="pricing"');
    expect(strip).toBeGreaterThan(0);
    expect(strip).toBeLessThan(pricing);
    expect(html.slice(strip, pricing)).toContain('href="/en/free-tools/site-crawler"');
    expect(html).toContain(FREE_TRY_STRIP.button.en);
  });

  it("the feature table has a Free column reading the free offer", async () => {
    const html = await crawler("en");
    expect(html).toContain(`<th scope="col">Free</th>`);
    const cell = /<td rowSpan="(\d+)" data-testid="free-column">([\s\S]*?)<\/td>/i.exec(html);
    expect(cell).not.toBeNull();
    expect(decode(cell![2]!)).toContain("100 URLs · raw HTML · full rule library · 7-day results");
    // It spans every body row of the by-plan table (the folded per-feature
    // table under it has no Free column), so each row still has one cell per column.
    const planTable = /<table[^>]*data-testid="plan-table"[^>]*>([\s\S]*?)<\/table>/.exec(html)![1]!;
    expect(Number(cell![1])).toBe((planTable.match(/<th scope="row"/g) ?? []).length);
    const fr = decode(await crawler("fr"));
    expect(fr).toContain(`<th scope="col">${FREE_COLUMN.head.fr}</th>`);
    expect(fr).toContain(FREE_COLUMN.summary.fr);
  });

  it("with crawl.free off: no strip, no Free column", async () => {
    flags.free = false;
    const html = await crawler("en");
    expect(html).not.toContain("try-free-strip");
    expect(html).not.toContain("free-column");
    expect(html).not.toContain("/free-tools/site-crawler");
  });
});

describe("the free-tools hub", () => {
  it("has the site crawler card while the flag is on, and the route table lists it", async () => {
    expect(await hub("en")).toContain('href="/en/free-tools/site-crawler"');
    expect(freeToolRoutes()).toContain("/free-tools/site-crawler");
    flags.free = false;
    expect(await hub("en")).not.toContain("/free-tools/site-crawler");
    expect(freeToolRoutes()).not.toContain("/free-tools/site-crawler");
  });
});
