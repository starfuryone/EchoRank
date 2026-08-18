"use client";

// Keyword Explorer help — copy + illustration bound onto the shared
// ToolHelpModal. Lives beside the other tool help modals rather than next to
// /visibility/keywords: the convention is one directory, one shape.
//
// ACCESSIBILITY IS THE MODAL'S, NOT THIS FILE'S. ToolHelpModal owns
// role="dialog", aria-modal, aria-labelledby, Escape and backdrop close, the
// Tab focus trap, focus restore to the trigger, and the body scroll lock.
// Everything here is copy and structure, which is why changing the sections
// cannot regress any of that.
//
// ── WHAT IT DELIBERATELY DOES NOT MENTION ──────────────────────────────────
//
// There is no "Score in Opportunity Finder" bulk action. The seeded bridge is
// not shipped, and a help modal describing a button the customer cannot find
// is worse than one that is merely out of date.
//
// Nor is there a "SERP Features Detected" grouping: the page groups All /
// Topics / Questions and nothing else. The sidecar does return a
// `serp_features` list, but no surface renders it, so the copy explains that
// SERP-feature phrases are REMOVED during extraction — which is what actually
// happens — rather than pointing at a tab that does not exist.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { KeywordsExplorerArt } from "@/components/seo-tools/help-illustrations/keywords-explorer";
import { KEYWORDS_EXPLORER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function KeywordsExplorerHelpButton({ locale }: { locale: DashLocale }) {
  const t = KEYWORDS_EXPLORER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={KeywordsExplorerArt}
      sections={[
        // The name says "explorer"; the tool scans your pages. Say so first.
        { title: t.whatTitle, body: t.whatBody },
        {
          title: t.readingTitle,
          body: t.readingBody,
          bullets: [t.readDifficulty, t.readRelevance, t.readSource],
        },
        {
          title: t.groupsTitle,
          body: t.groupsBody,
          bullets: [t.groupTopics, t.groupQuestions, t.groupSerp],
        },
        {
          title: t.actionsTitle,
          body: t.actionsBody,
          link: { href: "/visibility/tools/custom-prompts", label: t.actionsLink },
        },
        // The closing note every customer who confuses the two tools needs.
        {
          tone: "note",
          title: t.finderTitle,
          body: t.finderBody,
          link: {
            href: "/visibility/tools/keyword-opportunities",
            label: t.finderLink,
          },
        },
      ]}
    />
  );
}
