import { describe, it, expect } from "vitest";
import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  clampTzOffset,
  isOpenAtHour,
  isOpenForOffset,
  localHourFromOffset,
} from "@/lib/assistant-hours";

const BOUNDS = { openHour: DEFAULT_OPEN_HOUR, closeHour: DEFAULT_CLOSE_HOUR };

describe("isOpenAtHour", () => {
  it("is open from the opening hour and closed from the closing hour", () => {
    // The two boundaries the spec names: 9 is in, 23 is out.
    expect(isOpenAtHour(9, 9, 23)).toBe(true);
    expect(isOpenAtHour(22, 9, 23)).toBe(true);
    expect(isOpenAtHour(23, 9, 23)).toBe(false);
    expect(isOpenAtHour(8, 9, 23)).toBe(false);
    expect(isOpenAtHour(0, 9, 23)).toBe(false);
  });

  it("handles a window that wraps midnight", () => {
    // A naive `h >= open && h < close` returns false for every hour here.
    expect(isOpenAtHour(23, 22, 2)).toBe(true);
    expect(isOpenAtHour(1, 22, 2)).toBe(true);
    expect(isOpenAtHour(2, 22, 2)).toBe(false);
    expect(isOpenAtHour(12, 22, 2)).toBe(false);
  });

  it("treats equal bounds as always open rather than never", () => {
    expect(isOpenAtHour(3, 9, 9)).toBe(true);
  });
});

describe("clampTzOffset", () => {
  it("keeps real offsets", () => {
    expect(clampTzOffset(0)).toBe(0);
    expect(clampTzOffset(-120)).toBe(-120); // UTC+2
    expect(clampTzOffset(480)).toBe(480); // UTC-8
  });

  it("clamps beyond ±14h and falls back to UTC on junk", () => {
    expect(clampTzOffset(9999)).toBe(840);
    expect(clampTzOffset(-9999)).toBe(-840);
    expect(clampTzOffset(undefined)).toBe(0);
    expect(clampTzOffset(null)).toBe(0);
    expect(clampTzOffset("nonsense")).toBe(0);
    expect(clampTzOffset(NaN)).toBe(0);
  });
});

describe("localHourFromOffset", () => {
  // 2026-08-01T12:00Z
  const noonUtc = new Date(Date.UTC(2026, 7, 1, 12, 0, 0));

  it("applies the getTimezoneOffset sign convention", () => {
    expect(localHourFromOffset(noonUtc, 0)).toBe(12);
    // getTimezoneOffset() is NEGATIVE east of UTC: Zurich (UTC+2) reports -120.
    expect(localHourFromOffset(noonUtc, -120)).toBe(14);
    // Positive west of UTC: New York (UTC-4) reports 240.
    expect(localHourFromOffset(noonUtc, 240)).toBe(8);
  });

  it("wraps across the date line", () => {
    const lateUtc = new Date(Date.UTC(2026, 7, 1, 23, 0, 0));
    expect(localHourFromOffset(lateUtc, -120)).toBe(1); // next day, 01:00
  });
});

describe("isOpenForOffset", () => {
  const noonUtc = new Date(Date.UTC(2026, 7, 1, 12, 0, 0));

  it("gates on the visitor's local hour, not UTC", () => {
    // 12:00 UTC is inside 9–23 for UTC itself...
    expect(isOpenForOffset(noonUtc, 0, BOUNDS)).toBe(true);
    // ...but 02:00 local in UTC+14, which is outside.
    expect(isOpenForOffset(noonUtc, -840, BOUNDS)).toBe(false);
    // and 01:00 local in UTC-11.
    expect(isOpenForOffset(noonUtc, 660, BOUNDS)).toBe(false);
  });

  it("treats a missing or absurd offset as UTC", () => {
    expect(isOpenForOffset(noonUtc, undefined, BOUNDS)).toBe(true);
    const threeAmUtc = new Date(Date.UTC(2026, 7, 1, 3, 0, 0));
    expect(isOpenForOffset(threeAmUtc, undefined, BOUNDS)).toBe(false);
    // An absurd offset is clamped to ±14h, NOT rejected — and within that
    // range it can still land inside the window: 03:00Z at UTC-14 is 13:00
    // local. That is the accepted trade-off, since a spoofed offset only buys
    // a chat the rate limiter already bounds. Asserted so nobody "fixes" the
    // clamp later believing it prevents this.
    expect(isOpenForOffset(threeAmUtc, 100000, BOUNDS)).toBe(true);
    expect(clampTzOffset(100000)).toBe(840);
  });

  it("closes exactly at the closing hour", () => {
    const elevenPmUtc = new Date(Date.UTC(2026, 7, 1, 23, 0, 0));
    expect(isOpenForOffset(elevenPmUtc, 0, BOUNDS)).toBe(false);
    const tenFiftyNine = new Date(Date.UTC(2026, 7, 1, 22, 59, 0));
    expect(isOpenForOffset(tenFiftyNine, 0, BOUNDS)).toBe(true);
  });
});
