// src/lib/snapshot/report.ts
//
// Stored answers → the report. Pure, so the fixtures in
// tests/snapshot-report.test.ts can pin every number the page prints.

import { fold, findBrand } from "./match";
import {
  SNAPSHOT_ENGINES,
  type AnswerCell,
  type CompetitorCount,
  type EngineSummary,
  type PromptRow,
  type SnapshotEngine,
  type SnapshotPrompt,
  type ActionRow,
  type SnapshotReport,
} from "./types";
import { sourceMap } from "./sources";

export const TOP_COMPETITORS = 5;

/** One stored answer row, as the report needs it. */
export interface StoredAnswer {
  promptIndex: number;
  engine: SnapshotEngine;
  model: string | null;
  mentioned: boolean;
  cited: boolean;
  competitors: string[];
  citedDomains: string[];
  excerpt: string;
  error: string | null;
}

export interface ReportInput {
  brand: string;
  domain: string;
  category: string;
  location: string | null;
  prompts: SnapshotPrompt[];
  /** Engines the run asked; an engine absent here is not in the report. */
  engines: SnapshotEngine[];
  answers: StoredAnswer[];
  /** "What to do" rows (sources.ts actionRows); empty when there are none. */
  actions: ActionRow[];
  capped: boolean;
  now: Date;
}

/**
 * Competitor names as the extraction returned them → one display name per
 * competitor. Case, accents and punctuation are folded for the key; the first
 * spelling seen is the one displayed. The brand itself is dropped.
 */
export function canonicalCompetitors(names: string[], brand: string, domain: string): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = raw.replace(/\s+/g, " ").trim().slice(0, 80);
    const key = fold(name).replace(/ /g, "");
    if (!key || seen.has(key)) continue;
    if (findBrand(name, brand, domain) >= 0) continue;
    seen.set(key, name);
  }
  return [...seen.values()];
}

export function countCompetitors(answers: StoredAnswer[]): CompetitorCount[] {
  const byKey = new Map<string, CompetitorCount>();
  for (const a of answers) {
    if (a.error) continue;
    for (const name of a.competitors) {
      const key = fold(name).replace(/ /g, "");
      const c = byKey.get(key) ?? { name, count: 0, byEngine: {} };
      c.count += 1;
      c.byEngine[a.engine] = (c.byEngine[a.engine] ?? 0) + 1;
      byKey.set(key, c);
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function summarize(engine: SnapshotEngine, answers: StoredAnswer[], asked: number): EngineSummary {
  const mine = answers.filter((a) => a.engine === engine);
  const ok = mine.filter((a) => !a.error);
  const mentioned = ok.filter((a) => a.mentioned).length;
  const cited = ok.filter((a) => a.cited).length;
  return {
    engine,
    model: mine.find((a) => a.model)?.model ?? null,
    asked,
    answered: ok.length,
    mentioned,
    cited,
    mentionRate: ok.length ? mentioned / ok.length : null,
    citationRate: ok.length ? cited / ok.length : null,
  };
}

export function buildReport(input: ReportInput): SnapshotReport {
  const engines = SNAPSHOT_ENGINES.filter((e) => input.engines.includes(e));
  const prompts: PromptRow[] = input.prompts.map((p, index) => {
    const results: Partial<Record<SnapshotEngine, AnswerCell>> = {};
    for (const e of engines) {
      const a = input.answers.find((x) => x.promptIndex === index && x.engine === e);
      results[e] = a
        ? {
            mentioned: a.mentioned,
            cited: a.cited,
            competitors: a.competitors,
            citedDomains: a.citedDomains,
            excerpt: a.excerpt,
            error: a.error,
          }
        : { mentioned: false, cited: false, competitors: [], citedDomains: [], excerpt: "", error: "not_run" };
    }
    return { index, kind: p.kind, text: p.text, results };
  });
  return {
    brand: input.brand,
    domain: input.domain,
    category: input.category,
    location: input.location,
    engines: engines.map((e) => summarize(e, input.answers, input.prompts.length)),
    competitors: countCompetitors(input.answers).slice(0, TOP_COMPETITORS),
    prompts,
    sources: sourceMap(input.answers, input.domain),
    actions: input.actions,
    capped: input.capped,
    generatedAt: input.now.toISOString(),
  };
}
