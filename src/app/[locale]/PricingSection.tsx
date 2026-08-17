"use client";

// src/app/[locale]/PricingSection.tsx
//
// The pricing toggle + card grid, shared by the homepage's /13 section and the
// standalone /pricing page.
//
// EXTRACTED, NOT COPIED. Both surfaces render the same numbers from the same
// PLAN_CONFIGS-derived array (see pricingTiers() in page.tsx), so a price can
// only ever be changed in one place. A second hand-maintained grid on /pricing
// is the shape that ends with two different prices on the same site and a
// customer quoting the cheaper one.
//
// The section CHROME is a prop rather than baked in: the homepage wants its
// "/ 13 — PRICING" run-in label, the standalone page wants an <h1>. Everything
// below that line — toggle, cards, struck price, tax lines — is identical and
// lives here.

import { useState, type ReactNode } from "react";
import s from "./home2.module.css";
import type { HomePricingChrome } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import { ConsentGate, consentPayload } from "./ConsentGate";

export interface HomePricingTier {
  id: string;
  name: string;
  /** Null for the custom-priced tier, which renders `customLabel` instead. */
  monthly: number | null;
  annual: number | null;
  customLabel: string | null;
  savePct: number | null;
  features: string[];
  highlighted: boolean;
}

/** The Stripe tier keys a card can check out with. */
export type CheckoutTier = "starter" | "growth" | "agency";
export type CheckoutInterval = "month" | "year";

/**
 * PlanType (as it comes from PLAN_CONFIGS via pricingTiers) -> Stripe tier key.
 * Enterprise maps to null on purpose: it is custom priced, has no Stripe
 * lookup key, and must never render a checkout button.
 */
export function checkoutTierFor(planId: string): CheckoutTier | null {
  switch (planId) {
    case "STARTER":
      return "starter";
    case "GROWTH":
      return "growth";
    case "AGENCY":
      return "agency";
    default:
      return null;
  }
}

/**
 * A card's checkout CTA. PRESENTATIONAL: the request itself lives in
 * PricingSection, because the consent modal's own button has to start the very
 * same checkout for the very same plan. A second copy of the fetch there is how
 * the two paths end up sending different bodies.
 */
function CheckoutButton({
  tier,
  interval,
  chrome,
  busy,
  error,
  onStart,
}: {
  tier: CheckoutTier;
  interval: CheckoutInterval;
  chrome: HomePricingChrome;
  busy: boolean;
  error: boolean;
  onStart: (tier: CheckoutTier, interval: CheckoutInterval) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={s.pbuy}
        onClick={() => onStart(tier, interval)}
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
  );
}

