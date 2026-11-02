// tests/snapshot-run.test.ts
//
// runSnapshot with fake engines and in-memory storage: the cost and call
// caps, the interleaving that keeps a capped run even across engines, resume
// after a retry, and the competitor extraction feeding the report.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ANSWER_CALLS, runSnapshot, type AnswerRow, type RunDeps } from "@/lib/snapshot/run";
import { buildPrompts } from "@/lib/snapshot/prompts";
import type { Answer, EngineConfig } from "@/lib/snapshot/engines";
import type { SnapshotEngine } from "@/lib/snapshot/types";

const ENGINES: EngineConfig[] = [
  { engine: "openai", model: "gpt-4.1-mini", apiKey: "k" },
  { engine: "gemini", model: "gemini-3.1-flash-lite", apiKey: "k" },
];
const spec = {
  id: "snap1",
  brand: "Acme Plumbing",
  domain: "acmeplumbing.co.uk",
  category: "emergency plumber",
  location: "Leeds",
  prompts: buildPrompts({ brand: "Acme Plumbing", domain: "acmeplumbing.co.uk", category: "emergency plumber", location: "Leeds" }),
};

function harness(opts: { cap?: number; perCall?: number; answer?: (e: SnapshotEngine, i: number) => Answer | Error; stored?: AnswerRow[] } = {}) {
  const db = new Map<string, AnswerRow>((opts.stored ?? []).map((r) => [`${r.promptIndex}:${r.engine}`, r]));
  const asked: string[] = [];
  const perCall = opts.perCall ?? 0.01;
  const deps: RunDeps = {
    engines: ENGINES,
    capUsd: opts.cap ?? 1,
    ask: vi.fn(async (cfg: EngineConfig, prompt: string) => {
      const i = spec.prompts.findIndex((p) => p.text === prompt);
      asked.push(`${i}:${cfg.engine}`);
      const a = opts.answer?.(cfg.engine, i) ?? {
        text: i % 2 ? "Pipeworks Ltd is the usual pick." : "Acme Plumbing and Pipeworks Ltd are both good.",
        sourceUrls:
          i === 0
            ? ["https://acmeplumbing.co.uk/", "https://www.checkatrade.com/x"]
            : i % 2
              ? ["https://checkatrade.com/y", "https://www.yell.com/z"]
              : ["https://checkatrade.com/y"],
        usage: { inputTokens: 100, outputTokens: 100 },
        model: cfg.model,
      };
      if (a instanceof Error) throw a;
      return a;
    }),
    askJson: vi.fn(async (_cfg, instructions: string, input: string) => ({
      value: instructions.startsWith("Classify")
        ? { domains: [{ domain: "yell.com", type: "directory" }] }
        : {
        answers: [...input.matchAll(/### Answer (\d+)/g)].map((m) => ({
          index: Number(m[1]),
          competitors: ["Pipeworks Ltd", "pipeworks ltd.", "Acme Plumbing"],
        })),
      },
      usage: { inputTokens: 10, outputTokens: 10 },
    })),
    cost: (_e, _m, _u, searched) => (searched ? perCall : 0.001),
    estimate: (_e, _m, searched) => (searched ? perCall : 0.001),
    loadAnswers: async () => [...db.values()],
    saveAnswer: async (_id, row) => void db.set(`${row.promptIndex}:${row.engine}`, row),
    saveAnalysis: async () => undefined,
    now: () => new Date("2026-11-02T05:00:00Z"),
  };
  return { deps, db, asked };
}

