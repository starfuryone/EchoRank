// src/lib/marketing/types.ts
//
// Wire shapes for the Marketing Studio routes. Kept separate from the heuristic
// modules so the client components can import DTOs without pulling n-gram code
// into the browser bundle.

import type { MarketingMode } from "@/lib/marketing-templates";

/** Variable values as the client submits them: { PRODUCT: "...", ... }. */
export type MarketingValues = Record<string, string>;

export interface MarketingUsage {
  /** Output tokens spent this month across every category. */
  used: number;
  /** null = unmetered (ENTERPRISE). */
  limit: number | null;
  plan: string;
  /** False when the plan has no marketing_studio flag. */
  unlocked: boolean;
}

export interface MarketingResult {
  categoryId: string;
  mode: MarketingMode;
  /** The deliverable. Markdown for generate/hybrid, plain text for heuristic. */
  output: string;
  /** Heuristic findings rendered for the UI, when the category computes any. */
  computed: string | null;
  /** True when this came from the Redis result cache — no tokens were spent. */
  cached: boolean;
  /** 0 for heuristic categories and cache hits. */
  outputTokens: number;
  usage: MarketingUsage;
}

/** What /compute returns — the heuristic half, with no model involved. */
export interface MarketingComputeResult {
  categoryId: string;
  computed: string;
  /** The payload the optional AI step would receive. Shown in the UI so the
   *  "your data stays here" claim is inspectable rather than asserted. */
  aiPayloadPreview: string | null;
}
