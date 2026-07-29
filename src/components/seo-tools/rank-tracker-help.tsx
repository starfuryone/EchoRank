"use client";

// Rank Tracker help — now a thin binding of copy + illustration onto the
// shared ToolHelpModal. The modal chrome, accessibility and layout live in
// one place (ToolHelpModal.tsx); this file only decides what it says.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { RankTrackerArt } from "@/components/seo-tools/help-illustrations/rank-tracker";
import { RANK_TRACKED_KEYWORDS } from "@/lib/rank-tracker/options";
import { RANK_TRACKER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

/** Keyword discovery lives on the existing Keywords Explorer surface. */
const KEYWORDS_HREF = "/visibility/keywords";

export function RankTrackerHelpButton({ locale }: { locale: DashLocale }) {
  const t = RANK_TRACKER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      illustration={RankTrackerArt}
      sections={[
        {
          title: t.step1Title,
          body: t.step1Body,
          // Plan caps come from the config, never written into the copy, so
          // the help text cannot claim a limit the code does not enforce.
          bullets: [
            t.step1Plans(RANK_TRACKED_KEYWORDS.GROWTH, RANK_TRACKED_KEYWORDS.AGENCY),
          ],
        },
        { title: t.step2Title, body: t.step2Body },
        { title: t.step3Title, body: t.step3Body },
        { title: t.step4Title, bullets: t.tips },
        {
          tone: "note",
          title: t.findKeywordsIntro,
          link: { href: KEYWORDS_HREF, label: `${t.findKeywordsLink} →` },
        },
      ]}
    />
  );
}
