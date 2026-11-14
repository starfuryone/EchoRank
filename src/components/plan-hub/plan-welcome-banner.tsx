"use client";

// "Welcome to {Plan}. Your plan is active." — shown on /plan?welcome=1 only
// when the server has confirmed the plan is paid (the page decides; this only
// dismisses). Dismissing drops ?welcome=1 so a reload does not bring it back.

import { useState } from "react";
import { X } from "lucide-react";

export function PlanWelcomeBanner({ text, dismiss }: { text: string; dismiss: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role="status"
      data-testid="plan-welcome"
      className="flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
    >
      <p>{text}</p>
      <button
        type="button"
        aria-label={dismiss}
        className="shrink-0 rounded p-1 hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        onClick={() => {
          setOpen(false);
          try {
            window.history.replaceState(null, "", "/plan");
          } catch {
            /* closed either way */
          }
        }}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
