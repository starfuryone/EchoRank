/**
 * @vitest-environment jsdom
 */
// tests/theme-schedule.test.ts
//
// The marketing default theme follows New York time: day 09:00:00–16:59:59
// America/New_York, night otherwise. A stored toggle choice always wins. The
// pre-paint script is exercised for real (eval'd under a mocked clock), since
// it decides the first frame.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_THEME_INIT_SCRIPT,
  THEME_SCHEDULE_EVENT,
  isMarketingPath,
  newYorkHour,
  scheduledTheme,
  themeInitScript,
  themeScheduleEnabled,
  withThemeSchedule,
} from "@/lib/theme-schedule";

/** A wall-clock time in New York, as a UTC instant, for the offset in force. */
const ny = (iso: string, offsetHours: 4 | 5) =>
  new Date(Date.parse(`${iso}Z`) + offsetHours * 3_600_000);

describe("schedule boundaries (New York wall clock)", () => {
  // 2026-07-15 is EDT (UTC-4).
  it.each([
    ["08:59:59", "night"],
    ["09:00:00", "day"],
    ["16:59:59", "day"],
    ["17:00:00", "night"],
    ["00:00:00", "night"],
    ["12:00:00", "day"],
    ["20:00:00", "night"],
  ] as const)("%s EDT -> %s", (time, want) => {
    expect(scheduledTheme(ny(`2026-07-15T${time}`, 4))).toBe(want);
  });

  it.each([
    ["08:59:59", "night"],
    ["09:00:00", "day"],
    ["16:59:59", "day"],
    ["17:00:00", "night"],
  ] as const)("%s EST -> %s", (time, want) => {
    // 2026-01-15 is EST (UTC-5).
    expect(scheduledTheme(ny(`2026-01-15T${time}`, 5))).toBe(want);
  });
});

describe("DST change days", () => {
  // 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST. After 02:00 the
  // offset is -5, so 09:00 local is 14:00Z, not 13:00Z.
  it("November fall-back: 09:00 and 17:00 local fall on the EST offset", () => {
    expect(scheduledTheme(new Date("2026-11-01T13:59:59Z"))).toBe("night"); // 08:59:59 EST
    expect(scheduledTheme(new Date("2026-11-01T14:00:00Z"))).toBe("day"); // 09:00 EST
    expect(scheduledTheme(new Date("2026-11-01T21:59:59Z"))).toBe("day"); // 16:59:59 EST
    expect(scheduledTheme(new Date("2026-11-01T22:00:00Z"))).toBe("night"); // 17:00 EST
    // A fixed UTC-4 would have called 13:00Z "09:00" — it is 08:00 here.
    expect(newYorkHour(new Date("2026-11-01T13:00:00Z"))).toBe(8);
  });

  it("March spring-forward: 09:00 and 17:00 local fall on the EDT offset", () => {
    // 2026-03-08: 02:00 EST -> 03:00 EDT.
    expect(scheduledTheme(new Date("2026-03-08T12:59:59Z"))).toBe("night"); // 08:59:59 EDT
    expect(scheduledTheme(new Date("2026-03-08T13:00:00Z"))).toBe("day"); // 09:00 EDT
    expect(scheduledTheme(new Date("2026-03-08T20:59:59Z"))).toBe("day"); // 16:59:59 EDT
    expect(scheduledTheme(new Date("2026-03-08T21:00:00Z"))).toBe("night"); // 17:00 EDT
    expect(newYorkHour(new Date("2026-03-08T07:30:00Z"))).toBe(3); // 02:30 never exists
  });
});

describe("a visitor in another time zone sees New York time", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });
  it.each(["Asia/Tokyo", "Europe/Zurich", "America/Los_Angeles", "UTC"])("%s", (tz) => {
    process.env.TZ = tz;
    // 12:00 New York is day and 20:00 New York is night, whatever the local clock says.
    expect(scheduledTheme(ny("2026-07-15T12:00:00", 4))).toBe("day");
    expect(scheduledTheme(ny("2026-07-15T20:00:00", 4))).toBe("night");
  });
});

describe("marketing paths only", () => {
  it.each(["/", "/en", "/fr", "/fr/pricing", "/en/free-audit", "/de-CH/resources", "/fr-CA/"])("%s", (p) =>
    expect(isMarketingPath(p)).toBe(true),
  );
  it.each(["/dashboard", "/settings/account", "/login", "/help", "/english", "/api/x"])("not %s", (p) =>
    expect(isMarketingPath(p)).toBe(false),
  );
});

