"use client";

// Mobile-drawer rendering of the Products navigation: native <details>
// accordions per group inside the existing dark sidebar, driven by the SAME
// config as the desktop mega-menu (src/lib/product-nav.ts). Wrapper is
// lg:hidden — on desktop the header ProductsMenu is the surface.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleProductNav, isItemActive } from "@/lib/product-nav";
import { PRODUCT_NAV_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { NewBadge } from "./new-badge";
import type { PlanType } from "@/generated/prisma";

export function SidebarProducts({
  locale,
  plan,
  onNavigate,
}: {
  locale: DashLocale;
  plan?: PlanType | null;
  onNavigate?: () => void;
}) {
  const copy = PRODUCT_NAV_COPY[locale];
  const groups = visibleProductNav(plan);
  const pathname = usePathname();

  if (groups.length === 0) return null;

  return (
    <div className="mt-6 border-t border-gray-800 pt-4 lg:hidden">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {copy.menuLabel}
      </p>
      <ul className="space-y-1">
        {groups.map((group) => {
          const groupActive = group.items.some((i) => isItemActive(pathname, i.href));
          return (
            <li key={group.id}>
              <details open={groupActive} className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                    "text-gray-400 hover:bg-gray-800/50 hover:text-white",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    "[&::-webkit-details-marker]:hidden",
                  )}
                >
                  {copy.groups[group.id]}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <ul className="mt-1 space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const active = isItemActive(pathname, item.href);
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg py-2 pl-6 pr-3 text-sm",
                            active
                              ? "bg-gray-800 text-white"
                              : "text-gray-400 hover:bg-gray-800/50 hover:text-white",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{copy.items[item.id].name}</span>
                          {item.badge === "new" && <NewBadge locale={locale} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
