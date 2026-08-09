"use client";

import { useEffect, useState } from "react";
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
import type { PlanType } from "@/generated/prisma";
import { BILLING_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { PlanCards } from "@/components/billing/plan-cards";

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
  currentPlan,
}: {
  locale: DashLocale;
  /** Tenant.planType, resolved server-side in page.tsx. */
  currentPlan: PlanType | null;
}) {
  const t = BILLING_COPY[locale];
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          locale={locale}
          t={t}
          plans={PLAN_CARD_ORDER}
          icons={PLAN_ICONS}
          features={t.planFeatures as Record<string, string[]>}
        />
        <p className="mt-4 text-sm text-gray-500">{t.pricesInUsd}</p>
      </div>
    </div>
  );
}
