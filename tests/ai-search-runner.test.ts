// tests/ai-search-runner.test.ts
//
// The checkup runner: the plan, the cap, idempotency, and the status a checkup
// lands on.
//
// DRIVEN ENTIRELY THROUGH FAKE PORTS. That is not a compromise for lack of a
// database — it is how the behaviours that matter get tested at all. "At the
// cap, skip this run and keep going" cannot be asserted against a real provider
// without spending money to prove it, and "a re-run does not double the rows"
// cannot be asserted against a real database without one to write to. Both are
// exact, deterministic statements about control flow, so they are tested as
// such. The Prisma binding those ports have in production is thin by design and
// is what the gated round-trip test covers.
//
// THE CAP CASES ARE THE POINT OF THIS FILE. A cap that stops the whole checkup,
// or that is read once at the start, or that discards the answers already paid
// for, would each still pass a naive "it ran" test. Each has its own case here.

import { describe, expect, it } from "vitest";
import type { PlanType } from "@/generated/prisma";
import {
  runCheckup,
  toScoredRun,
  type AnalysisSignals,
  type CapReading,
  type RunnerPorts,
  type SlotOutcome,
} from "@/lib/ai-monitor/runner/checkup-runner";
import { buildRunPlan, slotKey, snapshotShape, type RunSlot } from "@/lib/ai-monitor/runner/plan";
import {
  isPartialCoverage,
  stoppedReason,
  tally,
  terminalStatus,
} from "@/lib/ai-monitor/runner/status";
import { answerHash, normalizeAnswer } from "@/lib/ai-monitor/runner/normalize";
import { refusalFor, refusals, runnableEngines } from "@/lib/ai-monitor/runner/providers";
import {
  MIN_STALE_MS,
  PER_SLOT_BUDGET_MS,
  expectedDurationMs,
  isStaleRunning,
} from "@/lib/ai-monitor/runner/scheduler";
import {
  salvageScoredRuns,
  scoredRunFromPersisted,
  type PersistedRun,
} from "@/lib/ai-monitor/runner/salvage";
import type { EngineSpec } from "@/lib/ai-monitor/engines";
import type { BrandContext, RunAnalysis } from "@/lib/ai-monitor/analysis/analyze-response";

const CLAUDE: EngineSpec = {
  provider: "CLAUDE",
  modelName: "claude-sonnet-5",
  displayName: "Claude",
  supportsSearch: true,
  supportsCitations: true,
  apiKeyEnv: "ANTHROPIC_API_KEY",
  sortOrder: 40,
};
const GEMINI: EngineSpec = {
  provider: "GEMINI",
  modelName: "gemini-3-pro",
  displayName: "Gemini",
  supportsSearch: true,
  supportsCitations: true,
  apiKeyEnv: "GEMINI_API_KEY",
  sortOrder: 30,
};

const PROMPTS = [
  { id: "p1", text: "best AI visibility tools" },
  { id: "p2", text: "alternatives to Ahrefs" },
];

const BRAND: BrandContext = {
  brand: "Echorank360",
  domain: "echorank360.com",
  brandVariations: [],
};

// ───────────────────────────────── the plan ─────────────────────────────────

