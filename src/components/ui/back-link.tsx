import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

/**
 * Tertiary back/side navigation link for sub-pages — the one shared pattern
 * for "← Back to X" controls (intelligence sub-pages, Keywords Explorer).
 * Arrow glyphs travel in the localized label; `icon` is for lucide icons
 * (e.g. Wrench on the SEO Tools link). Server-component safe: no hooks.
 */
export function BackLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}

/** Left-aligned row of BackLinks, placed above a page heading. */
export function BackLinkRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{children}</div>
  );
}
