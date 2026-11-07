import Link from "next/link";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";

/**
 * What a plan sees on a page its plan does not include (src/lib/plan-access.ts),
 * rendered by the (dashboard) layout in place of the page. Server-side: the
 * page itself never renders, so nothing it would load is fetched.
 */
export function PlanUpgradeScreen({ locale }: { locale: DashLocale }) {
  const c = PLAN_ACCESS_COPY[locale];
  return (
    <div className="mx-auto max-w-xl py-16 text-center" data-testid="plan-upgrade-screen">
      <h1 className="text-2xl font-semibold text-gray-900">{c.title}</h1>
      <p className="mt-3 text-gray-600">{c.body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/${locale}/pricing`}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {c.cta}
        </Link>
        <Link href="/visibility" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          {c.back}
        </Link>
      </div>
    </div>
  );
}