describe("building a run plan", () => {
  it("expands prompts x engines x repetitions", () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE, GEMINI], 3);
    expect(slots).toHaveLength(2 * 2 * 3);
  });

  it("takes repetitions from the tier, identically for every engine", () => {
    // Locked: repetitions are a tier property. Per-engine counts would make the
    // repeatability score incomparable between two engines in one checkup.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE, GEMINI], 2);
    const perEngine = new Map<string, number>();
    for (const slot of slots) perEngine.set(slot.engine, (perEngine.get(slot.engine) ?? 0) + 1);
    expect([...perEngine.values()]).toEqual([4, 4]);
    expect(new Set(slots.map((s) => s.repetition))).toEqual(new Set([1, 2]));
  });

  it("orders prompt-major so a cap leaves whole prompts answered", () => {
    // Engine-major would spend the budget asking one engine everything;
    // repetition-major would buy three copies of question one before asking
    // question two. Both leave a partial result nobody can read.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE, GEMINI], 2);
    expect(slots.slice(0, 4).every((s) => s.promptId === "p1")).toBe(true);
    expect(slots.slice(0, 2).every((s) => s.engine === "CLAUDE")).toBe(true);
    expect(slots.slice(0, 2).map((s) => s.repetition)).toEqual([1, 2]);
  });

  it("never plans fewer than one repetition", () => {
    expect(buildRunPlan("c1", PROMPTS, [CLAUDE], 0)).toHaveLength(2);
    expect(buildRunPlan("c1", PROMPTS, [CLAUDE], -3)).toHaveLength(2);
  });

  it("plans nothing when a brand has no prompts or no reachable engines", () => {
    expect(buildRunPlan("c1", [], [CLAUDE], 2)).toEqual([]);
    expect(buildRunPlan("c1", PROMPTS, [], 2)).toEqual([]);
  });

  it("keys every slot on (checkup, prompt, engine, repetition)", () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE, GEMINI], 2);
    expect(new Set(slots.map(slotKey)).size).toBe(slots.length);
    // Re-planning is a pure function of the same inputs, so a retry produces
    // exactly the keys the first attempt did.
    expect(buildRunPlan("c1", PROMPTS, [CLAUDE, GEMINI], 2).map(slotKey)).toEqual(
      slots.map(slotKey),
    );
  });

  it("snapshots the shape it ran under", () => {
    expect(snapshotShape(PROMPTS, [CLAUDE, GEMINI], 3)).toEqual({
      providers: ["CLAUDE", "GEMINI"],
      promptCount: 2,
      repetitions: 3,
    });
  });
});

// ─────────────────────────────── fail-closed ───────────────────────────────

