// src/lib/snapshot/types.ts
//
// Shapes shared by the free AI Visibility Check (/ai-visibility-check): the
// run, the per-answer rows and the report. Dependency-free on purpose: the
// client widget imports these types, and `import type` is all it may import.

export type SnapshotEngine = "openai" | "gemini";
export const SNAPSHOT_ENGINES: readonly SnapshotEngine[] = ["openai", "gemini"];
export const ENGINE_LABEL: Record<SnapshotEngine, string> = { openai: "ChatGPT", gemini: "Gemini" };

/** The fixed mix: 4 best/top, 2 vs-alternatives, 2 problem/how-to, 2 direct. */
export type PromptKind = "best" | "alternatives" | "howto" | "direct";

export interface SnapshotPrompt {
  kind: PromptKind;
  text: string;
}

export type SnapshotStatus = "queued" | "running" | "done" | "failed";

/** One engine's answer to one prompt, as the report shows it. */
export interface AnswerCell {
  mentioned: boolean;
  cited: boolean;
  competitors: string[];
  citedDomains: string[];
  excerpt: string;
  /** Set when the call failed or was skipped by the cost cap. */
  error: string | null;
}

export interface EngineSummary {
  engine: SnapshotEngine;
  model: string | null;
  /** Prompts sent to this engine (10 unless the engine was unavailable). */
  asked: number;
  /** Prompts that came back with an answer. Rates are over this. */
  answered: number;
  mentioned: number;
  cited: number;
  /** 0-1 over `answered`; null when nothing was answered. */
  mentionRate: number | null;
  citationRate: number | null;
}

export interface CompetitorCount {
  name: string;
  /** Answers naming it, across both engines. */
  count: number;
  byEngine: Partial<Record<SnapshotEngine, number>>;
}

export type SourceType = "directory" | "publisher" | "competitor" | "forum" | "unknown";
export type SourceAction = "get_listed" | "claim_profile" | "pitch_comparison" | "join_discussion";

/** "Sources that decided the answers": one row per cited domain. */
export interface SourceRow {
  domain: string;
  /** Answers that cited it. */
  timesCited: number;
  /** Competitors named in those answers, most frequent first. */
  competitors: CompetitorCount[];
  /** True when the user's own domain was cited in at least one of those answers. */
  userCited: boolean;
}

/** "What to do": a cited domain the user's domain is absent from. */
export interface ActionRow {
  domain: string;
  timesCited: number;
  /** "directory" covers directories and review sites; "unknown" when the classification failed. */
  type: SourceType;
  /** Null for competitor-owned and unknown domains. */
  action: SourceAction | null;
}

export interface PromptRow {
  index: number;
  kind: PromptKind;
  text: string;
  results: Partial<Record<SnapshotEngine, AnswerCell>>;
}

export interface SnapshotReport {
  brand: string;
  domain: string;
  category: string;
  location: string | null;
  engines: EngineSummary[];
  /** Top 5 by frequency across both engines. */
  competitors: CompetitorCount[];
  prompts: PromptRow[];
  sources: SourceRow[];
  /** Top 5 absent sources with a type and an action. */
  actions: ActionRow[];
  /** True when the cost or call cap stopped the run before every call was made. */
  capped: boolean;
  generatedAt: string;
}

/** What the page shows before the email gate: rates, names, a count. */
export interface SnapshotPreview {
  brand: string;
  domain: string;
  engines: EngineSummary[];
  competitors: string[];
  sourceCount: number;
  /** 0 mentions on every engine that answered: the result leads with that. */
  notMentioned: boolean;
  capped: boolean;
}

export function previewOf(r: SnapshotReport): SnapshotPreview {
  const answered = r.engines.filter((e) => e.answered > 0);
  return {
    brand: r.brand,
    domain: r.domain,
    engines: r.engines,
    competitors: r.competitors.map((c) => c.name),
    sourceCount: r.sources.length,
    notMentioned: answered.length > 0 && answered.every((e) => e.mentioned === 0),
    capped: r.capped,
  };
}
