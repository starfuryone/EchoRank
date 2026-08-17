"use client";

// SEO Tools hub help — the hub's own "How to use", on the shared ToolHelpModal.
//
// Replaces the inline-styled anchor that downloaded the white paper straight
// from the page header (baf57c7): hardcoded English, an inline style object,
// and a PDF as the only answer to "how do I use this". The paper is still one
// click away — it is the last line of the modal instead of the first thing the
// page offers.
//
// Two things here are read from live config rather than restated in the help
// catalog, because a second copy is the one that rots: the group bullets come
// from SEO_TOOL_GROUPS + SEO_TOOLS_COPY (the same pair the grid renders from,
// so the list and its order cannot drift), and the plan allowance is a link to
// /billing rather than a number.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import {
  SEO_TOOLS_COPY,
  SEO_TOOLS_HUB_HELP_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

/** Served from public/. Unchanged by this component — only how you reach it. */
export const SEO_TOOLS_WHITEPAPER = "/whitepapers/echorank360-seo-tools-whitepaper.pdf";

export function ToolsHubHelpButton({ locale }: { locale: DashLocale }) {
  const t = SEO_TOOLS_HUB_HELP_COPY[locale];
  const hub = SEO_TOOLS_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      sections={[
        {
          title: t.groupsTitle,
          body: t.groupsBody,
          bullets: SEO_TOOL_GROUPS.map((group) => hub.groups[group.id]),
        },
        { title: t.toolsTitle, body: t.toolsBody },
        { title: t.accessTitle, body: t.accessBody },
        {
          title: t.quotaTitle,
          body: t.quotaBody,
          link: { href: "/billing", label: t.quotaLink },
        },
        {
          // The white paper: still reachable, no longer the button.
          tone: "note",
          title: t.paperTitle,
          body: t.paperBody,
          link: { href: SEO_TOOLS_WHITEPAPER, label: hub.hubWhitepaper, external: true },
        },
      ]}
    />
  );
}
