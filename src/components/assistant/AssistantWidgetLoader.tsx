"use client";

/**
 * Lazy boundary for the floating assistant.
 *
 * WHY A SEPARATE FILE. `next/dynamic` with `ssr: false` may only be called from
 * a client component, and the (dashboard) layout is a server component. This
 * module is the client boundary that lets the layout mount the widget without
 * the widget's code — the panel, the transcript, the fetch logic and the whole
 * copy catalog it closes over — landing in the dashboard's initial bundle.
 *
 * NO LOADING STATE, DELIBERATELY. The placeholder for a chat launcher that has
 * not loaded yet is nothing at all; a skeleton circle in the corner of every
 * dashboard page would be a worse first paint than an empty corner.
 *
 * THE GATE IS UPSTREAM. This component renders nothing on its own account —
 * the layout decides whether to mount it at all, from a server-derived paid +
 * kill-switch flag. There is no client-side plan check here, because a client
 * -side plan check is a suggestion.
 */

import dynamic from "next/dynamic";
import type { AssistantCopy } from "@/lib/i18n/dashboard";

const AssistantWidget = dynamic(
  () => import("./AssistantWidget").then((mod) => mod.AssistantWidget),
  { ssr: false },
);

export function AssistantWidgetLoader({ c, fullHref }: { c: AssistantCopy; fullHref: string }) {
  return <AssistantWidget c={c} fullHref={fullHref} />;
}
