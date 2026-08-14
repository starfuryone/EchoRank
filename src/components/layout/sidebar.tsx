"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  PenTool,
  UserPlus,
  Settings,
  CreditCard,
  ScanEye,
  Wrench,
  UserCircle,
  HelpCircle,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashNav, type DashLocale } from "@/lib/i18n/dashboard";
import { SEO_TOOLS_HUB } from "@/lib/seo-tools";
import type { PlanType } from "@/generated/prisma";

// Eleven reputation surfaces used to sit here as eleven rows, which made the
// sidebar the product's table of contents. They now live behind /reputation as
// a grouped hub; the routes did not move, so every bookmark still works.
//
// Team stays OUT of that hub deliberately: seat and role management is
// administration, not a reputation tool, and it belongs next to Settings and
// Billing where someone goes to administer an account rather than to work.
//
// Marketing Studio gets a row of its own even though it lives under
// /visibility/tools/*. It is a destination people go to directly and repeatedly,
// unlike the other tools in that hub, and its dashNav label is what the page
// calls itself.
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/reputation", icon: Sparkles },
  { href: "/visibility", icon: ScanEye },
  { href: "/visibility/tools", icon: Wrench },
  { href: "/visibility/tools/ai-content-helper", icon: PenTool },
  { href: "/team", icon: UserPlus },
  { href: "/settings", icon: Settings },
  { href: "/settings/account", icon: UserCircle },
  { href: "/billing", icon: CreditCard },
  { href: "/notifications", icon: Bell },
  // Last row, below the administration block. Help is never plan-gated.
  { href: "/help", icon: HelpCircle },
] as const;

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  locale?: DashLocale;
  plan?: PlanType | null;
  /** Tenant has an ACTIVE billing status (computed server-side in the layout). */
  paid?: boolean;
}

export function Sidebar({ open, onClose, locale = "en", plan, paid = false }: SidebarProps) {
  const labels = dashNav[locale];
  const pathname = usePathname();
  // No plan-based route filtering: every tier reaches every dashboard path.
  // The SEO Tools hub still requires a paid (ACTIVE) subscription — visibility
  // only; the tools layout enforces the same predicate server-side.
  const items = navItems.filter(
    (item) => !item.href.startsWith(SEO_TOOLS_HUB) || paid,
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Longest matching href wins so /visibility/tools/* highlights
          "SEO Tools" and not also "AI Visibility". */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 transition-transform duration-200 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center border-b border-gray-800 px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/echorank-logo-light.svg"
            alt="Echorank360"
            className="h-7 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const activeHref = items
                .map((i) => i.href)
                .filter((h) => pathname === h || pathname.startsWith(h + "/"))
                .reduce((a, b) => (b.length > a.length ? b : a), "");
              const isActive = item.href === activeHref;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {labels[item.href]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-800 px-3 py-4">
          <p className="px-3 text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Echorank
          </p>
        </div>
      </aside>
    </>
  );
}