describe("which engines may spend money", () => {
  const withKeys = { ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv;

  it("runs an engine that has a key, an adapter and a rate", () => {
    expect(refusalFor(CLAUDE, withKeys)).toBeNull();
    expect(runnableEngines([CLAUDE], withKeys)).toHaveLength(1);
  });

  it("refuses an engine with a key but no rate rather than metering it at zero", () => {
    // ISOLATES THE PRICE GATE. A provider with no adapter is refused before the
    // rates are ever consulted, so asserting on one of those would pass with
    // the price check deleted — which is exactly what a mutation run showed.
    // This engine has an adapter (CLAUDE) and a key, and differs only in
    // carrying a model nothing has priced.
    const unpriced: EngineSpec = { ...CLAUDE, modelName: "claude-unpriced-9" };
    const refusal = refusalFor(unpriced, withKeys);
    expect(refusal?.reason).toBe("no_rates");
    // The failure this prevents: the calls happen, the cap never sees them, and
    // the vendor invoice is the first sign.
    expect(runnableEngines([CLAUDE, unpriced], withKeys)).toEqual([CLAUDE]);
    // And the refusal names the fix.
    expect(refusal?.detail).toContain("AI_RATES_CLAUDE");
  });

  it("refuses a provider it has no adapter for", () => {
    const refusal = refusalFor(GEMINI, withKeys);
    expect(refusal?.reason).toBe("no_adapter");
    expect(runnableEngines([CLAUDE, GEMINI], withKeys)).toEqual([CLAUDE]);
  });

  it("refuses an engine whose key is missing", () => {
    expect(refusalFor(CLAUDE, {} as NodeJS.ProcessEnv)?.reason).toBe("missing_key");
  });

  it("reports every refusal with a reason, so it does not look like an outage", () => {
    const reported = refusals([CLAUDE, GEMINI], withKeys);
    expect(reported.map((r) => r.provider)).toEqual(["GEMINI"]);
    expect(reported[0].detail).toBeTruthy();
  });

  it("lets an operator price a provider without a deploy", () => {
    // AI_RATES_<PROVIDER> is the designed path; the built-in table ships only
    // rates with a published source.
    const priced = { ...withKeys, AI_RATES_GEMINI: "1,5,0.1" } as unknown as NodeJS.ProcessEnv;
    // Still refused, but now for the honest reason: no adapter, not no price.
    expect(refusalFor(GEMINI, priced)?.reason).toBe("no_adapter");
  });
});

// ──────────────────────────── status derivation ────────────────────────────

describe("what a finished checkup calls itself", () => {
  const outcomes = (statuses: ("OK" | "SKIPPED_CAP" | "FAILED")[]) =>
    tally(statuses.map((status) => ({ status })));

  it("is READY when every planned run answered", () => {
    expect(terminalStatus(outcomes(["OK", "OK", "OK"]))).toBe("READY");
    expect(isPartialCoverage(outcomes(["OK", "OK"]))).toBe(false);
    expect(stoppedReason(outcomes(["OK", "OK"]))).toBeNull();
  });

  it("is PARTIAL when some runs were skipped or failed", () => {
    expect(terminalStatus(outcomes(["OK", "SKIPPED_CAP"]))).toBe("PARTIAL");
    expect(terminalStatus(outcomes(["OK", "FAILED"]))).toBe("PARTIAL");
    expect(isPartialCoverage(outcomes(["OK", "SKIPPED_CAP"]))).toBe(true);
  });

  it("is FAILED only when nothing answered", () => {
    expect(terminalStatus(outcomes(["FAILED", "FAILED"]))).toBe("FAILED");
    // Every run skipped at the cap: nothing went wrong, but there is nothing to
    // score either, so there is no partial result to flag.
    expect(terminalStatus(outcomes(["SKIPPED_CAP", "SKIPPED_CAP"]))).toBe("FAILED");
    expect(isPartialCoverage(outcomes(["SKIPPED_CAP"]))).toBe(false);
  });

  it("is FAILED for a plan with no slots at all", () => {
    // A checkup that asked nothing has not succeeded; calling it READY would
    // put a brand with no prompts on the dashboard as though it were monitored.
    expect(terminalStatus(outcomes([]))).toBe("FAILED");
  });

  it("names the cap specifically, because that is actionable", () => {
    expect(stoppedReason(outcomes(["OK", "SKIPPED_CAP"]))).toMatch(/cap_reached/);
    expect(stoppedReason(outcomes(["OK", "FAILED"]))).toMatch(/provider_errors/);
    expect(stoppedReason(outcomes(["OK", "SKIPPED_CAP", "FAILED"]))).toMatch(/cap_reached/);
  });
});

// ──────────────────────────── the runner itself ────────────────────────────

function fakeAnalysis(over: Partial<RunAnalysis> = {}): RunAnalysis {
  return {
    brandMentioned: true,
    mentionCount: 1,
    citations: [],
    deterministic: {
      brandMentioned: true,
      mentionCount: 1,
      listPosition: null,
      competitorNames: [],
      citedOwnDomain: false,
      citedDomains: [],
      contextSnippets: [],
    },
    brandPosition: 1,
    competitors: [],
    sentiment: "POSITIVE",
    extraction: { ok: true, inputTokens: 100, outputTokens: 20, model: "claude-haiku-4-5", attempts: 1 },
    ...over,
  };
}

interface Harness {
  ports: RunnerPorts;
  persisted: SlotOutcome[];
  asked: RunSlot[];
  analysisContext: AnalysisSignals[];
  capReads: number;
  statuses: { status: string; stoppedReason?: string | null }[];
  metrics: { partialCoverage: boolean; skippedRuns: number; engines: string[] }[];
}

/**
 * Ports whose cap goes hard after `allowance` successful asks.
 *
 * `alreadyDone` seeds a resumed checkup. `failOn` makes named slots throw, so
 * a provider error and a cap skip can be told apart.
 */
function harness(
  opts: {
    allowance?: number;
    alreadyDone?: string[];
    failOn?: (slot: RunSlot) => boolean;
    cap?: number;
    /** Name the analysis should report as ranked, for the tally tests. */
    rankCompetitor?: string | null;
  } = {},
): Harness {
  const allowance = opts.allowance ?? Number.POSITIVE_INFINITY;
  const state: Harness = {
    persisted: [],
    asked: [],
    analysisContext: [],
    capReads: 0,
    statuses: [],
    metrics: [],
    ports: null as unknown as RunnerPorts,
  };

  state.ports = {
    async readCap(): Promise<CapReading> {
      state.capReads += 1;
      const spent = state.asked.length;
      return { capped: spent >= allowance, spent, cap: opts.cap ?? allowance };
    },
    async ask(slot: RunSlot) {
      state.asked.push(slot);
      if (opts.failOn?.(slot)) throw new Error("upstream 503");
      return {
        answer: `An answer about ${slot.promptText}`,
        sources: null,
        latencyMs: 12,
        inputTokens: 50,
        outputTokens: 10,
      };
    },
    async analyze(_slot, _answer, _sources, context) {
      state.analysisContext.push(context);
      const ranked = opts.rankCompetitor;
      return fakeAnalysis(
        ranked === undefined || ranked === null
          ? {}
          : {
              competitors: [
                {
                  name: ranked,
                  position: 1,
                  classification: {
                    entity: ranked,
                    classification: "RIVAL",
                    score: 2,
                    classifierVersion: 2,
                    trace: [],
                  },
                },
              ],
            },
      );
    },
    async persistRun(outcome) {
      state.persisted.push(outcome);
    },
    async priorRuns() {
      // Prior runs come back with their outcome AND their scoreable form, so a
      // resumed checkup tallies the whole plan rather than just this pass.
      return (opts.alreadyDone ?? []).map((key) => ({
        key,
        status: "OK" as const,
        scored: {
          engine: "CLAUDE",
          promptId: key.split(":")[1] ?? "p0",
          brandMentioned: true,
          mentionCount: 1,
          brandPosition: 1,
          sentiment: "POSITIVE" as const,
          citations: [],
          competitors: [],
        },
      }));
    },
    async writeMetrics(args) {
      state.metrics.push({
        partialCoverage: args.partialCoverage,
        skippedRuns: args.skippedRuns,
        engines: args.engines.map((e) => e.engine),
      });
    },
    async setStatus(_id, status, fields) {
      state.statuses.push({ status, stoppedReason: fields?.stoppedReason });
    },
  };

  return state;
}

const runArgs = (slots: RunSlot[]) => ({
  checkupId: "c1",
  tenantId: "t1",
  brandProfileId: "b1",
  plan: "GROWTH" as PlanType,
  brand: BRAND,
  slots,
  day: new Date("2026-08-10T00:00:00Z"),
});

describe("running a checkup", () => {
  it("asks every slot and lands READY", async () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    const h = harness();
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(h.asked).toHaveLength(4);
    expect(result.status).toBe("READY");
    expect(result.tally).toEqual({ planned: 4, ok: 4, skippedCap: 0, failed: 0 });
    expect(h.statuses.map((s) => s.status)).toEqual(["RUNNING", "READY"]);
    expect(result.wroteMetrics).toBe(true);
    expect(h.metrics[0].partialCoverage).toBe(false);
  });

  it("writes a row for every slot, including the ones it refused to run", async () => {
    // A missing row is indistinguishable from a slot that was never planned.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    const h = harness({ allowance: 1 });
    await runCheckup(runArgs(slots), h.ports);

    expect(h.persisted).toHaveLength(4);
    expect(h.persisted.filter((p) => p.status === "SKIPPED_CAP")).toHaveLength(3);
    expect(h.persisted.every((p) => p.slot !== undefined)).toBe(true);
  });
});

