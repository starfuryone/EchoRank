"use client";

/**
 * The floating assistant: a launcher button, and the panel it opens.
 *
 * MOUNTED ONCE, IN THE (dashboard) LAYOUT. Not per page — a per-page mount
 * would reset the conversation on every navigation, which is the one thing a
 * floating assistant must not do.
 *
 * IT COSTS NOTHING UNTIL IT IS OPENED. This module is loaded lazily by
 * AssistantWidgetLoader (next/dynamic, ssr:false), so the panel, its copy and
 * its fetch logic are a separate chunk that the dashboard's initial bundle does
 * not carry. The launcher itself is a button and an icon.
 *
 * ~400px SLIDE-OVER ON DESKTOP, FULL SCREEN ON MOBILE. Below `sm` a 400px panel
 * over a 375px viewport is a modal pretending not to be one, so it becomes one
 * honestly (inset-0) rather than a sliver of chat with the dashboard peeking
 * around it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";
import type { AssistantCopy } from "@/lib/i18n/dashboard";

export interface AssistantWidgetProps {
  c: AssistantCopy;
  /** Locale-free dashboard path; the app has no locale prefix on these. */
  fullHref: string;
}

export function AssistantWidget({ c, fullHref }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Focus goes back where it came from. Without this a keyboard user who
    // closes the panel lands at the top of the document.
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={c.launcherLabel}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {open && (
        <>
          {/* Backdrop, mobile only: on desktop the panel is a slide-over and
              the dashboard behind it stays usable. */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={close}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="false"
            aria-label={c.heading}
            className="fixed inset-0 z-50 flex flex-col border-gray-200 bg-white shadow-2xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:border-l"
          >
            <div className="flex items-center justify-end border-b border-gray-200 bg-white px-2 py-1">
              <button
                type="button"
                onClick={close}
                aria-label={c.closeLabel}
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <AssistantPanel c={c} variant="widget" fullHref={fullHref} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