describe("THEME_SCHEDULE_ENABLED", () => {
  it("defaults on", () => {
    expect(themeScheduleEnabled(undefined)).toBe(true);
    expect(themeScheduleEnabled("")).toBe(true);
    expect(themeScheduleEnabled("true")).toBe(true);
  });
  it.each(["false", "0", "off", "FALSE"])("%s turns it off", (v) => {
    expect(themeScheduleEnabled(v)).toBe(false);
  });
});

// ─── The pre-paint script, run for real ────────────────────────────────────

const root = () => document.documentElement;

function runInit(opts: { at: Date; path: string; stored?: string; enabled?: boolean }) {
  vi.setSystemTime(opts.at);
  window.history.replaceState(null, "", opts.path);
  localStorage.clear();
  if (opts.stored) localStorage.setItem("er-theme", opts.stored);
  root().removeAttribute("data-theme");
  delete (window as { __erThemeSchedule?: boolean }).__erThemeSchedule;
  new Function(themeInitScript(opts.enabled ?? true))();
}

describe("init script", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const NOON = ny("2026-07-15T12:00:00", 4);
  const EIGHT_PM = ny("2026-07-15T20:00:00", 4);

  for (const path of ["/", "/fr"]) {
    it(`${path}: no stored choice -> day at 12:00 NY, night at 20:00 NY`, () => {
      runInit({ at: NOON, path });
      expect(root().getAttribute("data-theme")).toBe("day");
      runInit({ at: EIGHT_PM, path });
      expect(root().getAttribute("data-theme")).toBeNull();
    });

    it(`${path}: stored night at 12:00 stays night; stored day at 20:00 stays day`, () => {
      runInit({ at: NOON, path, stored: "night" });
      expect(root().getAttribute("data-theme")).toBeNull();
      runInit({ at: EIGHT_PM, path, stored: "day" });
      expect(root().getAttribute("data-theme")).toBe("day");
    });
  }

  it("/dashboard is untouched by the schedule", () => {
    runInit({ at: NOON, path: "/dashboard" });
    expect(root().getAttribute("data-theme")).toBeNull();
  });

  it("a stored day choice still applies anywhere, exactly as before", () => {
    runInit({ at: EIGHT_PM, path: "/dashboard", stored: "day" });
    expect(root().getAttribute("data-theme")).toBe("day");
  });

  it("switches an open tab within a minute of 17:00 and announces it", () => {
    runInit({ at: ny("2026-07-15T16:59:40", 4), path: "/en" });
    expect(root().getAttribute("data-theme")).toBe("day");
    const heard = vi.fn();
    window.addEventListener(THEME_SCHEDULE_EVENT, heard);
    vi.advanceTimersByTime(60_000);
    expect(root().getAttribute("data-theme")).toBeNull();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(THEME_SCHEDULE_EVENT, heard);
  });

  it("switches within a minute of 09:00", () => {
    runInit({ at: ny("2026-07-15T08:59:30", 4), path: "/fr" });
    expect(root().getAttribute("data-theme")).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(root().getAttribute("data-theme")).toBe("day");
  });

  it("stops ticking once a choice is stored, and never overrides it at a boundary", () => {
    runInit({ at: ny("2026-07-15T16:59:40", 4), path: "/en" });
    localStorage.setItem("er-theme", "day"); // the visitor clicks
    vi.advanceTimersByTime(120_000); // past 17:00
    expect(root().getAttribute("data-theme")).toBe("day");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs no interval at all when a choice is already stored", () => {
    runInit({ at: NOON, path: "/en", stored: "night" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("THEME_SCHEDULE_ENABLED=false falls back to the old default", () => {
    runInit({ at: NOON, path: "/en", enabled: false });
    expect(root().getAttribute("data-theme")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    runInit({ at: NOON, path: "/en", stored: "day", enabled: false });
    expect(root().getAttribute("data-theme")).toBe("day");
  });

  it("survives localStorage throwing (private mode): schedule still applies", () => {
    vi.setSystemTime(NOON);
    window.history.replaceState(null, "", "/en");
    root().removeAttribute("data-theme");
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    new Function(themeInitScript(true))();
    expect(root().getAttribute("data-theme")).toBe("day");
    spy.mockRestore();
  });
});

describe("landing pages get the same script", () => {
  it("replaces the legacy guard their payloads carry", async () => {
    const { GLOSSARY_HTML } = await import("@/app/[locale]/glossary/landing-html");
    expect(GLOSSARY_HTML).toContain(LEGACY_THEME_INIT_SCRIPT);
    const out = withThemeSchedule(GLOSSARY_HTML);
    expect(out).not.toContain(LEGACY_THEME_INIT_SCRIPT);
    expect(out).toContain("America/New_York");
  });
});
