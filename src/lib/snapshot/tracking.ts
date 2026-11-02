// src/lib/snapshot/tracking.ts
//
// "Track these 10 prompts weekly": which plan covers N prompts × E engines ×
// a cadence. Dependency-free; the pricing grid (a Client Component) imports it.
//
// Live pricing is the plan grid (PLAN_CONFIGS aiCheckup: prompts, providers,
// frequency). The prompt-based pricing rework is parked on wip/prompt-pricing
// and not live; when it lands, this is the one function to repoint.

export type TrackFrequency = "none" | "weekly" | "twice_weekly" | "daily" | "custom";

export const CHECKUPS_PER_WEEK: Record<TrackFrequency, number> = {
  none: 0,
  weekly: 1,
  twice_weekly: 2,
  daily: 7,
  // Enterprise: whatever was agreed, so assume it covers any cadence.
  custom: 7,
};

export interface TrackWant {
  prompts: number;
  engines: number;
  perWeek: number;
}

/** "10x2-weekly" → { prompts: 10, engines: 2, perWeek: 1 }. */
export function parseTrackParam(v: string | null): TrackWant | null {
  const m = /^(\d{1,3})x(\d)-(weekly|twice_weekly|daily)$/.exec(v ?? "");
  if (!m) return null;
  return { prompts: Number(m[1]), engines: Number(m[2]), perWeek: CHECKUPS_PER_WEEK[m[3] as TrackFrequency] };
}

export function fitsTracking(
  plan: { prompts: number; providers: number | null; perWeek: number },
  want: TrackWant,
): boolean {
  return (
    plan.prompts >= want.prompts &&
    (plan.providers === null || plan.providers >= want.engines) &&
    plan.perWeek >= want.perWeek
  );
}
