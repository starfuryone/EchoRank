// @vitest-environment jsdom
//
// tests/public-crawl-api-docs.test.tsx — the API-access page documents the
// crawler (Phase 3d-A): every endpoint, each one a real route file; the curl
// walkthrough (start, poll, issues, CSV) reading the key from an environment
// variable, never printing one; the callback check; the four MCP tools; the
// feature table's API row behind crawl.api. en / fr / de-CH.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ACCESS_COPY, MCP_SERVER_COPY } from "@/lib/i18n/dashboard";
import { ApiAccessClient, CRAWL_MCP_TOOLS, CRAWL_WALKTHROUGH } from "@/components/seo-tools/api-access-client";
import { CRAWL_FEATURE_ROWS, featureCells, visibleFeatureRows } from "@/lib/site-crawler/marketing-copy";
import { FLAGS } from "@/lib/flags";
import { hasFeature } from "@/lib/feature-flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { MCP_TOOL_NAMES } from "@/lib/mcp/tools";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const API = join(__dirname, "..", "src", "app", "api", "public", "v1", "crawl");

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ keys: [] }) })),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

describe.each(["en", "fr", "de-CH"] as const)("%s", (l) => {
  const t = API_ACCESS_COPY[l];

  it("lists every crawl endpoint with its description, the walkthrough, the callback check and the MCP tools", async () => {
    await act(async () => root.render(<ApiAccessClient locale={l} />));
    const docs = el.querySelector('[data-testid="crawl-api-docs"]')!;
    expect(el.textContent).toContain(t.crawlTitle);
    const paths = [...docs.querySelectorAll("code")].map((c) => c.textContent ?? "").filter((x) => x.startsWith("GET ") || x.startsWith("POST "));
    expect(paths).toHaveLength(7);
    for (const k of ["crawlStart", "crawlList", "crawlStatus", "crawlIssues", "crawlPages", "crawlExport", "crawlCancel"] as const) {
      expect(docs.textContent).toContain(t.docsEndpoints[k]);
    }
    for (const step of ["start", "poll", "issues", "csv"] as const) {
      const block = docs.querySelector(`[data-walk="${step}"]`)!;
      expect(block.textContent).toContain(t.walkSteps[step]);
      expect(block.querySelector("pre")!.textContent).toBe(CRAWL_WALKTHROUGH[step]);
    }
    expect(docs.textContent).toContain(t.callbackNote);
    const tools = [...docs.querySelectorAll('[data-testid="crawl-mcp-tools"] li')].map((li) => li.textContent);
    expect(tools).toEqual(CRAWL_MCP_TOOLS.map((n) => `${n} — ${MCP_SERVER_COPY[l].toolDescs[n]}`));
    if (l === "de-CH") expect(JSON.stringify(t)).not.toContain("ß");
    expect(t.docsIntro).not.toMatch(/All endpoints are GET|sont en GET|sind GET/);
  });
});

it("every documented path is a real route file, and every tool listed is in the MCP catalog", () => {
  for (const f of ["route.ts", "[id]/route.ts", "[id]/issues/route.ts", "[id]/pages/route.ts", "[id]/export/route.ts", "[id]/cancel/route.ts"]) {
    expect(existsSync(join(API, f)), f).toBe(true);
  }
  for (const n of CRAWL_MCP_TOOLS) expect(MCP_TOOL_NAMES).toContain(n);
});

it("the walkthrough reads the key from $ECHORANK_API_KEY and never prints one", () => {
  const all = Object.values(CRAWL_WALKTHROUGH).join("\n");
  expect(all).not.toMatch(/er_api_[0-9a-f]{8,}/);
  for (const step of ["start", "poll", "issues", "csv"] as const) expect(CRAWL_WALKTHROUGH[step]).toContain("Authorization: Bearer $ECHORANK_API_KEY");
  expect(CRAWL_WALKTHROUGH.start).toContain("Idempotency-Key");
  expect(CRAWL_WALKTHROUGH.csv).toContain("/export?view=issues");
  expect(CRAWL_WALKTHROUGH.callback).toContain("timingSafeEqual");
});

it("the feature table's Command line & API row shows on crawl.api, only on the plans with api_access", () => {
  const r = CRAWL_FEATURE_ROWS.find((x) => x.id === "api")!;
  expect(r.gate).toEqual({ flag: "crawl.api" });
  expect(FLAGS["crawl.api"]).toBe(true);
  const ctx = (on: boolean) => ({ flags: { ...FLAGS, "crawl.api": on }, families: new Set<string>() }) as never;
  expect(visibleFeatureRows(ctx(true)).some((x) => x.id === "api")).toBe(true);
  expect(visibleFeatureRows(ctx(false)).some((x) => x.id === "api")).toBe(false);
  // The keys come with api_access (Agency and Enterprise today): "—" on the others.
  const en = featureCells(r, PLAN_CONFIGS as never, "en");
  for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) expect(en[p], p).toBe(hasFeature(p, "api_access") ? "REST API and MCP" : "—");
  expect(en.AGENCY).toBe("REST API and MCP");
  expect(en.STARTER).toBe("—");
  expect(featureCells(r, PLAN_CONFIGS as never, "fr").AGENCY).toBe("API REST et MCP");
});
