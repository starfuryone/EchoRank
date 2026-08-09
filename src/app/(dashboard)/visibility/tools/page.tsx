// SEO Tools hub — the single navigation surface for all SEO tools, grouped
// Ahrefs-style (information architecture only; visual identity is native
// Echorank). Cards render from the typed config in src/lib/seo-tools.ts;
// every tier sees every card, since no tier is confined to a route subset.
// The paid gate lives in ./layout.tsx.
import Link from "next/link";
import { cookies } from "next/headers";
import { dashboardLocale, SEO_TOOLS_COPY } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { visibleSeoToolGroups } from "@/lib/seo-tools";
import { NewBadge } from "@/components/layout/new-badge";

export default async function SeoToolsHubPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const copy = SEO_TOOLS_COPY[locale];
  const plan = (await getCurrentTenant())?.tenant.planType;
  const groups = visibleSeoToolGroups(plan);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {copy.hubTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{copy.hubSubtitle}</p>
        <a href="/whitepapers/echorank360-seo-tools-whitepaper.pdf" download target="_blank" rel="noopener" style={{float:"right",marginLeft:"auto",display:"inline-flex",alignItems:"center",padding:"6px 14px",border:"1px solid #d1d5db",borderRadius:"8px",fontSize:"13px",fontWeight:600,color:"#374151",background:"#fff",textDecoration:"none"}}>How to use</a>
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
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {it.name}
                        </span>
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
        </section>
      ))}
    </div>
  );
}
