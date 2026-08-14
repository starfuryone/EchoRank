"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { dashChrome, type DashLocale } from "@/lib/i18n/dashboard";

interface HeaderProps {
  title: string;
  locale?: DashLocale;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  /** Unread count resolved server-side in the (dashboard) layout. */
  unreadCount?: number;
  onMenuToggle?: () => void;
  onSignOut?: () => void;
}

export function Header({
  title,
  locale = "en",
  user,
  unreadCount = 0,
  onMenuToggle,
  onSignOut,
}: HeaderProps) {
  const chrome = dashChrome[locale];
  const pathname = usePathname();
  const [unread, setUnread] = useState(unreadCount);

  // The server value seeds the badge on first paint; after that the count
  // changes under us — the user marks rows read on /notifications, or a worker
  // writes new ones while a long-lived tab sits open. Re-reading on navigation
  // keeps the badge honest without polling, and is also why the prop is not
  // mirrored back into state on every render: this effect already covers the
  // navigation that would change it.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { unreadCount?: number } | null) => {
        if (!cancelled && typeof data?.unreadCount === "number") {
          setUnread(data.unreadCount);
        }
      })
      .catch(() => {
        // Chrome on every page: a failed count keeps the last known value
        // rather than surfacing an error the header cannot render.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);
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
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications. The dot used to be hardcoded on, so it meant nothing;
            it now appears only when this user has unread rows. */}
        <Link
          href="/notifications"
          className={`relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700${unread > 0 ? " er-bell-live" : ""}`}
          aria-label={
            unread > 0
              ? `${chrome.notifications} (${unread})`
              : chrome.notifications
          }
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

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
