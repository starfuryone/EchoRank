// @vitest-environment jsdom
//
// tests/backlinks-overview-cards.dom.test.tsx
//
// The Backlinks overview cards — the block that sits at the top of the results
// on BOTH tiers.
//
// ── WHY THIS IS A DOM TEST AND NOT A CONFIG ONE ───────────────────────────
// Two of the three things worth pinning here are only true of the rendered
// output: that the new/lost card DISAPPEARS when there is no history to
// report, and that every card's badge carries the same blue as the scope chip
// in the form above it. Neither is visible from the catalog or the config.
//
// The third is that there is ONE component. `BacklinksOverviewCards` is
// rendered by the results view for every tier, with no capability branch — the
// data it reads (summary, history) is fetched on every tier, so there is
// nothing to gate. A fork reintroduced later would have to delete this file to
// pass, which is the point.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BacklinksOverviewCards } from "@/components/seo-tools/backlinks-client";
import { BACKLINKS_TOOL_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import type { HistorySection, SummarySection } from "@/lib/backlinks/types";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];

// vitest runs with `globals` off, so RTL does not register its own afterEach
// and nothing unmounts between tests. Without this, `screen` accumulates every
// render in the file and the "card is omitted" assertions below pass or fail
// on a tree from three tests ago.
afterEach(cleanup);

const int = new Intl.NumberFormat("en-US");
const dec = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function summary(overrides: Partial<SummarySection> = {}): SummarySection {
  return {
    backlinks: 12_400,
    referringDomains: 860,
    referringMainDomains: 800,
    rank: 412,
    brokenBacklinks: 37,
    dofollowDomains: 640,
    nofollowDomains: 220,
    dofollowRatio: 0.744,
    spamScore: 8,
    ...overrides,
  };
}

function history(): HistorySection {
  return {
    points: [
      { month: "2026-07", backlinks: 12_000, referringDomains: 840, newBacklinks: 90, lostBacklinks: 30 },
      { month: "2026-08", backlinks: 12_400, referringDomains: 860, newBacklinks: 155, lostBacklinks: 41 },
    ],
  };
}

/**
 * A card's label by its badge, not by its text.
 *
 * The label lives in a <span> inside a <dt> that contains nothing else, so a
 * bare text query matches BOTH and throws "found multiple elements". Scoping to
 * the span is also the more honest assertion: what is being checked is that the
 * label rendered AS A BADGE.
 */
function badge(text: string): HTMLElement {
  return screen.getByText(text, { selector: "dt > span" });
}

function noBadge(text: string): HTMLElement | null {
  return screen.queryByText(text, { selector: "dt > span" });
}

function renderCards(opts: { history: HistorySection | null; locale?: DashLocale }) {
  const locale = opts.locale ?? "en";
  return render(
    <BacklinksOverviewCards
      summary={summary()}
      history={opts.history}
      t={BACKLINKS_TOOL_COPY[locale]}
      int={int}
      dec={dec}
    />,
  );
}

// ─── The requested card set ─────────────────────────────────────────────────

