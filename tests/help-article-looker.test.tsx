// @vitest-environment jsdom
//
// tests/help-article-looker.test.tsx — the Looker Studio guide (Phase 4c):
// public only while crawl.sheets is on, documents the exact columns the
// exporter writes, the same checks every help article gets, and the
// "Export to Sheets" control that links to it.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.sheets": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] };
});

import { HELP_ARTICLES, helpArticleBySlug, helpArticleRoutes } from "@/lib/help-articles";
import { LOOKER_STUDIO_ARTICLE, LOOKER_STUDIO_SLUG } from "@/lib/help-articles-crawler";
import { COMPARE_HEADER, ISSUES_HEADER, PAGES_HEADER, SUMMARY_HEADER } from "@/lib/site-crawler/sheets-layout";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SheetsExport } from "@/components/seo-tools/site-crawler-sheets";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const text = (base: "en" | "fr") => JSON.stringify(LOOKER_STUDIO_ARTICLE.copy[base]);

describe("Looker Studio guide", () => {
  it("is a registered public help article once crawl.sheets is on", () => {
    expect(helpArticleBySlug(LOOKER_STUDIO_SLUG)).toBe(LOOKER_STUDIO_ARTICLE);
    expect(helpArticleRoutes()).toContain(`/help/${LOOKER_STUDIO_SLUG}`);
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain(`/help/${LOOKER_STUDIO_SLUG}`);
    expect(HELP_ARTICLES.filter((a) => a.slug === LOOKER_STUDIO_SLUG)).toHaveLength(1);
  });

  it.each(["en", "fr"] as const)("%s: lists every column the exporter writes", (base) => {
    for (const col of [...SUMMARY_HEADER, ...ISSUES_HEADER, ...PAGES_HEADER, ...COMPARE_HEADER]) expect(text(base)).toContain(`\`${col}\``);
    for (const tab of ["Summary", "Issues", "Pages", "Compare"]) expect(text(base)).toContain(tab);
  });

  it("both locales have the same shape, real copy, the brand cased right, no template promised", () => {
    const [en, fr] = [LOOKER_STUDIO_ARTICLE.copy.en, LOOKER_STUDIO_ARTICLE.copy.fr];
    expect(fr.body.map((b) => b.k)).toEqual(en.body.map((b) => b.k));
    en.body.forEach((b, i) => {
      const f = fr.body[i]!;
      if (b.k === "steps" && f.k === "steps") expect(f.items.length).toBe(b.items.length);
      if (b.k === "table" && f.k === "table") expect(f.rows.length).toBe(b.rows.length);
    });
    for (const base of ["en", "fr"] as const) {
      const t = text(base);
      expect(t.match(/echo[\s-]*rank/gi)!.every((m) => m === "Echorank")).toBe(true);
      expect(t).not.toMatch(/template|modèle/i);
      expect(t).not.toMatch(/Nosy Bat/);
    }
  });

  it("every internal link points at a registered route", () => {
    const registered = new Set(LOCALIZED_ROUTES.map((r) => r.path));
    for (const base of ["en", "fr"] as const) {
      const c = LOOKER_STUDIO_ARTICLE.copy[base];
      const links = [...JSON.stringify(c).matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]!);
      for (const href of [...links, ...c.related.map((r) => r.href)]) expect(registered.has(href.split("#")[0]!), `${base}: ${href}`).toBe(true);
    }
  });
});

describe("SheetsExport", () => {
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function mount(l: "en" | "fr" | "de-CH", response: { status: number; body: unknown }) {
    const fetchMock = vi.fn(async () => ({ ok: response.status < 300, status: response.status, json: async () => response.body }));
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host!).render(<SheetsExport crawlId="j1" t={SITE_CRAWLER_COPY[l].p4c} int={new Intl.NumberFormat("en-US")} guideHref={`/en/help/${LOOKER_STUDIO_SLUG}`} />);
    });
    const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === SITE_CRAWLER_COPY[l].p4c.shExport)!;
    await act(async () => button.click());
    return fetchMock;
  }

  it.each(["en", "fr", "de-CH"] as const)("%s: exports, then links the sheet and the guide", async (l) => {
    const fetchMock = await mount(l, { status: 200, body: { spreadsheetId: "s", url: "https://docs.google.com/spreadsheets/d/s", pages: 1200 } });
    expect(fetchMock).toHaveBeenCalledWith("/api/seo/v1/crawl/j1/sheets", expect.objectContaining({ method: "POST", body: "{}" }));
    const c = SITE_CRAWLER_COPY[l].p4c;
    expect(host!.textContent).toContain(c.shDone("1,200"));
    const hrefs = [...host!.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://docs.google.com/spreadsheets/d/s", `/en/help/${LOOKER_STUDIO_SLUG}`]);
  });

  it("not connected: offers the connect link", async () => {
    await mount("en", { status: 409, body: { code: "SHEETS_NOT_CONNECTED", connectHref: "/api/seo/v1/crawl/sheets/connect" } });
    const connect = [...host!.querySelectorAll("a")].find((a) => a.textContent === SITE_CRAWLER_COPY.en.p4c.shConnect)!;
    expect(connect.getAttribute("href")).toBe("/api/seo/v1/crawl/sheets/connect");
  });
});
