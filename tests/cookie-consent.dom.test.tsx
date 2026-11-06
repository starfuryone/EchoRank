// @vitest-environment jsdom
// GA4 Consent Mode default-denied, the banner (equal-weight Accept / Reject), and "Cookie settings".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "fr" }) }));

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  COOKIE_CONSENT_COPY,
  OPEN_COOKIE_SETTINGS_EVENT,
  consentUpdate,
  ga4ConsentInitScript,
  readConsent,
  writeConsent,
} from "@/lib/consent/cookie-consent";
import { CookieConsent, CookieSettingsLink } from "@/components/marketing/cookie-consent";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, root };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  (window as unknown as { gtag?: unknown }).gtag = vi.fn();
});

describe("Consent Mode init", () => {
  const s = ga4ConsentInitScript("G-TEST");
  it("denies everything by default, BEFORE GA is configured", () => {
    const def = s.indexOf("gtag('consent','default'");
    expect(def).toBeGreaterThan(0);
    expect(def).toBeLessThan(s.indexOf("gtag('config'"));
    for (const k of ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]) {
      expect(s).toContain(`${k}:'denied'`);
    }
  });
  it("re-applies only a stored Accept of the current version, and only for analytics", () => {
    expect(s).toContain(`localStorage.getItem('${CONSENT_STORAGE_KEY}')`);
    expect(s).toContain(`c.v===${CONSENT_VERSION}&&c.choice==='granted'`);
    expect(s).toContain("gtag('consent','update',{analytics_storage:'granted'})");
    expect(s).not.toMatch(/ad_storage:'granted'|ad_personalization:'granted'|ad_user_data:'granted'/);
  });
  it("configures GA4 with Google signals and ads personalisation off", () => {
    expect(s).toContain("gtag('config','G-TEST',{allow_google_signals:false,allow_ad_personalization_signals:false})");
  });
  it("the public layout uses it, init before the tag, and mounts the banner", () => {
    const layout = read("src/app/[locale]/layout.tsx");
    expect(layout).toContain("{ga4ConsentInitScript(GA_MEASUREMENT_ID)}");
    expect(layout).toContain("<CookieConsent />");
    expect(layout.indexOf('id="ga4-init"')).toBeLessThan(layout.indexOf("googletagmanager.com/gtag/js"));
    expect(layout).not.toMatch(/gtag\('config', '\$\{GA_MEASUREMENT_ID\}'\)/);
  });
});

describe("stored choice", () => {
  it("round-trips, and ignores another version or garbage", () => {
    writeConsent(localStorage, "denied", new Date("2026-11-06T00:00:00Z"));
    expect(readConsent(localStorage)).toEqual({ v: CONSENT_VERSION, choice: "denied", at: "2026-11-06T00:00:00.000Z" });
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION + 1, choice: "granted" }));
    expect(readConsent(localStorage)).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, "{");
    expect(readConsent(localStorage)).toBeNull();
    expect(consentUpdate("granted")).toEqual({ analytics_storage: "granted" });
  });
});

describe("the banner", () => {
  it("shows until a choice; Accept and Reject are the same button style", () => {
    const { host } = mount(createElement(CookieConsent));
    const banner = host.querySelector('[data-testid="cookie-banner"]')!;
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain(COOKIE_CONSENT_COPY.fr.body);
    const accept = host.querySelector('[data-testid="cookie-accept"]') as HTMLButtonElement;
    const reject = host.querySelector('[data-testid="cookie-reject"]') as HTMLButtonElement;
    expect(accept.getAttribute("style")).toBe(reject.getAttribute("style"));
    expect(accept.tagName).toBe(reject.tagName);
  });

  it("Reject stores denied, tells gtag, closes; Cookie settings reopens it", () => {
    const { host } = mount(createElement("div", null, createElement(CookieConsent), createElement(CookieSettingsLink, { locale: "fr" })));
    act(() => (host.querySelector('[data-testid="cookie-reject"]') as HTMLButtonElement).click());
    expect(readConsent(localStorage)?.choice).toBe("denied");
    expect((window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "denied" });
    expect(host.querySelector('[data-testid="cookie-banner"]')).toBeNull();
    const link = host.querySelector('[data-testid="cookie-settings-link"]') as HTMLButtonElement;
    expect(link.textContent).toBe(COOKIE_CONSENT_COPY.fr.settings);
    act(() => link.click());
    expect(host.querySelector('[data-testid="cookie-banner"]')).not.toBeNull();
    act(() => (host.querySelector('[data-testid="cookie-accept"]') as HTMLButtonElement).click());
    expect(readConsent(localStorage)?.choice).toBe("granted");
  });

  it("stays closed once chosen", () => {
    writeConsent(localStorage, "granted");
    const { host } = mount(createElement(CookieConsent));
    expect(host.querySelector('[data-testid="cookie-banner"]')).toBeNull();
    act(() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT)));
    expect(host.querySelector('[data-testid="cookie-banner"]')).not.toBeNull();
  });

  it("copy in en / fr / de-CH, no ß; the footers carry Cookie settings", () => {
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(COOKIE_CONSENT_COPY[l])).toEqual(Object.keys(COOKIE_CONSENT_COPY.en));
    expect(JSON.stringify(COOKIE_CONSENT_COPY["de-CH"])).not.toContain("ß");
    expect(read("src/components/PublicFooter.tsx")).toContain("<CookieSettingsLink locale={locale} />");
    expect(read("src/app/[locale]/HomeClient.tsx")).toContain("<CookieSettingsLink locale={locale} />");
  });
});
