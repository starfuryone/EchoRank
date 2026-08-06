// src/lib/free-tools/volatility.ts
//
// The SERP Volatility Checker's basket and its churn formula.
//
// NOBODY'S VISIT COSTS ANYTHING. A daily worker buys one fixed basket for
// everyone (~$0.018/day at standard-queue prices) and the public endpoint only
// reads. That is the only shape in which a "live SERP volatility" tool can be
// free: metering it per visitor would make the cost scale with traffic, which
// is exactly backwards for a number that is identical for every reader.
//
// THE SCORE IS COMPUTED ON READ, not stored — see the model comment in
// schema.prisma. The formula is the part most likely to be revised, and a
// stored score would need backfilling every time it was.

import { SERP_LOCATION_CODES } from "@/lib/serp/options";

export const VOLATILITY_CATEGORIES = [
  "ecommerce",
  "local",
  "finance",
  "health",
  "tech",
] as const;

export type VolatilityCategory = (typeof VOLATILITY_CATEGORIES)[number];

/** One location for the whole basket — US, the deepest and most-watched index. */
export const VOLATILITY_LOCATION_CODE: number = 2840;

/**
 * The fixed basket: 6 keywords × 5 categories = 30.
 *
 * FIXED IS THE POINT. Volatility is a day-over-day comparison, so the basket
 * must not change: swapping a keyword would show up as churn that no search
 * engine caused. Adding a category means starting its series from zero, not
 * rewriting history.
 *
 * Head terms, deliberately — they have stable, well-populated top-10s, so
 * movement reflects the index rather than thin-result noise.
 */
export const VOLATILITY_BASKET: Record<VolatilityCategory, string[]> = {
  ecommerce: [
    "running shoes",
    "office chair",
    "coffee maker",
    "laptop backpack",
    "wireless earbuds",
    "standing desk",
  ],
  local: [
    "plumber near me",
    "dentist near me",
    "car repair near me",
    "hair salon near me",
    "locksmith near me",
    "pizza delivery",
  ],
  finance: [
    "best savings account",
    "car insurance quotes",
    "mortgage rates",
    "credit card offers",
    "personal loan",
    "index funds",
  ],
  health: [
    "back pain relief",
    "healthy meal plan",
    "vitamin d benefits",
    "how to sleep better",
    "knee pain causes",
    "blood pressure chart",
  ],
  tech: [
    "best vpn",
    "password manager",
    "cloud storage",
    "project management software",
    "website builder",
    "antivirus software",
  ],
};

export function basketEntries(): { category: VolatilityCategory; keyword: string }[] {
  return VOLATILITY_CATEGORIES.flatMap((category) =>
    VOLATILITY_BASKET[category].map((keyword) => ({ category, keyword })),
  );
}

/** Sanity: the location the basket samples must be one we already validate. */
export function isKnownLocation(): boolean {
  return (SERP_LOCATION_CODES as readonly number[]).includes(VOLATILITY_LOCATION_CODE);
}

/**
 * Rank churn between two consecutive days, on a 0–10 scale.
 *
 * THE FORMULA. For each domain appearing in either day's top-10, take how far
 * it moved. A domain that entered or left is treated as having moved from/to
 * position 11 — one past the window — because "arrived from nowhere" is a real
 * move and scoring it as zero would make an entirely new top-10 look calm.
 *
 *   movement = Σ |position_today − position_yesterday|   (absent ⇒ 11)
 *
 * The maximum for a 10-result window is a complete replacement: 10 domains each
 * moving the full 10 places, i.e. 100. Dividing by that and scaling to 10 gives
 * a number where 0 is "identical" and 10 is "nothing in common". In practice a
 * calm day is under 1 and a major update is 3–5; the scale deliberately leaves
 * headroom rather than normalising to the observed maximum, which would make
 * every day look dramatic once a quiet week set the baseline.
 */
export const MAX_CHURN_PER_KEYWORD = 100;
const ABSENT_POSITION = 11;

export function keywordChurn(
  yesterday: readonly string[],
  today: readonly string[],
): number {
  if (yesterday.length === 0 || today.length === 0) return 0;

  const positionIn = (list: readonly string[], domain: string): number => {
    const index = list.indexOf(domain);
    return index === -1 ? ABSENT_POSITION : index + 1;
  };

  const domains = new Set([...yesterday.slice(0, 10), ...today.slice(0, 10)]);
  let movement = 0;
  for (const domain of domains) {
    movement += Math.abs(positionIn(today, domain) - positionIn(yesterday, domain));
  }

  return Math.min(10, (movement / MAX_CHURN_PER_KEYWORD) * 10);
}

export interface DaySample {
  keyword: string;
  category: string;
  topDomains: string[];
}

/**
 * Category scores for one day, versus the day before.
 *
 * A category with no comparable pair scores null rather than 0 — "we have no
 * data" and "nothing moved" are different answers, and showing the second when
 * the first is true is how a dashboard lies quietly.
 */
export function scoreDay(
  today: readonly DaySample[],
  yesterday: readonly DaySample[],
): Record<string, number | null> {
  const previous = new Map(yesterday.map((s) => [s.keyword, s.topDomains]));
  const byCategory = new Map<string, number[]>();

  for (const sample of today) {
    const before = previous.get(sample.keyword);
    if (!before) continue;
    const scores = byCategory.get(sample.category) ?? [];
    scores.push(keywordChurn(before, sample.topDomains));
    byCategory.set(sample.category, scores);
  }

  const out: Record<string, number | null> = {};
  for (const category of VOLATILITY_CATEGORIES) {
    const scores = byCategory.get(category);
    out[category] =
      scores && scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;
  }
  return out;
}

/** Overall = the mean of the categories that have a score. */
export function overallScore(categories: Record<string, number | null>): number | null {
  const values = Object.values(categories).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Domain of a result URL, lowercased and without www. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