describe("runSnapshot", () => {
  it("asks 10 prompts × 2 engines, scores them, extracts competitors once per engine, classifies once", async () => {
    const { deps, asked } = harness();
    const r = await runSnapshot(spec, deps);
    expect(asked).toHaveLength(20);
    expect(deps.askJson).toHaveBeenCalledTimes(3);
    expect(r.calls).toBe(23);
    expect(r.costUsd).toBeCloseTo(20 * 0.01 + 3 * 0.001, 8);
    const [openai, gemini] = r.report.engines;
    expect(openai).toMatchObject({ engine: "openai", asked: 10, answered: 10, mentioned: 5, cited: 1, mentionRate: 0.5, citationRate: 0.1 });
    expect(gemini.mentionRate).toBe(0.5);
    // Deduped across spellings, the brand itself dropped.
    expect(r.report.competitors).toEqual([{ name: "Pipeworks Ltd", count: 20, byEngine: { openai: 10, gemini: 10 } }]);
    // checkatrade.com is cited by every answer; the user's site only by prompt 0, so
    // the user was cited beside checkatrade there and it is not a gap.
    expect(r.report.sources[0]).toMatchObject({ domain: "checkatrade.com", timesCited: 20, userCited: true });
    expect(r.report.sources[0].competitors[0]).toMatchObject({ name: "Pipeworks Ltd", count: 20 });
    // yell.com is cited only beside competitors: the one gap, classified and actioned.
    expect(r.report.sources[1]).toMatchObject({ domain: "yell.com", timesCited: 10, userCited: false });
    expect(r.report.actions).toEqual([{ domain: "yell.com", timesCited: 10, type: "directory", action: "get_listed" }]);
    // Excerpts are centred on the first brand or competitor mention.
    expect(r.report.prompts[1].results.openai?.excerpt).toBe("Pipeworks Ltd is the usual pick.");
    expect(r.report.capped).toBe(false);
  });

  it("the cost cap stops the run, evenly across engines, and never crosses the cap", async () => {
    const { deps, asked } = harness({ cap: 0.1, perCall: 0.0125 });
    const r = await runSnapshot(spec, deps);
    expect(asked.length).toBe(8); // 8 × 0.0125 = 0.1 exactly; a 9th would cross it
    expect(r.costUsd).toBeLessThanOrEqual(0.1 + 1e-9);
    const by = (e: string) => asked.filter((a) => a.endsWith(e)).length;
    expect(Math.abs(by("openai") - by("gemini"))).toBeLessThanOrEqual(1);
    expect(r.report.capped).toBe(true);
    const skipped = r.report.prompts.flatMap((p) => Object.values(p.results)).filter((c) => c?.error === "cost_cap");
    expect(skipped.length).toBe(20 - 8);
    // No room left for the extraction calls either.
    expect(deps.askJson).not.toHaveBeenCalled();
  });

  it("never makes more than MAX_ANSWER_CALLS search calls", async () => {
    const tooMany = { ...spec, prompts: [...spec.prompts, ...spec.prompts.map((p) => ({ ...p, text: `${p.text} (2)` }))] };
    const { deps, asked } = harness();
    await runSnapshot(tooMany, deps);
    expect(asked.length).toBe(MAX_ANSWER_CALLS);
  });

  it("a retry re-asks only what errored, and the errored calls' cost still counts", async () => {
    // A job is retried only when every answer errored (processSnapshot throws);
    // here one engine had an outage on the first attempt, so it is the
    // general shape: answered rows are kept, errored rows are asked again.
    const first = harness({ answer: (e, i) => (e === "gemini" && i >= 5 ? new Error("HTTP 503") : (undefined as never)) });
    await runSnapshot(spec, first.deps);
    const stored = [...first.db.values()];
    expect(stored.filter((r) => r.error)).toHaveLength(5);

    const second = harness({ stored });
    const r = await runSnapshot(spec, second.deps);
    expect(second.asked.sort()).toEqual(["5:gemini", "6:gemini", "7:gemini", "8:gemini", "9:gemini"]);
    expect(r.report.engines[1].answered).toBe(10);
    // 15 answers + 5 errors charged at the estimate, then 5 answers and one
    // extraction (the OpenAI answers already have theirs). The first
    // attempt's extraction calls live on no answer row and are not re-counted.
    expect(r.costUsd).toBeCloseTo(20 * 0.01 + 5 * 0.01 + 0.001 + 0.001, 8); // + the classification
  });

  it("every answer errored: allErrored, no extraction", async () => {
    const { deps } = harness({ answer: () => new Error("HTTP 401: bad key") });
    const r = await runSnapshot(spec, deps);
    expect(r.allErrored).toBe(true);
    expect(deps.askJson).not.toHaveBeenCalled();
    expect(r.report.engines.every((e) => e.answered === 0 && e.mentionRate === null)).toBe(true);
  });

  it("a failed extraction leaves the rates standing, with no competitors", async () => {
    const { deps } = harness();
    deps.askJson = vi.fn(async () => {
      throw new Error("bad json");
    });
    const r = await runSnapshot(spec, deps);
    expect(r.report.competitors).toEqual([]);
    expect(r.report.engines[0].mentionRate).toBe(0.5);
  });
});
