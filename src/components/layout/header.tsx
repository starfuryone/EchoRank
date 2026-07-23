"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { dashChrome, type DashLocale } from "@/lib/i18n/dashboard";
import { ProductsMenu } from "./products-menu";
import type { PlanType } from "@/generated/prisma";

interface HeaderProps {
  title: string;
  locale?: DashLocale;
  plan?: PlanType | null;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuToggle?: () => void;
  onSignOut?: () => void;
}

export function Header({ title, locale = "en", plan, user, onMenuToggle, onSignOut }: HeaderProps) {
  const chrome = dashChrome[locale];
  const displayName = user?.name || user?.email || chrome.user;
  const initials = getInitials(displayName);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label={chrome.toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">
          {title}
        </h1>

        {/* Products mega-menu (desktop; the mobile drawer renders the same
            config via SidebarProducts) */}
        <ProductsMenu locale={locale} plan={plan} />
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={chrome.notifications}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 pl-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
              user?.image
                ? ""
                : "bg-blue-600 text-white"
            )}
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <span className="hidden text-sm font-medium text-gray-700 sm:inline-block">
            {displayName}
          </span>

          {/* Sign out */}
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={chrome.signOut}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
