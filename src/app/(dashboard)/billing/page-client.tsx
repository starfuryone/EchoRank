"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  AlertCircle,
  Zap,
  Building2,
  Rocket,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_PRICES, planConfig, sellablePlan } from "@/lib/plan-config";
import { planFeaturesByPlan } from "@/lib/plan-features";
import type { PlanType } from "@/generated/prisma";
import { BILLING_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { PlanCards } from "@/components/billing/plan-cards";
import type { CreditHistoryRow } from "@/lib/credits/store";

interface BillingData {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  requestsUsed: number;
  requestsLimit: number;
  cancelAtPeriodEnd: boolean;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="h-6 w-6" />,
  GROWTH: <Rocket className="h-6 w-6" />,
  AGENCY: <Building2 className="h-6 w-6" />,
};

// Product names — intentionally kept English in every locale.
const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  AGENCY: "Agency",
};

/** Tiers drawn on this page, in order. ENTERPRISE is not among them — it has
 *  never had a card here, and adding one would change a four-column grid. */
const PLAN_CARD_ORDER = ["STARTER", "GROWTH", "AGENCY"] as const;

export function BillingPageClient({
  locale,
  cancelHelpHref,
  currentPlan,
  subscribed,
  credits,
  creditHistory,
}: {
  locale: DashLocale;
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

  /**
   * Open Stripe's billing portal — where cancellation actually happens.
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
          requestsUsed: json.usage?.feedbackSent ?? 0,
          requestsLimit: json.usage?.feedbackLimit ?? 300,
          cancelAtPeriodEnd: json.subscription?.cancelAtPeriodEnd ?? false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t.genericError);
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, [t.loadFailed, t.genericError]);


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

  const usagePct =
    billing.requestsLimit > 0
      ? Math.round((billing.requestsUsed / billing.requestsLimit) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {/* Current Plan Overview */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t.planTitle(PLAN_LABELS[billing.plan] ?? billing.plan)}
                  </h2>
                  <Badge
                    variant={
                      billing.status === "ACTIVE" ? "success" : "warning"
                    }
                  >
                    {t.statusLabels[billing.status] ?? billing.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {planConfig(billing.plan as PlanType).isCustomPricing
                    ? t.contactUs
                    : `$${PLAN_PRICES[sellablePlan(billing.plan as PlanType)] ?? 0}${t.perMonth}`}
                  {billing.currentPeriodEnd && (
                    <span>
                      {" "}
                      &middot;{" "}
                      {t.renews(
                        new Date(billing.currentPeriodEnd).toLocaleDateString(
                          locale
                        )
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {billing.cancelAtPeriodEnd && (
              <Badge variant="warning">{t.cancelsAtPeriodEnd}</Badge>
            )}
          </div>

          {/* The cancellation route the Subscription Agreement promises.
              Shown for any subscriber, plan or watcher alike — the portal is
              Stripe's UI over Stripe's customer record and manages whatever
              they hold. The route 400s a tenant with no Stripe customer, which
              is the case this button should not be reached in. */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={openPortal} disabled={portalBusy}>
              {t.manageSubscription}
            </Button>
            <p className="mt-2 text-xs text-gray-500">
              {t.manageSubscriptionHint}
              {/* The full walkthrough, next to the button it walks through.
                  Public page, so it opens in a new tab rather than dropping
                  someone out of the dashboard mid-cancellation — and the slug
                  comes from the help-content route map, so a renamed article
                  breaks a test instead of this link. */}
              {cancelHelpHref && (
                <>
                  {" "}
                  <a
                    href={cancelHelpHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                  >
                    {t.cancellationHelp}
                  </a>
                </>
              )}
            </p>
            {portalError && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {t.manageSubscriptionError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">
            {t.usageTitle}
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t.feedbackRequests}</span>
              <span className="font-medium text-gray-900">
                {billing.requestsUsed.toLocaleString(locale)} /{" "}
                {billing.requestsLimit.toLocaleString(locale)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  usagePct >= 90
                    ? "bg-red-500"
                    : usagePct >= 70
                      ? "bg-yellow-400"
                      : "bg-blue-500"
                )}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{t.usagePct(usagePct)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div>
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