describe("the spend cap", () => {
  it("is read before every call, not once for the checkup", async () => {
    // A single reading at the start lets the whole plan through on the strength
    // of a number that was true before any of it ran.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    const h = harness();
    await runCheckup(runArgs(slots), h.ports);
    expect(h.capReads).toBe(4);
  });

  it("skips the run and keeps going instead of failing the checkup", async () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    const h = harness({ allowance: 2 });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(result.status).toBe("PARTIAL");
    expect(result.tally).toEqual({ planned: 4, ok: 2, skippedCap: 2, failed: 0 });
    // The cap was re-read for every remaining slot rather than the loop
    // breaking on the first refusal.
    expect(h.capReads).toBe(4);
    expect(h.statuses.map((s) => s.status)).toEqual(["RUNNING", "PARTIAL"]);
  });

  it("still scores the answers it already paid for", async () => {
    // Discarding them because the budget ran out would waste money already
    // spent and report less than we know.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    const h = harness({ allowance: 2 });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(result.wroteMetrics).toBe(true);
    expect(h.metrics[0]).toMatchObject({ partialCoverage: true, skippedRuns: 2 });
  });

  it("records the cap on the checkup so the customer can act on it", async () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 1);
    const h = harness({ allowance: 1, cap: 40 });
    await runCheckup(runArgs(slots), h.ports);
    expect(h.statuses.at(-1)?.stoppedReason).toMatch(/cap_reached/);
    const skipped = h.persisted.find((p) => p.status === "SKIPPED_CAP");
    expect(skipped?.error).toMatch(/cap_reached/);
  });

  it("writes no metrics row when the cap took everything", async () => {
    // A row of zeroes would put "you are invisible" on the chart for a day we
    // never managed to ask about.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 1);
    const h = harness({ allowance: 0 });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(result.status).toBe("FAILED");
    expect(result.wroteMetrics).toBe(false);
    expect(h.metrics).toHaveLength(0);
  });
});