describe("the overview card set", () => {
  it("renders every headline figure", () => {
    renderCards({ history: history() });
    const t = BACKLINKS_TOOL_COPY.en;

    expect(badge(t.metricBacklinks)).toBeTruthy();
    expect(screen.getByText("12,400")).toBeTruthy();
    expect(badge(t.metricReferringDomains)).toBeTruthy();
    expect(screen.getByText("860")).toBeTruthy();
    expect(badge(t.metricRank)).toBeTruthy();
    expect(screen.getByText("412")).toBeTruthy();
  });

  it("shows the dofollow/nofollow SPLIT, not just the dofollow half", () => {
    // Both figures are reported on the same base — referring domains — which is
    // the only pairing that means anything. Showing one alone leaves the reader
    // to assume the remainder, and the remainder is not what they would guess.
    renderCards({ history: history() });
    expect(badge(BACKLINKS_TOOL_COPY.en.metricFollowSplit)).toBeTruthy();
    expect(screen.getByText("640 / 220")).toBeTruthy();
  });

  it("shows new-vs-lost for the NEWEST reported month, with the month on the card", () => {
    renderCards({ history: history() });
    expect(badge(BACKLINKS_TOOL_COPY.en.metricNewLost)).toBeTruthy();
    // The latest point (2026-08), not the first and not a sum of both.
    expect(screen.getByText("+155 / −41")).toBeTruthy();
    expect(screen.getByText("2026-08")).toBeTruthy();
  });

  it("OMITS new-vs-lost when there is no history at all", () => {
    // Page- and path-scoped analyses have no monthly growth series. Rendering
    // "+0 / −0" there would be a claim about a month nobody measured — the
    // same null-is-not-zero rule the rest of this tool follows.
    renderCards({ history: null });
    expect(noBadge(BACKLINKS_TOOL_COPY.en.metricNewLost)).toBeNull();
    // ...and the rest of the cards are unaffected.
    expect(badge(BACKLINKS_TOOL_COPY.en.metricBacklinks)).toBeTruthy();
  });

  it("omits it for an empty points array too, not just a null section", () => {
    renderCards({ history: { points: [] } });
    expect(noBadge(BACKLINKS_TOOL_COPY.en.metricNewLost)).toBeNull();
  });
});

// ─── The badge ──────────────────────────────────────────────────────────────

describe("the badge", () => {
  it("puts white text on the scope chip's blue, on EVERY card", () => {
    // bg-blue-600 is the active "Whole domain" chip's blue in the form above.
    // Read from there rather than chosen here: they are the same "this is the
    // primary thing" blue on one page, and a second hex would drift the moment
    // either is touched.
    const { container } = renderCards({ history: history() });
    const badges = container.querySelectorAll("dt > span");
    // Six always-on cards plus new/lost.
    expect(badges).toHaveLength(7);
    for (const badge of badges) {
      const className = badge.getAttribute("class") ?? "";
      expect(className).toContain("bg-blue-600");
      expect(className).toContain("text-white");
      expect(className).toContain("rounded-full");
    }
  });

  it("gives every card a badge, and no card two", () => {
    // Consistency is the requirement: a badge driven by something optional — a
    // delta, a unit — would be present on some cards and absent on others,
    // which reads as a rendering bug rather than a design.
    const { container } = renderCards({ history: history() });
    const cards = container.querySelectorAll("dl > div");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.querySelectorAll("dt > span")).toHaveLength(1);
    }
  });
});

// ─── Copy ───────────────────────────────────────────────────────────────────

describe("copy", () => {
  it("labels every card in all three catalogs", () => {
    for (const locale of LOCALES) {
      const t = BACKLINKS_TOOL_COPY[locale];
      for (const key of [
        "metricBacklinks",
        "metricReferringDomains",
        "metricRank",
        "metricFollowSplit",
        "metricBroken",
        "metricSpam",
        "metricNewLost",
      ] as const) {
        expect(t[key]?.length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("renders in the caller's locale rather than defaulting to English", () => {
    renderCards({ history: history(), locale: "fr" });
    expect(badge(BACKLINKS_TOOL_COPY.fr.metricNewLost)).toBeTruthy();
  });

  it("states the reuse window and quotes no price", () => {
    for (const locale of LOCALES) {
      const hint = BACKLINKS_TOOL_COPY[locale].costHint;
      // A plain string now, not a function of a dollar figure: a price in the
      // UI is a number nothing meters from and everyone has to remember to
      // update.
      expect(typeof hint, locale).toBe("string");
      expect(hint, locale).toContain("7");
      expect(hint, locale).not.toContain("$");
    }
  });

  it("de-CH uses ss, never sz", () => {
    const t = BACKLINKS_TOOL_COPY["de-CH"];
    for (const line of [t.costHint, t.metricFollowSplit, t.metricNewLost]) {
      expect(line).not.toContain("ß");
    }
  });
});
