// SEO Tools hub — the single navigation surface for all SEO tools, grouped
// Ahrefs-style (information architecture only; visual identity is native
// Echorank). Cards render from the typed config in src/lib/seo-tools.ts;
// every tier sees every card. On the AI-only plan, cards outside its areas
// (src/lib/plan-access.ts) are shown locked and link to the plans. The paid
// gate lives in ./layout.tsx.
import Link from "next/link";
import { cookies } from "next/headers";
import { dashboardLocale, SEO_TOOLS_COPY } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoToolCounts, visibleSeoToolGroups } from "@/lib/seo-tools";
import { toolCountLine } from "@/lib/i18n/content";
import { NewBadge } from "@/components/layout/new-badge";
import { ComingSoonBadge } from "@/components/layout/coming-soon-badge";
import { ToolsHubHelpButton } from "@/components/seo-tools/tools-hub-help";
import { RecentResearchPanel } from "@/components/seo-tools/recent-research-panel";
import { readResearchLog } from "@/lib/research-log/store";
import { RESEARCH_LOG_PANEL_LIMIT } from "@/lib/research-log/types";
import { Lock } from "lucide-react";
import { planAllowsPage, planShowsLockedTeasers } from "@/lib/plan-access";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";

export default async function SeoToolsHubPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = SEO_TOOLS_COPY[locale];
  const membership = await getCurrentTenant();
  const plan = membership?.tenant.planType;
  // The crawler-only plan sees no locked teasers (src/lib/plan-access.ts): only
  // the cards it can open (the crawler), no tool count, no research log, and
  // one "Upgrade for more tools" link. Every other plan sees every card.
  const teasers = planShowsLockedTeasers(plan);
  const groups = visibleSeoToolGroups(plan)
    .map((g) => (teasers ? g : { ...g, tools: g.tools.filter((tool) => planAllowsPage(plan, tool.href)) }))
    .filter((g) => g.tools.length > 0);

  // What this workspace has already paid to research. Reads fail soft and
  // return [] (see readResearchLog), so the hub renders identically on a
  // deployment where the research_log migration has not been applied yet.
  const research = membership && teasers
    ? await readResearchLog(membership.tenant.id, { limit: RESEARCH_LOG_PANEL_LIMIT })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {copy.hubTitle}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{copy.hubSubtitle}</p>
          {/* Same sentence and numbers as the homepage and /pricing — see
              TOOL_COUNT_LINE. DashLocale is a subset of the marketing Locale. */}
          {teasers ? (
            <p className="mt-1 text-xs font-medium text-gray-400">
              {toolCountLine(locale, seoToolCounts())}
            </p>
          ) : (
            <Link href={`/${locale}/pricing`} className="mt-1 inline-block text-xs font-medium text-blue-600 hover:text-blue-700" data-testid="hub-upgrade-more">
              {PLAN_ACCESS_COPY[locale].upgradeMore}
            </Link>
          )}
        </div>
        <ToolsHubHelpButton locale={locale} />
      </div>

      {groups.map((group, gi) => (
        <section
          key={group.id}
          aria-labelledby={`seo-group-${group.id}`}
          className={gi > 0 ? "border-t border-gray-200 pt-8" : undefined}
        >
          <h3
            id={`seo-group-${group.id}`}
            className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {copy.groups[group.id]}
          </h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.tools.map((tool) => {
              const it = copy.items[tool.id];
              // The plan allowlist (src/lib/plan-access.ts): a card for a tool
              // the plan does not include is shown locked and links to the
              // plans, never to the tool. Only the AI-only plan locks any.
              const allowed = planAllowsPage(plan, tool.href);
              return (
                <li key={tool.id}>
                  <Link
                    href={allowed ? tool.href : `/${locale}/pricing`}
                    data-locked={allowed ? undefined : "true"}
                    className={`group flex h-full items-start gap-3 rounded-xl border border-gray-200 p-4 shadow-sm transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none ${allowed ? "bg-white hover:bg-gray-50" : "bg-gray-50 opacity-75"}`}
                  >
                    <tool.icon
                      className="mt-0.5 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-600"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {it.name}
                        </span>
                        {/* REPLACES the New badge while set — two badges on
                            one card is a card that has to be read twice, and
                            the Google block is always the more urgent of the
                            two. */}
                        {!allowed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            {PLAN_ACCESS_COPY[locale].locked}
                          </span>
                        ) : tool.requiresGoogleApproval ? (
                          <ComingSoonBadge locale={locale} />
                        ) : (
                          tool.badge === "new" && <NewBadge locale={locale} />
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-gray-500">
                        {it.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {teasers && <RecentResearchPanel locale={locale} entries={research} />}
    </div>
  );
}
