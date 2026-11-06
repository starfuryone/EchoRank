"use client";

// The cookie banner on the public pages (src/lib/consent/cookie-consent.ts).
// Shown until the visitor chooses; "Cookie settings" in the footer reopens it.
// Accept and Reject are the same element, the same size and the same weight —
// neither is the "primary" button. Analytics stays off (Consent Mode default
// denied, set by the layout's inline script) unless Accept is pressed.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  COOKIE_CONSENT_COPY,
  OPEN_COOKIE_SETTINGS_EVENT,
  consentUpdate,
  cookieLocale,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent/cookie-consent";

type Gtag = (...args: unknown[]) => void;

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function CookieConsent() {
  const params = useParams<{ locale?: string }>();
  const c = COOKIE_CONSENT_COPY[cookieLocale(params?.locale)];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // After hydration only: the server never knows the stored choice.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store once on mount
    setOpen(readConsent(storage()) === null);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const choose = useCallback((choice: ConsentChoice) => {
    writeConsent(storage(), choice);
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    gtag?.("consent", "update", consentUpdate(choice));
    setOpen(false);
  }, []);

  if (!open) return null;
  const button: React.CSSProperties = {
    flex: "1 1 0",
    minWidth: 120,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid var(--er-border, #474d57)",
    background: "var(--er-surface, #1e2329)",
    color: "var(--er-text, #eaecef)",
    font: "600 14px/1.2 inherit",
    cursor: "pointer",
  };
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="er-cookie-title"
      data-testid="cookie-banner"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        maxWidth: 560,
        margin: "0 auto",
        padding: 16,
        borderRadius: 12,
        background: "var(--er-bg, #181a20)",
        color: "var(--er-text, #eaecef)",
        border: "1px solid var(--er-border, #2b3139)",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
      }}
    >
      <p id="er-cookie-title" style={{ margin: "0 0 6px", fontWeight: 700 }}>
        {c.title}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5, color: "var(--er-text-muted, #b7bdc6)" }}>
        {c.body}{" "}
        <a href={`/${params?.locale ?? "en"}/legal/cookies`} style={{ color: "inherit", textDecoration: "underline" }}>
          {c.policy}
        </a>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={button} onClick={() => choose("denied")} data-testid="cookie-reject">
          {c.reject}
        </button>
        <button type="button" style={button} onClick={() => choose("granted")} data-testid="cookie-accept">
          {c.accept}
        </button>
      </div>
    </div>
  );
}

/** "Cookie settings" in a footer: reopens the banner. */
export function CookieSettingsLink({ locale, className }: { locale: string; className?: string }) {
  const c = COOKIE_CONSENT_COPY[cookieLocale(locale)];
  return (
    <button
      type="button"
      className={className}
      data-testid="cookie-settings-link"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
      style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}
    >
      {c.settings}
    </button>
  );
}
