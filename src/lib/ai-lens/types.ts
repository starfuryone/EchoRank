// src/lib/ai-lens/types.ts
//
// The shapes crossing two boundaries: sidecar -> route, and route -> client.
// Kept separate from the Prisma row because the row stores JSON columns that the
// client must not be handed untyped.

import type { AiLensVerdict } from "./options";

/** One block of text present in the rendered page and absent from the raw fetch. */
export interface MissingBlock {
  /** <= 300 chars, already flattened and entity-decoded by the sidecar. */
  text_excerpt: string;
  /** The heading it sits under, or "(before any heading)". */
  approx_location: string;
  word_count: number;
}

/** Fetch metadata. Every field comes from a fetch that actually happened. */
export interface AiLensMeta {
  raw_status: number;
  rendered_status: number;
  raw_ms: number;
  rendered_ms: number;
  final_url: string;
  redirects: string[];
  user_agent: string;
  raw_flags: RobotsFlags;
  rendered_flags: RobotsFlags;
}

export interface RobotsFlags {
  meta_robots: string[];
  x_robots_tag: string;
  noindex: boolean;
}

/** POST /internal/ai-lens response. */
export interface SidecarLensResult {
  url: string;
  gap_percent: number;
  raw_word_count: number;
  rendered_word_count: number;
  missing_word_count: number;
  raw_block_count: number;
  rendered_block_count: number;
  missing_block_count: number;
  missing_blocks: MissingBlock[];
  missing_blocks_truncated: number;
  raw_markdown: string;
  rendered_markdown: string;
  meta: AiLensMeta;
}

/**
 * What the client renders. Note the markdown documents are NOT here: they are
 * hundreds of KB, the UI shows word counts and missing blocks rather than the
 * documents themselves, and shipping both to the browser on every history row
 * would dwarf the rest of the payload.
 */
export interface AiLensAnalysisDto {
  id: string;
  url: string;
  gapPercent: number;
  verdict: AiLensVerdict;
  rawWordCount: number;
  renderedWordCount: number;
  missingBlocks: MissingBlock[];
  missingBlocksTruncated: number;
  /** Words in the missing blocks — the gap percentage's numerator. */
  missingWordCount: number;
  meta: AiLensMeta;
  createdAt: string;
}

export interface AiLensHistoryRow {
  id: string;
  url: string;
  gapPercent: number;
  verdict: AiLensVerdict;
  renderedWordCount: number;
  missingBlockCount: number;
  createdAt: string;
}

export interface AiLensUsage {
  used: number;
  limit: number;
  plan: string;
  /** Whether this plan may analyze URLs outside its own domains. */
  crossDomain: boolean;
}
