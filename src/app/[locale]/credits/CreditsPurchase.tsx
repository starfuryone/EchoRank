"use client";

// The three pack cards and the buy behaviour.
//
// ── THE BUY BUTTONS ARE THE CHECKOUT ────────────────────────────────────────
// They do not route to /pricing. See the page.tsx header — this is the site's
// one deliberate exception to the CTA rule, and a sweep that "fixes" it breaks
// the only way to buy a pack.
//
// Signed in  → POST the checkout and follow the Stripe url.
// Signed out → /login?next=/credits, which returns here afterwards so the buy
//              can be repeated with one click. NOT /register: an agency buying
//              lookups almost certainly already has an account, and /login
//              carries its own link to sign up.
//
// The 401 branch is still handled even though the button already knows whether
// it is signed in: the session can expire between render and click, and a
// silent failure on a buy button is the worst possible place for one.

// Navigation uses location.assign() rather than assigning location.href: the
// destination is Stripe's hosted checkout, so next/link cannot carry it, and
// react-hooks/immutability (correctly) refuses a write to a value defined
// outside the component. assign() is the same navigation as a method call.
import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { PricedPack } from "@/lib/credits/pricing";
import s from "../home2.module.css";

/** Ties every inert buy button to the panel that says why. */
const NO_PLAN_NOTE_ID = "credits-no-plan";

export interface CreditsPurchaseCopy {
  perLookup: string;
  lookups: string;
  buy: string;
  mostPopular: string;
  unavailable: string;
  terms: string;
  planNoticeTitle: string;
  planNoticeBody: string;
  noPlanTitle: string;
  noPlanBody: string;
  noPlanCta: string;
}

