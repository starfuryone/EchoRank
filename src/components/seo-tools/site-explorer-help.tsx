"use client";

// Site Explorer help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { SiteExplorerArt } from "@/components/seo-tools/help-illustrations/site-explorer";
import { SITE_EXPLORER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function SiteExplorerHelpButton({ locale }: { locale: DashLocale }) {
  const t = SITE_EXPLORER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={SiteExplorerArt}
      sections={[
        // "Why doesn't this match Analytics?" leads, because it is the first
        // thing anyone asks of a modelled traffic number.
        { title: t.estimatesTitle, body: t.estimatesBody },
        { title: t.distributionTitle, body: t.distributionBody },
        { title: t.competitorsTitle, body: t.competitorsBody },
        { title: t.backlinksTitle, body: t.backlinksBody },
        { tone: "note", title: t.quotaTitle, body: t.quotaBody },
      ]}
    />
  );
}
