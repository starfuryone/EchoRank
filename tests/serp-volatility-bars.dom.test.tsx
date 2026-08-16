// @vitest-environment jsdom
//
// tests/serp-volatility-bars.dom.test.tsx
//
// A BAR'S WIDTH MUST TRACK ITS VALUE.
//
// The page shipped for months with every bar looking maxed out. The widths were
// never the problem — the component always computed value/10*100 and set it
// inline. The problem was CSS: .barFill is a <span>, width does not apply to a
// non-replaced inline box, and the declaration was silently dropped. All that
// remained was the full-width grey track.
//
// So this file asserts BOTH halves, because either one alone stays green while
// the page is visibly broken:
//   1. the rendered style strings really do differ by value, and
//   2. .barFill is still display:block, which is what makes them take effect.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SerpVolatilityClient } from "@/app/[locale]/free-tools/serp-volatility/client";
import { severityOf, widthPct } from "@/lib/free-tools/volatility-severity";

// Real values from /api/free/v1/serp-volatility, trimmed to three days. 0.68
// and 2.21 are the pair the bug report named.
const PAYLOAD = {
  collecting: false,
  days: [
    { date: "2026-08-12", overall: 2.21, categories: { ecommerce: 2.22, local: 3.2 } },
    { date: "2026-08-15", overall: 1.25, categories: { ecommerce: 1.2, local: 2 } },
    {
      date: "2026-08-16",
      overall: 1.18,
      categories: { ecommerce: 0.97, local: 1.7, finance: 1.33, health: 0.68, tech: 1.22 },
    },
  ],
  latest: {
    date: "2026-08-16",
    overall: 1.18,
    categories: { ecommerce: 0.97, local: 1.7, finance: 1.33, health: 0.68, tech: 1.22 },
  },
};

function mockFetch(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload } as Response),
  );
}

/** Every inline width on a bar fill, in document order. */
function fillWidths(container: HTMLElement): number[] {
  return [...container.querySelectorAll<HTMLElement>("[style*='width']")]
    .map((el) => parseFloat(el.style.width))
    .filter((n) => !Number.isNaN(n));
}

afterEach(() => {
  // Renders accumulate otherwise: this suite has no auto-cleanup, and a second
  // render leaves two copies of the panel in the body, so every query for a
  // score matches twice.
  cleanup();
  vi.unstubAllGlobals();
});

describe("volatility bar widths", () => {
  it("renders a 0.68 bar visibly narrower than a 2.21 bar", async () => {
    mockFetch(PAYLOAD);
    const { container } = render(<SerpVolatilityClient />);
    await waitFor(() => expect(container.querySelector("[style*='width']")).toBeTruthy());

    const widths = fillWidths(container);
    // health 0.68 -> 7%, and the 2026-08-12 history row 2.21 -> 22%.
    expect(widths).toContain(widthPct(0.68));
    expect(widths).toContain(widthPct(2.21));
    expect(widthPct(0.68)).toBeLessThan(widthPct(2.21));
    expect(widthPct(0.68)).toBe(7);
    expect(widthPct(2.21)).toBe(22);
  });

  it("never renders every bar at the same width", async () => {
    // The exact shape of the original bug: five categories, one track width.
    mockFetch(PAYLOAD);
    const { container } = render(<SerpVolatilityClient />);
    await waitFor(() => expect(container.querySelector("[style*='width']")).toBeTruthy());

    const widths = fillWidths(container);
    expect(widths.length).toBeGreaterThan(5);
    expect(new Set(widths).size).toBeGreaterThan(1);
    expect(widths.every((w) => w === 100)).toBe(false);
  });

  it("keeps .barFill display:block so the widths are not dropped", () => {
    // Guards the actual defect. Without this, a future tidy-up that removes
    // display:block re-breaks the page and every assertion above stays green.
    const css = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "free-tools", "_shared", "free-tools.module.css"),
      "utf8",
    );
    const rule = css.match(/\.barFill\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("display: block");
  });
});

describe("volatility severity bands", () => {
  it("maps the documented thresholds", () => {
    expect(severityOf(0)).toBe("calm");
    expect(severityOf(1.99)).toBe("calm");
    expect(severityOf(2)).toBe("elevated");
    expect(severityOf(4.9)).toBe("elevated");
    expect(severityOf(5)).toBe("high");
    expect(severityOf(10)).toBe("high");
  });

  it("labels today's score and shows the delta against the previous day", async () => {
    mockFetch(PAYLOAD);
    render(<SerpVolatilityClient />);
    await waitFor(() => expect(screen.getByText("Calm")).toBeTruthy());
    // 1.18 today vs 1.25 the previous sampled day — down, so ▼ 0.07.
    expect(screen.getByText(/▼\s*0\.07/)).toBeTruthy();
    expect(screen.getByText(/Below 2 means rankings are stable/)).toBeTruthy();
  });
});
