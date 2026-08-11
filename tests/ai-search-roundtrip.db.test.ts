// tests/ai-search-roundtrip.db.test.ts
//
// The integration test metrics-store.ts and runner/ports.ts are owed: a
// synthetic checkup driven through the runner into Postgres and read back.
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET, and that is not a convenience.
// This repo has exactly one configured DATABASE_URL and it points at the
// database this box serves production from; every other test in the suite
// mocks @/lib/prisma for that reason. A test that wrote a tenant, four runs and
// a metrics row into production on every `vitest run` — and this suite is run
// many times a day — would be a worse bug than anything it could catch. So it
// runs only against a database whose URL was handed to it explicitly.
//
//   createdb echorank_test
//   DATABASE_URL=<test url> npx prisma migrate deploy
//   TEST_DATABASE_URL=<test url> npx vitest run tests/ai-search-roundtrip.db.test.ts
//
// WHAT ONLY A DATABASE CAN CHECK, and therefore what this covers rather than
// re-covering the runner's logic:
//   - the columns the writers name actually exist and accept these types;
//   - the (checkupId, promptId, engine, repetition) unique index really does
//     stop a re-run doubling the rows, rather than the runner's in-memory skip
//     merely appearing to;
//   - a Decimal, a Date-as-@db.Date and a String[] survive the round trip;
//   - the cascade deletes leave nothing behind.
// A deadlock, a missing column or a constraint that fires are invisible to the
// fake-port tests by construction.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlanType } from "@/generated/prisma";

const TEST_DB = process.env.TEST_DATABASE_URL;
// Must happen before anything imports @/lib/prisma, which reads DATABASE_URL at
// module scope. Every import below is therefore dynamic.
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const SUFFIX = "roundtrip-ai-search";
const PLAN: PlanType = "GROWTH";
const DAY = new Date("2026-08-10T00:00:00.000Z");

