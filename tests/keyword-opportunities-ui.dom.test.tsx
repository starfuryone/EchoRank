// @vitest-environment jsdom
//
// tests/keyword-opportunities-ui.dom.test.tsx
//
// Walking the Keyword Opportunity Finder end to end, in the real components.
//
// This is the check the tool page cannot get from a config test: that the seven
// states actually render, that the table sorts, that clicking a row opens the
// panel with the right numbers in it, and that the copy rules hold in every
// locale rather than only in the catalog the author was looking at.
//
// ── THE COPY RULES, ASSERTED RATHER THAN REVIEWED ──────────────────────────
//
//   THE UNIT IS A "DOMAIN ANALYSIS". The rendered output is grepped for the
//   word "search" used as a unit of work, in all three locales. `seoSearches`
//   already means something else in this codebase and the two must not be
//   spoken of in the same words.
//
//   NO GOOGLE ENDORSEMENT. Google may be named as the surface a rank is
//   measured on and nowhere else — no "powered by", no "official", no partner
//   language.
//
//   NO HARDCODED ENGLISH. The page is rendered in French and in de-CH and
//   checked for the English strings a copy-paste would leave behind.
//
//   ANSWER SNAPSHOTS ARE TEXT. The file is grepped for
//   dangerouslySetInnerHTML — the snapshot is another vendor's model output and
//   is untrusted input.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KeywordOpportunitiesClient } from "@/components/seo-tools/keyword-opportunities-client";
import { demoPageData } from "@/lib/keyword-opportunity/fixtures";
import { KEYWORD_OPPORTUNITY_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
const EN = KEYWORD_OPPORTUNITY_COPY.en;

const CLIENT_FILE = join(
  process.cwd(),
  "src",
  "components",
  "seo-tools",
  "keyword-opportunities-client.tsx",
);

afterEach(cleanup);

function renderState(state: Parameters<typeof demoPageData>[0], locale: DashLocale = "en") {
  return render(
    <KeywordOpportunitiesClient locale={locale} data={demoPageData(state)} preview />,
  );
}

describe("the states all render", () => {
  it("shows the results table, with the domain and the allowance on the run bar", () => {
    renderState("results");
    expect(screen.getByText("acmecrm.com")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 domain analyses left this month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EN.runCta })).toBeEnabled();
    expect(screen.getByRole("table", { name: EN.sortedByScore })).toBeInTheDocument();
  });

  it("shows the empty state with no analysis", () => {
    renderState("empty");
    expect(screen.getByText(EN.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the queued state", () => {
    renderState("queued");
    expect(screen.getByText(EN.queuedTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EN.runCta })).toBeDisabled();
  });

  it("shows the running state with all five steps, in order", () => {
    renderState("running");
    expect(screen.getByText("Analysing acmecrm.com")).toBeInTheDocument();
    const steps = screen.getByRole("list");
    const labels = within(steps)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(labels).toEqual([
      EN.stepDiscover,
      EN.stepDemand,
      EN.stepRankings,
      EN.stepAi,
      EN.stepScore,
    ]);
  });

  it("shows the error state and offers a retry, without blaming the customer", () => {
    renderState("error");
    expect(screen.getByText(EN.errorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EN.errorCta })).toBeInTheDocument();
    // The one thing a customer needs to know about a failed run.
    expect(screen.getByText(EN.errorBody)).toBeInTheDocument();
  });

  it("shows the insufficient-allowance state and disables the CTA", () => {
    renderState("denied");
    expect(screen.getByText(EN.allowanceNoneTitle)).toBeInTheDocument();
    expect(screen.getByText("0 of 5 domain analyses left this month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EN.runCta })).toBeDisabled();
    // The previous result is still on screen — being at the ceiling does not
    // take away what the tenant already paid for.
    expect(screen.getByRole("table", { name: EN.sortedByScore })).toBeInTheDocument();
  });

  it("says a cache hit is free, and does not spend the allowance to say it", () => {
    renderState("cached");
    expect(screen.getByText(EN.cacheNotice)).toBeInTheDocument();
    expect(screen.getByText("3 of 5 domain analyses left this month")).toBeInTheDocument();
  });
});

describe("the results table", () => {
  it("is sorted by opportunity score descending by default", () => {
    renderState("results");
    const rows = screen.getAllByRole("row").slice(1); // drop the header
    const scores = rows.map((row) => {
      const cells = within(row).getAllByRole("cell");
      return Number.parseInt(cells[6].textContent ?? "", 10);
    });
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(scores[0]).toBe(92);
  });

  it("re-sorts on a header click and reports the direction to assistive tech", () => {
    renderState("results");
    const volumeHeader = screen.getByRole("columnheader", { name: /Volume/ });
    expect(volumeHeader).toHaveAttribute("aria-sort", "none");

    fireEvent.click(within(volumeHeader).getByRole("button"));
    expect(volumeHeader).toHaveAttribute("aria-sort", "descending");

    const firstRow = screen.getAllByRole("row")[1];
    // 49.5K — "what is a CRM", the largest volume in the fixture.
    expect(within(firstRow).getAllByRole("cell")[0].textContent).toBe(
      "what is a CRM",
    );

    fireEvent.click(within(volumeHeader).getByRole("button"));
    expect(volumeHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts untracked ranks last rather than treating them as rank zero", () => {
    renderState("results");
    const rankHeader = screen.getByRole("columnheader", { name: /Google rank/ });
    fireEvent.click(within(rankHeader).getByRole("button")); // desc
    fireEvent.click(within(rankHeader).getByRole("button")); // asc

    const rows = screen.getAllByRole("row").slice(1);
    const ranks = rows.map((row) => within(row).getAllByRole("cell")[4].textContent);
    expect(ranks[0]).toBe("1");
    expect(ranks.at(-1)).toBe(EN.rankUntracked);
  });

  it("renders the three AI states distinctly", () => {
    renderState("results");
    expect(screen.getAllByText(EN.aiNotMentioned).length).toBeGreaterThan(0);
    expect(screen.getAllByText(EN.aiNotTested).length).toBe(10);
    expect(screen.getByText(EN.aiMentionedUnranked)).toBeInTheDocument();
  });

  it("carries the methodology note on the results view, not behind a link", () => {
    renderState("results");
    expect(screen.getByText(EN.methodologyTitle)).toBeInTheDocument();
    expect(screen.getByText(EN.methodologyBody)).toBeInTheDocument();
  });
});

describe("the detail panel", () => {
  function openRow(keyword: string) {
    renderState("results");
    fireEvent.click(screen.getByRole("button", { name: keyword }));
  }

  it("opens on a row click with the score, severity and its explanation", () => {
    openRow("best CRM for startups");
    expect(screen.getByRole("heading", { name: "best CRM for startups" })).toBeInTheDocument();
    expect(screen.getByText("High · 75")).toBeInTheDocument();
    expect(screen.getByText(EN.severityHighExplain)).toBeInTheDocument();
  });

  it("reads sensibly on a MEDIUM row at the bottom of the band", () => {
    // Lowering the MEDIUM floor to 60 pulled untested keywords into the band.
    // "CRM software reviews" scores 61 and was never AI-tested, so the panel
    // must not tell the customer the assistant already names them here.
    openRow("CRM software reviews");
    expect(screen.getByText("Medium · 61")).toBeInTheDocument();
    expect(screen.getByText(EN.severityMediumExplain)).toBeInTheDocument();
    expect(screen.getByText(EN.componentNotMeasured)).toBeInTheDocument();
  });

  it("breaks the score down per component, with weights and provenance", () => {
    openRow("best CRM for startups");
    expect(screen.getByText(EN.detailBreakdown)).toBeInTheDocument();
    for (const label of [
      EN.componentVolume,
      EN.componentCpc,
      EN.componentTrend,
      EN.componentIntent,
      EN.componentSeoGap,
      EN.componentAiGap,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Volume and CPC are the provider's figures; the other four are ours.
    expect(screen.getAllByText(EN.sourceProvider)).toHaveLength(2);
    expect(screen.getAllByText(EN.sourceEchorank)).toHaveLength(4);
  });

  it("lists the rivals that this keyword's own answer named", () => {
    openRow("best CRM for startups");
    expect(screen.getByText(EN.detailCompetitors)).toBeInTheDocument();
    for (const rival of ["HubSpot", "Pipedrive", "Close"]) {
      expect(screen.getByText(rival)).toBeInTheDocument();
    }
  });

  it("shows the generated prompt and the answer, and the prompt never names the brand", () => {
    openRow("best CRM for startups");
    expect(screen.getByText(EN.detailPrompt)).toBeInTheDocument();
    const prompt = screen.getByText(/we're a 12-person startup/);
    expect(prompt.textContent).not.toMatch(/acme/i);
    expect(screen.getByText(EN.detailAnswer)).toBeInTheDocument();
  });

  it("lists the recommended actions, ending with the re-run", () => {
    openRow("best CRM for startups");
    expect(screen.getByText(EN.detailActions)).toBeInTheDocument();
    // Rank 16 is inside the top 20, so there IS a page to improve and the
    // "publish a page" action is deliberately absent. The rest apply.
    expect(screen.queryByText(EN.actionLandingPage)).not.toBeInTheDocument();
    expect(screen.getByText(EN.actionCompetitorComparison)).toBeInTheDocument();
    expect(screen.getByText(EN.actionPricingProof)).toBeInTheDocument();
    expect(screen.getByText(EN.actionExternalCitations)).toBeInTheDocument();
    expect(screen.getByText(EN.actionRerun)).toBeInTheDocument();
  });

  it("offers a landing page when there is no rank worth defending", () => {
    openRow("HubSpot alternatives"); // rank null
    expect(screen.getByText(EN.actionLandingPage)).toBeInTheDocument();
  });

  it("carries the bridge into the Watcher", () => {
    openRow("best CRM for startups");
    const bridge = screen.getByRole("link", { name: new RegExp(EN.watcherBridgeCta) });
    expect(bridge).toHaveAttribute("href", "/visibility/tools/custom-prompts");
  });

  it("explains itself on a keyword that was never AI-tested, instead of showing a zero", () => {
    openRow("why is my CRM so slow");
    expect(screen.getByText(EN.componentNotMeasured)).toBeInTheDocument();
    expect(screen.getByText(EN.aiNotTestedHint)).toBeInTheDocument();
    // Nothing was bought, so there is no question and no answer to show.
    expect(screen.queryByText(EN.detailAnswer)).not.toBeInTheDocument();
  });

  it("closes on the close button and on Escape", () => {
    openRow("best CRM for startups");
    fireEvent.click(screen.getByRole("button", { name: EN.closePanel }));
    expect(screen.queryByText(EN.detailBreakdown)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "best CRM for startups" }));
    expect(screen.getByText(EN.detailBreakdown)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(EN.detailBreakdown)).not.toBeInTheDocument();
  });
});

describe("running a domain analysis from the empty state", () => {
  it("moves to the progress view with the first step in flight", () => {
    renderState("empty");
    expect(screen.getByText(EN.emptyTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: EN.runCta }));

    expect(screen.getByText("Analysing acmecrm.com")).toBeInTheDocument();
    expect(screen.getByText(EN.progressBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EN.runningCta })).toBeDisabled();
    expect(screen.queryByText(EN.emptyTitle)).not.toBeInTheDocument();
  });
});

describe("copy rules", () => {
  it.each(LOCALES)("never calls the unit a search (%s)", (locale) => {
    renderState("results", locale);
    const text = document.body.textContent ?? "";
    // "search demand", "search volume" and "search history" describe the
    // METRIC and are fine. What is banned is the unit of work.
    expect(text).not.toMatch(/\d+\s+(of\s+\d+\s+)?searches/i);
    expect(text).not.toMatch(/recherches? restantes?/i);
    expect(text).not.toMatch(/\d+\s+Suchen/);
  });

  it.each(LOCALES)("names Google only as the surface a rank sits on (%s)", (locale) => {
    renderState("results", locale);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/powered by google/i);
    expect(text).not.toMatch(/official(ly)? (google|partner)/i);
    expect(text).not.toMatch(/google (partner|certified|approved)/i);
  });

  it.each(LOCALES)("calls the unit a domain analysis (%s)", (locale) => {
    renderState("results", locale);
    const text = (document.body.textContent ?? "").toLowerCase();
    const unit = { en: "domain analys", fr: "analyse de domaine", "de-CH": "domain-analyse" }[
      locale
    ];
    expect(text).toContain(unit.toLowerCase());
  });

  it("leaks no English into the French or de-CH views", () => {
    for (const locale of ["fr", "de-CH"] as const) {
      cleanup();
      renderState("results", locale);
      const text = document.body.textContent ?? "";
      for (const english of [
        EN.runCta,
        EN.colRank,
        EN.aiNotTested,
        EN.methodologyTitle,
        EN.sortedByScore,
      ]) {
        expect(text, `${locale} leaked: ${english}`).not.toContain(english);
      }
    }
  });

  it("states that the provider metrics are directional estimates", () => {
    renderState("results");
    expect(EN.methodologyBody).toMatch(/directional estimates/i);
    expect(EN.methodologyBody).toMatch(/not measured traffic/i);
  });

  it("renders answer snapshots as text, never as markup", () => {
    // The ATTRIBUTE, not the word. The file's header names the API in order to
    // ban it, and a bare substring test would fail on the prohibition itself —
    // the same trap CLAUDE.md documents for the brand-casing guards.
    const source = readFileSync(CLIENT_FILE, "utf8");
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=/);
    expect(source).not.toMatch(/__html/);
  });

  it("spells the brand the one legal way in the new copy", () => {
    for (const locale of LOCALES) {
      const copy = JSON.stringify(KEYWORD_OPPORTUNITY_COPY[locale]);
      const offenders = (copy.match(/echo[\s-]*rank/gi) ?? []).filter(
        (match) => !["Echorank", "ECHORANK", "echorank"].includes(match),
      );
      expect(offenders, locale).toEqual([]);
    }
  });
});

describe("a completed analysis with nothing in it", () => {
  // THE BUG: the results block needs rows.length > 0 and the empty block
  // needed analysis === null, so this state fell between them and rendered a
  // blank page — for what is the ordinary outcome on a young domain.
  it("renders the finding rather than a blank page", () => {
    renderState("branded_empty");
    expect(screen.getByText(EN.noResultsBrandedTitle)).toBeInTheDocument();
    expect(
      screen.getByText(/We found 214 keywords for this domain, and 214 of them were your own brand/),
    ).toBeInTheDocument();
    expect(screen.getByText(EN.noResultsNextSteps)).toBeInTheDocument();
  });

  it("does not render it as an error", () => {
    renderState("branded_empty");
    expect(screen.queryByText(EN.errorTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("still offers another run, since the answer can change", () => {
    renderState("branded_empty");
    expect(screen.getByRole("button", { name: EN.runCta })).toBeEnabled();
  });
});
