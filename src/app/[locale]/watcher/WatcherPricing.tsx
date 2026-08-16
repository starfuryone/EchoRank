"use client";

// src/app/[locale]/watcher/WatcherPricing.tsx
//
// The Free / Watcher card pair.
//
// SEPARATE FROM PricingSection ON PURPOSE, and this is the one judgement call
// in the file. That component renders the PLAN catalogue: four tiers from
// PLAN_CONFIGS, each with a tools line and a checkoutTierFor() mapping off
// PlanType. The watcher is not a tier — it is an entitlement with no PlanType,
// no tools line, and a card beside it that is not a product at all. Widening
// PricingSection to cover both would mean four new optional props whose only
// job is to switch half of it off. What is shared is shared for real: the same
// CSS module, the same ConsentGate, the same checkout endpoint, the same
// struck-price rule.
//
// NO PRICES OR LIMITS ARE WRITTEN HERE. Everything the card claims arrives as
// props derived from plan-config's WATCHER_SOLO and WATCHER_PRICES_CENTS, so
// the page cannot advertise a shape the runner does not execute — the failure
// this replaces was a draft offering "500 prompts / 7 LLMs" against a product
// that runs 10 prompts on one engine.

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "../home2.module.css";
import { ConsentGate, consentPayload } from "../ConsentGate";
import type { HomePricingChrome } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import type { WatcherCtaState } from "@/app/api/billing/watcher-status/route";

/** The checkout tier for the standalone watcher. Not a PlanType. */
const WATCHER_TIER = "watcher_pro";

export interface WatcherCopy {
  freeName: string;
  freePrice: string;
  freeSub: string;
  freeFeatures: string[];
  freeCta: string;
  watcherName: string;
  watcherSub: string;
  watcherFeatures: string[];
  /** Shown to a tenant whose plan already includes monitoring. */
  includedNote: string;
  manageCta: string;
  tax: string;
  currency: string;
}

