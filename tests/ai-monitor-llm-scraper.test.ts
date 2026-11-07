// ChatGPT and Gemini through DataForSEO's LLM Scraper standard queue:
// the parser on real responses, the task, the shared drain per endpoint, the
// owners, the ask across two passes, the "ai_tracking" metering, and the
// runner leaving a checkup RUNNING until its queued answers are back.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  postTask: vi.fn(),
  getEndpoint: vi.fn(),
  recordCall: vi.fn(),
  markSeoCallResult: vi.fn(),
  addJob: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { llmScraperTask: m.task } }));
vi.mock("@/lib/dataforseo/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dataforseo/client")>()),
  postTask: m.postTask,
  getEndpoint: m.getEndpoint,
}));
vi.mock("@/lib/dataforseo/metering", async (orig) => ({
  ...(await orig<typeof import("@/lib/dataforseo/metering")>()),
  recordCall: m.recordCall,
  markSeoCallResult: m.markSeoCallResult,
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: m.addJob }));

import {
  cleanSourceUrl,
  isLlmScraperProvider,
  llmScraperPaths,
  llmScraperTask,
  parseLlmScraperResult,
} from "@/lib/ai-monitor/runner/llm-scraper-parse";
import { askViaLlmScraper, llmScraperOwner, LLM_SCRAPER_OWNERS } from "@/lib/ai-monitor/runner/llm-scraper";
import { AnswerPending, isAnswerPending } from "@/lib/ai-monitor/runner/pending";
import { postTrackingTask } from "@/lib/ai-monitor/runner/tracking-calls";
import { sweepStandardQueue, type StandardQueueOwner } from "@/lib/dataforseo/standard-queue";
import { OWN_CAP_FEATURES } from "@/lib/dataforseo/metering";
import { SEO_SEARCH_FEATURES } from "@/lib/seo-quota";
import { runCheckup, type RunnerPorts } from "@/lib/ai-monitor/runner/checkup-runner";
import { slotKey, type RunSlot } from "@/lib/ai-monitor/runner/plan";
import { trackerAnswerRequest } from "@/lib/ai-monitor/runner/shared-answers";

const ROOT = join(__dirname, "..");
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(ROOT, "fixtures/dataforseo", name), "utf8")).tasks[0].result as unknown[];

beforeEach(() => {
  vi.clearAllMocks();
  m.addJob.mockResolvedValue({ id: "j" });
});

describe("the answer, read from real responses", () => {
  it("ChatGPT: the markdown, cited sources without utm_source=chatgpt.com, the served model", () => {
    const parsed = parseLlmScraperResult(fixture("v3-ai_optimization-chat_gpt-llm_scraper-task_get-advanced.json"))!;
    expect(parsed.answer).toMatch(/^Based on current ratings/);
    expect(parsed.answer).toContain("North Austin Dentistry");
    expect(parsed.servedModel).toBe("gpt-6");
    expect(parsed.sources.map((s) => s.url)).toEqual([
      "https://reviews.birdeye.com/d/dentists/austin-tx/",
      "https://www.bestinhood.com/austin/dentists/best-dentists-in-austin/",
      "https://www.localcitationdirectory.com/austin-texas/dentist",
    ]);
    expect(parsed.sources[0].title).toBe("Top Dentists Companies in Austin, TX");
  });

  it("Gemini: the same shape", () => {
    const parsed = parseLlmScraperResult(fixture("v3-ai_optimization-gemini-llm_scraper-task_get-advanced.json"))!;
    expect(parsed.answer).toMatch(/^Small marketing agencies/);
    expect(parsed.servedModel).toBe("3.5 Flash-Lite");
    expect(parsed.sources).toHaveLength(3);
    expect(parsed.sources[1].url).toBe("https://www.ravetree.com/blog/best-project-management-software-for-small-marketing-agencies");
  });

  it("no answer is null, not an empty answer (never scored as 'not mentioned')", () => {
    expect(parseLlmScraperResult([{ markdown: "  ", sources: [] }])).toBeNull();
    expect(parseLlmScraperResult([])).toBeNull();
    expect(parseLlmScraperResult(null)).toBeNull();
  });

  it("drops non-http sources and duplicates", () => {
    const parsed = parseLlmScraperResult([
      { markdown: "x", sources: [{ url: "javascript:alert(1)" }, { url: "https://a.example/?utm_source=chatgpt.com" }, { url: "https://a.example/" }] },
    ])!;
    expect(parsed.sources).toEqual([{ url: "https://a.example/", title: null }]);
    expect(cleanSourceUrl("https://a.example/p?x=1&utm_source=chatgpt.com")).toBe("https://a.example/p?x=1");
  });
});

