// The AI hub — the single navigation surface for every AI feature.
//
// Cards render from the typed config in src/lib/ai-tools.ts and point at routes
// that already exist: nothing moved, so /visibility is still the AI Visibility
// dashboard and every bookmark, marketing link and onboarding email still lands
// where it did. The sidebar's one AI row now points here instead.
//
// Card layout is the /reputation hub's, deliberately — two hubs that look
// different teach the reader that they work differently, and they do not.
//
// ROLLOUT IS RESOLVED HERE, NOT IN THE CONFIG. aiSearchEnabledFor() reads the
// environment, and ai-tools.ts stays pure so it can be tested without one. The
// gate is evaluated with THIS tenant's id, exactly as the destination route
// evaluates it, so the card appears if and only if the page behind it would
// render instead of calling notFound().
import Link from "next/link";
import { cookies } from "next/headers";
import { dashboardLocale, AI_HUB_COPY } from "@/lib/i18n/dashboard";
import { requireTenant } from "@/lib/tenant";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { visibleAiGroups } from "@/lib/ai-tools";

export default async function AiHubPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = AI_HUB_COPY[locale];

  const membership = await requireTenant();
  const groups = visibleAiGroups(membership.tenant.planType, {
    ai_search: aiSearchEnabledFor(membership.tenantId),
  });

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
          aria-labelledby={`ai-group-${group.id}`}
          className={gi > 0 ? "border-t border-gray-200 pt-8" : undefined}
        >
          <h3
            id={`ai-group-${group.id}`}
            className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {copy.groups[group.id]}
          </h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.tools.map((tool) => {
              const item = copy.items[tool.id];
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
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        {item.description}
                      </p>
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