describe.skipIf(!TEST_DB)("a checkup round-trips through Postgres", () => {
  let prisma: Awaited<typeof import("@/lib/prisma")>["prisma"];
  let tenantId = "";
  let brandProfileId = "";
  let checkupId = "";
  let promptIds: string[] = [];

  // Built here rather than imported so the shape is visible next to the
  // assertions that read it back.
  const analysisFor = (mentioned: boolean) => ({
    brandMentioned: mentioned,
    mentionCount: mentioned ? 2 : 0,
    citations: mentioned
      ? [
          {
            url: "https://echorank360.com/pricing",
            domain: "echorank360.com",
            title: null,
            citationPosition: 1,
            isMonitoredDomain: true,
          },
          {
            url: "https://g2.com/echorank360",
            domain: "g2.com",
            title: "Reviews",
            citationPosition: 2,
            isMonitoredDomain: false,
          },
        ]
      : [],
    deterministic: {
      brandMentioned: mentioned,
      mentionCount: mentioned ? 2 : 0,
      listPosition: mentioned ? 1 : null,
      competitorNames: ["Ahrefs"],
      citedOwnDomain: mentioned,
      citedDomains: mentioned ? ["echorank360.com", "g2.com"] : [],
      contextSnippets: mentioned ? ["…Echorank360 is excellent…"] : [],
    },
    brandPosition: mentioned ? 1 : null,
    competitors: [{ name: "Ahrefs", position: mentioned ? 2 : 1 }],
    sentiment: (mentioned ? "POSITIVE" : "NOT_MENTIONED") as "POSITIVE" | "NOT_MENTIONED",
    extraction: {
      ok: true,
      inputTokens: 120,
      outputTokens: 30,
      model: "claude-haiku-4-5",
      attempts: 1,
    },
  });

  async function makePorts() {
    const { prismaPorts } = await import("@/lib/ai-monitor/runner/ports");
    const { meteredAiCall } = await import("@/lib/ai-monitor/metering");

    const base = prismaPorts({
      tenantId,
      plan: PLAN,
      checkupId,
      brand: { brand: "Echorank360", domain: "echorank360.com", brandVariations: [] },
    });

    return {
      ...base,
      // The provider is stubbed — this test must not spend money — but the call
      // still goes through meteredAiCall, so the AiProviderCall ledger row and
      // the cap query it feeds are exercised against real Postgres.
      ask: async (slot: { engine: string; model: string; promptText: string }) =>
        meteredAiCall(
          { tenantId, plan: PLAN },
          { provider: "CLAUDE", model: slot.model, purpose: "answer", checkupId },
          async () => ({
            value: {
              answer: `Echorank360 and Ahrefs are options for ${slot.promptText}. https://echorank360.com/pricing`,
              sources: null,
              latencyMs: 5,
              inputTokens: 200,
              outputTokens: 60,
            },
            usage: { inputTokens: 200, outputTokens: 60 },
            model: slot.model,
          }),
        ),
      analyze: async (slot: { promptId: string }) =>
        analysisFor(slot.promptId === promptIds[0]) as never,
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));

    const tenant = await prisma.tenant.create({
      data: { name: `${SUFFIX} tenant`, slug: `${SUFFIX}-${Date.now()}` },
      select: { id: true },
    });
    tenantId = tenant.id;

    const brand = await prisma.brandProfile.create({
      data: { tenantId, name: "Echorank360", website: "https://echorank360.com" },
      select: { id: true },
    });
    brandProfileId = brand.id;

    const prompts = await Promise.all(
      ["best AI visibility tools", "alternatives to Ahrefs"].map((text) =>
        prisma.trackedPrompt.create({
          data: { tenantId, brandProfileId, text },
          select: { id: true },
        }),
      ),
    );
    promptIds = prompts.map((p) => p.id);

    const checkup = await prisma.checkup.create({
      data: { tenantId, brandProfileId, providers: ["CLAUDE"], promptCount: 2, repetitions: 2 },
      select: { id: true },
    });
    checkupId = checkup.id;
  });

  afterAll(async () => {
    if (!tenantId) return;
    // Tenant cascades to BrandProfile -> Checkup -> PromptRun -> analyses,
    // citations and competitor mentions, and to AiProviderCall. Asserted below.
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("writes a run, its analysis and its children for every slot", async () => {
    const { runCheckup } = await import("@/lib/ai-monitor/runner/checkup-runner");
    const { buildRunPlan } = await import("@/lib/ai-monitor/runner/plan");

    const engines = [
      {
        provider: "CLAUDE" as const,
        modelName: "claude-sonnet-5",
        displayName: "Claude",
        supportsSearch: true,
        supportsCitations: true,
        apiKeyEnv: "ANTHROPIC_API_KEY",
        sortOrder: 40,
      },
    ];
    const slots = buildRunPlan(
      checkupId,
      promptIds.map((id, i) => ({ id, text: `question ${i}` })),
      engines,
      2,
    );

    const result = await runCheckup(
      {
        checkupId,
        tenantId,
        brandProfileId,
        plan: PLAN,
        brand: { brand: "Echorank360", domain: "echorank360.com", brandVariations: [] },
        slots,
        day: DAY,
      },
      await makePorts(),
    );

    expect(result.status).toBe("READY");
    expect(result.tally).toEqual({ planned: 4, ok: 4, skippedCap: 0, failed: 0 });

    const runs = await prisma.promptRun.findMany({
      where: { checkupId },
      include: { analysis: true, citations: true, competitorMentions: true },
      orderBy: [{ promptId: "asc" }, { repetition: "asc" }],
    });
    expect(runs).toHaveLength(4);
    expect(runs.every((run) => run.status === "OK")).toBe(true);
    // The answer and its hash survived the trip.
    expect(runs.every((run) => (run.rawResponse ?? "").includes("Echorank360"))).toBe(true);
    expect(runs.every((run) => (run.responseHash ?? "").length === 64)).toBe(true);

    const mentioned = runs.filter((run) => run.brandMentioned);
    expect(mentioned).toHaveLength(2);
    // String[] and the child rows round-trip.
    expect(mentioned[0].analysis?.citedDomains).toEqual(["echorank360.com", "g2.com"]);
    expect(mentioned[0].citations).toHaveLength(2);
    expect(mentioned[0].competitorMentions.map((c) => c.name)).toEqual(["Ahrefs"]);
    expect(mentioned[0].analysis?.sentiment).toBe("positive");
  });

  it("writes one metrics row for the day, with the score and coverage", async () => {
    const rows = await prisma.visibilityMetric.findMany({ where: { brandProfileId } });
    expect(rows).toHaveLength(1);
    const [row] = rows;

    expect(row.engine).toBe("CLAUDE");
    expect(row.day.toISOString().slice(0, 10)).toBe("2026-08-10");
    expect(row.scoreVersion).toBe(1);
    expect(row.runCount).toBe(4);
    expect(row.partialCoverage).toBe(false);
    expect(row.skippedRuns).toBe(0);
    // 2 of 4 mentioned. Worked through, because the citation component is the
    // one that is easy to get wrong by hand — only the MENTIONED runs carry
    // citations, so its rate is 50%, not 100%:
    //   mention   2/4            -> 50   x 0.40 = 20
    //   position  100/1          -> 100  x 0.30 = 30
    //   citation  0.7*50 + 0.3*100 -> 65 x 0.20 = 13
    //   sentiment POSITIVE       -> 100  x 0.10 = 10
    // = 73. A first run of this file expected 80 and was wrong; the database
    // was right, which is the entire reason this test exists.
    expect(row.visibilityScore).toBe(73);
    // Fractions, not percentages — the units the column contract fixes.
    expect(row.mentionRate).toBe(0.5);
    expect(row.top3Rate).toBe(0.5);
    // -1..1, not the 0-100 component.
    expect(row.sentimentScore).toBe(1);
  });

  it("meters every provider call into the ledger", async () => {
    const calls = await prisma.aiProviderCall.findMany({ where: { checkupId } });
    // Four answer calls; the analysis pass is stubbed out in this test.
    expect(calls.filter((call) => call.purpose === "answer")).toHaveLength(4);
    expect(calls.every((call) => Number(call.costUsd) > 0)).toBe(true);
  });

  it("does not double-write when the same checkup id runs again", async () => {
    // The unique index is what makes this true under a race; the runner's
    // in-memory skip only makes it cheap.
    const { runCheckup } = await import("@/lib/ai-monitor/runner/checkup-runner");
    const { buildRunPlan } = await import("@/lib/ai-monitor/runner/plan");

    const before = await prisma.promptRun.count({ where: { checkupId } });
    const slots = buildRunPlan(
      checkupId,
      promptIds.map((id, i) => ({ id, text: `question ${i}` })),
      [
        {
          provider: "CLAUDE" as const,
          modelName: "claude-sonnet-5",
          displayName: "Claude",
          supportsSearch: true,
          supportsCitations: true,
          apiKeyEnv: "ANTHROPIC_API_KEY",
          sortOrder: 40,
        },
      ],
      2,
    );

    const again = await runCheckup(
      {
        checkupId,
        tenantId,
        brandProfileId,
        plan: PLAN,
        brand: { brand: "Echorank360", domain: "echorank360.com", brandVariations: [] },
        slots,
        day: DAY,
      },
      await makePorts(),
    );

    expect(await prisma.promptRun.count({ where: { checkupId } })).toBe(before);

    // The re-run describes the WHOLE checkup, not this pass. Reporting an empty
    // pass was the bug this test found on its first real execution: with
    // nothing left to do the runner counted zero successes and wrote FAILED
    // over a READY checkup, which the cadence sweep then read as "this interval
    // was never covered" and re-queued the brand forever.
    expect(again.tally).toEqual({ planned: 4, ok: 4, skippedCap: 0, failed: 0 });
    expect(again.status).toBe("READY");
    expect((await prisma.checkup.findUniqueOrThrow({ where: { id: checkupId } })).status).toBe(
      "READY",
    );

    // Nothing new was asked, so nothing new was spent.
    expect(await prisma.aiProviderCall.count({ where: { checkupId, purpose: "answer" } })).toBe(4);
    // And the day still has exactly one metrics row per engine.
    expect(await prisma.visibilityMetric.count({ where: { brandProfileId } })).toBe(1);
  });

  it("refuses a duplicate run at the database, not just in the runner", async () => {
    // Bypasses the runner entirely: this is the constraint itself.
    await expect(
      prisma.promptRun.create({
        data: {
          tenantId,
          promptId: promptIds[0],
          checkupId,
          engine: "CLAUDE",
          model: "claude-sonnet-5",
          repetition: 1,
          brandMentioned: false,
          competitors: [],
        },
      }),
    ).rejects.toThrow();
  });

  it("moves the checkup to a terminal status", async () => {
    const checkup = await prisma.checkup.findUniqueOrThrow({ where: { id: checkupId } });
    expect(checkup.status).toBe("READY");
    expect(checkup.startedAt).not.toBeNull();
    expect(checkup.completedAt).not.toBeNull();
    expect(checkup.stoppedReason).toBeNull();
  });

  it("leaves nothing behind when the tenant goes", async () => {
    // Verified here rather than trusted: an orphaned metrics row would make the
    // next run of this suite fail for a reason nobody would look for.
    const scratch = await prisma.tenant.create({
      data: { name: `${SUFFIX} cascade`, slug: `${SUFFIX}-cascade-${Date.now()}` },
      select: { id: true },
    });
    const brand = await prisma.brandProfile.create({
      data: { tenantId: scratch.id, name: "Cascade" },
      select: { id: true },
    });
    await prisma.visibilityMetric.create({
      data: {
        brandProfileId: brand.id,
        engine: "CLAUDE",
        day: DAY,
        visibilityScore: 1,
        recommendationScore: 1,
        mentionRate: 1,
        top3Rate: 1,
      },
    });

    await prisma.tenant.delete({ where: { id: scratch.id } });
    expect(await prisma.visibilityMetric.count({ where: { brandProfileId: brand.id } })).toBe(0);
  });
});
