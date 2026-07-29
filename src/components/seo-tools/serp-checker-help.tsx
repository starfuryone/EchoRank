"use client";

// SERP Checker help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { SerpCheckerArt } from "@/components/seo-tools/help-illustrations/serp-checker";
import { SERP_CHECKER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function SerpCheckerHelpButton({ locale }: { locale: DashLocale }) {
  const t = SERP_CHECKER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={SerpCheckerArt}
      sections={[
        { title: t.snapshotTitle, body: t.snapshotBody },
        { title: t.targetingTitle, body: t.targetingBody },
        { title: t.featuresTitle, body: t.featuresBody },
        // The queued wait is what the "nothing happened" tickets are about.
        { tone: "note", title: t.timingTitle, body: t.timingBody },
      ]}
    />
  );
}
