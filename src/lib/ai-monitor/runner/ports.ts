// src/lib/ai-monitor/runner/ports.ts
//
// The real implementations behind ./checkup-runner.ts's ports: Prisma, the
// metering layer, and the provider adapter.
//
// DELIBERATELY THIN. Every decision the runner makes — when to skip, what
// status to land on, whether a metrics row is written — is in the runner and
// its pure helpers, under test. What is left here is binding, so a reader
// checking whether the cap is enforced correctly never has to read Prisma to
// find out, and so this file has nowhere to hide a rule of its own.
//
// SEPARATE FROM THE RUNNER for the reason ./metrics-store.ts is separate from
// ../metrics.ts: this imports @/lib/prisma, which builds a connection pool at
// module scope and throws without DATABASE_URL. Keeping it out of the runner is
// what lets the runner's behaviour be tested with fakes on a box with no
// database — which, in this repo, is every box, because the only configured
// DATABASE_URL points at production.
//
// EVERY PROVIDER CALL GOES THROUGH meteredAiCall. Not "should" — the cap is
// only a ceiling if there is no path around it, and this file is the only place
// the monitor talks to a vendor.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { analyzeResponse, type BrandContext } from "../analysis/analyze-response";
import { checkAiCap, meteredAiCall } from "../metering";
import { persistRunAnalysis, writeVisibilityMetrics } from "../metrics-store";
import type { AiProvider } from "../pricing";
import { askEngine } from "./providers";
import { answerHash, normalizeAnswer } from "./normalize";
import { slotKey, type RunSlot } from "./plan";
import type { RunnerPorts, SlotOutcome } from "./checkup-runner";

export interface PortContext {
  tenantId: string;
  plan: PlanType;
  checkupId: string;
  brand: BrandContext;
}

/** Bind the runner to the database and the providers. */
export function prismaPorts(ctx: PortContext): RunnerPorts {
  return {
    async readCap(tenantId: string, plan: PlanType) {
      const state = await checkAiCap(tenantId, plan);
      return { capped: state.capped, spent: state.spent, cap: state.cap };
    },

    async ask(slot: RunSlot) {
      // The answer call and the analysis call are metered separately because
      // they are separately priced and separately attributable — a tenant
      // asking about the cost of a checkup wants the split, and the ledger is
      // the only place it exists.
      const result = await meteredAiCall(
        { tenantId: ctx.tenantId, plan: ctx.plan },
        {
          provider: slot.engine as AiProvider,
          model: slot.model,
          purpose: "answer",
          checkupId: ctx.checkupId,
        },
        async () => {
          const answer = await askEngine({
            provider: slot.engine,
            model: slot.model,
            promptText: slot.promptText,
          });
          return {
            value: answer,
            usage: {
              inputTokens: answer.inputTokens,
              outputTokens: answer.outputTokens,
            },
            model: answer.model,
          };
        },
      );

      // Sources arrive only from engines that return them structurally; the
      // ones that do not fall back to the URLs in their own prose, which
      // ../analysis/citations.ts handles.
      return {
        answer: result.answer,
        sources: null,
        model: result.model,
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    },

    async analyze(slot, answer, sources) {
      return analyzeResponse(
        { answer, promptText: slot.promptText, sources },
        ctx.brand,
        { tenantId: ctx.tenantId, plan: ctx.plan, checkupId: ctx.checkupId },
      );
    },

    async persistRun(outcome: SlotOutcome) {
      const { slot, analysis, status, ask } = outcome;
      // Kept verbatim, plus the formatting-stripped form the hash is taken
      // over. Null for a skipped slot: there is no answer, and "" stored as one
      // would later be read as a genuine reply naming nobody.
      const normalized = ask ? normalizeAnswer(ask.answer) : null;
      const answerFields = ask
        ? {
            rawResponse: ask.answer,
            normalizedResponse: normalized,
            responseHash: normalized === null ? null : answerHash(normalized),
            latencyMs: ask.latencyMs ?? null,
            inputTokens: ask.inputTokens ?? 0,
            outputTokens: ask.outputTokens ?? 0,
          }
        : {};

      // UPSERT ON THE IDEMPOTENCY KEY, never create. A retried checkup re-plans
      // the same slots, and the unique index is what makes the second attempt
      // land on the first attempt's row instead of beside it.
      const run = await prisma.promptRun.upsert({
        where: {
          checkupId_promptId_engine_repetition: {
            checkupId: slot.checkupId,
            promptId: slot.promptId,
            engine: slot.engine,
            repetition: slot.repetition,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          promptId: slot.promptId,
          checkupId: slot.checkupId,
          engine: slot.engine,
          model: slot.model,
          repetition: slot.repetition,
          status,
          brandMentioned: analysis?.brandMentioned ?? false,
          competitors: (analysis?.competitors ?? []).map((c) => ({ name: c.name, mentioned: true })),
          brandRank: analysis?.brandPosition ?? null,
          error: outcome.error ?? null,
          ...answerFields,
        },
        update: {
          status,
          brandMentioned: analysis?.brandMentioned ?? false,
          competitors: (analysis?.competitors ?? []).map((c) => ({ name: c.name, mentioned: true })),
          brandRank: analysis?.brandPosition ?? null,
          error: outcome.error ?? null,
          ...answerFields,
        },
        select: { id: true },
      });

      // Only an answered run has an analysis to store. A skipped one is a row
      // that records the absence and nothing more.
      if (analysis) {
        await persistRunAnalysis({
          promptRunId: run.id,
          tenantId: ctx.tenantId,
          analysis,
        });
      }
    },

    async completedKeys(checkupId: string) {
      const rows = await prisma.promptRun.findMany({
        where: { checkupId },
        select: { checkupId: true, promptId: true, engine: true, repetition: true },
      });
      return new Set(
        rows.map((row) =>
          slotKey({
            checkupId: row.checkupId ?? checkupId,
            promptId: row.promptId,
            promptText: "",
            engine: row.engine,
            model: "",
            repetition: row.repetition,
          }),
        ),
      );
    },

    async writeMetrics({ brandProfileId, day, engines, partialCoverage, skippedRuns }) {
      await writeVisibilityMetrics(brandProfileId, day, engines, { partialCoverage, skippedRuns });
    },

    async setStatus(checkupId, status, fields) {
      await prisma.checkup.update({
        where: { id: checkupId },
        data: {
          status,
          ...(fields?.stoppedReason !== undefined ? { stoppedReason: fields.stoppedReason } : {}),
          ...(fields?.startedAt ? { startedAt: fields.startedAt } : {}),
          ...(fields?.completedAt ? { completedAt: fields.completedAt } : {}),
        },
      });
    },
  };
}

export { answerHash, normalizeAnswer };
