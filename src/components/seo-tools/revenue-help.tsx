"use client";

// AI Revenue help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { RevenueArt } from "@/components/seo-tools/help-illustrations/revenue";
import { REVENUE_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function RevenueHelpButton({ locale }: { locale: DashLocale }) {
  const t = REVENUE_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={RevenueArt}
      sections={[
        { title: t.leadsTitle, body: t.leadsBody },
        { title: t.modelTitle, body: t.modelBody },
        { title: t.wonTitle, body: t.wonBody },
        { title: t.lostTitle, body: t.lostBody },
        // A note rather than a step: it is not part of the sequence, it is the
        // thing a reader asks the moment they see one table keyed by assistant
        // and the next keyed by engine.
        { tone: "note", title: t.splitTitle, body: t.splitBody },
      ]}
    />
  );
}
