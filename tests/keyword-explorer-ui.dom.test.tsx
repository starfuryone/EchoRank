// @vitest-environment jsdom
//
// tests/keyword-explorer-ui.dom.test.tsx
//
// The Keyword Explorer refactor, rendered.
//
// The page has no server component worth testing and its data comes from one
// fetch, so this stubs that fetch and drives the real client — which is the
// only way to catch the things tsc cannot: a tab handler that throws, a filter
// that empties the table, a metric computed off the wrong array.
//
// WHAT IT DELIBERATELY PINS is the honesty rules, because those are the ones a
// future edit would break without noticing: no Source column (the payload does
// not carry one), no relevance number on an AI row (the sidecar stamps a flat
// 0.5 there rather than measuring), and metrics that equal the arrays they
// claim to count.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeywordsPageClient } from "@/app/(dashboard)/visibility/keywords/page-client";
import { KEYWORDS_COPY } from "@/lib/i18n/dashboard";

const EN = KEYWORDS_COPY.en;

/** A sidecar response, in the shape keyword_suggest.py actually returns. */
const RESULT = {
  url: "ahrefs.com",
  language: "en",
  seed_keywords: [
    {
      kw: "keyword research",
      score: 1,
      difficulty: "low",
      source: "heuristic",
      fields: { title: 4, body: 3 },
      count: 7,
    },
    {
      kw: "backlink checker",
      score: 0.62,
      difficulty: "medium",
      source: "heuristic",
      fields: { h2: 2, body: 1 },
      count: 3,
    },
    {
      kw: "rank tracking software",
      score: 0.31,
      difficulty: "high",
      source: "heuristic",
      fields: { body: 2 },
      count: 2,
    },
    // An AI row: the model proposed it, nothing weighed it, so score is null
    // and it carries no field origin.
    { kw: "seo audit tool", score: null, difficulty: "low", source: "ai" },
  ],
  serp_features: ["Image Pack", "People Also Ask"],
  question_keywords: [
    {
      kw: "best ahrefs",
      score: 0.9,
      difficulty: "low",
      source: "heuristic",
      fields: { body: 1 },
      count: 1,
    },
  ],
  content_optimization: {
    present_terms: ["seo"],
    missing_terms: ["backlinks"],
    title_suggestion: "",
    meta_suggestion: "",
    flags: ["missing_h1"],
  },
  ai_visibility_prompts: ["which seo tool should I use?"],
  technical: [
    { check: "robots.txt", status: "pass", detail: "found" },
    { check: "canonical", status: "warn", detail: "missing" },
  ],
  meta: { pages_crawled: 5, ai_used: false, elapsed_ms: 1200 },
};

function mockFetch(body: unknown = RESULT, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status === 200, status, json: async () => body })),
  );
}

/** Render, run a scan, and wait for the results to land. */
async function scan() {
  render(<KeywordsPageClient locale="en" />);
  fireEvent.change(screen.getByPlaceholderText(EN.urlPlaceholder), {
    target: { value: "ahrefs.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: EN.analyzeCta }));
  await waitFor(() => expect(screen.getByText("ahrefs.com")).toBeInTheDocument());
}

beforeEach(() => {
  mockFetch();
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("hierarchy", () => {
  it("has exactly one page title, and it is not the old uppercase eyebrow", () => {
    render(<KeywordsPageClient locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: EN.heading })).toBeInTheDocument();
    expect(screen.getByText(EN.headingDescription)).toBeInTheDocument();
    // The competing "Keyword Suggester" treatment is gone.
    expect(screen.queryByText(/keyword suggester/i)).not.toBeInTheDocument();
  });

  it("shows one dominant CTA before a scan, and no AI regenerate button", () => {
    render(<KeywordsPageClient locale="en" />);
    expect(screen.getByRole("button", { name: EN.analyzeCta })).toBeInTheDocument();
    // Regenerate is an overflow action on a result, never a peer of Analyze.
    expect(screen.queryByText(EN.regenerateAi)).not.toBeInTheDocument();
  });
});

describe("the scan card after a result", () => {
  it("collapses to a status line with Scan again, hiding Regenerate in the overflow", async () => {
    await scan();
    expect(screen.getByText(EN.pagesScanned(5))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(EN.scanAgain) })).toBeInTheDocument();

    expect(screen.queryByText(EN.regenerateAi)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: EN.moreActions }));
    expect(screen.getByRole("menuitem", { name: new RegExp(EN.regenerateAi) })).toBeInTheDocument();
  });

  it("says 'pages scanned', never 'crawled'", async () => {
    await scan();
    expect(screen.getByText(EN.pagesScanned(5))).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/pages crawled/i);
  });
});

describe("summary metrics", () => {
  it("counts what is actually in the payload", async () => {
    await scan();
    // Scoped to the <dl>: "Keywords" is also a tab and the table's caption,
    // and a bare text query would happily assert against the wrong one.
    const metrics = document.querySelector("dl")!;
    const valueFor = (label: string) =>
      within(metrics).getByText(label).closest("div")!.querySelector("dd")!.textContent;

    // 4 seeds; 1 question; 3 easy (two low seeds + the question, which the
    // generator always stamps low); 1 technical warn + 1 content flag.
    expect(valueFor(EN.metricKeywords)).toBe("4");
    expect(valueFor(EN.metricQuestions)).toBe("1");
    expect(valueFor(EN.metricEasyWins)).toBe("3");
    expect(valueFor(EN.metricIssues)).toBe("2");
  });
});

