// @vitest-environment jsdom
//
// tests/site-crawler-4d-backlinks.test.tsx — the backlink opt-in on the start
// card: the estimate (N × last unit cost, budget left) on the card and in the
// confirm step, in every dashboard locale.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.psi": true, "crawl.backlinks": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] };
});

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { AddDataSection, backlinkCost, confirmLines } from "@/components/seo-tools/site-crawler-add-data";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const quota = { psiCap: 10, lighthouseUsed: 0, lighthouseLimit: 20, backlinkCap: 50, backlinkUnitUsd: 0.024, seoBudgetLeftUsd: 12.5 };

describe("backlink opt-in", () => {
  it("costs N × the unit cost", () => {
    expect(backlinkCost({ pages: 25, segment: null }, 0.024)).toBeCloseTo(0.6);
    expect(backlinkCost(null, 0.024)).toBe(0);
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: estimate on the card and a line in the confirm step", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4d;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ segments: [] }) })));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const value = { psi: null, backlinks: { pages: 25, segment: null } };
    await act(async () => createRoot(host).render(<AddDataSection t={t} host="x.com" quota={quota} value={value} onChange={() => {}} />));
    expect(host.textContent).toContain(t.blLabel("50"));
    expect(host.textContent).toContain(t.blEstimate("$0.60", "$0.024", "$12.50"));
    expect(confirmLines(t, value, quota)).toEqual([t.confirmBacklinks("25", "$0.60", "$12.50")]);
    host.remove();
    vi.unstubAllGlobals();
  });
});
