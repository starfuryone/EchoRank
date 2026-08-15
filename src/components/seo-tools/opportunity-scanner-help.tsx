"use client";

// Opportunity Scanner help — copy + illustration bound onto the shared
// ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { OpportunityScannerArt } from "@/components/seo-tools/help-illustrations/opportunity-scanner";
import { OPPORTUNITY_SCANNER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function OpportunityScannerHelpButton({ locale }: { locale: DashLocale }) {
  const t = OPPORTUNITY_SCANNER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={OpportunityScannerArt}
      sections={[
        { title: t.listTitle, body: t.listBody },
        { title: t.scanTitle, body: t.scanBody },
        { title: t.gradeTitle, body: t.gradeBody },
        { title: t.reportTitle, body: t.reportBody },
        // Both notes rather than steps: neither is part of the sequence, and
        // both are things an agency needs to have read BEFORE their first
        // batch — one because it costs money, one because it involves someone
        // else's website.
        { tone: "note", title: t.googleTitle, body: t.googleBody },
        { tone: "note", title: t.etiquetteTitle, body: t.etiquetteBody },
      ]}
    />
  );
}
