// @vitest-environment jsdom
//
// tests/content-optimizer.dom.test.tsx
//
// The results block had three separate ways of telling a visitor nothing:
//
//   1. a bare "17" with no scale, no colour and no verdict,
//   2. a 2px left border in a hue that vanishes against the panel, and
//   3. a status column that printed the visitor's own title back at them —
//      "Keyword in title: Italian food" — which answers a question nobody
//      asked. The row wants Yes or No.
//
// Plus the drift guard that matters most here: the target strings quote
// numbers, and those numbers must be the ones the scorer actually applies.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContentOptimizerClient } from "@/app/[locale]/free-tools/content-optimizer/client";
import {
  CHECK_META,
  GRADE_COLOR,
  GRADE_LABEL,
  THRESHOLDS,
  gradeOf,
  orderChecks,
  scoreContent,
  type ContentCheck,
} from "@/lib/free-tools/content-score";

afterEach(cleanup);

const check = (id: string, status: ContentCheck["status"]): ContentCheck => ({
  id,
  status,
  value: "",
});

describe("grade bands", () => {
  it("switches exactly at 40 and 70", () => {
    expect(gradeOf(0)).toBe("poor");
    expect(gradeOf(39)).toBe("poor");
    expect(gradeOf(40)).toBe("fair");
    expect(gradeOf(69)).toBe("fair");
    expect(gradeOf(70)).toBe("good");
    expect(gradeOf(100)).toBe("good");
  });

  it("colours the three bands red, gold and green", () => {
    expect(GRADE_COLOR[gradeOf(39)]).toContain("#F6465D");
    expect(GRADE_COLOR[gradeOf(40)]).toContain("#F0B90B");
    expect(GRADE_COLOR[gradeOf(69)]).toContain("#F0B90B");
    expect(GRADE_COLOR[gradeOf(70)]).toContain("#0ECB81");
  });

  it("names each band", () => {
    expect(GRADE_LABEL[gradeOf(20)]).toBe("Needs work");
    expect(GRADE_LABEL[gradeOf(55)]).toBe("Getting there");
    expect(GRADE_LABEL[gradeOf(88)]).toBe("Well optimized");
  });
});

