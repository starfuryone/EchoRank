"use client";

// Content Explorer help — copy + illustration on the shared ToolHelpModal.
//
// Section order follows the order the mistakes happen in: what a mention is (the
// count is over-read constantly), then why sentiment is not a verdict, then the
// outreach use that makes the domain column the most valuable column, then the
// cost model that explains why repeats are free.
//
// The quota line is LIVE DATA passed in from the page, not a hardcoded plan
// number — the tool-page rules require reading it from the plan config.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { ContentExplorerArt } from "@/components/seo-tools/help-illustrations/content-explorer";
import { CONTENT_EXPLORER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function ContentExplorerHelpButton({
  locale,
  used,
  limit,
  plan,
}: {
  locale: DashLocale;
  used: number;
  limit: number;
  plan: string;
}) {
  const t = CONTENT_EXPLORER_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={ContentExplorerArt}
      sections={[
        { title: t.mentionTitle, body: t.mentionBody },
        { title: t.sentimentTitle, body: t.sentimentBody },
        {
          title: t.outreachTitle,
          body: t.outreachBody,
          link: { href: "/campaigns", label: t.fixLink },
        },
        // Closing caveat plus the live allowance — a note, not a step.
        {
          tone: "note",
          title: t.costTitle,
          body: `${t.costBody} ${t.quotaLine(used, limit, plan)}`,
        },
      ]}
    />
  );
}
