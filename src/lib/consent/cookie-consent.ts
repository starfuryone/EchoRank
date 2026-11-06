// src/lib/consent/cookie-consent.ts
//
// Cookie consent for the public pages (UK GDPR / PECR): Google Analytics 4
// with Consent Mode v2, DEFAULT DENIED. Nothing analytics-related is stored on
// the visitor's device until they press Accept; Reject is the same size, the
// same weight and the same number of clicks. The choice lives in localStorage
// (CONSENT_STORAGE_KEY) and can be changed at any time from "Cookie settings"
// in the footer, which reopens the banner.
//
// Ads are never granted (Echorank runs no ads): ad_storage, ad_user_data and
// ad_personalization stay denied whatever the visitor chooses, and the GA4
// config turns Google signals and ads personalisation off.
//
// No React and no server imports: the layout's inline script, the banner and
// the tests all read this.

export const GA_MEASUREMENT_ID = "G-WLEC4CZ86S";
export const CONSENT_STORAGE_KEY = "er-cookie-consent";
/** Bump to ask everyone again (e.g. a new analytics purpose). */
export const CONSENT_VERSION = 1;
/** The event the "Cookie settings" link fires; the banner listens for it. */
export const OPEN_COOKIE_SETTINGS_EVENT = "er:cookie-settings";

export type ConsentChoice = "granted" | "denied";

/**
 * The inline script that runs BEFORE gtag.js: Consent Mode defaults (all
 * denied), the stored choice re-applied, then GA4 configured without Google
 * signals or ads personalisation. Plain ES5, no template input from users.
 */
export function ga4ConsentInitScript(id = GA_MEASUREMENT_ID): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});",
    `try{var c=JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}')||'null');if(c&&c.v===${CONSENT_VERSION}&&c.choice==='granted'){gtag('consent','update',{analytics_storage:'granted'});}}catch(e){}`,
    "gtag('js',new Date());",
    `gtag('config','${id}',{allow_google_signals:false,allow_ad_personalization_signals:false});`,
  ].join("\n");
}

export interface StoredConsent {
  v: number;
  choice: ConsentChoice;
  at: string;
}

export function readConsent(storage: Pick<Storage, "getItem"> | null): StoredConsent | null {
  try {
    const raw = storage?.getItem(CONSENT_STORAGE_KEY);
    const c = raw ? (JSON.parse(raw) as StoredConsent) : null;
    return c && c.v === CONSENT_VERSION && (c.choice === "granted" || c.choice === "denied") ? c : null;
  } catch {
    return null;
  }
}

export function writeConsent(storage: Pick<Storage, "setItem"> | null, choice: ConsentChoice, now = new Date()): StoredConsent {
  const c: StoredConsent = { v: CONSENT_VERSION, choice, at: now.toISOString() };
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* private mode: the choice holds for this page only */
  }
  return c;
}

/** The Consent Mode update for a choice: only analytics ever changes. */
export function consentUpdate(choice: ConsentChoice): Record<string, "granted" | "denied"> {
  return { analytics_storage: choice };
}

export type CookieLocale = "en" | "fr" | "de-CH";
export const cookieLocale = (l: string | null | undefined): CookieLocale =>
  l?.startsWith("fr") ? "fr" : l?.startsWith("de") ? "de-CH" : "en";

export const COOKIE_CONSENT_COPY: Record<
  CookieLocale,
  { title: string; body: string; accept: string; reject: string; policy: string; settings: string }
> = {
  en: {
    title: "Cookies",
    body: "We'd like to use Google Analytics cookies to understand how this site is used. They are set only if you accept. Cookies needed for sign-in and your language are always on.",
    accept: "Accept",
    reject: "Reject",
    policy: "Cookie policy",
    settings: "Cookie settings",
  },
  fr: {
    title: "Cookies",
    body: "Nous aimerions utiliser les cookies de Google Analytics pour comprendre comment ce site est utilisé. Ils ne sont déposés que si vous acceptez. Les cookies nécessaires à la connexion et à votre langue sont toujours actifs.",
    accept: "Accepter",
    reject: "Refuser",
    policy: "Politique relative aux cookies",
    settings: "Paramètres des cookies",
  },
  "de-CH": {
    title: "Cookies",
    body: "Wir möchten Cookies von Google Analytics verwenden, um zu verstehen, wie diese Website genutzt wird. Sie werden nur gesetzt, wenn Sie zustimmen. Cookies für die Anmeldung und Ihre Sprache sind immer aktiv.",
    accept: "Akzeptieren",
    reject: "Ablehnen",
    policy: "Cookie-Richtlinie",
    settings: "Cookie-Einstellungen",
  },
};
