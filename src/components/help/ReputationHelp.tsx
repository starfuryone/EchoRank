"use client";

import { HelpButton, type HelpSection } from "./HelpModal";
import {
  ArtHubGrid,
  ArtRequestFlow,
  ArtRecoveryCatch,
  ArtSourcesToScore,
  ArtPlanLock,
} from "./reputation-help-art";
import {
  REPUTATION_HELP_COPY,
  type ReputationHelpCopy,
  type DashLocale,
} from "@/lib/i18n/dashboard";

/**
 * Per-page help content for /reputation: maps the i18n copy + illustrations
 * into HelpModal sections, the shape CompetitorsHelp.tsx established.
 *
 * Five sections, one per thing the page actually renders — the four card
 * groups plus the lock state — so the modal explains the page in front of the
 * reader rather than the product in general.
 *
 * Usage:
 *   import { ReputationHelpButton } from "@/components/help/ReputationHelp";
 *   <ReputationHelpButton locale={locale} />
 */
export function reputationHelpSections(t: ReputationHelpCopy): HelpSection[] {
  return [
    { heading: t.s1Heading, paragraphs: [t.s1Text], note: t.s1Note, art: <ArtHubGrid /> },
    { heading: t.s2Heading, paragraphs: [t.s2Text], note: t.s2Note, art: <ArtRequestFlow /> },
    { heading: t.s3Heading, paragraphs: [t.s3Text], art: <ArtRecoveryCatch /> },
    { heading: t.s4Heading, paragraphs: [t.s4Text], art: <ArtSourcesToScore /> },
    { heading: t.s5Heading, paragraphs: [t.s5Text], note: t.s5Note, art: <ArtPlanLock /> },
  ];
}

export function ReputationHelpButton({ locale = "en" }: { locale?: DashLocale }) {
  const t = REPUTATION_HELP_COPY[locale];
  return (
    <HelpButton
      label={t.buttonLabel}
      ariaLabel={t.buttonAria}
      title={t.title}
      closeLabel={t.close}
      // The metric-card labels HelpModal requires. No section here uses
      // metrics, so these are never rendered — passed because the prop is
      // required, not because the page has metrics to label.
      labels={{ meaning: "", why: "", action: "" }}
      sections={reputationHelpSections(t)}
    />
  );
}
