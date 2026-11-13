// The one colour map for the seven prompt uses: the hub's stacked chart (H3),
// the "Prompt mix by industry" table's legend (H5) and each guide's bar chart (G2).
//
// FILLS, NOT TEXT. Each fill must read against the dark page (#181A20, ≥ 3:1)
// and carry dark text (#181A20, ≥ 4.5:1) for the counts printed on it;
// tests/prompt-guides.test.ts computes both. Colour is never the only cue: every
// use also has a pattern, and every chart prints its counts and use names.
// No teal or mint — the package's palette is not carried over.

import type { PromptUse } from "@/lib/prompt-guides";

/** Text and strokes drawn ON a fill. Binance #181A20 in both themes. */
export const INK = "#181A20";

export type UsePattern = "solid" | "diagUp" | "dots" | "horizontal" | "diagDown" | "cross" | "vertical";

export const USE_STYLES: Record<PromptUse, { fill: string; pattern: UsePattern }> = {
  Discovery: { fill: "#FCD535", pattern: "solid" },
  Education: { fill: "#6EA8FE", pattern: "diagUp" },
  Evaluation: { fill: "#C29BFF", pattern: "dots" },
  Comparison: { fill: "#F6849B", pattern: "horizontal" },
  Validation: { fill: "#0ECB81", pattern: "diagDown" },
  "Fact check": { fill: "#FF9F43", pattern: "cross" },
  Local: { fill: "#B7BDC6", pattern: "vertical" },
};

/** "Fact check" → "fact-check", for SVG pattern ids. */
export function patternSlug(use: PromptUse): string {
  return use.toLowerCase().replace(/\s+/g, "-");
}
