// tests/site-crawler-ux-metadata.test.ts — the crawler views' <title>,
// description and robots (UX restructure): page-specific, localized, the
// Results title naming the crawl (read tenant-scoped), every view noindex.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "en" as string | undefined, member: { tenantId: "t1" } as { tenantId: string } | null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (state.locale ? { value: state.locale } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => state.member }));
const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { resultsTitle } from "@/lib/site-crawler/page-metadata";
import * as start from "@/app/(dashboard)/crawler/page";
import * as results from "@/app/(dashboard)/crawler/[id]/page";
import * as history from "@/app/(dashboard)/crawler/history/page";
import * as schedules from "@/app/(dashboard)/crawler/schedules/page";

const title = (m: { title?: unknown }) => (m.title as { absolute: string }).absolute;

beforeEach(() => {
  state.locale = "en";
  state.member = { tenantId: "t1" };
  findFirst.mockReset();
});

describe.each([
  ["en", "en"],
  ["fr", "fr"],
  ["de-CH", "de-CH"],
] as const)("%s", (cookie, l) => {
  const u = SITE_CRAWLER_COPY[l].ux;
  it("titles and describes each view, all noindex", async () => {
    state.locale = cookie;
    findFirst.mockResolvedValue({ rootUrl: "https://shop.example/", createdAt: new Date("2026-11-01T23:30:00Z") });
    const all = [
      [await start.generateMetadata(), u.metaStartTitle, u.metaStartDesc],
      [await history.generateMetadata(), u.metaHistoryTitle, u.metaHistoryDesc],
      [await schedules.generateMetadata(), u.metaSchedulesTitle, u.metaSchedulesDesc],
      [await results.generateMetadata({ params: Promise.resolve({ id: "c1" }) }), resultsTitle(l, "https://shop.example/", new Date("2026-11-01T23:30:00Z")), u.metaResultsDesc],
    ] as const;
    for (const [m, t, d] of all) {
      expect(title(m)).toBe(t);
      expect(m.description).toBe(d);
      expect(m.robots).toEqual({ index: false, follow: false });
    }
    expect(new Set(all.map(([m]) => title(m))).size).toBe(4);
    if (l === "de-CH") expect(JSON.stringify(u)).not.toContain("ß");
  });
});

describe("titles", () => {
  it("Start: the brand, then what it is", () => {
    expect(SITE_CRAWLER_COPY.en.ux.metaStartTitle).toBe(`${CRAWLER_BRAND.name} — site crawler by Echorank`);
  });

  it("Results: 'Crawl of <host>, <date>', the date in UTC", () => {
    expect(resultsTitle("en", "https://shop.example/a", new Date("2026-11-01T23:30:00Z"))).toBe("Crawl of shop.example, Nov 1, 2026");
  });

  it("Results reads the crawl tenant-scoped; another workspace's id or a signed-out request gets the generic title", async () => {
    findFirst.mockResolvedValue(null);
    const m = await results.generateMetadata({ params: Promise.resolve({ id: "other" }) });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "other", tenantId: "t1" }, select: { rootUrl: true, createdAt: true } });
    expect(title(m)).toBe(SITE_CRAWLER_COPY.en.ux.metaResultsFallback);
    state.member = null;
    findFirst.mockClear();
    expect(title(await results.generateMetadata({ params: Promise.resolve({ id: "c1" }) }))).toBe(SITE_CRAWLER_COPY.en.ux.metaResultsFallback);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