describe("the task and its endpoints", () => {
  it("ChatGPT searches the web; Gemini has no such flag; both asked from the tracker's location", () => {
    expect(llmScraperTask("CHATGPT", "best dentist?", {} as NodeJS.ProcessEnv)).toEqual({
      keyword: "best dentist?",
      location_code: 2840,
      language_code: "en",
      force_web_search: true,
    });
    expect(llmScraperTask("GEMINI", "q", { AI_AIO_LOCATION_CODE: "2826", AI_AIO_LANGUAGE_CODE: "en" } as never)).toEqual({
      keyword: "q",
      location_code: 2826,
      language_code: "en",
    });
    expect((llmScraperTask("GEMINI", "x".repeat(3000), {} as never).keyword as string).length).toBe(2000);
  });

  it("each engine has its own queue", () => {
    expect(llmScraperPaths("CHATGPT")).toEqual({
      taskPost: "v3/ai_optimization/chat_gpt/llm_scraper/task_post",
      tasksReady: "v3/ai_optimization/chat_gpt/llm_scraper/tasks_ready",
      taskGet: "v3/ai_optimization/chat_gpt/llm_scraper/task_get/advanced",
    });
    expect(llmScraperPaths("GEMINI").tasksReady).toBe("v3/ai_optimization/gemini/llm_scraper/tasks_ready");
    expect(isLlmScraperProvider("CHATGPT") && isLlmScraperProvider("GEMINI") && !isLlmScraperProvider("CLAUDE")).toBe(true);
  });

  it("the shared answer cache keys them on the new adapter and the location", () => {
    const req = trackerAnswerRequest("CHATGPT", "gpt-5", 1, {} as NodeJS.ProcessEnv);
    expect(req.location).toBe("2840:en");
    expect(req.profile).not.toBe(trackerAnswerRequest("CLAUDE", "claude-haiku-5-5", 1, {} as never).profile);
  });
});

describe("the shared drain reads each queue once and fetches from the owner's endpoint", () => {
  it("one tasks_ready per distinct queue, task_get on the owner's path", async () => {
    const seen: string[] = [];
    m.getEndpoint.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path.endsWith("/tasks_ready")) {
        return { data: path.includes("chat_gpt") ? [{ id: "t-gpt" }] : path.includes("gemini") ? [{ id: "t-gem" }] : [], billing: { path: [], costUsd: 0 } };
      }
      return { data: [{ markdown: "an answer" }], billing: { path: [], costUsd: 0 } };
    });
    const completed: string[] = [];
    const owner = (name: string, se: "chat_gpt" | "gemini" | null, taskId: string): StandardQueueOwner => ({
      name,
      ...(se ? { queue: { tasksReady: `v3/ai_optimization/${se}/llm_scraper/tasks_ready`, taskGet: `v3/ai_optimization/${se}/llm_scraper/task_get/advanced` } } : {}),
      timeoutStale: async () => 0,
      findPending: async () => [{ rowId: `${name}-row`, taskId, createdAt: new Date(Date.now() - 60_000) }],
      complete: async (rowId) => void completed.push(rowId),
      fail: async () => {},
    });
    await sweepStandardQueue([owner("serp", null, "t-serp"), owner("gpt", "chat_gpt", "t-gpt"), owner("gem", "gemini", "t-gem")]);
    expect(seen.filter((p) => p.endsWith("tasks_ready")).sort()).toEqual([
      "v3/ai_optimization/chat_gpt/llm_scraper/tasks_ready",
      "v3/ai_optimization/gemini/llm_scraper/tasks_ready",
      "v3/serp/google/organic/tasks_ready",
    ]);
    expect(seen).toContain("v3/ai_optimization/chat_gpt/llm_scraper/task_get/advanced/t-gpt");
    expect(seen).toContain("v3/ai_optimization/gemini/llm_scraper/task_get/advanced/t-gem");
    expect(completed.sort()).toEqual(["gem-row", "gpt-row"]);
  });

  it("both owners are registered with the drain's worker", () => {
    expect(LLM_SCRAPER_OWNERS.map((o) => o.name)).toEqual(["llm-scraper-chatgpt", "llm-scraper-gemini"]);
    expect(readFileSync(join(ROOT, "src/infrastructure/queue/workers/serp-check.worker.ts"), "utf8")).toContain("...LLM_SCRAPER_OWNERS");
  });
});

