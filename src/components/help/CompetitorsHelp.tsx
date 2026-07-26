"use client";

import { HelpButton, type HelpSection } from "./HelpModal";
import {
  ArtStorefronts,
  ArtSearch,
  ArtReviews,
  ArtCalendar,
  ArtStarsRow,
  ArtRaceBar,
} from "./competitors-help-art";
import {
  COMPETITORS_HELP_COPY,
  type CompetitorsHelpCopy,
  type DashLocale,
} from "@/lib/i18n/dashboard";

/**
 * Per-page help content for /intelligence/competitors: maps the i18n copy +
 * illustrations into HelpModal sections. To adopt on another page (risk,
 * tools…), add a <PAGE>_HELP_COPY catalog and a sibling module like this one.
 *
 * Usage:
 *   import { CompetitorsHelpButton } from "@/components/help/CompetitorsHelp";
 *   <CompetitorsHelpButton locale={locale} />
 */
export function competitorsHelpSections(t: CompetitorsHelpCopy): HelpSection[] {
  return [
    { heading: t.s1Heading, paragraphs: [t.s1Text], art: <ArtStorefronts /> },
    { heading: t.s2Heading, paragraphs: [t.s2Text], note: t.s2Note, art: <ArtSearch /> },
    {
      heading: t.s3Heading,
      art: <ArtReviews />,
      metrics: t.metrics.map((m, i) => ({
        ...m,
        art: i === 0 ? <ArtStarsRow /> : i === 3 ? <ArtRaceBar /> : undefined,
      })),
    },
    { heading: t.s4Heading, bullets: t.s4Bullets, art: <ArtCalendar /> },
  ];
}

export function CompetitorsHelpButton({ locale = "en" }: { locale?: DashLocale }) {
  const t = COMPETITORS_HELP_COPY[locale];
  const sections = competitorsHelpSections(t);
  return (
    <HelpButton
      label={t.button}
      ariaLabel={t.buttonAria}
      title={t.modalTitle}
      closeLabel={t.close}
      labels={t.labels}
      sections={sections}
    />
  );
}