export function PricingSection({
  locale,
  pricing,
  priceChrome,
  liveToolCount,
  tax,
  currency,
  header,
  /**
   * Where the "N tools" line points. The homepage has a #tools section on the
   * same page; /pricing does not, so it sends the reader to the homepage's.
   * Defaulting to "#tools" would leave a dead anchor there.
   */
  toolsHref = "#tools",
}: {
  locale: string;
  pricing: HomePricingTier[];
  priceChrome: HomePricingChrome;
  liveToolCount: number;
  tax: string;
  currency: string;
  /** Section label / heading, supplied by the caller. */
  header: ReactNode;
  toolsHref?: string;
}) {
  const [annual, setAnnual] = useState(false);
  // Consent state lives here, not in the button: one checkbox governs every
  // card, and the page row and the modal row are two views of THIS boolean.
  const [consented, setConsented] = useState(false);
  const [consentModal, setConsentModal] = useState(false);
  /**
   * The card whose CTA the modal interrupted. Held so accepting inside the
   * dialog resumes THAT plan and interval — asking the buyer to find their card
   * again after they have already chosen is where an annual buyer quietly
   * restarts on monthly.
   */
  const [pending, setPending] = useState<{ tier: CheckoutTier; interval: CheckoutInterval } | null>(
    null,
  );
  // One checkout at a time, tracked by tier so the busy label and the error line
  // land on the card that was clicked. Lifted out of CheckoutButton with the
  // request itself.
  const [busyTier, setBusyTier] = useState<CheckoutTier | null>(null);
  const [errorTier, setErrorTier] = useState<CheckoutTier | null>(null);

  async function startCheckout(tier: CheckoutTier, interval: CheckoutInterval) {
    if (busyTier) return;
    setBusyTier(tier);
    setErrorTier(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server re-validates this against CONSENT_DOCUMENTS and
        // CONSENT_VERSION; sending it is not what authorizes the checkout.
        body: JSON.stringify({ tier, interval, locale, consent: consentPayload() }),
      });
      // Not signed in: go and make an account, then come straight back into
      // checkout for the tier and interval that were clicked. Carrying the
      // interval matters — losing it silently drops an annual buyer onto a
      // monthly price.
      //
      // THIS /register IS DELIBERATE AND STAYS. The marketing CTAs now route to
      // /pricing instead, but a card's own checkout has already chosen a plan —
      // sending it to /pricing would loop the buyer back to the page they just
      // acted on, which is how a funnel dead-ends.
      if (res.status === 401) {
        window.location.assign(
          `/register?plan=${encodeURIComponent(tier)}&interval=${encodeURIComponent(interval)}&checkout=1`,
        );
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout failed");
      // Full navigation, not router.push: this leaves the app for Stripe.
      window.location.assign(data.url);
      // Deliberately stay busy — the page is on its way out, and re-enabling
      // here invites a second session on a slow redirect.
    } catch {
      setErrorTier(tier);
      setBusyTier(null);
    }
  }

  /**
   * Every plan CTA enters here. Gate BEFORE any network call: this is the
   * single place consent is enforced on the client, and the checkout route
   * re-checks it regardless.
   */
  function requestCheckout(tier: CheckoutTier, interval: CheckoutInterval) {
    if (!consented) {
      setPending({ tier, interval });
      setConsentModal(true);
      return;
    }
    void startCheckout(tier, interval);
  }

  /** The modal's primary button: the box is ticked, so finish what it blocked. */
  function acceptAndCheckout() {
    const resume = pending;
    setConsentModal(false);
    setPending(null);
    if (resume) void startCheckout(resume.tier, resume.interval);
  }

  /** Close/Esc/backdrop. Drops the pending plan and NOT the consent — a box
   *  ticked in the dialog is still ticked on the page. */
  function closeConsentModal() {
    setConsentModal(false);
    setPending(null);
  }

  return (
    <>
      {header}
      {/* Monthly / annual. Annual renders the per-month equivalent so the
          two modes are comparable at a glance, with the billing period
          spelled out underneath. */}
      <div
        className={s.priceToggle}
        role="group"
        aria-label={priceChrome.monthly + " / " + priceChrome.annual}
      >
        <button
          type="button"
          aria-pressed={!annual}
          className={`${s.priceToggleBtn} ${!annual ? s.priceToggleOn : ""}`}
          onClick={() => setAnnual(false)}
        >
          {priceChrome.monthly}
        </button>
        <button
          type="button"
          aria-pressed={annual}
          className={`${s.priceToggleBtn} ${annual ? s.priceToggleOn : ""}`}
          onClick={() => setAnnual(true)}
        >
          {priceChrome.annual}
        </button>
      </div>

      <div className={s.priceGrid}>
        {pricing.map((p) => {
          const amount = annual ? p.annual : p.monthly;
          return (
            <div className={p.highlighted ? s.priceHi : s.price} key={p.id}>
              <div className={s.pname}>/ {p.name}</div>
              {amount === null ? (
                <div className={s.pamount}>{p.customLabel}</div>
              ) : (
                <>
                  <div className={s.pamount}>
                    {/* Anchor: the REAL monthly price, struck through beside
                        the annual per-month rate. Annual toggle only, and
                        derived from the same pricing array the card renders
                        — never a computed "was" figure, because nobody has
                        ever been charged one and a struck-through price
                        that was never charged is what pricing law is about.
                        $29 IS what a monthly subscriber pays, so "$29 $24"
                        is a comparison rather than a claim. */}
                    {annual && p.monthly !== null && p.annual !== null && p.monthly > p.annual ? (
                      <s className={s.priceAnchor} aria-label={priceChrome.anchorLabel}>
                        ${p.monthly}
                      </s>
                    ) : null}
                    ${amount}
                    <span>{priceChrome.perMonth}</span>
                    {annual && p.savePct ? (
                      <span className={s.priceSave}>
                        {priceChrome.save.replace("{pct}", String(p.savePct))}
                      </span>
                    ) : null}
                  </div>
                  {annual && <div className={s.pbilled}>{priceChrome.billedAnnually}</div>}
                </>
              )}
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {/* Every paid tier reaches the tools hub, so the line is not
                  tier-gated. */}
              {amount !== null && (
                <a className={s.ptools} href={toolsHref}>
                  {priceChrome.toolsLine.replace("{n}", String(liveToolCount))} ·{" "}
                  {priceChrome.toolsAnchor}
                </a>
              )}
              {/* The card's ONE action. The old "Start Free Trial →" link
                  to /register?plan=… is gone: two CTAs on a card that only
                  does one thing just split the click. Enterprise never
                  renders a button; it is custom priced. */}
              {checkoutTierFor(p.id) && (
                <CheckoutButton
                  tier={checkoutTierFor(p.id)!}
                  interval={annual ? "year" : "month"}
                  chrome={priceChrome}
                  busy={busyTier === checkoutTierFor(p.id)}
                  error={errorTier === checkoutTierFor(p.id)}
                  onStart={requestCheckout}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Credit packs. ONE LINE, NOT A FOURTH CARD, and the restraint is the
          decision: this grid sells plans, and a credit pack is an add-on to
          one of them. A fourth column would invite the "$79 vs $99/mo"
          comparison it would lose, and would imply packs are an alternative
          to a subscription rather than something you spend inside one.

          Rendered HERE rather than on each page so both surfaces carry it
          from one string — it previously existed only on /pricing, which is
          how the homepage came to have no route to /credits at all. */}
      <p className={s.creditsLine}>
        <a href={`/${locale}/credits`}>{priceChrome.creditsLine}</a>
      </p>
      <ConsentGate
        locale={locale as Locale}
        accepted={consented}
        onChange={setConsented}
        modalOpen={consentModal}
        onCloseModal={closeConsentModal}
        ctaLabel={priceChrome.checkoutCta}
        onAccept={acceptAndCheckout}
      />
      <p className={s.taxline}>{tax}</p>
      <p className={s.taxline}>{currency}</p>
    </>
  );
}
