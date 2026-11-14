import Link from "next/link";
import type { PlanType } from "@/generated/prisma";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";
import { PLAN_HOME } from "@/lib/plan-routing";
import { PLAN_CONFIGS } from "@/lib/plan-config";

/**
 * What a plan sees on a page its plan does not include (src/lib/plan-access.ts),
 * rendered by the (dashboard) layout in place of the page. Server-side: the
 * page itself never renders, so nothing it would load is fetched.
 *
 * The body and the way back name what the plan has: AI visibility for the
 * AI-only plan, the crawler for the crawler-only plan (its home, PLAN_HOME).
 * The plan it names is `target`, computed by the layout from this page's gates
 * and the tenant's plan (src/lib/upgrade-target.ts), never typed here.
 */
export function PlanUpgradeScreen({
  locale,
  plan,
  target,
}: {
  locale: DashLocale;
  plan?: PlanType | null;
  target: PlanType | null;
}) {
  const c = PLAN_ACCESS_COPY[locale];
  const crawlerOnly = plan === "NOSY_BAT";
  const name = target ? PLAN_CONFIGS[target].name : null;
  return (
    <div className="mx-auto max-w-xl py-16 text-center" data-testid="plan-upgrade-screen" data-upgrade-to={target ?? undefined}>
      <h1 className="text-2xl font-semibold text-gray-900">{name ? c.title(name) : c.titleNoPlan}</h1>
      {name && <p className="mt-3 text-gray-600">{crawlerOnly ? c.bodyCrawler(name) : c.body(name)}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/${locale}/pricing`}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {c.cta}
        </Link>
        <Link href={crawlerOnly ? PLAN_HOME.NOSY_BAT : "/visibility"} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          {crawlerOnly ? c.backCrawler : c.back}
        </Link>
      </div>
    </div>
  );
}
