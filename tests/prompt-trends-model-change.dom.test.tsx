/**
 * @vitest-environment jsdom
 */
// The "Claude model changed" marker on the prompt-trend sparklines: the history
// API reports the day a Claude answer came from a different model than the run
// before it, and the chart draws a rule there with a visible note beside it.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PromptTrends } from "@/components/visibility/prompt-trends";
import { PROMPT_TRENDS_COPY } from "@/lib/i18n/dashboard";

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function serve(series: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ days: 90, series }), { status: 200 })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("prompt trends: Claude model change marker", () => {
  it("draws a marker on the switch day and names the change", async () => {
    serve([
      {
        promptId: "p1",
        text: "best plumber in Laval",
        active: true,
        points: [
          { d: yesterday, m: true, r: 1 },
          { d: today, m: false, r: null },
        ],
        modelChanges: [{ d: today, from: "claude-haiku-4-5", to: "claude-haiku-5-5" }],
      },
    ]);
    const { container } = render(<PromptTrends locale="en" />);
    expect(await screen.findByText(PROMPT_TRENDS_COPY.en.modelChanged)).toBeTruthy();
    const markers = container.querySelectorAll('[data-testid="model-change-marker"]');
    expect(markers).toHaveLength(1);
    expect(markers[0].textContent).toContain("claude-haiku-4-5 → claude-haiku-5-5");
  });

  it("draws the mention rate's 90% interval as a light band behind the bars", async () => {
    serve([
      {
        promptId: "p1",
        text: "band prompt",
        active: true,
        points: [
          { d: yesterday, m: true, r: 1 },
          { d: today, m: false, r: null },
        ],
        modelChanges: [],
      },
    ]);
    const { container } = render(<PromptTrends locale="en" />);
    await screen.findByText("band prompt");
    const band = container.querySelectorAll('[data-testid="rate-band"]');
    expect(band).toHaveLength(2);
    // One of two runs mentioned: the band spans most of the height.
    expect(Number(band[1].getAttribute("height"))).toBeGreaterThan(14);
    expect(band[1].getAttribute("opacity")).toBe("0.12");
  });

  it("draws nothing for a prompt whose model never changed", async () => {
    serve([
      { promptId: "p1", text: "q", active: true, points: [{ d: today, m: true, r: 2 }], modelChanges: [] },
    ]);
    const { container } = render(<PromptTrends locale="fr" />);
    await screen.findByText("q");
    expect(container.querySelectorAll('[data-testid="model-change-marker"]')).toHaveLength(0);
    expect(screen.queryByText(PROMPT_TRENDS_COPY.fr.modelChanged)).toBeNull();
  });
});