export function CreditsPurchase({
  locale,
  packs,
  signedIn,
  canPurchase,
  showPlanNotice,
  pricingHref,
  copy,
}: {
  locale: Locale;
  packs: PricedPack[];
  signedIn: boolean;
  /**
   * Server-resolved: may this tenant buy at all? False only for a signed-in
   * tenant that has never subscribed. TRUE for a signed-out visitor, who is
   * unknown rather than unentitled and keeps the sign-in path.
   *
   * PRESENTATION ONLY. POST /api/billing/credits/checkout enforces the same
   * rule and is the actual gate; a disabled button is a courtesy, and this
   * component would be trivially bypassable on its own.
   */
  canPurchase: boolean;
  showPlanNotice: boolean;
  /** Where "choose a plan" goes. Locale-prefixed by the caller. */
  pricingHref: string;
  copy: CreditsPurchaseCopy;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nf = new Intl.NumberFormat(locale.startsWith("fr") ? "fr" : "en");

  async function buy(credits: number) {
    if (!signedIn) {
      window.location.assign(`/login?next=/${locale}/credits`);
      return;
    }
    // Belt to the server's braces. The buttons are not rendered as live in
    // this state, so reaching here means something got out of step; refusing
    // locally beats a round trip that can only end in a 403.
    if (!canPurchase) return;
    setPending(credits);
    setError(null);
    try {
      const res = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, locale }),
      });
      const json = (await res.json().catch(() => null)) as
        | { url?: string; error?: string; reason?: string }
        | null;

      // The session died between render and click. Send them to sign in and
      // back, rather than showing an error they cannot act on.
      if (res.status === 401) {
        window.location.assign(`/login?next=/${locale}/credits`);
        return;
      }
      if (!res.ok || !json?.url) {
        setError(json?.error ?? copy.unavailable);
        setPending(null);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError(copy.unavailable);
      setPending(null);
    }
  }

  return (
    <section className={s.section}>
      <div className={s.container}>
        <p className={s.label}>
          <b>/ 03</b>
        </p>

        {/* NO PLAN AT ALL: a state that explains itself, not a dead button.
            Lookups are an add-on to a subscription, so the only useful thing
            this page can offer someone without one is the way to get one. The
            buy buttons below render inert in this state rather than being
            hidden — a card whose price you can still read, with a reason
            attached, tells you what you would be buying once you have a plan. */}
        {signedIn && !canPurchase && (
          <div
            id={NO_PLAN_NOTE_ID}
            className={s.ucCard}
            style={{ display: "block", marginBottom: 24, maxWidth: 760 }}
          >
            <span className={s.ucTitle}>{copy.noPlanTitle}</span>
            <span className={s.ucBody}>{copy.noPlanBody}</span>
            <p style={{ marginTop: 12 }}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={pricingHref}>
                {copy.noPlanCta}
              </Link>
            </p>
          </div>
        )}

        {/* MONEY IS ACCEPTED, BUT NEVER MISLEADINGLY. A tenant below Agency can
            buy — the credits keep — and is told plainly that the tool which
            spends them is not on their plan. Hiding this to close the sale is
            exactly the thing not to do. */}
        {showPlanNotice && (
          <div
            className={s.ucCard}
            style={{ display: "block", marginBottom: 24, maxWidth: 760 }}
          >
            <span className={s.ucTitle}>{copy.planNoticeTitle}</span>
            <span className={s.ucBody}>{copy.planNoticeBody}</span>
          </div>
        )}

        {packs.length === 0 ? (
          <p className={s.sub} style={{ maxWidth: 760 }}>
            {copy.unavailable}
          </p>
        ) : (
          <>
            <div className={s.ucGrid}>
              {packs.map((pack) => (
                <div
                  key={pack.credits}
                  className={s.ucCard}
                  style={pack.featured ? { outline: "2px solid #2a78d6" } : undefined}
                >
                  {pack.featured && (
                    <span className={s.ucBody} style={{ opacity: 0.8 }}>
                      {copy.mostPopular}
                    </span>
                  )}
                  <span className={s.ucTitle}>
                    {nf.format(pack.credits)} {copy.lookups}
                  </span>
                  <span className={s.ucTitle} style={{ fontSize: "1.6rem" }}>
                    ${pack.usd}
                  </span>
                  {/* The volume discount, stated rather than implied. Three
                      decimals because at these sizes two would print the same
                      number on two cards. */}
                  <span className={s.ucBody}>
                    ${pack.unitUsd.toFixed(3)} {copy.perLookup}
                  </span>
                  {/* Inert without a plan. `disabled` and not a hidden button:
                      the price stays readable, and the reason is in the panel
                      above rather than in a control that silently does nothing. */}
                  <button
                    type="button"
                    onClick={() => void buy(pack.credits)}
                    disabled={pending !== null || (signedIn && !canPurchase)}
                    aria-describedby={signedIn && !canPurchase ? NO_PLAN_NOTE_ID : undefined}
                    className={`${s.btn} ${s.btnPrimary}`}
                    style={{
                      marginTop: 14,
                      width: "100%",
                      opacity: pending || (signedIn && !canPurchase) ? 0.6 : 1,
                    }}
                  >
                    {pending === pack.credits ? "…" : `${copy.buy} ↗`}
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p className={s.sub} style={{ marginTop: 16, maxWidth: 760 }} role="alert">
                {error}
              </p>
            )}

            {/* The consent line. No modal and no gate — a one-time payment is
                not a subscription or a plan change, so §8.1's checkout-consent
                flow does not wrap it. See the route handler for the full note. */}
            <p className={s.sub} style={{ marginTop: 18, maxWidth: 760, fontSize: "0.85rem" }}>
              {copy.terms}{" "}
              {/* Deep-linked to the clause that governs THESE purchases rather
                  than the top of a sixteen-section document. The anchor is
                  declared on the section itself (LegalSection.id), so it is
                  stable across locales and survives rewording of the heading. */}
              <Link href={`/${locale}/legal/terms#prepaid-credits`}>Terms</Link>
              {" · "}
              <Link href={`/${locale}/legal/privacy`}>Privacy</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
