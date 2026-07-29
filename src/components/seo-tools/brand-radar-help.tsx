"use client";

// Brand Radar help — copy + illustration bound onto the shared ToolHelpModal.
//
// Every section maps to a field the visibility summary actually returns
// (audit score/grade, prompt mention rate, per-engine coverage, alerts). If a
// section here has no field behind it, it is copy for a feature we do not
// ship — which is how a "trust score" section would have got written.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { BrandRadarArt } from "@/components/seo-tools/help-illustrations/brand-radar";
import { BRAND_RADAR_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function BrandRadarHelpButton({ locale }: { locale: DashLocale }) {
  const t = BRAND_RADAR_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={BrandRadarArt}
      sections={[
        {
          title: t.scoreTitle,
          body: t.scoreBody,
          link: { href: "/visibility", label: t.scoreLink },
        },
        { title: t.mentionTitle, body: t.mentionBody },
        { title: t.enginesTitle, body: t.enginesBody },
        { title: t.alertsTitle, body: t.alertsBody },
        // The empty state is a designed answer, not a missing one.
        { tone: "note", title: t.emptyTitle, body: t.emptyBody },
      ]}
    />
  );
}
