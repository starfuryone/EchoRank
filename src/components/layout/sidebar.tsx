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
  Sparkle,
  Wrench,
  UserCircle,
  HelpCircle,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_GROUPS_COPY, dashNav, type DashLocale } from "@/lib/i18n/dashboard";
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
//
// The AI row points at /ai, the hub, NOT at /visibility. /visibility is still
// the AI Visibility dashboard — it never moved, and it is linked from the
// marketing site, the onboarding emails and the notification fan-in — it is
// simply one card on the hub now. Same consolidation as /reputation.
//
// activePrefixes is why that retarget does not go dark: without it, every
// /visibility/* route would light NO row, because the only thing that used to
// match them left the list. It is deliberately NOT "/visibility/tools", which
// has its own row and, being longer, wins the match below on its own.
/** The Pro assistant row, gated separately from the SEO Tools hub. */
const ASSISTANT_HREF = "/assistant";

// ── THREE BANDS, AND NOTHING ELSE CHANGED ──────────────────────────────────
//
// `group` is presentation. No route moved, no plan gate moved, and the active-
// row rule below still runs over the flat filtered list, so the longest-claim
// behaviour is untouched. The bands exist because twelve equally-weighted rows
// made a customer read the whole list to find the one they wanted: what you
// work in, what you administer, and the utilities you reach for occasionally
// are three different kinds of destination.
//
// Account and Billing stay where they are rather than folding into a Settings
// menu — that is an information-architecture change with its own consequences
// for deep links and for the account menu in the header, and this is a
// grouping pass.
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, group: "workspace" },
  { href: "/ai", icon: ScanEye, activePrefixes: ["/visibility"], group: "workspace" },
  // Directly under the AI row: the assistant answers questions ABOUT the
  // data the AI hub renders, so it belongs next to it rather than in the
  // administration block at the bottom. Filtered out entirely below when
  // the tenant does not qualify — no locked row, no upsell.
  { href: "/assistant", icon: Sparkle, group: "workspace" },
  { href: "/visibility/tools", icon: Wrench, group: "workspace" },
  { href: "/visibility/tools/ai-content-helper", icon: PenTool, group: "workspace" },
  { href: "/reputation", icon: Sparkles, group: "workspace" },
  { href: "/team", icon: UserPlus, group: "manage" },
  { href: "/notifications", icon: Bell, group: "manage" },
  { href: "/settings", icon: Settings, group: "utility" },
  { href: "/settings/account", icon: UserCircle, group: "utility" },
  { href: "/billing", icon: CreditCard, group: "utility" },
  // Help is never plan-gated.
  { href: "/help", icon: HelpCircle, group: "utility" },
] as const;

/** Render order of the bands. "utility" is unlabelled — it is the tail. */
const NAV_GROUPS = ["workspace", "manage", "utility"] as const;

interface NavItem {
  href: string;
  activePrefixes?: readonly string[];
}

/**
 * How long a path this item claims for the current route, or -1 for no claim.
 *
 * An item claims its own href plus any activePrefixes, and the LONGEST claim
 * across the whole list wins — which is what keeps /visibility/tools/ai-lens on
 * the SEO Tools row rather than the AI row, even though the AI row also claims
 * /visibility. Exported for tests: this is the one piece of sidebar behaviour
 * with a wrong answer that looks fine until you are three levels deep.
 */
export function navMatchLength(item: NavItem, pathname: string): number {
  const claims = [item.href, ...(item.activePrefixes ?? [])];
  return claims.reduce((best, claim) => {
    const matches = pathname === claim || pathname.startsWith(claim + "/");
    return matches && claim.length > best ? claim.length : best;
  }, -1);
}

/** The href of the row to highlight, or "" when nothing claims this route. */
export function activeNavHref(items: readonly NavItem[], pathname: string): string {
  let winner = "";
  let best = -1;
  for (const item of items) {
    const length = navMatchLength(item, pathname);
    if (length > best) {
      best = length;
      winner = item.href;
    }
  }
  return best < 0 ? "" : winner;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  locale?: DashLocale;
  plan?: PlanType | null;
  /** Tenant has an ACTIVE billing status (computed server-side in the layout). */
  paid?: boolean;
  /** Paid AND both assistant switches on (computed server-side in the layout). */
  assistantVisible?: boolean;
}

export function Sidebar({
  open,
  onClose,
  locale = "en",
  plan,
  paid = false,
  assistantVisible = false,
}: SidebarProps) {
  const labels = dashNav[locale];
  const groupLabels = SIDEBAR_GROUPS_COPY[locale];
  const pathname = usePathname();
  // No plan-based route filtering: every tier reaches every dashboard path.
  // The SEO Tools hub still requires a paid (ACTIVE) subscription — visibility
  // only; the tools layout enforces the same predicate server-side.
  const items = navItems.filter((item) => {
    if (item.href.startsWith(SEO_TOOLS_HUB)) return paid;
    // The assistant row is gated on its own flag, not on `paid`: the two
    // kill-switch envs can hide it while the tenant is still fully paid.
    if (item.href === ASSISTANT_HREF) return assistantVisible;
    return true;
  });
  // Computed once for the whole list, not once per row: the winner is a
  // property of the route, not of the row being drawn.
  const activeHref = activeNavHref(items, pathname);

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

      {/* Longest claim wins (see activeNavHref), so /visibility/tools/*
          highlights "SEO Tools" and not also "AI" — even though the AI row
          claims /visibility as a prefix. */}
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
          {NAV_GROUPS.map((group) => {
            const rows = items.filter((item) => item.group === group);
            if (rows.length === 0) return null;
            const heading = group === "utility" ? null : groupLabels[group as "workspace" | "manage"];

            return (
              <div key={group} className="mb-5 last:mb-0">
                {heading ? (
                  <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {heading}
                  </h2>
                ) : (
                  // The utility tail earns a rule rather than a word: naming it
                  // would give Settings and Help a category they do not need.
                  <div aria-hidden="true" className="mx-3 mb-3 border-t border-gray-800" />
                )}
                <ul className="space-y-1">
                  {rows.map((item) => {
                    const isActive = item.href === activeHref;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={isActive ? "page" : undefined}
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
              </div>
            );
          })}
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
