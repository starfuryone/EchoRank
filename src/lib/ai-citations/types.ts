// src/lib/ai-citations/types.ts
//
// The normalised, persisted shapes for AI Citations. These are OURS; the
// provider-side shapes live beside their constants in dataforseo/endpoints.ts.
//
// Shared by the service, the route, the client component and the MCP tool, so
// nothing here may import a server module.

import type { LlmPlatform } from "./platforms";
import type { CitationScope } from "./target";

/** completed = every requested platform answered; partial = at least one did not. */
export type AiCitationsStatus = "completed" | "partial";

/** One page an AI platform cites when answering about this target. */
export interface CitedSourceRow {
  url: string;
  /** Hostname without `www.`. Null when the URL would not parse. */
  domain: string | null;
  platform: LlmPlatform;
  /**
   * How often this page was seen cited. Null is NOT zero — it means the
   * provider returned no figure, and a UI that renders it as 0 is asserting
   * something nobody measured.
   */
  mentions: number | null;
  /** The AI search volume captured through this page. Same null rule. */
  capturedVolume: number | null;
  /**
   * Real questions this page was cited for, from the mentions SAMPLE — not an
   * exhaustive list, and the copy says so. Attached only where the sampled
   * source URL matches this row's URL exactly.
   */
  prompts: { question: string; aiSearchVolume: number | null }[];
}

/** One brand's slice of the mentions on the platforms that answered. */
export interface ShareOfVoiceEntry {
  label: string;
  isTarget: boolean;
  /** null = no data for this brand, which is different from a measured zero. */
  mentions: number | null;
  /** null when mentions is null, or when the denominator is zero. */
  sharePct: number | null;
}

export interface ShareOfVoiceSection {
  /** Platforms whose cross-aggregated call actually succeeded. */
  platforms: LlmPlatform[];
  entries: ShareOfVoiceEntry[];
}

/** Per-platform totals for the target itself. */
export interface PlatformTotal {
  platform: LlmPlatform;
  mentions: number | null;
  aiSearchVolume: number | null;
  impressions: number | null;
}

/** The shape the route returns and the page renders. */
export interface AiCitationsAnalysisDto {
  id: string;
  /** hostname + path, as shown to the user. */
  target: string;
  scope: CitationScope;
  platforms: LlmPlatform[];
  competitors: string[];
  status: AiCitationsStatus;
  costUsd: number;
  totals: PlatformTotal[];
  sources: CitedSourceRow[];
  shareOfVoice: ShareOfVoiceSection | null;
  /** Platforms that failed. Each renders its own "couldn't load" note. */
  failedPlatforms: LlmPlatform[];
  createdAt: string;
  /** True when a stored analysis was replayed instead of spending. */
  cached?: boolean;
  /** ms until this target can be looked up again; only set on a cache hit. */
  reRunAvailableInMs?: number;
}

/** One row of the history list — no payload, just enough to pick from. */
export interface AiCitationsHistoryRow {
  id: string;
  target: string;
  scope: CitationScope;
  status: AiCitationsStatus;
  costUsd: number;
  createdAt: string;
}
