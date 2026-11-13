// "Your plan has ended — Resubscribe", across the top of every dashboard page
// for a CANCELED tenant (CANCEL-FAIR-PLAY). The page under it still renders:
// an ended plan is a usable account with a way back, never a blank screen.
//
// Server-safe (no "use client"): the dashboard layout renders it.

import Link from "next/link";
import type { BillingCopy } from "@/lib/i18n/dashboard";

export function PlanEndedBanner({ t }: { t: BillingCopy }) {
  return (
    <div
      role="status"
      data-testid="plan-ended-banner"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        <strong className="font-semibold">{t.planEndedTitle}.</strong> {t.planEndedBody}
      </p>
      <Link
        href="/billing#plans"
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {t.planEndedCta}
      </Link>
    </div>
  );
}
