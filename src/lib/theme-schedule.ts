// src/lib/theme-schedule.ts
//
// The marketing site's DEFAULT theme follows the clock in New York: day from
// 09:00:00 to 16:59:59 America/New_York, night otherwise, DST-aware.
//
// ── THE DEFAULT ONLY ──────────────────────────────────────────────────────
// A visitor who has clicked the toggle has "day" or "night" stored under
// THEME_STORAGE_KEY, and that wins everywhere, at every boundary, until they
// click again. The schedule applies only while nothing is stored. How the
// choice is stored and what it is called are unchanged.
//
// ── DECIDED IN THE BROWSER, BEFORE PAINT. NOT ON THE SERVER ───────────────
// The HTML stays theme-free, as before. Three reasons:
//   1. The stored choice lives in localStorage, so the server cannot see it.
//      Server-side theming would paint the schedule over a visitor's stored
//      choice and then flip, which is the flash this exists to prevent.
//   2. Marketing pages are statically generated, and Cloudflare caches the
//      route-handler pages for up to a year. HTML themed by request time would
//      freeze whichever hour the edge happened to cache.
//   3. The init script below runs synchronously in <head>, before the body
//      paints. The first frame is therefore already the final theme, which is
//      everything server-side theming could have bought.
//
// ── MARKETING ONLY ────────────────────────────────────────────────────────
// The script runs from the root layout on every page, dashboard included. The
// schedule applies only on marketing paths ("/" and "/{locale}/..."). The app
// keeps its light theme, and a stored choice behaves exactly as it did before.
//
// Plain module, not "use client": the root layout and the landing-page route
// handlers (server) build the script, and the toggle (client) reads the rule.

export const THEME_STORAGE_KEY = "er-theme";
export const THEME_TIME_ZONE = "America/New_York";
/** First day hour, inclusive. */
export const DAY_START_HOUR = 9;
/** First night hour, inclusive: 17:00:00 is night. */
export const DAY_END_HOUR = 17;
/** Dispatched on window when the schedule flips the theme of an open tab. */
export const THEME_SCHEDULE_EVENT = "er-theme-schedule";
/** How often an open tab re-checks the clock. Under a minute, per the brief. */
export const THEME_SCHEDULE_TICK_MS = 30_000;

export type MarketingTheme = "night" | "day";

/** Marketing paths: "/" and anything under a supported locale. */
const MARKETING_PATH = /^\/(?:(?:en|en-CA|fr|fr-CA|de-CH)(?:\/|$)|$)/;

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATH.test(pathname);
}

/** The hour (0-23) in New York at `date`. Uses the tz database, never an offset. */
export function newYorkHour(date: Date): number {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: THEME_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  return h % 24;
}

/** The default theme at `date`, for a visitor with no stored choice. */
export function scheduledTheme(date: Date): MarketingTheme {
  const h = newYorkHour(date);
  return h >= DAY_START_HOUR && h < DAY_END_HOUR ? "day" : "night";
}

/** A stored value counts as a choice only if it is one of the two themes. */
export function asStoredChoice(value: string | null | undefined): MarketingTheme | null {
  return value === "day" || value === "night" ? value : null;
}

/**
 * THEME_SCHEDULE_ENABLED, default on. "false"/"0"/"off" restore the previous
 * default (night, unless the visitor chose day). Read when the page is built,
 * since the marketing pages are static.
 */
export function themeScheduleEnabled(raw: string | undefined = process.env.THEME_SCHEDULE_ENABLED): boolean {
  return !["false", "0", "off", "no"].includes((raw ?? "").trim().toLowerCase());
}

/**
 * The pre-paint script: the FOUC guard and the schedule in one place.
 *
 * It sets an attribute and nothing else, and every branch is wrapped in
 * try/catch, so a failure leaves night, as before. With the schedule off it
 * behaves exactly like the guard it replaces.
 *
 * While nothing is stored, a single interval re-checks every 30 s, so a tab
 * left open across 09:00 or 17:00 New York switches within a minute. The
 * interval stops the moment a choice is stored.
 */
export function themeInitScript(scheduleEnabled: boolean = themeScheduleEnabled()): string {
  const base =
    `var K="${THEME_STORAGE_KEY}",d=document.documentElement;` +
    `function st(){try{var v=localStorage.getItem(K);return v==="day"||v==="night"?v:null}catch(e){return null}}` +
    `function set(t){if(t==="day")d.setAttribute("data-theme","day");else d.removeAttribute("data-theme")}` +
    `var s=st();if(s==="day")set("day");`;
  if (!scheduleEnabled) return `try{(function(){${base}})()}catch(e){}`;
  const schedule =
    `if(s)return;window.__erThemeSchedule=true;` +
    `var M=${MARKETING_PATH.toString()};` +
    `function sch(){var h=+new Intl.DateTimeFormat("en-US",{timeZone:"${THEME_TIME_ZONE}",hour:"numeric",hourCycle:"h23"}).format(new Date())%24;return h>=${DAY_START_HOUR}&&h<${DAY_END_HOUR}?"day":"night"}` +
    `var i;function tick(){if(st()){clearInterval(i);return}` +
    `var t=M.test(location.pathname)?sch():"night",was=d.getAttribute("data-theme")==="day"?"day":"night";` +
    `if(t!==was){set(t);try{window.dispatchEvent(new Event("${THEME_SCHEDULE_EVENT}"))}catch(e){}}}` +
    `tick();i=setInterval(tick,${THEME_SCHEDULE_TICK_MS});`;
  return `try{(function(){${base}${schedule}})()}catch(e){}`;
}

/**
 * The guard the standalone landing pages shipped inline in their payloads.
 * Their route handlers swap it for themeInitScript(), so those pages follow
 * the same schedule without changing the payloads themselves.
 */
export const LEGACY_THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="day")document.documentElement.setAttribute("data-theme","day")}catch(e){}`;

export function withThemeSchedule(html: string): string {
  return html.replace(LEGACY_THEME_INIT_SCRIPT, themeInitScript());
}