export function WatcherPricing({
  locale,
  copy,
  chrome,
  monthly,
  annualPerMonth,
  savePct,
}: {
  locale: Locale;
  copy: WatcherCopy;
  chrome: HomePricingChrome;
  /** Dollars. */
  monthly: number;
  annualPerMonth: number;
  savePct: number;
}) {
  const [annual, setAnnual] = useState(false);
  const [consented, setConsented] = useState(false);
  const [consentModal, setConsentModal] = useState(false);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  /**
   * Defaults to "buy", which is the correct render for an anonymous visitor and
   * therefore also correct in the static HTML. Signed-in states only ever
   * replace it after the fetch resolves, so nobody sees a buy button flicker
   * into existence — it is already there and may become something else.
   */
  const [cta, setCta] = useState<WatcherCtaState>("buy");

  useEffect(() => {
    let live = true;
    fetch("/api/billing/watcher-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { state?: WatcherCtaState } | null) => {
        if (live && d?.state) setCta(d.state);
      })
      // Silent: the buy button is a safe default, and the checkout route
      // re-decides this server-side anyway. A pricing page must not show an
      // error because a status probe failed.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function startCheckout(interval: "month" | "year") {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Re-validated server-side against CONSENT_DOCUMENTS and
        // CONSENT_VERSION; sending it is not what authorises the checkout.
        body: JSON.stringify({
          tier: WATCHER_TIER,
          interval,
          locale,
          consent: consentPayload(),
        }),
      });
      // Same contract as the plan cards: 401 means make an account and come
      // back into checkout carrying the interval, so an annual buyer is not
      // silently restarted on monthly.
      if (res.status === 401) {
        window.location.assign(
          `/register?plan=${encodeURIComponent(WATCHER_TIER)}&interval=${encodeURIComponent(interval)}&checkout=1`,
        );
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout failed");
      window.location.assign(data.url);
      // Deliberately stays busy: the page is leaving for Stripe, and
      // re-enabling here invites a second session on a slow redirect.
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  /**
   * Open Stripe's portal — where cancellation actually happens.
   *
   * A POST, so it cannot be a Link: the route mints a Stripe object, and a
   * prefetchable GET would create portal sessions for links the browser merely
   * warmed. Same navigate-with-the-returned-url shape as checkout.
   */
  async function openPortal() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("portal failed");
      window.location.assign(data.url);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  /** Every watcher CTA enters here, so consent is enforced before any request. */
  function requestCheckout() {
    if (!consented) {
      setPending(true);
      setConsentModal(true);
      return;
    }
    void startCheckout(annual ? "year" : "month");
  }

  function acceptAndCheckout() {
    const resume = pending;
    setConsentModal(false);
    setPending(false);
    if (resume) void startCheckout(annual ? "year" : "month");
  }

  function closeConsentModal() {
    setConsentModal(false);
    setPending(false);
  }

  const amount = annual ? annualPerMonth : monthly;

  return (
    <>
      <div
        className={s.priceToggle}
        role="group"
        aria-label={chrome.monthly + " / " + chrome.annual}
      >
        <button
          type="button"
          aria-pressed={!annual}
          className={`${s.priceToggleBtn} ${!annual ? s.priceToggleOn : ""}`}
          onClick={() => setAnnual(false)}
        >
          {chrome.monthly}
        </button>
        <button
          type="button"
          aria-pressed={annual}
          className={`${s.priceToggleBtn} ${annual ? s.priceToggleOn : ""}`}
          onClick={() => setAnnual(true)}
        >
          {chrome.annual}
        </button>
      </div>

      <div className={s.priceGrid2}>
        {/* ── Free: the anonymous one-shot audit. No checkout, no account.
             Pointed at the free-tools AI Search Grader until that tool was
             retired; /free-audit runs the same sidecar audit and returns the
             same A–F letter, so every word of this card still holds. ── */}
        <div className={s.price}>
          <div className={s.pname}>/ {copy.freeName}</div>
          <div className={s.pamount}>{copy.freePrice}</div>
          <div className={s.pbilled}>{copy.freeSub}</div>
          <ul>
            {copy.freeFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link className={s.pbuyGhost} href={`/${locale}/free-audit`}>
            {copy.freeCta}
          </Link>
        </div>

        {/* ── Watcher: the paid card, and the only one wearing the accent. ── */}
        <div className={s.priceHi}>
          <div className={s.pname}>/ {copy.watcherName}</div>
          <div className={s.pamount}>
            {/* The struck figure is the REAL monthly price, shown only on the
                annual toggle beside the annual per-month rate. $9 is what a
                monthly subscriber actually pays, so "$9 $7.50" is a comparison
                between two live prices rather than a "was" price nobody was
                ever charged. */}
            {annual && monthly > annualPerMonth ? (
              <s className={s.priceAnchor} aria-label={chrome.anchorLabel}>
                ${usd(monthly)}
              </s>
            ) : null}
            ${usd(amount)}
            <span>{chrome.perMonth}</span>
            {annual ? (
              <span className={s.priceSave}>{chrome.save.replace("{pct}", String(savePct))}</span>
            ) : null}
          </div>
          {annual && <div className={s.pbilled}>{chrome.billedAnnually}</div>}
          <div className={s.pbilled}>{copy.watcherSub}</div>
          <ul>
            {copy.watcherFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          {cta === "included" ? (
            // Mirrors the checkout route's 400: a plan already includes this,
            // so there is nothing to sell. Stated rather than disabled.
            <p className={s.pnote}>{copy.includedNote}</p>
          ) : cta === "manage" ? (
            // Straight into Stripe's portal, not to /billing. The Subscription
            // Agreement promises cancellation there, and a subscriber clicking
            // "Manage" wants the thing that can cancel, not a page that links
            // to it.
            <>
              <button
                type="button"
                className={s.pbuyGhost}
                onClick={openPortal}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? chrome.checkoutBusy : copy.manageCta}
              </button>
              {error && (
                <p className={s.pbuyErr} role="alert">
                  {chrome.checkoutError}
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={s.pbuy}
                onClick={requestCheckout}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? chrome.checkoutBusy : chrome.checkoutCta}
              </button>
              {error && (
                <p className={s.pbuyErr} role="alert">
                  {chrome.checkoutError}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ConsentGate
        locale={locale}
        accepted={consented}
        onChange={setConsented}
        modalOpen={consentModal}
        onCloseModal={closeConsentModal}
        ctaLabel={chrome.checkoutCta}
        onAccept={acceptAndCheckout}
      />
      <p className={s.taxline}>{copy.tax}</p>
      <p className={s.taxline}>{copy.currency}</p>
    </>
  );
}

/** "9" and "7.50" — never "7.5", which reads as a truncated price. */
function usd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