describe("the owner", () => {
  const owner = llmScraperOwner("CHATGPT");

  it("stores a collected answer and resumes the checkup", async () => {
    m.task.update.mockResolvedValue({ checkupId: "c1" });
    await owner.complete("row1", fixture("v3-ai_optimization-chat_gpt-llm_scraper-task_get-advanced.json"));
    const data = m.task.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "DONE", servedModel: "gpt-6", error: null });
    expect(data.answer).toMatch(/^Based on current ratings/);
    expect(m.addJob).toHaveBeenCalledWith("ai-checkup", "resume", { resumeCheckupId: "c1" }, expect.objectContaining({ jobId: "checkup-resume-c1", delay: 30_000 }));
  });

  it("an empty answer is a failure, and still resumes", async () => {
    m.task.update.mockResolvedValue({ checkupId: "c1" });
    await owner.complete("row1", [{ markdown: "" }]);
    expect(m.task.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED", error: "ChatGPT returned an empty answer" });
    expect(m.addJob).toHaveBeenCalledTimes(1);
  });

  it("times out queued tasks after the drain's limit, resuming each checkup once", async () => {
    m.task.findMany.mockResolvedValue([{ id: "a", checkupId: "c1" }, { id: "b", checkupId: "c1" }, { id: "c", checkupId: "c2" }]);
    expect(await owner.timeoutStale(new Date())).toBe(3);
    expect(m.task.updateMany.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
    expect(m.addJob).toHaveBeenCalledTimes(2);
  });

  it("finds only its own engine's queued rows", async () => {
    m.task.findMany.mockResolvedValue([{ id: "r", taskId: "t", createdAt: new Date(0) }]);
    expect(await owner.findPending(new Date(), 50)).toEqual([{ rowId: "r", taskId: "t", createdAt: new Date(0) }]);
    expect(m.task.findMany.mock.calls[0][0].where).toMatchObject({ provider: "CHATGPT", status: "QUEUED" });
  });
});

describe("asking a slot across two passes", () => {
  const slot: RunSlot = { checkupId: "c1", promptId: "p1", promptText: "best dentist?", engine: "CHATGPT", model: "gpt-5", repetition: 1, promptCategory: null };
  const meterCalls: { costUsd?: number }[] = [];
  const meter = (async (_ctx: unknown, _spec: unknown, fn: () => Promise<{ value: unknown; costUsd?: number }>) => {
    const out = await fn();
    meterCalls.push({ costUsd: out.costUsd });
    return out.value;
  }) as never;
  const ask = () => askViaLlmScraper({ provider: "CHATGPT", slot, tenantId: "t1", plan: "STARTER" as never, meter, env: {} as never });

  beforeEach(() => {
    meterCalls.length = 0;
  });

  it("first pass: posts once, meters the billed cost, stores the slot, and says pending", async () => {
    m.task.findUnique.mockResolvedValue(null);
    m.postTask.mockResolvedValue({ data: null, taskId: "task-1", billing: { path: ["v3", "ai_optimization", "chat_gpt", "llm_scraper", "task_post"], costUsd: 0.0012 } });
    m.task.create.mockResolvedValue({ taskId: "task-1" });
    const err = await ask().catch((e) => e);
    expect(isAnswerPending(err)).toBe(true);
    expect(m.postTask).toHaveBeenCalledWith("v3/ai_optimization/chat_gpt/llm_scraper/task_post", expect.objectContaining({ keyword: "best dentist?", force_web_search: true }));
    expect(meterCalls).toEqual([{ costUsd: 0.0012 }]);
    expect(m.task.create.mock.calls[0][0].data).toMatchObject({ slotKey: slotKey(slot), taskId: "task-1", costUsd: 0.0012, promptText: "best dentist?", model: "gpt-5" });
    expect(m.recordCall).toHaveBeenCalledWith(expect.objectContaining({ feature: "ai_tracking", costUsd: 0.0012, dataforseoTaskId: "task-1", ok: true }));
  });

  it("while queued: pending again, nothing posted", async () => {
    m.task.findUnique.mockResolvedValue({ status: "QUEUED", taskId: "task-1" });
    expect(isAnswerPending(await ask().catch((e) => e))).toBe(true);
    expect(m.postTask).not.toHaveBeenCalled();
  });

  it("failed: the reason, as an ordinary failure", async () => {
    m.task.findUnique.mockResolvedValue({ status: "FAILED", error: "ChatGPT did not return an answer within 90 minutes" });
    await expect(ask()).rejects.toThrow(/90 minutes/);
  });

  it("done: the stored answer, at no further cost", async () => {
    m.task.findUnique.mockResolvedValue({
      status: "DONE", answer: "an answer", sources: [{ url: "https://a.example/" }], servedModel: "gpt-6", model: "gpt-5",
      createdAt: new Date(0), completedAt: new Date(60_000),
    });
    const r = await ask();
    expect(r).toMatchObject({ answer: "an answer", model: "gpt-6", costUsd: 0, inputTokens: 0, latencyMs: 60_000 });
    expect(m.postTask).not.toHaveBeenCalled();
    expect(meterCalls).toEqual([]);
  });
});

