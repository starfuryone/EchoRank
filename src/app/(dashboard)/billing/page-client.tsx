"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Zap,
  Building2,
  Rocket,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { PlanStatusCard } from "@/components/billing/plan-status-card";
import { UsageMeters } from "@/components/billing/usage-meters";
import { formatPeriodDate, planCardState } from "@/lib/billing/plan-card-state";
import { PLAN_PRICES, planConfig, sellablePlan } from "@/lib/plan-config";
import { pricingBase, usd, usdCents } from "@/lib/pricing-page/format";
import { planFeaturesByPlan } from "@/lib/plan-features";
import type { PlanType } from "@/generated/prisma";
import { BILLING_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { PLAN_HUB_COPY } from "@/lib/i18n/plan-hub";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { PlanCards } from "@/components/billing/plan-cards";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";
import type { CreditHistoryRow } from "@/lib/credits/store";

interface BillingData {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  /** The plan includes feedback requests (the reputation area); else no meter. */
  feedbackIncluded: boolean;
  requestsUsed: number;
  requestsLimit: number;
  cancelAtPeriodEnd: boolean;
  /** The site crawler's monthly page allowance; null when the plan has no crawler. */
  crawlPages: { used: number; limit: number | null; resetsAt: string } | null;
  /**
   * What this subscription is charged, from its own Stripe price (/api/billing).
   * A subscriber from before a price change keeps their price, so this wins
   * over the plan config. null when unknown.
   */
  charge: { cents: number; interval: "month" | "year" } | null;
  /** No charge read, but the subscription's price is the one on sale. */
  chargeIsConfig: boolean;
  /** No subscription price at all (never subscribed): the config price is shown. */
  noPrice: boolean;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  AI_VISIBILITY: <Eye className="h-6 w-6" />,
  STARTER: <Zap className="h-6 w-6" />,
  GROWTH: <Rocket className="h-6 w-6" />,
  AGENCY: <Building2 className="h-6 w-6" />,
};

// Product names — intentionally kept English in every locale.
const PLAN_LABELS: Record<string, string> = {
  AI_VISIBILITY: "AI Visibility",
  NOSY_BAT: CRAWLER_BRAND.name,
  STARTER: "Starter",
  GROWTH: "Growth",
  AGENCY: "Agency",
};

/** Tiers drawn on this page, in order: the four self-serve plans fill the
 *  four-column grid. ENTERPRISE is not among them — it has never had a card
 *  here; it is reached through the sales contact link. */
const PLAN_CARD_ORDER = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"] as const;

export function BillingPageClient({
  locale,
  cancelHelpHref,
  currentPlan,
  subscribed,
  credits,
  creditHistory,
  canManage,
  ownerName,
  hasPortal,
  justCancelled,
}: {
  locale: DashLocale;
  /** OWNER or ADMIN (src/lib/billing/billing-roles.ts): may cancel, resume, open the portal. */
  canManage: boolean;
  /** Named in "Only {owner} can cancel this subscription". */
  ownerName: string | null;
  /** The tenant has a Stripe customer, so the portal has something to show. */
  hasPortal: boolean;
  /** Arrived from /billing/cancel (?cancelled=1): show the confirmation banner. */
  justCancelled: boolean;
  /**
   * The public "How cancellation works" article, already locale-prefixed and
   * resolved server-side — see the note in page.tsx. Null if the route map has
   * no article for /billing, in which case the link simply is not rendered.
   */
  cancelHelpHref: string | null;
  /** Tenant.planType, resolved server-side in page.tsx. */
  currentPlan: PlanType | null;
  /**
   * Has this tenant ever subscribed? False for BillingStatus.NONE. Without it
   * the cards read planType alone, which defaults to STARTER for everyone.
   */
  subscribed: boolean;
  /** Prepaid lookups held, SUM(delta) server-side. */
  credits: number;
  /** Newest first. Empty for a tenant that has never bought a pack. */
  creditHistory: CreditHistoryRow[];
}) {
  const t = BILLING_COPY[locale];
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(justCancelled);
  const [reloadKey, setReloadKey] = useState(0);

  /** One click, while the period lasts. Re-reads the card on success. */
  async function resume() {
    if (resumeBusy) return;
    setResumeBusy(true);
    setResumeError(false);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      if (!res.ok) throw new Error("resume failed");
      setBannerOpen(false);
      setReloadKey((k) => k + 1);
    } catch {
      setResumeError(true);
    } finally {
      setResumeBusy(false);
    }
  }

  function dismissBanner() {
    setBannerOpen(false);
    // Drop ?cancelled=1, so a reload or a shared URL does not bring it back.
    try {
      window.history.replaceState(null, "", "/billing");
    } catch {
      /* the banner is closed either way */
    }
  }

  /**
   * Open Stripe's billing portal: payment method, invoices (and, if the
   * portal is configured for it, cancellation too — the in-app button above
   * is the primary way now).
   *
   * A POST, so it cannot be a link: the route mints a Stripe object, and a
   * prefetchable GET would create portal sessions for links the browser merely
   * warmed. The Subscription Agreement names this path, so it has to exist.
   */
  async function openPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    setPortalError(false);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("portal failed");
      window.location.assign(data.url);
    } catch {
      setPortalError(true);
      setPortalBusy(false);
    }
  }

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch("/api/billing");
        if (!res.ok) throw new Error(t.loadFailed);
        const json = await res.json();
        setBilling({
          plan: json.plan?.type ?? "STARTER",
          status: json.plan?.status ?? "ACTIVE",
          currentPeriodEnd: json.subscription?.currentPeriodEnd ?? null,
          // Absent (an older server) reads as included: the meter it always showed.
          feedbackIncluded: json.usage?.feedbackIncluded !== false,
          requestsUsed: json.usage?.feedbackSent ?? 0,
          requestsLimit: json.usage?.feedbackLimit ?? 300,
          cancelAtPeriodEnd: json.subscription?.cancelAtPeriodEnd ?? false,
          crawlPages: json.usage?.crawlPages ?? null,
          charge: json.plan?.charge ?? null,
          chargeIsConfig: json.plan?.chargeIsConfig === true,
          noPrice: !json.subscription,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t.genericError);
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, [t.loadFailed, t.genericError, reloadKey]);


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-200" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          {t.errorTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (!billing) return null;

  const cardState = planCardState({ status: billing.status, cancelAtPeriodEnd: billing.cancelAtPeriodEnd });
  const customPricing = planConfig(billing.plan as PlanType).isCustomPricing;
  // The subscription's own price: monthly whole ("$78/month"), a yearly
  // price as its total with both decimals ("$748.80/year").
  const priceText: string | null = billing.charge
    ? billing.charge.interval === "year"
      ? t.perYearTotal(usdCents(billing.charge.cents / 100, pricingBase(locale)))
      : `${usd(billing.charge.cents / 100, pricingBase(locale))}${t.perMonth}`
    : billing.chargeIsConfig || billing.noPrice
      ? `${usd(PLAN_PRICES[sellablePlan(billing.plan as PlanType)] ?? 0, pricingBase(locale))}${t.perMonth}`
      : null;

  return (
    <div className="space-y-6">
      {/* Header, with the way to "Your plan" (PLAN-HUB): what the plan
          includes lives there, the money lives here. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <Link href="/plan" className="text-sm font-medium text-blue-600 hover:text-blue-700" data-testid="billing-your-plan">
          {PLAN_HUB_COPY[locale].yourPlan} →
        </Link>
      </div>

      {/* Just cancelled on /billing/cancel: the end date, once more, from
          the subscription itself. Dismissible; never shown from a guess. */}
      {bannerOpen && cardState === "cancelling" && billing.currentPeriodEnd && (
        <div
          role="status"
          data-testid="billing-cancelled-banner"
          className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p>{t.cancelledBanner(formatPeriodDate(billing.currentPeriodEnd, locale))}</p>
          <button
            type="button"
            onClick={dismissBanner}
            className="shrink-0 rounded p-1 text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label={t.dismiss}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* The plan card: state, dates, Cancel or Resume, and the portal.
          The cancellation route the Subscription Agreement promises is the
          portal; the in-app button is the two-click way to the same end. */}
      <PlanStatusCard
        locale={locale}
        t={t}
        state={cardState}
        status={billing.status}
        planLabel={PLAN_LABELS[billing.plan] ?? billing.plan}
        price={
          customPricing ? (
            <Link href={salesContactHref(locale, "app-billing-plan")} className="text-blue-600 hover:text-blue-700">
              {t.contactUs}
            </Link>
          ) : (
            priceText
          )
        }
        priceText={customPricing ? null : priceText}
        periodEnd={billing.currentPeriodEnd}
        canManage={canManage}
        ownerName={ownerName}
        hasPortal={hasPortal}
        onPortal={openPortal}
        portalBusy={portalBusy}
        portalError={portalError}
        onResume={resume}
        resumeBusy={resumeBusy}
        resumeError={resumeError}
        cancelHelpHref={cancelHelpHref}
      />

      {/* Usage */}
      <UsageMeters
        locale={locale}
        t={t}
        crawlerName={CRAWLER_BRAND.name}
        feedback={billing.feedbackIncluded ? { used: billing.requestsUsed, limit: billing.requestsLimit } : null}
        crawlPages={billing.crawlPages}
      />

      {/* Pricing Cards — #plans is where an ended plan's "Choose a plan" lands. */}
      <div id="plans" className="scroll-mt-24">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t.plansTitle}
        </h3>
        <PlanCards
          currentPlan={currentPlan}
          subscribed={subscribed}
          locale={locale}
          t={t}
          plans={PLAN_CARD_ORDER}
          icons={PLAN_ICONS}
          // THE SAME BULLETS THE MARKETING CARDS RENDER, in this locale.
          // These used to come from BILLING_COPY.planFeatures, a second
          // hand-written set that had drifted badly: it told a Growth customer
          // they had 3 locations and 2,000 requests when they had bought 5 and
          // 5,000. Reading the shared source makes that class of contradiction
          // impossible rather than merely fixed.
          features={planFeaturesByPlan(locale)}
        />
        <p className="mt-4 text-sm text-gray-500">{t.pricesInUsd}</p>
        <p className="mt-1 text-sm">
          <Link
            href={salesContactHref(locale, "app-billing")}
            className="font-medium text-blue-600 hover:text-blue-700"
            data-testid="billing-sales-link"
          >
            {SALES_COPY[locale].links.enterpriseLine}
          </Link>
        </p>
      </div>

      {/* ── Prospect lookups ───────────────────────────────────────────────
          Balance and ledger. Rendered for EVERY tenant, including one that has
          never bought a pack: the zero state is where they learn the packs
          exist, and hiding the section until after a purchase would make it
          discoverable only to people who had already found it another way.

          The ledger is shown in full rather than summarised. It is an
          append-only record of money the customer spent, and "you have 340
          lookups" with no way to see where the rest went is the kind of
          balance people email support about. */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t.creditsTitle}</h3>
              <p className="mt-1 text-sm text-gray-500">{t.creditsSubtitle}</p>
            </div>
            <Link
              href="/credits"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t.creditsBuy}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums text-gray-900">
            {credits.toLocaleString(locale === "en" ? "en" : locale)}
          </p>
          <p className="mt-1 text-sm text-gray-500">{t.creditsAvailable}</p>

          {creditHistory.length === 0 ? (
            <p className="mt-5 text-sm text-gray-500">{t.creditsEmpty}</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th scope="col" className="py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t.creditsColDate}
                    </th>
                    <th scope="col" className="py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t.creditsColReason}
                    </th>
                    <th scope="col" className="py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t.creditsColChange}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {creditHistory.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 text-gray-500">
                        {new Date(row.createdAt).toLocaleDateString(
                          locale === "en" ? "en" : locale,
                          { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
                        )}
                      </td>
                      <td className="py-2 text-gray-700">{t.creditsReasons[row.reason]}</td>
                      {/* Sign is spelled out as well as coloured — a red number
                          and a green number are the same number to a reader who
                          cannot tell them apart. */}
                      <td
                        className={`py-2 text-right tabular-nums font-medium ${
                          row.delta >= 0 ? "text-green-700" : "text-gray-900"
                        }`}
                      >
                        {row.delta >= 0 ? "+" : "−"}
                        {Math.abs(row.delta).toLocaleString(locale === "en" ? "en" : locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
