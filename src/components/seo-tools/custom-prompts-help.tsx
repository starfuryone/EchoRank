"use client";

// Custom Prompts help — copy + illustration bound onto the shared ToolHelpModal.
//
// The prompt allowance is per plan and per tenant, so it is passed in from the
// live payload rather than written into the copy. When it has not loaded (or
// the tenant is below AGENCY and the card never fetched it) the section simply
// drops that sentence instead of rendering a placeholder number.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { CustomPromptsArt } from "@/components/seo-tools/help-illustrations/custom-prompts";
import { CUSTOM_PROMPTS_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export interface PromptQuota {
  used: number;
  limit: number;
}

export function CustomPromptsHelpButton({
  locale,
  quota,
}: {
  locale: DashLocale;
  quota?: PromptQuota | null;
}) {
  const t = CUSTOM_PROMPTS_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={CustomPromptsArt}
      sections={[
        {
          title: t.trackTitle,
          body: quota
            ? `${t.trackBody} ${t.trackQuota(quota.used, quota.limit)}`
            : t.trackBody,
        },
        { title: t.runsTitle, body: t.runsBody },
        { title: t.trendTitle, body: t.trendBody },
        { title: t.writeTitle, body: t.writeBody },
        // The answer to "I'm not in any of them", which is the question this
        // page generates most often.
        {
          tone: "note",
          title: t.auditTitle,
          body: t.auditBody,
          link: { href: "/visibility", label: t.auditLink },
        },
      ]}
    />
  );
}
