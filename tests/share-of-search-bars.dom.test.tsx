// @vitest-environment jsdom
//
// tests/share-of-search-bars.dom.test.tsx
//
// The results block has to answer "who leads" at a glance, which means three
// things that are easy to break independently:
//
//   1. the fills are proportional and DIFFERENT (the shared .barFill defect
//      made every bar look identical here too — same classes, same bug),
//   2. the biggest brand is first and carries the leader chip, whatever order
//      the API answered in, and
//   3. each brand gets its own colour, so two bars are never confusable.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareOfSearchClient } from "@/app/[locale]/free-tools/share-of-search/client";

// Deliberately NOT in share order: the API echoes the order the visitor typed,
// so adidas-first is the realistic payload for someone who typed adidas first.
const PAYLOAD = {
  brands: [
    { brand: "adidas", volume: 301_000, share: 40.1, monthly: null },
    { brand: "nike", volume: 449_000, share: 59.9, monthly: null },
  ],
};

function mockFetch(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload } as Response),
  );
}

/** Render, submit the form, and wait for the bars. */
async function runTool(payload: unknown) {
  mockFetch(payload);
  const view = render(<ShareOfSearchClient />);
  const [first, second] = [...view.container.querySelectorAll("input")];
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(first!, { target: { value: "adidas" } });
  fireEvent.change(second!, { target: { value: "nike" } });
  fireEvent.click(screen.getByText("Compare"));
  await waitFor(() => expect(view.container.querySelector("[style*='width']")).toBeTruthy());
  return view;
}

function fills(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[style*='width']")];
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("share of search results", () => {
  it("sizes each fill to its own share, not to the full track", async () => {
    const { container } = await runTool(PAYLOAD);
    const widths = fills(container).map((el) => el.style.width);

    expect(widths).toEqual(["59.9%", "40.1%"]);
    expect(new Set(widths).size).toBe(2);
    expect(widths.every((w) => w === "100%")).toBe(false);
  });

  it("puts the biggest brand first even though the API answered adidas first", async () => {
    const { container } = await runTool(PAYLOAD);
    const names = [...container.querySelectorAll("[class*='sosBrand']")].map((el) =>
      el.textContent?.trim(),
    );
    expect(names[0]).toBe("nike");
    expect(names[1]).toBe("adidas");
  });

  it("chips only the leader", async () => {
    await runTool(PAYLOAD);
    expect(screen.getAllByText("Leads the category")).toHaveLength(1);
  });

  it("shows each brand's absolute volume alongside the share", async () => {
    await runTool(PAYLOAD);
    // Locale-formatted, so match on the digits rather than the separator.
    expect(screen.getByText(/449[,\s.]?000\/mo/)).toBeTruthy();
    expect(screen.getByText(/301[,\s.]?000\/mo/)).toBeTruthy();
  });

  it("gives the two brands different fill classes", async () => {
    const { container } = await runTool(PAYLOAD);
    const classes = fills(container).map((el) => el.className);
    expect(classes[0]).not.toBe(classes[1]);
  });
});

describe("brand palette", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "app", "[locale]", "free-tools", "_shared", "free-tools.module.css"),
    "utf8",
  );

  it("defines one distinct fill per brand slot, up to MAX_BRANDS", () => {
    const backgrounds = [1, 2, 3, 4, 5].map(
      (n) => css.match(new RegExp(`\\.brandFill${n}\\s*\\{([^}]*)\\}`))?.[1]?.trim() ?? "",
    );
    expect(backgrounds.every(Boolean)).toBe(true);
    expect(new Set(backgrounds).size).toBe(5);
  });

  it("declares the brand fills after .barFill so they actually win", () => {
    // Equal specificity — source order is the only thing deciding this, and a
    // tidy-up that hoists the palette above .barFill would silently grey every
    // bar back out.
    expect(css.indexOf(".brandFill1")).toBeGreaterThan(css.indexOf(".barFill {"));
  });

  it("gives the leader the gold", () => {
    const leader = css.match(/\.brandFill1\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(leader).toContain("#F0B90B");
  });
});
