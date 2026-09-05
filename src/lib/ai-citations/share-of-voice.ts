// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/ai-citations/share-of-voice.ts
//
// Brand versus competitors: who gets mentioned, and what share of the
// mentions each one holds, from the cross_aggregated_metrics calls.
//
// ── NULL IS NOT ZERO, AND THE WHOLE FILE TURNS ON IT ───────────────────────
// A brand whose summed mentions is NULL is "no data" — the provider returned
// nothing about it. A brand with 0 is measured-and-absent. These are different
// findings and the customer is entitled to both:
//
//   null → excluded from the denominator, sharePct null, rendered "no data"
//   0    → counted, sharePct 0, rendered "0%"
//
// Collapsing null to 0 would quietly inflate every OTHER brand's share, because
// the denominator would grow by brands nobody measured. `sumNullable` exists
// only to keep the distinction through addition: null + null stays null,
// null + n is n.
//
// ── EVERY REQUESTED BRAND IS SEEDED AS A ROW ───────────────────────────────
// Up front, before any response is read. A brand the provider returned nothing
// for renders as "no data" instead of vanishing from a leaderboard the
// customer paid to compare it on — which would read as "we did not ask".
//
// Echoed aggregation keys are matched back case-insensitively: the provider
// normalises them, and a case difference would orphan a row or, worse, lose the
// target's own `isTarget` flag and make the customer's brand look like a rival.
//
// PURE.

import type { LlmCrossAggregatedItem } from "@/lib/dataforseo/endpoints";
import type { LlmPlatform } from "./platforms";
import { roundOrNull } from "./cited-sources";
import type { ShareOfVoiceSection } from "./types";

/** One platform's cross-aggregated outcome. Failures are kept, not dropped. */
export interface CrossOutcome {
  platform: LlmPlatform;
  status: "success" | "error";
  items: LlmCrossAggregatedItem[];
}

/** null + null = null; null + n = n; m + n = m + n. */
export function sumNullable(values: readonly (number | null)[]): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value != null) {
      total += value;
      seen = true;
    }
  }
  return seen ? total : null;
}

/**
 * Resolve raw competitor input into comparison groups.
 *
 * Deduped case-insensitively and against the target itself. Both matter and
 * for the same reason: the provider charges per aggregation group, so "Nike"
 * beside "nike" is a paid slot spent on a duplicate row, and a competitor that
 * IS the target is a row claiming 100% intersection with itself.
 */
export function resolveCompetitorGroups(
  targetValue: string,
  competitors: readonly string[],
  max: number,
): string[] {
  const seen = new Set<string>([targetValue.trim().toLowerCase()]);
  const groups: string[] = [];
  for (const raw of competitors) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(label);
    if (groups.length >= max) break;
  }
  return groups;
}

/**
 * The leaderboard.
 *
 * Returns null when there are no competitors, or when every platform's call
 * failed — the UI then omits the section rather than rendering a bar chart of
 * one bar, or of nothing.
 */
export function computeShareOfVoice(
  crossOutcomes: readonly CrossOutcome[],
  targetKey: string,
  competitorKeys: readonly string[],
): ShareOfVoiceSection | null {
  if (competitorKeys.length === 0) return null;
  const successful = crossOutcomes.filter((outcome) => outcome.status === "success");
  if (successful.length === 0) return null;

  const requested = [targetKey, ...competitorKeys];
  const labelByKey = new Map(requested.map((key) => [key.toLowerCase(), key]));
  // Seeded to null — "asked about, nothing returned" — before anything is read.
  const mentionsByKey = new Map<string, number | null>(
    requested.map((key) => [key.toLowerCase(), null]),
  );

  for (const outcome of successful) {
    for (const item of outcome.items) {
      if (item?.key == null) continue;
      const key = item.key.toLowerCase();
      // The provider should echo only the keys we sent. If it ever returns an
      // extra, it must not move a requested brand's share.
      if (!labelByKey.has(key)) continue;
      const platformMentions = sumNullable(
        (item.platform ?? []).map((entry) => roundOrNull(entry?.mentions)),
      );
      mentionsByKey.set(key, sumNullable([mentionsByKey.get(key) ?? null, platformMentions]));
    }
  }

  const denominator = sumNullable([...mentionsByKey.values()]) ?? 0;
  const targetLower = targetKey.toLowerCase();

  const entries = [...mentionsByKey.entries()]
    .map(([key, mentions]) => ({
      label: labelByKey.get(key) ?? key,
      isTarget: key === targetLower,
      mentions,
      sharePct:
        mentions == null || denominator <= 0 ? null : (mentions / denominator) * 100,
    }))
    // "No data" sorts last, below a measured zero: -1 is unreachable for a real
    // count, so it cannot collide with one.
    .sort((a, b) => (b.mentions ?? -1) - (a.mentions ?? -1));

  return { platforms: successful.map((outcome) => outcome.platform), entries };
}
