// Word-level diff.
import { describe, it, expect } from "vitest";
import { tokenize, wordDiff } from "@/lib/historical/diff";

const text = (d: { tokens: Array<{ op: string; text: string }> }, op: string) =>
  d.tokens.filter((t) => t.op === op).map((t) => t.text).join("");

describe("tokenize", () => {
  it("keeps words and the whitespace between them", () => {
    expect(tokenize("a  b\nc")).toEqual(["a", "  ", "b", "\n", "c"]);
  });

  it("round-trips exactly", () => {
    const s = "# Title\n\nSome  text.\n- one\n";
    expect(tokenize(s).join("")).toBe(s);
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("wordDiff", () => {
  it("reports nothing changed for identical text", () => {
    const d = wordDiff("the quick brown fox", "the quick brown fox");
    expect(d.addedWords).toBe(0);
    expect(d.removedWords).toBe(0);
    expect(d.unchangedWords).toBe(4);
    expect(d.tokens.every((t) => t.op === "equal")).toBe(true);
  });

  it("finds a single replaced word and leaves the rest equal", () => {
    const d = wordDiff("the quick brown fox", "the quick red fox");
    expect(d.addedWords).toBe(1);
    expect(d.removedWords).toBe(1);
    expect(d.unchangedWords).toBe(3);
    expect(text(d, "removed")).toContain("brown");
    expect(text(d, "added")).toContain("red");
  });

  it("finds an insertion", () => {
    const d = wordDiff("we ship fast", "we ship very fast");
    expect(d.addedWords).toBe(1);
    expect(d.removedWords).toBe(0);
    expect(text(d, "added")).toContain("very");
  });

  it("finds a deletion", () => {
    const d = wordDiff("we ship very fast", "we ship fast");
    expect(d.removedWords).toBe(1);
    expect(d.addedWords).toBe(0);
    expect(text(d, "removed")).toContain("very");
  });

  it("treats an empty before as all-added", () => {
    const d = wordDiff("", "brand new page");
    expect(d.addedWords).toBe(3);
    expect(d.removedWords).toBe(0);
  });

  it("treats an empty after as all-removed", () => {
    const d = wordDiff("page was here", "");
    expect(d.removedWords).toBe(3);
    expect(d.addedWords).toBe(0);
  });

  it("preserves the full new text in order", () => {
    const before = "# Pricing\n\nStarter is $29 per month.";
    const after = "# Pricing\n\nStarter is $39 per month.";
    const d = wordDiff(before, after);
    const rebuiltAfter = d.tokens.filter((t) => t.op !== "removed").map((t) => t.text).join("");
    const rebuiltBefore = d.tokens.filter((t) => t.op !== "added").map((t) => t.text).join("");
    expect(rebuiltAfter).toBe(after);
    expect(rebuiltBefore).toBe(before);
  });

  it("coalesces a run of same-op tokens into one span", () => {
    // Three words plus their spaces = 5 tokens, emitted as ONE added span.
    const d = wordDiff("", "one two three");
    expect(d.tokens).toHaveLength(1);
    expect(d.tokens[0].op).toBe("added");
    expect(d.tokens[0].text).toBe("one two three");
  });

  it("keeps shared whitespace equal, which fragments a total rewrite", () => {
    // Not a defect: the spaces genuinely match, and matching them is what
    // preserves the original spacing when the diff is rendered. A rewrite of
    // every word therefore alternates removed/equal/added rather than
    // collapsing to two spans.
    const d = wordDiff("a b c d e", "x y z");
    expect(d.removedWords).toBe(5);
    expect(d.addedWords).toBe(3);
    expect(d.tokens.filter((t) => t.op === "equal").every((t) => t.text.trim() === "")).toBe(true);
  });

  it("does not count whitespace as a word", () => {
    const d = wordDiff("one two", "one    two");
    expect(d.addedWords).toBe(0);
    expect(d.removedWords).toBe(0);
    expect(d.unchangedWords).toBe(2);
  });

  it("falls back rather than hanging on very large inputs", () => {
    const big = Array.from({ length: 7000 }, (_, i) => `w${i}`).join(" ");
    const d = wordDiff(big, `${big} extra`);
    expect(d.truncated).toBe(true);
    // Still reports usable counts.
    expect(d.addedWords).toBeGreaterThan(0);
  });

  it("stays exact just under the fallback threshold", () => {
    const words = Array.from({ length: 2000 }, (_, i) => `w${i}`).join(" ");
    const d = wordDiff(words, `${words} tail`);
    expect(d.truncated).toBe(false);
    expect(d.addedWords).toBe(1);
    expect(d.removedWords).toBe(0);
  });

  it("handles a realistic markdown edit", () => {
    const before = "# Plumbing\n\nWe serve Toronto.\n\n- Drain cleaning\n- Repairs\n";
    const after = "# Plumbing\n\nWe serve Toronto and Mississauga.\n\n- Drain cleaning\n- Repairs\n- Installations\n";
    const d = wordDiff(before, after);
    expect(text(d, "added")).toContain("Mississauga");
    expect(text(d, "added")).toContain("Installations");
    // "Toronto." -> "Toronto" is a real word change: punctuation attaches to
    // the token, so ending a sentence later counts as one removal.
    expect(d.removedWords).toBe(1);
    expect(text(d, "removed")).toBe("Toronto.");
  });
});