describe("a provider that errors", () => {
  it("fails that run only and finishes the rest", async () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 1);
    const h = harness({ failOn: (slot) => slot.promptId === "p1" });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(result.tally).toEqual({ planned: 2, ok: 1, skippedCap: 0, failed: 1 });
    expect(result.status).toBe("PARTIAL");
    expect(h.persisted.find((p) => p.status === "FAILED")?.error).toMatch(/503/);
  });

  it("keeps no answer for a failed run", async () => {
    const slots = buildRunPlan("c1", [PROMPTS[0]], [CLAUDE], 1);
    const h = harness({ failOn: () => true });
    await runCheckup(runArgs(slots), h.ports);
    expect(h.persisted[0].ask).toBeNull();
    expect(h.persisted[0].analysis).toBeNull();
  });
});

describe("idempotency", () => {
  it("does not re-ask a slot the checkup already recorded", async () => {
    // Re-running a checkup id must not double-write runs or double-spend.
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 2);
    // Half the plan survived the first attempt.
    const h = harness({ alreadyDone: slots.slice(0, 2).map(slotKey) });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(slots).toHaveLength(4);
    expect(h.asked).toHaveLength(2);
    expect(h.persisted).toHaveLength(2);
    // The tally covers the WHOLE checkup — the two runs an earlier pass
    // collected plus the two this one did. Counting only this pass would make a
    // resumed checkup describe half of itself.
    expect(result.tally).toEqual({ planned: 4, ok: 4, skippedCap: 0, failed: 0 });
    expect(result.status).toBe("READY");
  });

  it("does nothing at all on a fully completed checkup", async () => {
    const slots = buildRunPlan("c1", PROMPTS, [CLAUDE], 1);
    const h = harness({ alreadyDone: slots.map(slotKey) });
    const result = await runCheckup(runArgs(slots), h.ports);

    expect(h.asked).toHaveLength(0);
    expect(h.persisted).toHaveLength(0);
    expect(h.capReads).toBe(0);
    // AND it stays READY. Re-running a finished checkup used to find nothing to
    // do, count zero successes and write FAILED over a good result — which the
    // cadence sweep then read as "this interval was never covered", so the
    // brand was re-checked forever. Caught by the Postgres round-trip, not by
    // these fakes, because the fakes never asserted the status that was stored.
    expect(result.status).toBe("READY");
    expect(h.statuses.at(-1)?.status).toBe("READY");
  });
});

describe("shaping an analysed run for the score", () => {
  it("carries engine and prompt through, so per-engine subsets are groupable", () => {
    const slot = buildRunPlan("c1", [PROMPTS[0]], [CLAUDE], 1)[0];
    const scored = toScoredRun(slot, fakeAnalysis());
    expect(scored).toMatchObject({ engine: "CLAUDE", promptId: "p1", brandPosition: 1 });
  });
});

// ────────────────────────────── answer hashing ──────────────────────────────

