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

import { useEffect, useState, type ReactNode } from "react";
import s from "./home2.module.css";
import type { HomePricingChrome } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import { ConsentGate, consentPayload } from "./ConsentGate";
import { stashCheckoutConsent } from "@/lib/checkout-consent";
import { SNAPSHOT_COPY, snapshotBaseOf } from "@/lib/snapshot/copy";
import { fitsTracking, parseTrackParam } from "@/lib/snapshot/tracking";
import { pricingBase, usd, usdCents } from "@/lib/pricing-page/format";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import { ENTERPRISE_BAND, ENTERPRISE_CARD, PLAN_AUDIENCE } from "@/lib/pricing-page/audience";
import { planAllowsArea } from "@/lib/plan-access";
import { NOSY_BAT_CARD_ANCHOR } from "@/lib/plan-launch";
import type { PlanType } from "@/generated/prisma";

export interface HomePricingTier {
  id: string;
  name: string;
  /** Null for the custom-priced tier, which renders `customLabel` instead. */
  monthly: number | null;
  annual: number | null;
  customLabel: string | null;
  /** Yearly saving in whole percent, rounded DOWN (pricing-tiers.ts). */
  savePct: number | null;
  /** annual × 12: what a yearly subscriber is billed once a year. */
  annualTotal: number | null;
  /**
   * The yearly saving as an amount, (monthly − annual) × 12, on a card that
   * states it that way instead of a percentage (the crawler-only plan,
   * pricing-tiers.ts). Null elsewhere.
   */
  saveAmount?: number | null;
  /** Free-trial length (TRIAL_DAYS). */
  trialDays: number;
  /** "Everything in Starter, plus:" — null on the entry card. */
  inherits: string | null;
  /** The card's headline lines (pricing-page/headlines.ts), in render order. */
  lines: string[];
  /** Who the plan is for, under the price (pricing-page/headlines.ts PLAN_AUDIENCE). */
  audience?: string;
  highlighted: boolean;
  /** The plan's AI checkup shape, for the free check's "track these prompts" prefill. */
  tracking?: { prompts: number; providers: number | null; perWeek: number };
}

/** The Stripe tier keys a card can check out with. */
export type CheckoutTier = "ai_visibility" | "nosy_bat" | "starter" | "growth" | "agency";
export type CheckoutInterval = "month" | "year";

/**
 * PlanType (as it comes from PLAN_CONFIGS via pricingTiers) -> Stripe tier key.
 * Enterprise maps to null on purpose: it is custom priced, has no Stripe
 * lookup key, and must never render a checkout button.
 */
