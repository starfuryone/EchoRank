"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  AlertCircle,
  Check,
  Zap,
  Building2,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_PRICES } from "@/lib/plan-config";

interface BillingData {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  requestsUsed: number;
  requestsLimit: number;
  cancelAtPeriodEnd: boolean;
}

const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: [
    "1 location",
    "300 feedback requests/mo",
    "Email channel only",
    "Basic analytics",
    "Email support",
  ],
  GROWTH: [
    "3 locations",
    "2,000 feedback requests/mo",
    "Email + SMS channels",
    "Advanced analytics",
    "Priority support",
    "Custom templates",
    "Team management (5 seats)",
  ],
  AGENCY: [
    "20 locations",
    "10,000 feedback requests/mo",
    "Email + SMS channels",
    "Full analytics suite",
    "Dedicated support",
    "Custom templates",
    "Unlimited team seats",
    "White-label branding",
    "Custom domain",
    "API access",
  ],
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="h-6 w-6" />,
  GROWTH: <Rocket className="h-6 w-6" />,
  AGENCY: <Building2 className="h-6 w-6" />,
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  AGENCY: "Agency",
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch("/api/billing");
        if (!res.ok) throw new Error("Failed to load billing data");
        const json = await res.json();
        setBilling({
          plan: json.plan ?? json.tenant?.planType ?? "STARTER",
          status: json.status ?? json.tenant?.billingStatus ?? "ACTIVE",
          currentPeriodEnd:
            json.currentPeriodEnd ?? json.subscription?.currentPeriodEnd ?? null,
          requestsUsed:
            json.requestsUsed ?? json.usage?.feedbackSentThisMonth ?? 0,
          requestsLimit:
            json.requestsLimit ?? json.tenant?.monthlyRequestLimit ?? 300,
          cancelAtPeriodEnd:
            json.cancelAtPeriodEnd ??
            json.subscription?.cancelAtPeriodEnd ??
            false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, []);

  const handlePlanChange = async (plan: string) => {
    if (!billing || plan === billing.plan) return;
    const currentPrice =
      PLAN_PRICES[billing.plan as keyof typeof PLAN_PRICES] ?? 0;
    const newPrice = PLAN_PRICES[plan as keyof typeof PLAN_PRICES] ?? 0;
    const action = newPrice > currentPrice ? "upgrade" : "downgrade";
    if (
      !confirm(
        `Are you sure you want to ${action} to the ${PLAN_LABELS[plan]} plan ($${newPrice}/mo)?`
      )
    )
      return;
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("Failed to change plan");
      const json = await res.json();
      setBilling((prev) => (prev ? { ...prev, plan, ...json } : prev));
    } catch {
      alert("Failed to change plan. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

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
          Failed to load billing
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
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
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and view usage.
        </p>
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
                    {PLAN_LABELS[billing.plan] ?? billing.plan} Plan
                  </h2>
                  <Badge
                    variant={
                      billing.status === "ACTIVE" ? "success" : "warning"
                    }
                  >
                    {billing.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  $
                  {PLAN_PRICES[billing.plan as keyof typeof PLAN_PRICES] ?? 0}
                  /month
                  {billing.currentPeriodEnd && (
                    <span>
                      {" "}
                      &middot; Renews{" "}
                      {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {billing.cancelAtPeriodEnd && (
              <Badge variant="warning">Cancels at period end</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">
            Usage This Month
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Feedback Requests</span>
              <span className="font-medium text-gray-900">
                {billing.requestsUsed.toLocaleString()} /{" "}
                {billing.requestsLimit.toLocaleString()}
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
            <p className="text-xs text-gray-500">
              {usagePct}% of your monthly limit used
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Plans</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {(["STARTER", "GROWTH", "AGENCY"] as const).map((plan) => {
            const isCurrent = billing.plan === plan;
            const price = PLAN_PRICES[plan];
            const isPopular = plan === "GROWTH";

            return (
              <Card
                key={plan}
                className={cn(
                  "relative overflow-hidden",
                  isCurrent && "ring-2 ring-blue-600",
                  isPopular && !isCurrent && "ring-1 ring-blue-200"
                )}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    Popular
                  </div>
                )}
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isCurrent
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {PLAN_ICONS[plan]}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {PLAN_LABELS[plan]}
                      </h4>
                      {isCurrent && (
                        <Badge variant="info" className="mt-0.5">
                          Current Plan
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      ${price}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <ul className="mb-6 space-y-2.5">
                    {PLAN_FEATURES[plan].map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={isPopular ? "primary" : "outline"}
                      className="w-full"
                      loading={upgrading === plan}
                      onClick={() => handlePlanChange(plan)}
                    >
                      {PLAN_PRICES[plan] >
                      PLAN_PRICES[
                        billing.plan as keyof typeof PLAN_PRICES
                      ]
                        ? "Upgrade"
                        : "Downgrade"}{" "}
                      to {PLAN_LABELS[plan]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
