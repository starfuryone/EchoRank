// Classic SEO Tools sub-hub — a curated cross-cutting view of the traditional
// search tools (second sidebar entry under SEO Tools). Renders the same card
// pattern as the main hub from the same typed config + copy catalogs. It is
// deliberately not a SeoToolGroup, so the main hub grid shows no duplicates.
// Paid gating: ../layout.tsx, same as every /visibility/tools/* page.
import Link from "next/link";
import { cookies } from "next/headers";
import { dashboardLocale, SEO_TOOLS_COPY } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { CLASSIC_SEO_TOOL_IDS, SEO_TOOL_GROUPS, navPath } from "@/lib/seo-tools";
import { canAccessPath } from "@/lib/plan-routing";
import { NewBadge } from "@/components/layout/new-badge";

const ALL_TOOLS = SEO_TOOL_GROUPS.flatMap((g) => g.tools);

export default async function ClassicSeoToolsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = SEO_TOOLS_COPY[locale];
  const plan = (await getCurrentTenant())?.tenant.planType;

  const tools = CLASSIC_SEO_TOOL_IDS.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => !!t && (!plan || canAccessPath(plan, navPath(t.href))),
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {copy.classicTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{copy.classicSubtitle}</p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tools.map((tool) => {
          const it = copy.items[tool.id];
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
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{it.name}</span>
                    {tool.badge === "new" && <NewBadge locale={locale} />}
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
    </div>
  );
}
