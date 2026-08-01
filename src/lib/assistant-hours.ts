// Opening-hours logic for the assistant widget.
//
// WHY THIS EXISTS ON ITS OWN: the widget and /api/assistant/chat do not exist
// in this branch yet. This is the half of the hours amendment that is fully
// specified without them — pure functions, no UI, no transport — so it can be
// written and tested now and consumed unchanged when the widget lands. Both
// callers need the same answer and must not compute it two different ways:
// the client decides whether to show the input, the server rejects with 403,
// and a disagreement between them is a support ticket.

/** 09:00–23:00 visitor-local, per the spec. */
export const DEFAULT_OPEN_HOUR = 9;
export const DEFAULT_CLOSE_HOUR = 23;

/** ±14h is the widest real UTC offset (Line Islands / Baker Island). */
const MAX_OFFSET_MINUTES = 840;

function readHour(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  // A typo in an env var must not silently make the assistant permanently
  // offline, so anything unparseable falls back to the documented default.
  if (!Number.isInteger(n) || n < 0 || n > 24) return fallback;
  return n;
}

/**
 * Bounds from NEXT_PUBLIC_ASSISTANT_OPEN_HOUR / _CLOSE_HOUR.
 *
 * Read through explicit property access, not a computed key: Next inlines
 * NEXT_PUBLIC_* at build time by literal match, and a dynamic lookup yields
 * undefined in the browser bundle.
 */
export function configuredHours(): { openHour: number; closeHour: number } {
  return {
    openHour: readHour(process.env.NEXT_PUBLIC_ASSISTANT_OPEN_HOUR, DEFAULT_OPEN_HOUR),
    closeHour: readHour(process.env.NEXT_PUBLIC_ASSISTANT_CLOSE_HOUR, DEFAULT_CLOSE_HOUR),
  };
}

/**
 * Is `hour` inside [openHour, closeHour)?
 *
 * Handles a window that wraps midnight (open 22, close 2) rather than
 * returning false for every hour, which is what a naive `h >= open && h < close`
 * does. Equal bounds mean "always open" — a zero-length window would be a
 * config mistake that silences the assistant forever.
 */
export function isOpenAtHour(hour: number, openHour: number, closeHour: number): boolean {
  if (openHour === closeHour) return true;
  if (openHour < closeHour) return hour >= openHour && hour < closeHour;
  return hour >= openHour || hour < closeHour;
}

/**
 * Sanitise a client-sent Date#getTimezoneOffset() value.
 *
 * Missing, non-finite or out-of-range means UTC (0). This is cost control, not
 * security: a spoofed offset only buys a chat the rate limiter already bounds.
 */
export function clampTzOffset(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Math.trunc(n)));
}

/**
 * The visitor's local hour, from a UTC instant plus their reported offset.
 *
 * getTimezoneOffset() is (UTC - local) in minutes — positive WEST of UTC — so
 * local time is `utc - offset`, and the sign is the easy thing to get backwards.
 */
export function localHourFromOffset(now: Date, tzOffsetMinutes: number): number {
  const shifted = new Date(now.getTime() - clampTzOffset(tzOffsetMinutes) * 60_000);
  return shifted.getUTCHours();
}

/** Server-side gate for /api/assistant/chat. */
export function isOpenForOffset(
  now: Date,
  tzOffsetMinutes: unknown,
  bounds: { openHour: number; closeHour: number } = configuredHours(),
): boolean {
  const hour = localHourFromOffset(now, clampTzOffset(tzOffsetMinutes));
  return isOpenAtHour(hour, bounds.openHour, bounds.closeHour);
}
