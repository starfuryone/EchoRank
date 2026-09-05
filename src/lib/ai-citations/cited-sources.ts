// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/ai-citations/cited-sources.ts
//
// Turn the provider's two mention endpoints into the cited-sources table.
//
// ── WHICH ENDPOINT IS AUTHORITATIVE, AND WHY IT MATTERS ────────────────────
// TWO endpoints describe cited pages and they do NOT agree, because they are
// measuring different things:
//
//   top_pages  — the provider's own ranked view of which pages get cited, with
//                per-platform mention counts and captured search volume. This
//                is a POPULATION figure.
//   search     — a SAMPLE of individual observed answers, each carrying the
//                question asked and the sources that answer cited.
//
// So the rows come from top_pages and the metrics on them stay top_pages'.
// The sample contributes only EXAMPLE PROMPTS, attached where a sampled
// source URL matches a row's URL exactly. Deriving the counts from the sample
// instead would produce a table that undercounts by however much the sample
// missed, while looking authoritative.
//
// ── THE FILTER RUNS BEFORE THE CAP ─────────────────────────────────────────
// The provider has no URL-level targeting (see ./target.ts), so a subfolder or
// exact-URL lookup asks about the whole domain and filters the returned pages.
// That filter MUST run before the per-platform cap. Capping first would take
// the top 25 pages of the domain and then discard the ones outside the path —
// returning an empty table for a subfolder that has plenty of cited pages,
// simply because the domain's homepage outranked them. This is the single
// edge case most worth preserving from the reference implementation.
//
// PURE. No provider calls, no prisma. Given fixtures, this file is fully
// testable, which is what lets the feature ship with the account unverified.

import { safeHostname, safeHttpUrl } from "./url";
import type { LlmMentionItem, LlmTopPagesItem } from "@/lib/dataforseo/endpoints";
import type { LlmPlatform } from "./platforms";
import { MAX_QUESTION_LENGTH, MAX_URL_LENGTH } from "./options";
import { urlMatchesTarget, type CitationTarget } from "./target";
import type { CitedSourceRow } from "./types";

/** One platform's raw pair of responses. */
export interface PlatformBundle {
  platform: LlmPlatform;
  topPages: LlmTopPagesItem[];
  mentions: LlmMentionItem[];
}

/** Round, or keep null. Null is "not measured" and must survive as null. */
export function roundOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function sourceKey(platform: LlmPlatform, url: string): string {
  return `${platform}::${url}`;
}

/**
 * platform+url -> question -> aiSearchVolume, from the mentions sample.
 *
 * FIRST WRITE WINS per question, so one question asked many times contributes
 * one example rather than crowding the list with itself.
 */
function buildPromptExamples(
  bundles: readonly PlatformBundle[],
): Map<string, Map<string, number | null>> {
  const examples = new Map<string, Map<string, number | null>>();

  for (const bundle of bundles) {
    for (const mention of bundle.mentions) {
      const question =
        typeof mention.question === "string"
          ? truncate(mention.question.replace(/\s+/g, " ").trim(), MAX_QUESTION_LENGTH)
          : "";
      if (!question) continue;
      const volume = roundOrNull(mention.ai_search_volume);

      for (const source of mention.sources ?? []) {
        const url = safeHttpUrl(source?.url);
        if (!url) continue;
        const key = sourceKey(bundle.platform, url);
        const existing = examples.get(key) ?? new Map<string, number | null>();
        if (!existing.has(question)) existing.set(question, volume);
        examples.set(key, existing);
      }
    }
  }
  return examples;
}

/**
 * The cited-sources table.
 *
 * `pageFilter` is null for a whole-domain lookup and a target for anything
 * narrower. Rows are capped PER PLATFORM so a high-volume platform cannot
 * crowd a sparse one out of the table entirely, then the combined set is
 * ordered by captured volume for a sensible default view.
 */
export function deriveCitedSources(
  bundles: readonly PlatformBundle[],
  limits: { sourcesPerPlatform: number; promptsPerSource: number },
  pageFilter: CitationTarget | null = null,
): CitedSourceRow[] {
  const promptExamples = buildPromptExamples(bundles);

  const rows = bundles.flatMap((bundle) =>
    bundle.topPages
      .map((page): CitedSourceRow | null => {
        const url = safeHttpUrl(page?.key);
        if (!url || url.length > MAX_URL_LENGTH) return null;

        // BEFORE the cap. See the header.
        if (pageFilter && !urlMatchesTarget(url, pageFilter)) return null;

        const group = page.platform?.find((entry) => entry?.key === bundle.platform);
        const examples =
          promptExamples.get(sourceKey(bundle.platform, url)) ??
          new Map<string, number | null>();

        return {
          url,
          domain: safeHostname(url),
          platform: bundle.platform,
          mentions: roundOrNull(group?.mentions),
          capturedVolume: roundOrNull(group?.ai_search_volume),
          prompts: [...examples.entries()]
            .map(([question, aiSearchVolume]) => ({ question, aiSearchVolume }))
            .sort((a, b) => (b.aiSearchVolume ?? 0) - (a.aiSearchVolume ?? 0))
            .slice(0, limits.promptsPerSource),
        };
      })
      .filter((row): row is CitedSourceRow => row !== null),
  );

  const byPlatform = new Map<LlmPlatform, CitedSourceRow[]>();
  for (const row of rows) {
    const list = byPlatform.get(row.platform) ?? [];
    list.push(row);
    byPlatform.set(row.platform, list);
  }

  const capped = [...byPlatform.values()].flatMap((list) =>
    [...list]
      .sort((a, b) => (b.capturedVolume ?? 0) - (a.capturedVolume ?? 0))
      .slice(0, limits.sourcesPerPlatform),
  );

  return capped.sort(
    (a, b) =>
      (b.capturedVolume ?? 0) - (a.capturedVolume ?? 0) ||
      (b.mentions ?? 0) - (a.mentions ?? 0),
  );
}
