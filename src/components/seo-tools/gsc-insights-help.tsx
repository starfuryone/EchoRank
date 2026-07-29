"use client";

// GSC Insights help — copy + illustration bound onto the shared ToolHelpModal.
//
// The timing section is a note rather than a step on purpose: it is the answer
// to "the sync ran and there are no queries", which is a caveat about Google's
// anonymity threshold and reporting lag, not a thing the user does.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { GscInsightsArt } from "@/components/seo-tools/help-illustrations/gsc-insights";
import { GSC_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function GscInsightsHelpButton({ locale }: { locale: DashLocale }) {
  const t = GSC_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={GscInsightsArt}
      sections={[
        { title: t.connectTitle, body: t.connectBody },
        { title: t.metricsTitle, body: t.metricsBody },
        { tone: "note", title: t.timingTitle, body: t.timingBody },
        { title: t.syncTitle, body: t.syncBody },
      ]}
    />
  );
}