export function checkoutTierFor(planId: string): CheckoutTier | null {
  switch (planId) {
    case "AI_VISIBILITY":
      return "ai_visibility";
    case "NOSY_BAT":
      return "nosy_bat";
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
      {/* Reassurance, directly under the button and centred to it, on both
          toggles. One line on every paid card, so the buttons stay level
          across the row. The trial line above does not say it, so nothing
          repeats; the sentence under the grid still does, in full. */}
      <p className={s.pcancel} data-testid="cancel-anytime">
        <svg
          className={s.pcancelIcon}
          width="12"
          height="12"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 8.5l3.2 3.2L13 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {chrome.cancelAnytime}
      </p>
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
  toolCountLine,
  tax,
  currency,
  header,
  /**
   * Where the "N tools" line points. The homepage has a #tools section on the
   * same page; /pricing does not, so it sends the reader to the homepage's.
   * Defaulting to "#tools" would leave a dead anchor there.
   */
  toolsHref = "#tools",
  /**
   * Where "See every feature →" points: the comparison table on /pricing.
   * The standalone page passes its own "#compare"; the homepage and
   * /site-crawler take the default, which crosses over to /pricing.
   */
  compareHref,
  salesSrc,
  enterpriseCard = false,
  enterpriseBand = false,
}: {
  locale: string;
  /** ?src= for the Enterprise line's link to the sales form: which page this grid is on. */
  salesSrc: string;
  /** Draw Enterprise as a card in the row (and drop the line under the grid). */
  enterpriseCard?: boolean;
  /**
   * /pricing: Enterprise as a full-width band under the cards instead of a card
   * in the row (2026-11-10). Drops the line under the grid too.
   */
  enterpriseBand?: boolean;
  pricing: HomePricingTier[];
  priceChrome: HomePricingChrome;
  /**
   * "27 tools available · 7 coming", filled server-side from seoToolCounts()
   * — the same string the homepage tools section prints, so the two pages
   * cannot show different numbers.
   */
  toolCountLine: string;
  tax: string;
  currency: string;
  /** Section label / heading, supplied by the caller. */
  header: ReactNode;
  toolsHref?: string;
  compareHref?: string;
}) {
  const base = pricingBase(locale);
  const compare = compareHref ?? `/${locale}/pricing#compare`;
  // Five across for five cards (/pricing and the homepage once the crawler-only
  // plan is on sale), four for four, the three-column grid otherwise.
  const cardCount = pricing.length + (enterpriseCard ? 1 : 0);
  const gridClass = cardCount >= 5 ? s.priceGrid5 : cardCount === 4 ? s.priceGrid4 : s.priceGrid;
  // Monthly by default; the toggle is client-side state only.
  const [annual, setAnnual] = useState(false);
  // Arriving from the free AI Visibility Check ("Track these 10 prompts
  // weekly", ?track=10x2-weekly): pick out the smallest plan that covers it.
  // Read after mount: the page is static, so the query never reaches the server.
  const [trackFit, setTrackFit] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const want = parseTrackParam(new URLSearchParams(window.location.search).get("track"));
    const fit = want && pricing.find((p) => p.tracking && fitsTracking(p.tracking, want));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the URL after hydration
    if (fit) setTrackFit({ id: fit.id, name: fit.name });
  }, [pricing]);
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
    // Built ONCE and reused below. The same acceptance has to be the one sent
    // to the server and the one stashed for the register hop — building a
    // second payload there would stamp a second timestamp for a single click.
    const consent = consentPayload();
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server re-validates this against CONSENT_DOCUMENTS and
        // CONSENT_VERSION; sending it is not what authorizes the checkout.
        body: JSON.stringify({ tier, interval, locale, consent }),
      });
      // Not signed in: go and make an account, then come straight back into
      // checkout for the tier and interval that were clicked. Carrying the
      // interval matters — losing it silently drops an annual buyer onto a
      // monthly price.
      //
      // THE CONSENT IS CARRIED TOO, and it is the part most easily lost. The
      // checkout route validates consent BEFORE its auth branch, so the call
      // the register form makes after signup is refused 400 without it — and
      // refused silently, leaving a brand-new customer on a dashboard with no
      // subscription. See src/lib/checkout-consent.ts.
      //
      // THIS /register IS DELIBERATE AND STAYS. Marketing CTAs route to
      // /pricing, but a card's own checkout has already chosen a plan —
      // sending it to /pricing would loop the buyer back to the page they just
      // acted on, which is how a funnel dead-ends.
      if (res.status === 401) {
        stashCheckoutConsent(consent);
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

      {trackFit && (
        <p className={s.sub} role="status" data-testid="track-fit">
          {SNAPSHOT_COPY[snapshotBaseOf(locale)].pricingFit.replace("{plan}", trackFit.name)}
        </p>
      )}

      <div className={gridClass}>
        {pricing.map((p) => {
          const amount = annual ? p.annual : p.monthly;
          const hi = trackFit ? trackFit.id === p.id : p.highlighted;
          return (
            <div
              className={hi ? s.priceHi : s.price}
              key={p.id}
              data-plan={p.id}
              id={p.id === "NOSY_BAT" ? NOSY_BAT_CARD_ANCHOR : undefined}
            >
              <div className={s.pnameRow}>
                <div className={s.pname}>/ {p.name}</div>
                {/* The recommended plan is CONFIG (PLAN_CONFIGS highlighted),
                    not this component's choice. The track-fit outline may
                    move to another card; the badge stays where config put it. */}
                {p.highlighted && <span className={s.pbadge}>{priceChrome.mostPopular}</span>}
              </div>
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
                        The struck figure IS what a monthly subscriber pays,
                        so the pair is a comparison rather than a claim. */}
                    {annual && p.monthly !== null && p.annual !== null && p.monthly > p.annual ? (
                      <s className={s.priceAnchor} aria-label={priceChrome.anchorLabel}>
                        {usd(p.monthly, base)}
                      </s>
                    ) : null}
                    {/* Monthly: whole dollars (usd). Yearly: the monthly
                        equivalent with both decimals (usdCents). */}
                    {annual ? usdCents(amount, base) : usd(amount, base)}
                    <span>{priceChrome.perMonth}</span>
                    {annual && p.saveAmount ? (
                      <span className={s.priceSave}>
                        {priceChrome.saveAmount.replace("{amount}", usdCents(p.saveAmount, base))}
                      </span>
                    ) : annual && p.savePct ? (
                      <span className={s.priceSave}>
                        {priceChrome.save.replace("{pct}", String(p.savePct))}
                      </span>
                    ) : null}
                  </div>
                  {/* "billed $X yearly": annual × 12, from config. */}
                  {annual && p.annualTotal !== null && (
                    <div className={s.pbilled}>
                      {priceChrome.billedYearly.replace("{total}", usdCents(p.annualTotal, base))}
                    </div>
                  )}
                  <div className={s.ptrial}>
                    {priceChrome.trialLine.replace("{days}", String(p.trialDays))}
                  </div>
                </>
              )}
              {p.audience && (
                <p className={s.paudience} data-testid="plan-audience">
                  {p.audience}
                </p>
              )}
              {p.inherits && <p className={s.pinherits}>{p.inherits}</p>}
              <ul>{p.lines.map((f) => <li key={f}>{f}</li>)}</ul>
              {/* The SAME sentence on every card and every page
                  (toolCountLine(seoToolCounts())), on the cards of plans that
                  include the tools hub: not on AI Visibility, which does not
                  (src/lib/plan-access.ts). */}
              {amount !== null && planAllowsArea(p.id as PlanType, "seo_tools") && (
                <a className={s.ptools} href={toolsHref}>
                  {toolCountLine} ·{" "}
                  {priceChrome.toolsAnchor}
                </a>
              )}
              <a className={s.pcompare} href={compare}>
                {priceChrome.seeEveryFeature}
              </a>
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
        {/* /pricing only: Enterprise as a card. Custom priced, no checkout; its
            one action is the sales contact form. */}
        {enterpriseCard && (
          <div className={s.price} key="ENTERPRISE" data-plan="ENTERPRISE">
            <div className={s.pnameRow}>
              <div className={s.pname}>/ ENTERPRISE</div>
            </div>
            <div className={s.pamount}>{ENTERPRISE_CARD[base].price}</div>
            <p className={s.paudience} data-testid="plan-audience">
              {PLAN_AUDIENCE.ENTERPRISE[base]}
            </p>
            <a
              className={s.pbuyLink}
              href={salesContactHref(locale, "pricing-enterprise-card")}
              data-testid="enterprise-card-cta"
            >
              {ENTERPRISE_CARD[base].cta}
            </a>
          </div>
        )}
      </div>
      {/* /pricing: Enterprise as a full-width band under the cards. Custom
          priced, no checkout; its one action is the sales contact form. */}
      {enterpriseBand && (
        <div className={s.enterpriseBand} data-testid="enterprise-band" data-plan="ENTERPRISE">
          <p className={s.enterpriseBandText}>
            <b>{ENTERPRISE_BAND[base].name}</b>
            <span aria-hidden="true"> · </span>
            {ENTERPRISE_BAND[base].line}
          </p>
          <a className={s.pbuyLink} href={salesContactHref(locale, "pricing-enterprise-band")} data-testid="enterprise-band-cta">
            {ENTERPRISE_BAND[base].cta}
          </a>
        </div>
      )}
      {/* Credit packs. ONE LINE, NOT A FOURTH CARD, and the restraint is the
          decision: this grid sells plans, and a credit pack is an add-on to
          one of them. A fourth column would invite a pack-vs-plan price
          comparison it would lose, and would imply packs are an alternative
          to a subscription rather than something you spend inside one.

          Rendered HERE rather than on each page so both surfaces carry it
          from one string — it previously existed only on /pricing, which is
          how the homepage came to have no route to /credits at all. */}
      {/* Under the grid. Enterprise has NO CARD by design (custom priced, no
          Stripe price); this line is its entry point. */}
      <p className={s.gridNotes}>
        <span>{priceChrome.secureCheckout}</span>
        {/* With an Enterprise card or band on the page, that is its entry point. */}
        {!enterpriseCard && !enterpriseBand && (
          <>
            <span aria-hidden="true"> · </span>
            <a href={salesContactHref(locale, salesSrc)} data-testid="pricing-enterprise-link">{priceChrome.enterpriseLine}</a>
          </>
        )}
      </p>
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
