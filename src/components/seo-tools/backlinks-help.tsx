"use client";

// Backlinks help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { BacklinksArt } from "@/components/seo-tools/help-illustrations/backlinks";
import { BACKLINKS_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function BacklinksHelpButton({ locale }: { locale: DashLocale }) {
  const t = BACKLINKS_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={BacklinksArt}
      sections={[
        { title: t.backlinksTitle, body: t.backlinksBody },
        { title: t.dofollowTitle, body: t.dofollowBody },
        { title: t.anchorsTitle, body: t.anchorsBody },
        { title: t.historyTitle, body: t.historyBody },
        // Index freshness is a caveat, not a step — it explains why this tool
        // and any other backlink checker will disagree slightly.
        { tone: "note", title: t.freshnessTitle, body: t.freshnessBody },
      ]}
    />
  );
}
