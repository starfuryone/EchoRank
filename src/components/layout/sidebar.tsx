"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Send,
  HeartHandshake,
  BarChart3,
  FileText,
  ExternalLink,
  UserPlus,
  Settings,
  CreditCard,
  Brain,
  Radar,
  Database,
  Puzzle,
  ScanEye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashNav, type DashLocale } from "@/lib/i18n/dashboard";
import { canAccessPath } from "@/lib/plan-routing";
import { SidebarProducts } from "./sidebar-products";
import type { PlanType } from "@/generated/prisma";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/customers", icon: Users },
  { href: "/feedback", icon: MessageSquare },
  { href: "/campaigns", icon: Send },
  { href: "/recovery", icon: HeartHandshake },
  { href: "/analytics", icon: BarChart3 },
  { href: "/intelligence", icon: Brain },
  { href: "/monitoring", icon: Radar },
  { href: "/visibility", icon: ScanEye },
  { href: "/imports", icon: Database },
  { href: "/extension", icon: Puzzle },
  { href: "/templates", icon: FileText },
  { href: "/review-links", icon: ExternalLink },
  { href: "/team", icon: UserPlus },
  { href: "/settings", icon: Settings },
  { href: "/billing", icon: CreditCard },
] as const;

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  locale?: DashLocale;
  plan?: PlanType | null;
}

export function Sidebar({ open, onClose, locale = "en", plan }: SidebarProps) {
  const labels = dashNav[locale];
  const pathname = usePathname();
  // Hide what this plan can't reach. The (dashboard) layout enforces the same
  // rule, but it only re-runs on hard loads — a <Link> soft-navigation skips
  // it — so the nav must not offer the link in the first place.
  const items = plan
    ? navItems.filter((item) => canAccessPath(plan, item.href))
    : navItems;

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
            alt="EchoRank 360"
            className="h-7 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

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

          {/* Products groups — mobile drawer only; desktop uses the header
              mega-menu. Same typed config drives both. */}
          <SidebarProducts locale={locale} plan={plan} onNavigate={onClose} />
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-800 px-3 py-4">
          <p className="px-3 text-xs text-gray-500">
            &copy; {new Date().getFullYear()} EchoRank
          </p>
        </div>
      </aside>
    </>
  );
}