describe("normalising an answer for change detection", () => {
  it("ignores reformatting", () => {
    // A model that swapped its bullets has not changed its mind, and hashing
    // the raw text would make the trend worker re-analyse a whole checkup.
    const a = normalizeAnswer("Here are the tools:\n\n* **Ahrefs**\n* _Semrush_");
    const b = normalizeAnswer("Here are the tools:\n\n- Ahrefs\n- Semrush");
    expect(a).toBe(b);
    expect(answerHash(a)).toBe(answerHash(b));
  });

  it("keeps link text and the URL, because a citation is content", () => {
    expect(normalizeAnswer("See [our pricing](https://echorank360.com/pricing).")).toBe(
      "See our pricing https://echorank360.com/pricing.",
    );
  });

  it("does not collapse genuinely different answers", () => {
    // A missed change means a brand's disappearance never registers, which is
    // far worse than a spurious one costing an analysis call.
    expect(answerHash(normalizeAnswer("Ahrefs is best."))).not.toBe(
      answerHash(normalizeAnswer("Semrush is best.")),
    );
    expect(answerHash(normalizeAnswer("We recommend Echorank360."))).not.toBe(
      answerHash(normalizeAnswer("We do not recommend Echorank360.")),
    );
  });

  it("leaves a mid-sentence hyphen alone", () => {
    expect(normalizeAnswer("It is a well-known tool")).toBe("It is a well-known tool");
  });

  it("survives an empty answer", () => {
    expect(normalizeAnswer("")).toBe("");
    expect(answerHash("")).toHaveLength(64);
  });
});

// ──────────────────────── staleness and salvage ────────────────────────

describe("declaring a checkup abandoned", () => {
  const started = new Date("2026-08-10T09:00:00Z");
  const after = (ms: number) => new Date(started.getTime() + ms);

  it("scales the budget with the size of the plan", () => {
    expect(expectedDurationMs(0)).toBe(0);
    expect(expectedDurationMs(10)).toBe(10 * PER_SLOT_BUDGET_MS);
  });

  it("waits twice the expected duration before giving up", () => {
    // 100 slots -> 2000s expected -> 4000s before it counts as dead.
    expect(isStaleRunning(started, 100, after(3_999_000))).toBe(false);
    expect(isStaleRunning(started, 100, after(4_001_000))).toBe(true);
  });

  it("never reaps inside the floor, however small the plan", () => {
    // A two-slot checkup expects 40s; without the floor it would be declared
    // dead 80 seconds in, while the first provider was still answering.
    expect(isStaleRunning(started, 2, after(5 * 60_000))).toBe(false);
    expect(isStaleRunning(started, 2, after(MIN_STALE_MS + 1_000))).toBe(true);
  });

  it("says nothing about a checkup that never started", () => {
    expect(isStaleRunning(null, 10, after(999_999_999))).toBe(false);
  });
});

