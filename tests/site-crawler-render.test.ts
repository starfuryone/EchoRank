// Render mode (Phase 3b): which pages are rendered, the per-job ceiling and
// one-at-a-time chain, the failure breaker, and the sidecar call.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildPageFacts } from "@/lib/site-crawler/facts";
import {
  RENDER_FAILURE_LIMIT,
  RenderBudget,
  callSidecarRender,
  toRenderFacts,
  wantsRender,
  type SidecarRender,
} from "@/lib/site-crawler/render";
import { renderColumns } from "@/lib/site-crawler/stored";
import { CRAWLER_USER_AGENT } from "@/lib/site-crawler/constants";

const ROOT = "https://example.com/";
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

function facts(body: string, statusCode = 200) {
  return buildPageFacts({
    url: "https://example.com/p",
    finalUrl: "https://example.com/p",
    rootUrl: ROOT,
    depth: 1,
    blockedByRobots: false,
    statusCode,
    fetchError: null,
    redirectHops: 0,
    redirectTarget: null,
    contentType: "text/html",
    responseMs: 10,
    bytes: null,
    inSitemap: null,
    headers: {},
    html: `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`,
  });
}

const FULL = () => facts(`<p>${words(200)}</p><a href="/a">a</a>`);
const SHELL = () => facts('<div id="root"></div>');

function sidecar(over: Partial<SidecarRender> = {}): SidecarRender {
  return {
    finalUrl: "https://example.com/p",
    status: 200,
    jsRedirect: null,
    offSite: false,
    html: `<html><head><title>t</title></head><body><p>${words(200)}</p><a href="/a">a</a><a href="/js">js</a></body></html>`,
    consoleErrors: 1,
    consoleSample: "boom",
    viewport: { width: 412, scrollWidth: 412 },
    bodyFontPx: 16,
    tapTargets: { checked: 2, tooClose: 0, sample: null },
    axe: { version: "4.11.4", violations: { "image-alt": { impact: "critical", nodes: 2 } } },
    ...over,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("wantsRender", () => {
  it("none renders nothing; all renders every 2xx HTML page", () => {
    expect(wantsRender("none", SHELL())).toBe(false);
    expect(wantsRender("all", FULL())).toBe(true);
    expect(wantsRender("all", facts("<p>gone</p>", 404))).toBe(false);
  });

  it("thin picks pages under 50 words or with no links", () => {
    expect(wantsRender("thin", SHELL())).toBe(true);
    expect(wantsRender("thin", facts(`<p>${words(200)}</p>`))).toBe(true);
    expect(wantsRender("thin", FULL())).toBe(false);
  });
});

describe("RenderBudget", () => {
  it("is disabled when the mode is none or the plan's cap is 0", () => {
    expect(new RenderBudget("none", 500).enabled).toBe(false);
    expect(new RenderBudget("all", 0).enabled).toBe(false);
    expect(new RenderBudget("thin", 100).enabled).toBe(true);
  });

  it("never exceeds the ceiling, even with pages arriving at once", async () => {
    const call = vi.fn(async () => sidecar());
    const b = new RenderBudget("all", 2, 0, call);
    const out = await Promise.all([1, 2, 3, 4].map(() => b.maybeRender(FULL())));
    expect(call).toHaveBeenCalledTimes(2);
    expect(out.filter(Boolean)).toHaveLength(2);
    expect(b.rendered).toBe(2);
  });

  it("counts attempts a retried job already made against the ceiling", async () => {
    const call = vi.fn(async () => sidecar());
    const b = new RenderBudget("all", 3, 3, call);
    expect(await b.maybeRender(FULL())).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("sends one render at a time", async () => {
    let open = 0;
    let most = 0;
    const call = vi.fn(async () => {
      most = Math.max(most, ++open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      return sidecar();
    });
    const b = new RenderBudget("all", 10, 0, call);
    await Promise.all([1, 2, 3, 4].map(() => b.maybeRender(FULL())));
    expect(call).toHaveBeenCalledTimes(4);
    expect(most).toBe(1);
  });

  it(`stops rendering after ${RENDER_FAILURE_LIMIT} failures in a row`, async () => {
    const call = vi.fn(async () => null);
    const b = new RenderBudget("all", 100, 0, call);
    for (let i = 0; i < RENDER_FAILURE_LIMIT + 3; i++) await b.maybeRender(FULL());
    expect(call).toHaveBeenCalledTimes(RENDER_FAILURE_LIMIT);
    expect(b.stopped).toBe(true);
    expect(b.failed).toBe(RENDER_FAILURE_LIMIT);
  });
});

describe("toRenderFacts + renderColumns", () => {
  it("parses the rendered DOM with the raw extractor and stores counts only", () => {
    const f = FULL();
    f.render = toRenderFacts(sidecar(), ROOT);
    expect(f.render.html?.wordCount).toBeGreaterThan(190);
    expect(f.render.axe).toEqual({ "image-alt": { impact: "critical", nodes: 2 } });
    const cols = renderColumns(f);
    expect(cols).toMatchObject({
      renderedLinkCount: 2,
      consoleErrors: 1,
      axeViolations: { "image-alt": 2 },
      jsOnly: { links: true, content: false, title: false },
    });
  });

  it("keeps no rendered DOM for a page that navigated off-site", () => {
    expect(toRenderFacts(sidecar({ offSite: true }), ROOT).html).toBeNull();
  });

  it("stores nothing for a page that was not rendered", () => {
    expect(renderColumns(FULL())).toEqual({});
  });
});

describe("callSidecarRender", () => {
  it("posts the URL and the crawler's user agent with the internal secret", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", "s3cret");
    const f = vi.fn(async () => new Response(JSON.stringify(sidecar()), { status: 200 }));
    const out = await callSidecarRender("https://example.com/p", f);
    expect(out?.status).toBe(200);
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toMatch(/\/render$/);
    expect((init.headers as Record<string, string>)["X-Internal-Secret"]).toBe("s3cret");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com/p", userAgent: CRAWLER_USER_AGENT });
    vi.unstubAllEnvs();
  });

  it("retries once on 429, then gives up", async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => new Response("{}", { status: 429 }));
    const p = callSidecarRender("https://example.com/p", f);
    await vi.runAllTimersAsync();
    expect(await p).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("returns null when the sidecar is unreachable", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await callSidecarRender("https://example.com/p", f)).toBeNull();
  });
});
