// @vitest-environment jsdom
//
// tests/site-crawler-4e-js.test.tsx — Phase 4e custom JavaScript: the config
// checks (verified only, render only, plan cap, preset fields), the presets'
// code, the sidecar call, and the editor in every dashboard locale.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlConfigInputSchema, checkCrawlConfig, readSiteDefaults, siteDefaultColumns, type StoredCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { JS_PRESETS, snippetCode, type JsSnippet } from "@/lib/site-crawler/js-snippets";
import { callSidecarRender, toRenderFacts, RENDER_REQUEST_TIMEOUT_MS } from "@/lib/site-crawler/render";
import { JsSnippetsEditor } from "@/components/seo-tools/site-crawler-js";
import { problemText } from "@/components/seo-tools/site-crawler-config";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = (over: Partial<JsSnippet> = {}): JsSnippet => ({ name: "dl", preset: "dataLayer", selector: null, code: null, ...over });
const check = (js: JsSnippet[], ctx: { verified?: boolean; renders?: boolean; jsSnippetCap?: number } = {}) =>
  checkCrawlConfig(CrawlConfigInputSchema.parse({ js }), { urlCap: 100, verified: ctx.verified ?? true, renders: ctx.renders ?? true, jsSnippetCap: ctx.jsSnippetCap ?? 3 });

describe("checkCrawlConfig: custom JavaScript", () => {
  it.each([
    ["two presets on a verified, rendering crawl", [s(), s({ preset: "scroll" })], {}, []],
    ["over the plan cap", [s(), s(), s(), s()], {}, ["js:over_plan_cap"]],
    ["unverified site", [s()], { verified: false }, ["js:requires_verified_site"]],
    ["no render mode", [s()], { renders: false }, ["js:requires_render"]],
    ["load more without a selector", [s({ preset: "loadMore" })], {}, ["js:invalid_snippet"]],
    ["custom without code", [s({ preset: "custom", code: "  " })], {}, ["js:invalid_snippet"]],
    ["a cap of 0 (no plan cap given)", [s()], { jsSnippetCap: 0 }, ["js:over_plan_cap"]],
    ["no snippets: nothing to check, even unverified", [], { verified: false, renders: false }, []],
  ] as const)("%s", (_n, js, ctx, codes) => {
    const { problems, config } = check([...js], ctx);
    expect(problems.map((p) => `${p.field}:${p.code}`)).toEqual(codes);
    expect(config.js).toHaveLength(js.length);
  });

  it("refuses a 21st snippet and over-long code at parse time", () => {
    expect(CrawlConfigInputSchema.safeParse({ js: Array.from({ length: 21 }, () => s()) }).success).toBe(false);
    expect(CrawlConfigInputSchema.safeParse({ js: [s({ preset: "custom", code: "x".repeat(2001) })] }).success).toBe(false);
    expect(CrawlConfigInputSchema.safeParse({ js: [s({ preset: "eval" as never })] }).success).toBe(false);
  });

  it("keeps snippets in their own site-defaults column", () => {
    const stored = { ...CrawlConfigInputSchema.parse({}), headers: [], cookies: null, basicAuth: null, js: [s()] } as StoredCrawlConfig;
    const cols = siteDefaultColumns(stored);
    expect("js" in (cols.config as object)).toBe(false);
    expect(cols.jsSnippets).toEqual([s()]);
    expect(readSiteDefaults(cols.config, cols.jsSnippets)?.js).toEqual([s()]);
    expect(readSiteDefaults(null, cols.jsSnippets)).toBeNull();
  });
});

describe("presets", () => {
  it.each(JS_PRESETS.filter((p) => p !== "custom"))("%s compiles to a function body that returns", (preset) => {
    const code = snippetCode(s({ preset, selector: preset === "loadMore" ? "button.more" : null }));
    expect(code).toMatch(/return /);
    expect(() => new Function(`return async function () {${code}}`)).not.toThrow();
  });
  it("quotes the load-more selector as a string literal", () => {
    expect(snippetCode(s({ preset: "loadMore", selector: `a"); alert(1); ("` }))).toContain(JSON.stringify(`a"); alert(1); ("`));
  });
  it("custom sends the code as written", () => {
    expect(snippetCode(s({ preset: "custom", code: "return document.title;" }))).toBe("return document.title;");
  });
});

describe("the sidecar call", () => {
  it("sends the snippets and allows 5 s more per snippet; values come back on the render facts", async () => {
    let seen: { body?: string; signal?: AbortSignal } = {};
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      seen = { body: init.body as string, signal: init.signal as AbortSignal };
      return new Response(JSON.stringify({ finalUrl: "https://x.com/", status: 200, jsRedirect: null, offSite: false, html: "<html></html>", consoleErrors: 0, consoleSample: null, viewport: null, bodyFontPx: null, tapTargets: null, axe: null, snippets: ["1", "error: x"] }), { status: 200 });
    });
    const out = await callSidecarRender("https://x.com/", f, ["return 1", "throw 1"]);
    expect(JSON.parse(seen.body!).snippets).toEqual(["return 1", "throw 1"]);
    expect(toRenderFacts(out!, "https://x.com/").snippets).toEqual(["1", "error: x"]);
    // 20 s render + up to 120 s queued behind the sidecar's shared contexts + 5 s slack (render.ts).
    expect(RENDER_REQUEST_TIMEOUT_MS).toBe(145_000);
  });
  it("sends no snippets key when there are none", async () => {
    let body = "";
    await callSidecarRender("https://x.com/", vi.fn(async (_u: string, init: RequestInit) => ((body = init.body as string), new Response("null", { status: 200 }))));
    expect(JSON.parse(body)).not.toHaveProperty("snippets");
  });
});

describe("the editor", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: presets, verified-only and render notes, cap", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4e;
    const el = document.createElement("div");
    const root = createRoot(el);
    const onChange = vi.fn();
    await act(async () => root.render(<JsSnippetsEditor t={t} value={[s({ preset: "loadMore", selector: "#m" })]} cap={1} verified renders={false} onChange={onChange} />));
    expect(el.textContent).toContain(t.jsTitle);
    expect(el.textContent).toContain(t.jsNeedsRender);
    expect(el.textContent).toContain(t.jsCapReached("1"));
    // A visible label now (UX restructure a11y), not aria-label alone.
    expect([...el.querySelectorAll("label")].find((l) => l.textContent === t.jsSelector)?.control?.tagName).toBe("INPUT");
    expect([...el.querySelectorAll("option")].map((o) => o.textContent)).toEqual(JS_PRESETS.map((p) => t.jsPresets[p]));
    await act(async () => root.render(<JsSnippetsEditor t={t} value={[]} cap={3} verified={false} renders onChange={onChange} />));
    expect(el.textContent).toContain(t.jsVerifiedOnly);
    expect((el.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    if (l === "de-CH") expect(JSON.stringify(t)).not.toContain("ß");
    root.unmount();
  });

  it("names each js problem", () => {
    const c = SITE_CRAWLER_COPY.en;
    expect(problemText({ field: "js", code: "requires_render" }, c.p4a, c.p4b, c.p4d, c.p4e)).toBe(c.p4e.problemRender);
    expect(problemText({ field: "js", code: "invalid_snippet", index: 1, reason: "selector_missing" }, c.p4a, c.p4b, c.p4d, c.p4e)).toBe(c.p4e.problemSnippet("2"));
    expect(problemText({ field: "js", code: "requires_verified_site" }, c.p4a, c.p4b, c.p4d, c.p4e)).toContain(c.p4e.jsVerifiedOnly);
  });
});
