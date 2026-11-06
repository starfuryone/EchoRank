// src/lib/snapshot/run.ts
//
// One check, end to end: ask every prompt on every configured engine, score
// each answer, extract competitors once per engine, build the report. Storage
// and the network are injected, so the cost cap and the resume logic are
// tested without either (tests/snapshot-run.test.ts).
//
// THE CAP IS A RESERVATION, NOT A TALLY. Calls run five at a time, so "spent
// so far" is always behind; each call reserves its pessimistic estimate before
// it starts and settles to the real cost when it ends. A call whose
// reservation would cross the cap is not made. Two ceilings bind:
//   - SNAPSHOT_RUN_CAP_USD (default 0.35) over every call in the run;
//   - MAX_ANSWER_CALLS (20) answered search calls per run, plus
//     MAX_ANALYSIS_CALLS (one competitor extraction per engine, one source
//     classification). A retry
//     re-asks only what errored; those calls stay under the dollar cap.
//
// RESUMABLE. Answers already stored for this run are not asked again, and
// their cost counts against the cap, so a BullMQ retry finishes the run
// instead of paying for it twice.

import type { Answer, EngineConfig, Usage } from "./engines";
import { domainsOf, excerptAround, isCited, isMentioned } from "./match";
import { buildReport, canonicalCompetitors, countCompetitors, type StoredAnswer } from "./report";
import {
  CLASSIFY_INSTRUCTIONS,
  CLASSIFY_SCHEMA,
  absentSources,
  actionRows,
  classifyInput,
  parseClassification,
  sourceMap,
  type ClassifiedKind,
} from "./sources";
import type { SnapshotEngine, SnapshotPrompt, SnapshotReport } from "./types";

export const MAX_ANSWER_CALLS = 20;
export const MAX_ANALYSIS_CALLS = 3;
export const DEFAULT_RUN_CAP_USD = 0.35;
export const CONCURRENCY = 5;

export function runCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.SNAPSHOT_RUN_CAP_USD);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RUN_CAP_USD;
}

export class Budget {
  spent = 0;
  private reserved = 0;
  answerCalls = 0;
  analysisCalls = 0;
  capped = false;
  constructor(readonly capUsd: number) {}

  /** Reserve `estimate` for one call; false (and capped) when it would cross a ceiling. */
  reserve(kind: "answer" | "analysis", estimate: number): boolean {
    const calls = kind === "answer" ? this.answerCalls : this.analysisCalls;
    const max = kind === "answer" ? MAX_ANSWER_CALLS : MAX_ANALYSIS_CALLS;
    if (calls >= max || this.spent + this.reserved + estimate > this.capUsd + 1e-9) {
      this.capped = true;
      return false;
    }
    if (kind === "answer") this.answerCalls += 1;
    else this.analysisCalls += 1;
    this.reserved += estimate;
    return true;
  }

  settle(estimate: number, actual: number): void {
    this.reserved -= estimate;
    this.spent += actual;
  }
}

export interface SnapshotSpec {
  id: string;
  brand: string;
  domain: string;
  category: string;
  location: string | null;
  prompts: SnapshotPrompt[];
}

export interface AnswerRow extends StoredAnswer {
  answer: string;
  costUsd: number;
}

export interface RunDeps {
  engines: EngineConfig[];
  capUsd: number;
  ask: (cfg: EngineConfig, prompt: string) => Promise<Answer>;
  askJson: (
    cfg: EngineConfig,
    instructions: string,
    input: string,
    schema: Record<string, unknown>,
  ) => Promise<{ value: unknown; usage: Usage }>;
  cost: (engine: SnapshotEngine, model: string, usage: Usage, searched: boolean) => number;
  estimate: (engine: SnapshotEngine, model: string, searched: boolean) => number;
  /** Answers already stored for this run (a retry resumes from them). */
  loadAnswers: (id: string) => Promise<AnswerRow[]>;
  saveAnswer: (id: string, row: AnswerRow) => Promise<void>;
  /** Competitors and the mention-centred excerpt, per prompt, once extraction has run. */
  saveAnalysis: (
    id: string,
    engine: SnapshotEngine,
    byPrompt: Map<number, { competitors: string[]; excerpt: string }>,
  ) => Promise<void>;
  now?: () => Date;
}

export interface RunResult {
  report: SnapshotReport;
  costUsd: number;
  calls: number;
  /** Every answer call errored: the run has nothing to report. */
  allErrored: boolean;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export const EXTRACT_INSTRUCTIONS =
  "You extract business names from AI assistant answers. For each numbered answer, list the companies, " +
  "brands, products or service providers it names or recommends as options for the customer. Exclude the " +
  "brand given as BRAND, generic categories, publications, review sites and directories. Use each name as " +
  "written. Return an empty list for an answer that names none.";

export const EXTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "competitors"],
        properties: {
          index: { type: "integer" },
          competitors: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

/** Parse the extraction result defensively: a bad shape is "no competitors", never a crash. */
export function parseExtraction(value: unknown): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const answers = (value as { answers?: unknown })?.answers;
  if (!Array.isArray(answers)) return out;
  for (const a of answers) {
    const idx = Number((a as { index?: unknown })?.index);
    const names = (a as { competitors?: unknown })?.competitors;
    if (!Number.isInteger(idx) || !Array.isArray(names)) continue;
    out.set(idx, names.filter((n): n is string => typeof n === "string"));
  }
  return out;
}