describe("salvaging a dead checkup's runs", () => {
  const persisted = (over: Partial<PersistedRun> = {}): PersistedRun => ({
    engine: "CLAUDE",
    promptId: "p1",
    status: "OK",
    brandMentioned: true,
    analysis: { mentionCount: 2, recommendationPosition: 3, sentiment: "positive" },
    citations: [{ domain: "echorank360.com", citationPosition: 1, supportsBrand: true }],
    competitorMentions: [{ name: "Ahrefs", recommendationPosition: 2 }],
    ...over,
  });

  it("inverts exactly what ports.ts wrote", () => {
    // The three places the stored shape and the scored shape disagree. Each is
    // a silent wrong answer rather than a crash, which is why this is pinned.
    const scored = scoredRunFromPersisted(persisted());
    expect(scored.sentiment).toBe("POSITIVE");
    expect(scored.brandPosition).toBe(3);
    expect(scored.citations[0].isMonitoredDomain).toBe(true);
    expect(scored.competitors).toEqual([{ name: "Ahrefs", position: 2 }]);
  });

  it("keeps a missing judgement missing rather than calling it neutral", () => {
    // metrics.ts drops a mentioned run with no reading from the sentiment
    // average on purpose; inventing NEUTRAL here would defeat that.
    expect(scoredRunFromPersisted(persisted({ analysis: null })).sentiment).toBeNull();
    expect(
      scoredRunFromPersisted(
        persisted({ analysis: { mentionCount: 1, recommendationPosition: null, sentiment: null } }),
      ).sentiment,
    ).toBeNull();
  });

  it("scores only the runs that answered", () => {
    // A SKIPPED_CAP row records that we never asked; scoring it would count
    // that as the brand being absent.
    const runs = [
      persisted({ promptId: "p1" }),
      persisted({ promptId: "p2", status: "SKIPPED_CAP", brandMentioned: false, analysis: null }),
      persisted({ promptId: "p3", status: "FAILED", brandMentioned: false, analysis: null }),
    ];
    const salvaged = salvageScoredRuns(runs);
    expect(salvaged).toHaveLength(1);
    expect(salvaged[0].promptId).toBe("p1");
  });

  it("survives a run with no analysis row at all", () => {
    const scored = scoredRunFromPersisted(
      persisted({ analysis: null, citations: [], competitorMentions: [] }),
    );
    expect(scored.mentionCount).toBe(0);
    expect(scored.brandPosition).toBeNull();
    expect(scored.citations).toEqual([]);
  });
});

// ───────────── the signals the classifier needs, on the REAL path ─────────────
//
// These exist because the two cross-run signals were dead in production for a
// release. Every classifier test passed, because every classifier test supplied
// the context by hand — the gap was that ports.analyze never received it, so on
// a real checkup prompt intent and cross-prompt consistency always evaluated
// neutral. A test that hand-supplies context cannot see that; only one that
// drives runCheckup and inspects what the ANALYZE PORT was handed can.

describe("what the analysis port is actually given", () => {
  const withCategories = [
    { id: "p1", text: "best tools?", category: "COMPARISON" },
    { id: "p2", text: "alternatives?", category: "ALTERNATIVES" },
  ];

  it("passes the prompt's category through, never a neutral null", async () => {
    const slots = buildRunPlan("c1", withCategories, [CLAUDE], 1);
    const h = harness();
    await runCheckup(runArgs(slots), h.ports);

    expect(h.analysisContext).toHaveLength(2);
    expect(h.analysisContext.map((c) => c.promptCategory)).toEqual([
      "COMPARISON",
      "ALTERNATIVES",
    ]);
    // The regression: every context arriving with a null category means the
    // prompt-intent signal can never fire on a real run.
    expect(h.analysisContext.every((c) => c.promptCategory === null)).toBe(false);
  });

  it("passes a cross-prompt tally that actually grows", async () => {
    // fakeAnalysis() ranks "Ahrefs" at position 1 on every run, so by the second
    // prompt the tally must know a previous prompt ranked it.
    const slots = buildRunPlan("c1", withCategories, [CLAUDE], 1);
    const h = harness({ rankCompetitor: "Ahrefs" });
    await runCheckup(runArgs(slots), h.ports);

    expect(h.analysisContext[0].rankedInPrompts).toEqual({});
    expect(h.analysisContext[1].rankedInPrompts.ahrefs).toBe(1);
  });

  it("counts DISTINCT prompts, not mentions, across repetitions", async () => {
    // Two repetitions of ONE prompt is one prompt. Counting mentions would make
    // a single question look like a consensus and promote a stray tool to rival.
    const slots = buildRunPlan("c1", [withCategories[0]], [CLAUDE], 3);
    const h = harness({ rankCompetitor: "Ahrefs" });
    await runCheckup(runArgs(slots), h.ports);

    expect(slots).toHaveLength(3);
    expect(h.analysisContext.at(-1)!.rankedInPrompts.ahrefs).toBe(1);
  });

  it("does not count an entity the answer never ranked", async () => {
    const slots = buildRunPlan("c1", withCategories, [CLAUDE], 1);
    const h = harness({ rankCompetitor: null });
    await runCheckup(runArgs(slots), h.ports);
    expect(h.analysisContext[1].rankedInPrompts).toEqual({});
  });
});
