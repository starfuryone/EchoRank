// Shared starter-state for SEO Tools whose backend has not shipped.
// Server component: static content only, no data fetching of metrics, and
// deliberately ZERO invented numbers — a disabled primary CTA plus a "coming
// soon" badge is honest; fake analytics are not.
//
// Auth: every page using this lives under /visibility/tools, whose layout
// enforces the paid-subscription gate ON TOP of the (dashboard) layout's
// session + plan-routing checks and the proxy's auth redirect.

import Link from "next/link";
import {
  SEO_TOOL_GROUPS,
  SCAFFOLD_RELATED,
  navPath,
  type ScaffoldId,
} from "@/lib/seo-tools";
import { SEO_TOOLS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { canAccessPath } from "@/lib/plan-routing";
import { getCurrentTenant } from "@/lib/tenant";

const TOOLS = SEO_TOOL_GROUPS.flatMap((g) => g.tools);

export async function FeatureScaffold({
  locale,
  id,
}: {
  locale: DashLocale;
  id: ScaffoldId;
}) {
  const copy = SEO_TOOLS_COPY[locale];
  const tool = TOOLS.find((i) => i.id === id);
  const it = copy.items[id];
  const scaffold = copy.scaffolds[id];
  const Icon = tool?.icon;

  // Related-surface link, only when this tenant's plan can actually reach it
  // (e.g. /analytics or /templates are outside the AI_VISIBILITY allowlist).
  const relatedHref = SCAFFOLD_RELATED[id];
  const plan = (await getCurrentTenant())?.tenant.planType;
  const related =
    relatedHref && (!plan || canAccessPath(plan, navPath(relatedHref)))
      ? relatedHref
      : undefined;

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