export async function runSnapshot(spec: SnapshotSpec, deps: RunDeps): Promise<RunResult> {
  const budget = new Budget(deps.capUsd);
  const previous = await deps.loadAnswers(spec.id);
  for (const a of previous) {
    budget.spent += a.costUsd;
    // The call ceiling counts answers; an errored call is re-asked on a retry
    // and still bounded by the dollar cap, which it was charged against.
    if (!a.error) budget.answerCalls += 1;
  }
  // An errored or capped answer is asked again on a retry; what it already
  // cost stays counted above.
  const stored = previous.filter((a) => !a.error);
  const has = (i: number, e: SnapshotEngine) => stored.some((a) => a.promptIndex === i && a.engine === e);

  // Interleaved (prompt 0 on every engine, then prompt 1…), so a run the cap
  // stops early is short on both engines evenly rather than missing one.
  const todo: { i: number; cfg: EngineConfig }[] = [];
  spec.prompts.forEach((_, i) => deps.engines.forEach((cfg) => !has(i, cfg.engine) && todo.push({ i, cfg })));

  const rows = [...stored];
  await pool(todo, CONCURRENCY, async ({ i, cfg }) => {
    const est = deps.estimate(cfg.engine, cfg.model, true);
    let row: AnswerRow;
    if (!budget.reserve("answer", est)) {
      row = blankRow(i, cfg, "cost_cap");
    } else {
      try {
        const a = await deps.ask(cfg, spec.prompts[i].text);
        // A shared answer was asked (and paid for) earlier today; this run spent nothing.
        const cost = a.shared ? 0 : deps.cost(cfg.engine, cfg.model, a.usage, true);
        budget.settle(est, cost);
        const citedDomains = domainsOf(a.sourceUrls);
        row = {
          promptIndex: i,
          engine: cfg.engine,
          model: a.model,
          mentioned: isMentioned(a.text, spec.brand, spec.domain),
          cited: isCited(citedDomains, spec.domain),
          competitors: [],
          citedDomains,
          excerpt: excerptAround(a.text, spec.brand, spec.domain, []),
          answer: a.text,
          error: a.text.trim() ? null : "empty answer",
          costUsd: cost,
        };
      } catch (err) {
        // An errored call may still have been billed; charge the estimate.
        budget.settle(est, est);
        row = { ...blankRow(i, cfg, truncate(err instanceof Error ? err.message : String(err), 300)), costUsd: est };
      }
    }
    rows.push(row);
    await deps.saveAnswer(spec.id, row);
  });

  // One competitor extraction per engine, over that engine's answers.
  for (const cfg of deps.engines) {
    const mine = rows.filter((r) => r.engine === cfg.engine && !r.error);
    if (!mine.length || mine.every((r) => r.competitors.length)) continue;
    const est = deps.estimate(cfg.engine, cfg.model, false);
    if (!budget.reserve("analysis", est)) continue;
    const input =
      `BRAND: ${spec.brand} (${spec.domain})\n\n` +
      mine.map((r) => `### Answer ${r.promptIndex}\n${truncate(r.answer, 3000)}`).join("\n\n");
    try {
      const { value, usage } = await deps.askJson(cfg, EXTRACT_INSTRUCTIONS, input, EXTRACT_SCHEMA);
      budget.settle(est, deps.cost(cfg.engine, cfg.model, usage, false));
      const parsed = parseExtraction(value);
      const byPrompt = new Map<number, { competitors: string[]; excerpt: string }>();
      for (const r of mine) {
        r.competitors = canonicalCompetitors(parsed.get(r.promptIndex) ?? [], spec.brand, spec.domain);
        // Re-centred now that the competitors are known: the first brand OR
        // competitor mention, whichever comes first.
        r.excerpt = excerptAround(r.answer, spec.brand, spec.domain, r.competitors);
        byPrompt.set(r.promptIndex, { competitors: r.competitors, excerpt: r.excerpt });
      }
      await deps.saveAnalysis(spec.id, cfg.engine, byPrompt);
    } catch {
      // No competitors for this engine beats no report: the rates stand alone.
      budget.settle(est, est);
    }
  }

  // "What to do": one classification call over the top absent sources.
  const competitorNames = countCompetitors(rows).map((c) => c.name);
  const absent = absentSources(sourceMap(rows, spec.domain), spec.domain);
  let classified: Map<string, ClassifiedKind> | null = null;
  const classifier = deps.engines[0];
  if (absent.length && classifier) {
    const est = deps.estimate(classifier.engine, classifier.model, false);
    if (budget.reserve("analysis", est)) {
      try {
        const { value, usage } = await deps.askJson(
          classifier,
          CLASSIFY_INSTRUCTIONS,
          classifyInput(absent, competitorNames),
          CLASSIFY_SCHEMA,
        );
        budget.settle(est, deps.cost(classifier.engine, classifier.model, usage, false));
        classified = parseClassification(value);
      } catch {
        // Every row falls back to "unknown", no action (sources.ts actionRows).
        budget.settle(est, est);
      }
    }
  }

  const answered = rows.filter((r) => !r.error).length;
  return {
    report: buildReport({
      ...spec,
      engines: deps.engines.map((e) => e.engine),
      answers: rows,
      actions: actionRows(absent, competitorNames, classified),
      capped: budget.capped,
      now: deps.now?.() ?? new Date(),
    }),
    costUsd: budget.spent,
    calls: budget.answerCalls + budget.analysisCalls,
    allErrored: rows.length > 0 && answered === 0,
  };
}

function blankRow(i: number, cfg: EngineConfig, error: string): AnswerRow {
  return {
    promptIndex: i,
    engine: cfg.engine,
    model: cfg.model,
    mentioned: false,
    cited: false,
    competitors: [],
    citedDomains: [],
    excerpt: "",
    answer: "",
    error,
    costUsd: 0,
  };
}
