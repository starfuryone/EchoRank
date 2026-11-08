"use client";

// The CTA on "Social posting, by EchoPilot": a plain link to EchoPilot's
// pricing page in a new tab, so it works without JavaScript and shows its real
// destination. The click is recorded on the side (POST /api/echopilot/click,
// keepalive); a failed record never blocks the link.
//
// Client Component: imports only the dependency-free config, never a server
// module (CLAUDE.md, Client / server boundary).

import { ExternalLink } from "lucide-react";
import { ECHOPILOT_PRICING_URL } from "@/lib/echopilot";

export const ECHOPILOT_CLICK_ENDPOINT = "/api/echopilot/click";

export function recordEchopilotClick(): void {
  try {
    void fetch(ECHOPILOT_CLICK_ENDPOINT, { method: "POST", keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  } catch {
    // Never let the record get in the way of the link.
  }
}

export function EchopilotCta({ label, newTab }: { label: string; newTab: string }) {
  return (
    <a
      href={ECHOPILOT_PRICING_URL}
      target="_blank"
      // The UTM tags carry the attribution, so the referrer is not needed.
      rel="noopener noreferrer"
      onClick={recordEchopilotClick}
      data-echopilot-cta=""
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {label}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only"> {newTab}</span>
    </a>
  );
}
