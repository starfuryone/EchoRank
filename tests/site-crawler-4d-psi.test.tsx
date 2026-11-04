// @vitest-environment jsdom
//
// tests/site-crawler-4d-psi.test.tsx — the PageSpeed opt-in: config caps and
// the flag, the run summary, the Add data section and its confirm lines in
// every dashboard locale.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ on: new Set<string>(["crawl.psi", "crawl.segments"]) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => flags.on.has(n) };
});

import { CrawlConfigInputSchema, checkCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { AddDataSection, confirmLines, psiRuns, withSource } from "@/components/seo-tools/site-crawler-add-data";
import { problemText } from "@/components/seo-tools/site-crawler-config";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const input = (addData: unknown) => CrawlConfigInputSchema.parse({ addData });
const ctx = { urlCap: 100, verified: false, extractorCap: 0, searchCap: 0, psiCap: 50, backlinkCap: 50 };

describe("addData in the crawl config", () => {
  it("keeps an opt-in under the plan cap, refuses one over it", () => {
    expect(checkCrawlConfig(input({ psi: { pages: 50 } }), ctx)).toMatchObject({ problems: [], config: { addData: { psi: { pages: 50, segment: null }, backlinks: null } } });
    expect(checkCrawlConfig(input({ psi: { pages: 51 } }), ctx).problems).toEqual([{ field: "addData.psi", code: "over_plan_cap", limit: 50 }]);
    expect(checkCrawlConfig(input({ psi: { pages: 5 } }), { urlCap: 100, verified: false }).problems).toEqual([{ field: "addData.psi", code: "over_plan_cap", limit: 0 }]);
  });

  it("drops an opt-in whose feature flag is off rather than refusing the crawl", () => {
    flags.on.delete("crawl.psi");
    expect(checkCrawlConfig(input({ psi: { pages: 5 } }), ctx)).toMatchObject({ problems: [], config: { addData: null } });
    flags.on.add("crawl.psi");
  });

  it("a config without addData is unchanged", () => {
    expect(checkCrawlConfig(CrawlConfigInputSchema.parse({}), ctx).config.addData).toBeNull();
  });
});

describe("helpers", () => {
  it("withSource / psiRuns", () => {
    const one = withSource(null, "psi", { pages: 7, segment: null });
    expect(one).toEqual({ psi: { pages: 7, segment: null }, backlinks: null });
    expect(withSource(one, "psi", null)).toBeNull();
    expect(psiRuns({ pages: 7, segment: null })).toBe(14);
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: problems and confirm lines read the opt-in", (l) => {
    const t = SITE_CRAWLER_COPY[l];
    expect(problemText({ field: "addData.psi", code: "unknown_segment" }, t.p4a, t.p4b, t.p4d)).toBe(t.p4d.problemSegment);
    expect(problemText({ field: "addData.psi", code: "over_plan_cap", limit: 10 }, t.p4a, t.p4b, t.p4d)).toBe(t.p4d.problemCap("10"));
    const lines = confirmLines(t.p4d, { psi: { pages: 10, segment: null }, backlinks: null }, { psiCap: 10, lighthouseUsed: 5, lighthouseLimit: 20 });
    expect(lines).toEqual([t.p4d.confirmPsi("10", "20", "15", "20")]);
  });
});

describe("AddDataSection", () => {
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
  });

  it.each(["en", "fr", "de-CH"] as DashLocale[])("%s: opt in, see the allowance, pick a saved segment", async (l) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ segments: [{ name: "Blog" }] }) })));
    const onChange = vi.fn();
    const t = SITE_CRAWLER_COPY[l].p4d;
    host = document.createElement("div");
    document.body.appendChild(host);
    const render = async (value: Parameters<typeof AddDataSection>[0]["value"]) =>
      act(async () => {
        createRoot(host!).render(<AddDataSection t={t} host="x.com" quota={{ psiCap: 50, lighthouseUsed: 4, lighthouseLimit: 20 }} value={value} onChange={onChange} />);
      });
    await render(null);
    expect(host.textContent).toContain(t.psiLabel("50"));
    expect(host.textContent).toContain(t.psiQuota("16", "20"));
    const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => box.click());
    expect(onChange).toHaveBeenCalledWith({ psi: { pages: 10, segment: null }, backlinks: null });
    host.remove();
    host = document.createElement("div");
    document.body.appendChild(host);
    await render({ psi: { pages: 10, segment: null }, backlinks: null });
    await act(async () => {});
    expect(host.textContent).toContain(t.psiNeeds("20"));
    expect([...host.querySelectorAll("#add-psi-by option")].map((o) => o.textContent)).toEqual([t.byInlinks, t.bySegment("Blog")]);
    expect(host.textContent).not.toMatch(/undefined|NaN/);
  });
});
