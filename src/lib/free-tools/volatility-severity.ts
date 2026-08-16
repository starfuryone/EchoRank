// Severity bands for the SERP volatility score (0–10).
//
// ONE DEFINITION, because this number is stated four times on the page — the
// bar colour, the chip beside the headline, the sentence under it, and every
// column of the history chart. Four literals would drift the way the Jul 31
// pricing copy did; a band is a lookup, not a re-derivation.
//
// The thresholds are product-set, not derived from the scorer. Note that
// volatility.ts's own commentary ("a calm day is under 1, a major update is
// 3–5") predates them and reads one band lower — the FAQ copy says the same.
// Left alone deliberately: reconciling them is a copy decision, not a
// refactor. See the report accompanying this change.

export type Severity = "calm" | "elevated" | "high";

/** Lower bound of each band, descending — the first match wins. */
const BANDS: readonly { min: number; severity: Severity }[] = [
  { min: 5, severity: "high" },
  { min: 2, severity: "elevated" },
  { min: 0, severity: "calm" },
];

export function severityOf(score: number): Severity {
  return BANDS.find((band) => score >= band.min)?.severity ?? "calm";
}

/**
 * Bar and chart fill per band.
 *
 * The Binance tokens the marketing theme already defines on .page
 * (home2.module.css): --green #0ECB81, --goldDeep #F0B90B, --red #F6465D.
 * Read through var() with the literal as fallback so the chart still colours
 * correctly if it is ever rendered outside that wrapper.
 */
export const SEVERITY_COLOR: Record<Severity, string> = {
  calm: "var(--green, #0ECB81)",
  elevated: "var(--goldDeep, #F0B90B)",
  high: "var(--red, #F6465D)",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  calm: "Calm",
  elevated: "Elevated",
  high: "High volatility",
};

/** The one-line read of today, driven by the same bands as the colour. */
export const SEVERITY_SENTENCE: Record<Severity, string> = {
  calm: "Below 2 means rankings are stable — a normal day.",
  elevated: "Between 2 and 5 means results are shifting more than usual — worth watching.",
  high: "5 or above means a broad update is likely rolling out.",
};

/** 0–10 onto a percentage of the track. Floored so a real score is never invisible. */
export function widthPct(score: number): number {
  return Math.max(2, Math.min(100, Math.round((score / 10) * 100)));
}
