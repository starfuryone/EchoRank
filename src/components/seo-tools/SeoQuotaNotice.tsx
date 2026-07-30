"use client";

// The two things every DataForSEO tool page must show about the pooled monthly
// search quota: how much is left, and — when it runs out — why the tool stopped
// working and what to do about it.
//
// NEVER A SILENT FAILURE. Before this existed, an exhausted tenant got whatever
// the route's generic error branch produced, which read as "the tool is broken".
// A quota is a product decision and has to look like one: the number used, the
// number allowed, the date it resets, and a way to buy more.
//
// Both pieces render from the same server-fetched SeoQuotaUsage block, so the
// counter and the banner can never disagree about the numbers.

import Link from "next/link";
import { AlertCircle, Gauge } from "lucide-react";
import type { SeoQuotaUsage } from "@/lib/seo-quota";
import { SEO_QUOTA_COPY, type DashLocale } from "@/lib/i18n/dashboard";

function formatReset(iso: string, locale: DashLocale): string {
  const intl = locale === "de-CH" ? "de-CH" : locale === "fr" ? "fr-FR" : "en-GB";
  return new Date(iso).toLocaleDateString(intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Small "N of Y searches used this month" line for a tool page header. */
export function SeoQuotaCounter({
  usage,
  locale,
}: {
  usage: SeoQuotaUsage;
  locale: DashLocale;
}) {
  const t = SEO_QUOTA_COPY[locale];
  // An unlimited tier has no meaningful ratio to show; saying "12 of ∞" is
  // noise, so it just states the tier is unlimited.
  if (usage.unlimited) {
    return <p className="text-xs text-gray-400">{t.unlimited}</p>;
  }
  const low = usage.remaining !== null && usage.remaining <= 5 && !usage.exceeded;
  return (
    <p className={`text-xs ${low ? "text-amber-600" : "text-gray-400"}`}>
      {t.counter(usage.used, usage.limit ?? 0)}
      {low && ` · ${t.runningLow}`}
    </p>
  );
}

/**
 * Full-width banner shown INSTEAD of the tool's form once the quota is gone.
 * Returns null while there is room, so a page can render it unconditionally.
 */
export function SeoQuotaExceededNotice({
  usage,
  locale,
}: {
  usage: SeoQuotaUsage;
  locale: DashLocale;
}) {
  const t = SEO_QUOTA_COPY[locale];
  if (!usage.exceeded) return null;

  // limit 0 is not "you used it all", it is "this plan never included it" —
  // a different sentence, because the fix is an upgrade rather than waiting.
  const zero = (usage.limit ?? 0) === 0;

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">
          {zero ? t.notIncludedTitle : t.exceededTitle(usage.used, usage.limit ?? 0)}
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {zero ? t.notIncludedBody : t.resets(formatReset(usage.resetsAt, locale))}
        </p>
      </div>
      <Link
        href="/billing"
        className="inline-flex shrink-0 items-center rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        <Gauge className="mr-2 h-4 w-4" aria-hidden="true" />
        {t.upgrade}
      </Link>
    </div>
  );
}