describe("the keyword table", () => {
  it("renders the columns the payload supports", async () => {
    // WAS "omits a Source column, because the payload does not carry one".
    // The extraction fix made keyword_suggest.py retain per-field origin
    // instead of summing it away, so the column has data now. The
    // does-it-disappear half of that old claim is asserted below against a
    // pre-fix cached response, which is where it still holds.
    await scan();
    expect(screen.getByRole("columnheader", { name: EN.colKeyword })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: EN.colRelevance })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: EN.colSource })).toBeInTheDocument();
  });

  it("shows a measured relevance for heuristic rows and a dash for unscored ones", async () => {
    await scan();
    // score: null — not a fabricated number the customer could sort by.
    const aiRow = screen.getByText("seo audit tool").closest("tr")!;
    expect(within(aiRow).getAllByText(EN.relevanceNa).length).toBeGreaterThan(0);

    const realRow = screen.getByText("backlink checker").closest("tr")!;
    expect(within(realRow).getByText("62")).toBeInTheDocument();
  });

  it("renders the Source column from field origin, by prominence not by weight", async () => {
    await scan();
    expect(screen.getByRole("columnheader", { name: EN.colSource })).toBeInTheDocument();
    // title 4 + body 3: body has more accumulated weight, but "Title" is the
    // useful answer and is what the priority order picks.
    const row = screen.getByText("keyword research").closest("tr")!;
    expect(within(row).getByText(EN.fieldLabels.title)).toBeInTheDocument();
    // h2 beats body on the same rule.
    const second = screen.getByText("backlink checker").closest("tr")!;
    expect(within(second).getByText(EN.fieldLabels.h2)).toBeInTheDocument();
  });

  it("omits the Source column entirely for a pre-fix cached response", async () => {
    // THE VERSION-TOLERANCE CASE. A response cached before the extraction fix
    // has no `fields` anywhere; the column vanishes rather than rendering a
    // stripe of blanks that reads as missing data.
    const legacy = {
      ...RESULT,
      serp_features: undefined,
      seed_keywords: RESULT.seed_keywords.map(({ kw, score, difficulty, source }) => ({
        kw,
        // The old pipeline stamped AI rows 0.5; that is a number and still
        // renders as one, because it is what the customer was already shown.
        score: source === "ai" ? 0.5 : score,
        difficulty,
        source,
      })),
      question_keywords: RESULT.question_keywords.map(({ kw, score, difficulty, source }) => ({
        kw,
        score,
        difficulty,
        source,
      })),
    };
    mockFetch(legacy);
    await scan();
    expect(screen.queryByRole("columnheader", { name: EN.colSource })).not.toBeInTheDocument();
    // And it still renders the rest of the table.
    expect(screen.getByText("keyword research")).toBeInTheDocument();
    const aiRow = screen.getByText("seo audit tool").closest("tr")!;
    expect(within(aiRow).getByText("50")).toBeInTheDocument();
  });

  it("labels difficulty in words, not by colour alone", async () => {
    await scan();
    const row = screen.getByText("rank tracking software").closest("tr")!;
    expect(within(row).getByText(EN.diffLabels.high)).toBeInTheDocument();
  });

  it("replaces the bordered per-row Copy button with a labelled icon", async () => {
    await scan();
    expect(screen.queryByRole("button", { name: EN.copy })).not.toBeInTheDocument();
    const copy = screen.getByRole("button", { name: `${EN.copyKeyword}: keyword research` });
    fireEvent.click(copy);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("keyword research");
  });
});

describe("grouping and bulk actions", () => {
  it("makes Questions a first-class filter", async () => {
    await scan();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(EN.filterQuestions) }));
    expect(screen.getByText("best ahrefs")).toBeInTheDocument();
    expect(screen.queryByText("keyword research")).not.toBeInTheDocument();
  });

  it("selects rows and copies the selection", async () => {
    await scan();
    fireEvent.click(screen.getByRole("checkbox", { name: EN.selectRow("keyword research") }));
    expect(screen.getByText(EN.selectedCount(1))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: EN.selectAll }));
    expect(screen.getByText(EN.selectedCount(5))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(EN.copySelected) }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("filters by search text and offers a way back out of an empty result", async () => {
    await scan();
    fireEvent.change(screen.getByLabelText(EN.searchPlaceholder), {
      target: { value: "zzzz-no-match" },
    });
    expect(screen.getByText(EN.noMatches)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: EN.clearFilters }));
    expect(screen.getByText("keyword research")).toBeInTheDocument();
  });
});

describe("workflow actions", () => {
  it("points Track in AI Visibility at the real prompt-tracking route, seeded", async () => {
    await scan();
    const link = screen.getByRole("link", {
      name: `${EN.trackInAiVisibility}: keyword research`,
    });
    // The route exists and the keyword travels with it — not a dead end.
    expect(link).toHaveAttribute(
      "href",
      "/visibility/tools/custom-prompts?prompt=keyword%20research",
    );
  });
});

describe("tabs", () => {
  it("carries counts and moves under arrow keys", async () => {
    await scan();
    const keywords = screen.getByRole("tab", { name: new RegExp(EN.tabSeeds) });
    expect(keywords).toHaveAttribute("aria-selected", "true");
    expect(within(keywords).getByText("5")).toBeInTheDocument();

    fireEvent.keyDown(keywords.closest('[role="tablist"]')!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: new RegExp(EN.tabContent) })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
