"use client";

// Lighthouse help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { LighthouseArt } from "@/components/seo-tools/help-illustrations/lighthouse";
import { LIGHTHOUSE_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function LighthouseHelpButton({ locale }: { locale: DashLocale }) {
  const t = LIGHTHOUSE_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={LighthouseArt}
      sections={[
        { title: t.labFieldTitle, body: t.labFieldBody },
        { title: t.scoresTitle, body: t.scoresBody },
        { title: t.devicesTitle, body: t.devicesBody },
        // Score volatility is the single most common "your tool is wrong"
        // support ticket; it is a caveat, not a step.
        { tone: "note", title: t.fluctuationTitle, body: t.fluctuationBody },
      ]}
    />
  );
}