describe("tracker DataForSEO calls are 'ai_tracking'", () => {
  it("out of the pooled SEO search allowance and the SEO data budget", () => {
    expect(OWN_CAP_FEATURES).toContain("ai_tracking");
    expect(SEO_SEARCH_FEATURES as readonly string[]).not.toContain("ai_tracking");
  });

  it("a live call (Google AI Overviews) records its cost with no task id", async () => {
    m.postTask.mockResolvedValue({ data: {}, billing: { path: ["v3", "serp", "google", "organic", "live", "advanced"], costUsd: 0.004 } });
    await postTrackingTask("t1", "v3/serp/google/organic/live/advanced", {});
    expect(m.recordCall).toHaveBeenCalledWith({ tenantId: "t1", feature: "ai_tracking", path: "v3/serp/google/organic/live/advanced", costUsd: 0.004, ok: true, dataforseoTaskId: null });
  });

  it("the AI Overviews engine meters through it", () => {
    expect(readFileSync(join(ROOT, "src/lib/ai-monitor/runner/aio-engine.ts"), "utf8")).toMatch(/postTrackingTask<unknown>\(tenantId, path, task\)/);
  });
});

describe("the runner waits for queued answers", () => {
  const slots: RunSlot[] = ["CLAUDE", "CHATGPT"].map((engine) => ({
    checkupId: "c1", promptId: "p1", promptText: "q", engine, model: "m", repetition: 1, promptCategory: null,
  }));
  const analysis = { brandMentioned: true, mentionCount: 1, citations: [], deterministic: {}, brandPosition: 1, competitors: [], sentiment: "POSITIVE" } as never;

  function ports(state: { chatgptReady: boolean; persisted: string[]; prior: string[]; statuses: string[]; capped: boolean; metrics: number }): RunnerPorts {
    return {
      readCap: async () => ({ capped: state.capped, spent: 0, cap: 1 }),
      prepaid: async (s) => s.engine === "CHATGPT" && state.prior.length > 0,
      ask: async (s) => {
        if (s.engine === "CHATGPT" && !state.chatgptReady) throw new AnswerPending(slotKey(s), "task-1");
        return { answer: "a", sources: null, latencyMs: 1, inputTokens: 0, outputTokens: 0 };
      },
      analyze: async () => analysis,
      persistRun: async (o) => void state.persisted.push(slotKey(o.slot)),
      priorRuns: async () =>
        state.prior.map((key) => ({
          key, status: "OK" as const,
          scored: { engine: key.split(":")[2], promptId: "p1", brandMentioned: true, mentionCount: 1, brandPosition: 1, sentiment: "POSITIVE" as const, citations: [], competitors: [] },
        })),
      writeMetrics: async () => void (state.metrics += 1),
      setStatus: async (_id, status) => void state.statuses.push(status),
    };
  }
  const args = { checkupId: "c1", tenantId: "t1", brandProfileId: "b1", plan: "STARTER" as never, brand: { brand: "B", domain: null, brandVariations: [] }, day: new Date(0) };

  it("first pass: the queued slot is not written, nothing is scored, the checkup stays RUNNING", async () => {
    const state = { chatgptReady: false, persisted: [] as string[], prior: [] as string[], statuses: [] as string[], capped: false, metrics: 0 };
    const r = await runCheckup({ ...args, slots }, ports(state));
    expect(r.status).toBe("RUNNING");
    expect(r.pending).toBe(1);
    expect(state.persisted).toEqual(["c1:p1:CLAUDE:1"]);
    expect(state.metrics).toBe(0);
    expect(state.statuses).toEqual(["RUNNING"]);
  });

  it("resume: the answer comes back even at the cap (already paid), and the whole checkup is scored", async () => {
    const state = { chatgptReady: true, persisted: [] as string[], prior: ["c1:p1:CLAUDE:1"], statuses: [] as string[], capped: true, metrics: 0 };
    const r = await runCheckup({ ...args, slots: [slots[1]], resume: true }, ports(state));
    expect(r.status).toBe("READY");
    expect(r.pending).toBe(0);
    expect(r.tally.ok).toBe(2);
    expect(state.persisted).toEqual(["c1:p1:CHATGPT:1"]);
    expect(state.metrics).toBe(1);
  });
});