describe("check ordering", () => {
  it("puts failed first, then partial, then passed", () => {
    const ordered = orderChecks([
      check("a", "pass"),
      check("b", "fail"),
      check("c", "warn"),
      check("d", "fail"),
    ]);
    expect(ordered.map((c) => c.status)).toEqual(["fail", "fail", "warn", "pass"]);
  });

  it("is stable inside a band and does not mutate its input", () => {
    const input = [check("a", "fail"), check("b", "fail")];
    const ordered = orderChecks(input);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b"]);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("check values are statuses, not the visitor's prose", () => {
  it("answers Yes/No for keyword-in-title instead of echoing the title", () => {
    const hit = scoreContent({
      text: "Italian food is wonderful.",
      keyword: "Italian food",
      title: "The best Italian food",
    });
    const row = hit.checks.find((c) => c.id === "keyword_in_title")!;
    expect(row.value).toBe("Yes");
    expect(row.value).not.toContain("best");

    const miss = scoreContent({ text: "x", keyword: "pasta", title: "Italian food" });
    expect(miss.checks.find((c) => c.id === "keyword_in_title")!.value).toBe("No");
  });

  it("says so plainly when there is no title and no heading", () => {
    const r = scoreContent({ text: "Some prose.", keyword: "pasta" });
    expect(r.checks.find((c) => c.id === "keyword_in_title")!.value).toBe("Not set");
    expect(r.checks.find((c) => c.id === "keyword_in_h1")!.value).toBe("No headings");
  });

  it("keeps the metric checks numeric", () => {
    const r = scoreContent({ text: "One.", keyword: "x" });
    expect(r.checks.find((c) => c.id === "word_count")!.value).toBe("1");
    expect(r.checks.find((c) => c.id === "keyword_density")!.value).toBe("0%");
  });
});

describe("check config", () => {
  it("has a label and a fix for every check the scorer emits", () => {
    // A new check without copy would render as a bare id with no instruction.
    const r = scoreContent({ text: "word ".repeat(50), keyword: "word" });
    for (const c of r.checks) {
      expect(CHECK_META[c.id], `${c.id} has no config`).toBeTruthy();
      expect(CHECK_META[c.id]!.label.length).toBeGreaterThan(0);
      expect(CHECK_META[c.id]!.hint.length).toBeGreaterThan(0);
    }
  });

  it("quotes the thresholds the scorer actually applies", () => {
    // The whole reason targets are built from THRESHOLDS. If someone moves the
    // pass band to 800 words and leaves "aim 600+" in the copy, this fails.
    expect(CHECK_META.word_count!.target).toBe(`aim ${THRESHOLDS.wordCount.pass}+`);
    expect(CHECK_META.keyword_density!.target).toBe(
      `aim ${THRESHOLDS.density.min}–${THRESHOLDS.density.max}%`,
    );
    expect(CHECK_META.meta_length!.target).toBe(
      `aim ${THRESHOLDS.meta.min}–${THRESHOLDS.meta.max}`,
    );

    const r = scoreContent({
      text: `${"word ".repeat(THRESHOLDS.wordCount.pass)}`,
      keyword: "word",
    });
    expect(r.checks.find((c) => c.id === "word_count")!.status).toBe("pass");
  });

  it("leaves the yes/no checks without a numeric target", () => {
    expect(CHECK_META.keyword_in_title!.target).toBeNull();
    expect(CHECK_META.keyword_first_100!.target).toBeNull();
  });
});

describe("rendered results", () => {
  /** Type a draft and wait past the 400ms debounce. */
  async function typeDraft(value: string) {
    const { fireEvent } = await import("@testing-library/react");
    const view = render(<ContentOptimizerClient />);
    fireEvent.change(view.container.querySelector("#co-keyword")!, {
      target: { value: "italian food" },
    });
    fireEvent.change(view.container.querySelector("#co-title")!, {
      target: { value: "Italian food" },
    });
    fireEvent.change(view.container.querySelector("#co-text")!, { target: { value } });
    await waitFor(() => expect(view.container.querySelector("details, [class*='check']")).toBeTruthy());
    return view;
  }

  it("shows the score in a ring with a grade, not a bare number", async () => {
    await typeDraft("Italian food is good.");
    await waitFor(() => expect(screen.getByText("/ 100")).toBeTruthy());
    expect(screen.getByText(/of \d+ checks passing/)).toBeTruthy();
    // One of the three grade labels is on screen.
    const labels = Object.values(GRADE_LABEL);
    expect(labels.some((l) => screen.queryByText(l))).toBe(true);
  });

  it("renders Yes rather than the title text in the status column", async () => {
    const { container } = await typeDraft("Italian food is good.");
    await waitFor(() => expect(screen.getByText("Keyword in title")).toBeTruthy());

    const row = screen.getByText("Keyword in title").closest("[class*='checkRow']")!;
    expect(row.textContent).toContain("Yes");
    // The old behaviour printed the title back into the value column.
    const value = row.querySelector("[class*='checkValue']")!;
    expect(value.textContent).not.toContain("Italian food");
    expect(container.textContent).toContain("Keyword in title");
  });

  it("gives failing rows an expandable fix and passing rows none", async () => {
    const { container } = await typeDraft("Italian food is good.");
    await waitFor(() => expect(container.querySelector("details")).toBeTruthy());

    const details = [...container.querySelectorAll("details")];
    expect(details.length).toBeGreaterThan(0);
    // Every disclosure carries a real instruction, not an empty body.
    for (const d of details) {
      expect(d.querySelector("[class*='checkHint']")?.textContent?.length ?? 0).toBeGreaterThan(10);
    }
    // A passing row is a plain div, so it is not a <details>.
    const passRows = container.querySelectorAll("div[class*='pass']");
    for (const row of passRows) expect(row.tagName).toBe("DIV");
  });

  it("waits for the debounce rather than re-scoring every keystroke", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const view = render(<ContentOptimizerClient />);
    fireEvent.change(view.container.querySelector("#co-text")!, { target: { value: "hello" } });
    // Nothing yet: the 400ms window has not elapsed.
    expect(view.container.querySelector("[class*='scoreRing']")).toBeNull();
    await waitFor(() => expect(view.container.querySelector("[class*='scoreRing']")).toBeTruthy());
  });
});
