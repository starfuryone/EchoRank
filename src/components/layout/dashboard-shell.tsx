"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { dashNav, type DashLocale } from "@/lib/i18n/dashboard";
import type { PlanType } from "@/generated/prisma";

interface DashboardShellProps {
  children: React.ReactNode;
  locale?: DashLocale;
  plan?: PlanType | null;
  /** Tenant billing status is ACTIVE (computed in the (dashboard) layout). */
  paid?: boolean;
  /**
   * Paid AND both assistant switches on — computed server-side in the
   * (dashboard) layout. Drives the sidebar row only; the widget itself is
   * mounted by the layout, and every /api/assistant/pro/* route re-checks the
   * plan on its own.
   */
  assistantVisible?: boolean;
  /** Unread notifications for this user (computed in the (dashboard) layout). */
  unreadCount?: number;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardShell({
  children,
  user,
  locale = "en",
  plan,
  paid,
  assistantVisible,
  unreadCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  // Resolve page title from pathname
  const pageTitles = dashNav[locale];
  const title =
    pageTitles[pathname] ??
    pageTitles[
      Object.keys(pageTitles).find((key) => pathname.startsWith(key + "/")) ??
        ""
    ] ??
    "Echorank";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} locale={locale} plan={plan} paid={paid} assistantVisible={assistantVisible} />

      {/* Main content area offset by sidebar width on desktop */}
      <div className="lg:pl-64">
        <Header
          title={title}
          locale={locale}
          user={user}
          unreadCount={unreadCount}
          onMenuToggle={handleMenuToggle}
          onSignOut={handleSignOut}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
