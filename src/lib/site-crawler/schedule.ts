// src/lib/site-crawler/schedule.ts
//
// Scheduled crawls (Phase 4c): the input shape, the cadence → cron pattern,
// the next run, and the BullMQ repeat key. Dependency-free, so the
// Configuration section validates with the same schema the route uses.
//
//   daily    every day at hourUtc:00 UTC
//   weekly   Mondays at hourUtc:00 UTC
//   monthly  the 1st of the month at hourUtc:00 UTC
//
// A schedule is one BullMQ repeatable on the site-crawl queue, keyed
// `crawl-schedule-<id>` (no colon: queueJobId's rule applies to repeat keys
// too). Its tick creates a normal crawl_jobs row.

import { z } from "zod";
import type { CrawlCadence } from "@/lib/plan-config";
import { CrawlConfigInputSchema } from "./crawl-config";

export const CADENCES = ["daily", "weekly", "monthly"] as const satisfies readonly CrawlCadence[];
export const SCHEDULE_JOB_NAME = "schedule";
export const SCHEDULE_KEY_PREFIX = "crawl-schedule-";

export const ExportToSchema = z
  .object({
    /** Email the tenant owner the summary, deltas and sign-in links (crawl.reports). */
    email: z.boolean().default(false),
    /** Write the crawl to Google Sheets (crawl.sheets); null id = create one on the first run. */
    sheets: z.object({ spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/).nullable() }).nullable().default(null),
  })
  .default({ email: false, sheets: null });
export type ExportTo = z.infer<typeof ExportToSchema>;

export const ScheduleInputSchema = z.object({
  rootUrl: z.string().trim().min(1).max(2048),
  renderMode: z.enum(["none", "thin", "all"]).default("none"),
  /** The Configuration section's settings; null = the defaults. */
  config: CrawlConfigInputSchema.nullable().default(null),
  cadence: z.enum(CADENCES),
  hourUtc: z.number().int().min(0).max(23),
  enabled: z.boolean().default(true),
  exportTo: ExportToSchema,
});
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;

export const SchedulePatchSchema = z.object({
  enabled: z.boolean().optional(),
  cadence: z.enum(CADENCES).optional(),
  hourUtc: z.number().int().min(0).max(23).optional(),
  exportTo: ExportToSchema.optional(),
});

/** What crawl_schedules.config holds: the root, render mode and the SEALED crawl config (secrets encrypted). */
export interface ScheduleConfig {
  rootUrl: string;
  renderMode: "none" | "thin" | "all";
  /** StoredCrawlConfig, or null for the defaults. */
  crawl: unknown;
}

export function cronPattern(cadence: CrawlCadence, hourUtc: number): string {
  if (cadence === "daily") return `0 ${hourUtc} * * *`;
  if (cadence === "weekly") return `0 ${hourUtc} * * 1`;
  return `0 ${hourUtc} 1 * *`;
}

/** The first run strictly after `now`. */
export function nextRunAt(cadence: CrawlCadence, hourUtc: number, now: Date = new Date()): Date {
  const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, hourUtc));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (cadence === "daily") {
    const today = at(y, m, d);
    return today > now ? today : at(y, m, d + 1);
  }
  if (cadence === "weekly") {
    const ahead = (8 - now.getUTCDay()) % 7; // days until Monday (0 when today is Monday)
    const monday = at(y, m, d + ahead);
    return monday > now ? monday : at(y, m, d + ahead + 7);
  }
  const first = at(y, m, 1);
  return first > now ? first : at(y, m + 1, 1);
}

export const repeatKey = (scheduleId: string) => `${SCHEDULE_KEY_PREFIX}${scheduleId}`;

/** Cadences outside the plan's list are refused; so is a schedule past the plan's count. */
export function scheduleProblem(
  input: { cadence: CrawlCadence },
  plan: { scheduleCap: number; scheduleCadences: readonly CrawlCadence[] },
  existing: number,
): "over_plan_cap" | "cadence_not_in_plan" | null {
  if (existing >= plan.scheduleCap) return "over_plan_cap";
  if (!plan.scheduleCadences.includes(input.cadence)) return "cadence_not_in_plan";
  return null;
}
