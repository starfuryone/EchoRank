"use client";

// Keywords Explorer help — copy + illustration bound onto the shared
// ToolHelpModal. Lives beside the other tool help modals rather than next to
// /visibility/keywords: the convention is one directory, one shape.

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
        // The name says "explorer"; the tool crawls your page. Say so first.
        { title: t.crawlTitle, body: t.crawlBody },
        { title: t.scoringTitle, body: t.scoringBody },
        { title: t.contentTitle, body: t.contentBody },
        {
          title: t.promptsTitle,
          body: t.promptsBody,
          link: { href: "/visibility/tools/custom-prompts", label: t.promptsLink },
        },
        { tone: "note", title: t.aiTitle, body: t.aiBody },
      ]}
    />
  );
}
