"use client";

// AI Lens help — copy + illustration bound onto the shared ToolHelpModal.
//
// The band thresholds are read from options.ts rather than written into the
// copy: they are the product's opinion in one place, and a modal that disagreed
// with the verdict on screen would be worse than no modal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { AiLensArt } from "@/components/seo-tools/help-illustrations/ai-lens";
import { AI_LENS_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function AiLensHelpButton({ locale }: { locale: DashLocale }) {
  const t = AI_LENS_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={AiLensArt}
      sections={[
        { title: t.whyTitle, body: t.whyBody },
        { title: t.gapTitle, body: t.gapBody },
        { title: t.fixTitle, body: t.fixBody },
        // 0% is the target, and it looks like "nothing happened" without this.
        { tone: "note", title: t.goalTitle, body: t.goalBody },
      ]}
    />
  );
}
