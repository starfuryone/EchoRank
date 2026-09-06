"use client";

// src/components/marketing/theme-toggle.tsx
//
// Night/Day switch for the marketing site.
//
// ── IT SETS AN ATTRIBUTE AND NOTHING ELSE ─────────────────────────────────
// `data-theme="day"` on <html>, or the attribute removed for night. Every
// colour in the marketing token set is a `[data-theme="day"]` override in
// globals.css, so one attribute repaints the whole site and no component
// branches on the theme. Night is the ABSENCE of the attribute, not
// `data-theme="night"` — a visitor who never touches this, and every crawler,
// gets exactly the bytes that shipped before the toggle existed.
//
// ── NO SSR BRANCH, NO COOKIE ──────────────────────────────────────────────
// The theme is read from localStorage by an inline script before paint (see
// ThemeScript below) and never reaches the server. That is what keeps these
// pages statically cacheable: a cookie would make every marketing response
// vary by header, and the route-handler pages are cached at the edge for up to
// a year. The cost is that the FIRST paint of a Day visitor is decided by that
// inline script rather than by React, which is why it must stay inline and in
// <head>.
//
// ── useSyncExternalStore, NOT useState + useEffect ────────────────────────
// localStorage is an external store, and this is the hook React provides for
// reading one without tearing. It also solves hydration by construction: the
// server snapshot is always "night", the client re-reads after hydration, and
// there is no mismatch to suppress and no setState during an effect (which is
// both a lint error here and a second render nobody needs).
//
// The subscription is a real one — a `storage` event — so opening the site in
// two tabs and switching the theme in one updates the other. That falls out of
// using the right hook rather than being extra work.

import { useCallback, useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "er-theme";

export type MarketingTheme = "night" | "day";

/**
 * The FOUC guard.
 *
 * Runs BEFORE first paint, synchronously, in <head>. Anything later — a
 * useEffect, a deferred script — paints night first and then flips, which on a
 * dark-to-light change is a full-screen flash.
 *
 * Wrapped in try/catch because localStorage throws outright in a few real
 * situations (Safari private mode historically, and any browser configured to
 * block site data). A theme preference is not worth a white screen, so the
 * failure mode is "you get night", silently.
 *
 * Minified by hand rather than by a bundler: it is inlined as a string, so
 * nothing else is going to shrink it, and at this size readable beats clever.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="day")document.documentElement.setAttribute("data-theme","day")}catch(e){}`;

export function readStoredTheme(): MarketingTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

function applyTheme(theme: MarketingTheme): void {
  syncAttribute(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Same reasoning as the init script: a preference that cannot be saved is
    // a preference that lasts one page. That is better than an error.
  }
  // localStorage does not fire `storage` in the tab that wrote it, so this tab
  // is told by hand. Without it the button repaints the page and not itself.
  for (const listener of themeListeners) listener();
}

/**
 * The server always renders night — it cannot know, and night is the default.
 * React swaps in the client snapshot after hydration without a mismatch.
 */
function serverTheme(): MarketingTheme {
  return "night";
}

/** Local listeners plus the cross-tab `storage` event. */
const themeListeners = new Set<() => void>();

function subscribeToTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      // Another tab changed it. Mirror the attribute here too, or this tab
      // shows the new icon over the old colours.
      syncAttribute(readStoredTheme());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function syncAttribute(theme: MarketingTheme): void {
  const root = document.documentElement;
  if (theme === "day") root.setAttribute("data-theme", "day");
  else root.removeAttribute("data-theme");
}

export function ThemeToggle({
  labels,
  className,
}: {
  /** From the caller's own catalog — this component owns no copy. */
  labels: { toDay: string; toNight: string };
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, readStoredTheme, serverTheme);

  const toggle = useCallback(() => {
    applyTheme(readStoredTheme() === "day" ? "night" : "day");
  }, []);

  const goingToDay = theme === "night";
  const label = goingToDay ? labels.toDay : labels.toNight;

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      // The label says what the button WILL DO, not what the theme is — a
      // control named for its current state reads as a status readout.
      aria-label={label}
      title={label}
    >
      {/* Inline SVG rather than an icon package: this file is imported by the
          standalone HTML pages' React siblings and by the nav, and neither
          should pull a dependency for two paths. */}
      <span aria-hidden="true" style={{ display: "inline-flex", width: 16, height: 16 }}>
        {goingToDay ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
