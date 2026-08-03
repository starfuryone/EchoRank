// Reputation Tools hub — the single navigation surface for the eleven
// reputation features that used to occupy eleven sidebar rows.
//
// Cards render from the typed config in src/lib/reputation-tools.ts and point
// at the routes that already exist: nothing moved, so every bookmark and deep
// link still works. Groups are filtered by canAccessPath (AI_VISIBILITY is
// confined to /visibility and never reaches this page at all), and individual
// cards render LOCKED — not hidden — when the destination's own feature gate
// would turn the visitor away. That mirrors the Marketing Studio landing: a
// hidden feature cannot be wanted, a locked one names the plan that unlocks it.
//
// The paid gate itself lives in ../layout.tsx, same as the SEO tools hub.
import Link from "next/link";
import { cookies } from "next/headers";
import { Lock } from "lucide-react";
import { dashboardLocale, REPUTATION_COPY } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { visibleReputationGroups, toolLockState } from "@/lib/reputation-tools";

export default async function ReputationHubPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = REPUTATION_COPY[locale];
  const plan = (await getCurrentTenant())?.tenant.planType;
  const groups = visibleReputationGroups(plan);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {copy.hubTitle}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">{copy.hubSubtitle}</p>
      </div>

      {groups.map((group, gi) => (
        <section
          key={group.id}
          aria-labelledby={`rep-group-${group.id}`}
          className={gi > 0 ? "border-t border-gray-200 pt-8" : undefined}
        >
          <h3
            id={`rep-group-${group.id}`}
            className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {copy.groups[group.id]}
          </h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.tools.map((tool) => {
              const item = copy.items[tool.id];
              const lock = toolLockState(tool, plan);
              const planName = lock.requiredPlan ? PLAN_CONFIGS[lock.requiredPlan].name : "";

              if (lock.locked) {
                return (
                  <li key={tool.id}>
                    <div className="flex h-full items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                      <tool.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-500">{item.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                            {copy.lockedBadge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-gray-400">{item.description}</p>
                        <p className="mt-2 text-xs text-gray-500">{copy.lockedHint(planName)}</p>
                        <Link
                          href="/billing"
                          className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
                        >
                          {copy.upgradeCta}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={tool.id}>
                  <Link
                    href={tool.href}
                    className="group flex h-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none"
                  >
                    <tool.icon
                      className="mt-0.5 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.description}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
