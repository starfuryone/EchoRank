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
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardShell({ children, user, locale = "en", plan }: DashboardShellProps) {
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
    "EchoRank";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} locale={locale} plan={plan} />

      {/* Main content area offset by sidebar width on desktop */}
      <div className="lg:pl-64">
        <Header
          title={title}
          user={user}
          onMenuToggle={handleMenuToggle}
          onSignOut={handleSignOut}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
