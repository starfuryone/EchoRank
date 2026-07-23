"use client";

// Desktop "Products" mega-menu. Renders from the typed config in
// src/lib/product-nav.ts; the mobile drawer equivalent is
// sidebar-products.tsx (same config, accordion form).
//
// Disclosure pattern, not a modal: no focus trap. The panel sits right after
// the trigger in the DOM so Tab flows into it naturally; Escape closes and
// returns focus to the trigger; outside click / focus-out / route change close
// without stealing focus.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleProductNav, isItemActive } from "@/lib/product-nav";
import { PRODUCT_NAV_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { NewBadge } from "./new-badge";
import type { PlanType } from "@/generated/prisma";

export function ProductsMenu({
  locale,
  plan,
}: {
  locale: DashLocale;
  plan?: PlanType | null;
}) {
  const copy = PRODUCT_NAV_COPY[locale];
  const groups = visibleProductNav(plan);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close when the route changes (item selected or browser navigation) —
  // state adjustment during render, per the react-hooks guidance, instead of
  // a setState-in-effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  // Outside click / touch closes.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  // Close when keyboard focus leaves the whole disclosure.
  function onBlur(e: React.FocusEvent) {
    if (!rootRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  if (groups.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative hidden lg:block"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="products-menu-panel"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          open
            ? "bg-gray-100 text-gray-900"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        {copy.menuLabel}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id="products-menu-panel"
        hidden={!open}
        className="absolute left-0 top-full z-40 mt-2 max-h-[calc(100vh-6rem)] w-[min(58rem,calc(100vw-18rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
      >
        <nav aria-label={copy.menuLabel}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 xl:grid-cols-3">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`pn-group-${group.id}`}>
                <h3
                  id={`pn-group-${group.id}`}
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
                >
                  {copy.groups[group.id]}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(pathname, item.href);
                    const it = copy.items[item.id];
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex items-start gap-3 rounded-lg p-2.5 transition-colors motion-reduce:transition-none",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            active ? "bg-blue-50" : "hover:bg-gray-50",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "mt-0.5 h-5 w-5 shrink-0",
                              active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600",
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "truncate text-sm font-medium",
                                  active ? "text-blue-700" : "text-gray-900",
                                )}
                              >
                                {it.name}
                              </span>
                              {item.badge === "new" && <NewBadge locale={locale} />}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-gray-500">
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
        </nav>
      </div>
    </div>
  );
}
