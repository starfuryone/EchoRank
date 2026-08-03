// Category 05 — social calendar. The grid, the pillar rotation and the format
// cycle are scheduling logic, so they are computed here. The one model call
// writes hooks against the finished schedule and nothing else.

export const POST_FORMATS = ["text", "carousel", "video", "poll"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export interface CalendarSlot {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  pillar: string;
  format: PostFormat;
}

export interface CalendarInput {
  /** ISO date the calendar starts on. Passed in — never defaulted to today,
   *  so the same inputs always produce the same schedule and the Redis result
   *  cache stays meaningful. */
  startDate: string;
  days: number;
  pillars: string[];
  maxConsecutive: number;
}

const MAX_DAYS = 90;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Build the schedule.
 *
 * Pillars rotate in order, and the rotation is FORCED to advance once a pillar
 * has run `maxConsecutive` days — that constraint is the whole reason this is
 * code rather than a prompt. A model asked to "vary the pillars" will happily
 * emit four Testimonials in a row and call it varied.
 *
 * Formats cycle independently of pillars, so the two do not lock into a
 * repeating pair (every Product post a carousel, forever).
 */
export function buildCalendar(input: CalendarInput): CalendarSlot[] {
  const pillars = input.pillars.map((p) => p.trim()).filter(Boolean);
  if (pillars.length === 0) throw new Error("At least one pillar is required.");
  if (!isValidIsoDate(input.startDate)) throw new Error("startDate must be an ISO date (YYYY-MM-DD).");

  const days = Math.max(1, Math.min(Math.floor(input.days), MAX_DAYS));
  // A cap below 1 would make the constraint unsatisfiable; with one pillar the
  // cap cannot be honoured at all, so it is ignored rather than looping forever.
  const cap = Math.max(1, Math.floor(input.maxConsecutive));

  const slots: CalendarSlot[] = [];
  let pillarIdx = 0;
  let run = 0;

  for (let i = 0; i < days; i++) {
    if (pillars.length > 1 && run >= cap) {
      pillarIdx = (pillarIdx + 1) % pillars.length;
      run = 0;
    }
    const pillar = pillars[pillarIdx];
    slots.push({
      date: addDays(input.startDate, i),
      pillar,
      format: POST_FORMATS[i % POST_FORMATS.length],
    });
    run++;
  }

  return slots;
}

/** Longest run of any single pillar — what the constraint test asserts on. */
export function longestPillarRun(slots: CalendarSlot[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const s of slots) {
    run = s.pillar === prev ? run + 1 : 1;
    prev = s.pillar;
    if (run > best) best = run;
  }
  return best;
}

/**
 * The schedule as the model receives it — date, pillar and format per slot.
 * No business data beyond the pillar names the user typed.
 */
export function scheduleForAi(slots: CalendarSlot[]): string {
  return JSON.stringify(slots.map((s) => ({ date: s.date, pillar: s.pillar, format: s.format })));
}

/** Merge the model's hooks back onto the schedule, matching by date. Slots the
 *  model skipped keep a null hook rather than shifting the calendar. */
export function mergeHooks(
  slots: CalendarSlot[],
  hooks: Array<{ date?: unknown; hook?: unknown }>,
): Array<CalendarSlot & { hook: string | null }> {
  const byDate = new Map<string, string>();
  for (const h of hooks) {
    if (typeof h?.date === "string" && typeof h?.hook === "string") byDate.set(h.date, h.hook);
  }
  return slots.map((s) => ({ ...s, hook: byDate.get(s.date) ?? null }));
}
