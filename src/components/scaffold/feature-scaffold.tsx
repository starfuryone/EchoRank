// Shared starter-state for product-nav modules whose backend has not shipped.
// Server component: static content only, no data fetching, and deliberately
// ZERO invented metrics — a disabled primary CTA plus a "coming soon" badge
// is honest; fake analytics are not.
//
// Auth: pages using this render inside the (dashboard) route group, whose
// layout enforces the session + per-plan route allowlist (plan-routing.ts);
// proxy.ts additionally redirects unauthenticated hits before rendering.

import Link from "next/link";
import { PRODUCT_NAV, SCAFFOLD_RELATED, type ScaffoldId } from "@/lib/product-nav";
import { PRODUCT_NAV_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const ITEMS = PRODUCT_NAV.flatMap((g) => g.items);

export function FeatureScaffold({
  locale,
  id,
}: {
  locale: DashLocale;
  id: ScaffoldId;
}) {
  const copy = PRODUCT_NAV_COPY[locale];
  const item = ITEMS.find((i) => i.id === id);
  const it = copy.items[id];
  const scaffold = copy.scaffolds[id];
  const related = SCAFFOLD_RELATED[id];
  const Icon = item?.icon;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {it.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>

      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
        {Icon && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Icon className="h-7 w-7 text-gray-400" aria-hidden="true" />
          </div>
        )}
        <h3 className="text-base font-semibold text-gray-900">{it.name}</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500">{copy.scaffoldIntro}</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50 disabled:cursor-not-allowed"
          >
            {scaffold.cta}
          </button>
          <span className="inline-flex items-center rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
            {copy.comingSoon}
          </span>
        </div>

        {related && scaffold.related && (
          <Link
            href={related}
            className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {scaffold.related}
          </Link>
        )}
      </div>
    </div>
  );
}
