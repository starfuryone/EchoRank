// @vitest-environment jsdom
//
// tests/site-crawler-4g-external-ui.test.tsx — the External tab in every
// dashboard locale: rows, the status and host filters in the request, the
// expandable source pages, the CSV link; the public line and row.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { ExternalPanel, externalQuery } from "@/components/seo-tools/site-crawler-external";
import { crawlTabs } from "@/components/seo-tools/site-crawler-client";
import { FLAGS } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_FEATURE_ROWS, featureCells, visibleCapabilities, visibleFeatureRows } from "@/lib/site-crawler/marketing-copy";
import { SITE_CRAWLER_4G } from "@/lib/i18n/site-crawler-4g";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const int = new Intl.NumberFormat("en-US");

describe("External tab", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: rows, filters, expandable sources, CSV", async (l) => {
    vi.useFakeTimers();
    const t = SITE_CRAWLER_COPY[l];
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        urls.push(u);
        if (u.includes("?url=")) return { ok: true, json: async () => ({ sources: [{ url: "https://site.example/a", anchor: "Docs" }], limit: 100 }) };
        return { ok: true, json: async () => ({ rows: [{ url: "https://gone.example/x", host: "gone.example", status: 404, sources: 3, firstAnchor: "Old docs" }, { url: "https://n.example/", host: "n.example", status: null, sources: 1, firstAnchor: null }], page: 1, totalPages: 1, total: 2 }) };
      }),
    );
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<ExternalPanel crawlId="c1" t={t} int={int} />));
    await act(async () => void vi.advanceTimersByTime(300));
    expect(el.textContent).toContain("https://gone.example/x");
    expect(el.textContent).toContain(t.p4g.notChecked);
    expect(el.querySelector("a")!.getAttribute("href")).toBe("/api/seo/v1/crawl/c1/external?&format=csv");
    const btn = [...el.querySelectorAll("button")].find((b) => b.textContent === t.p4g.showSources("3"))!;
    await act(async () => btn.click());
    await act(async () => void vi.advanceTimersByTime(10));
    expect(el.textContent).toContain("https://site.example/a");
    expect(urls.some((u) => u.endsWith("?url=https%3A%2F%2Fgone.example%2Fx"))).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (l === "de-CH") expect(JSON.stringify(SITE_CRAWLER_4G["de-CH"])).not.toContain("ß");
  });

  it("builds the query; the tab shows while links are kept", () => {
    expect(externalQuery("4xx", " Gone.Example ", 2)).toBe("status=4xx&host=gone.example&page=2");
    expect(crawlTabs({ config: null, status: "COMPLETED" })).toContain("external");
    expect(crawlTabs({ config: null, status: "COMPLETED", dataPurgedAt: "2026-11-01T00:00:00Z" })).not.toContain("external");
  });

  it("the public External links line and row render; the row's cell is the per-page limit", () => {
    expect(FLAGS["crawl.externalLinks"]).toBe(true);
    const ctx = { families: new Set<string>(), flags: FLAGS };
    expect(visibleCapabilities(ctx).map((c) => c.id)).toContain("external-links");
    expect(visibleFeatureRows(ctx).map((r) => r.id)).toContain("external-links");
    const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
    expect(Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "external-links")!, plans, "en"))).toEqual(Array(3).fill("50 per page, status checked once per crawl"));
  });
});
