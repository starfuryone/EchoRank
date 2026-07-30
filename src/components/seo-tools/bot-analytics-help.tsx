"use client";

// Bot Analytics help — copy + illustration on the shared ToolHelpModal.
//
// Section order is the order the misunderstandings happen in: crawlers are not
// visitors, then what the access check does, then what its verdicts mean, then
// why two tokens are not crawlers at all, then why the logs are the only real
// answer, then how much of the log counts can be trusted. The PII note is last
// and rendered as a callout because it is a promise, not a step.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { BotAnalyticsArt } from "@/components/seo-tools/help-illustrations/bot-analytics";
import { BOT_ANALYTICS_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function BotAnalyticsHelpButton({ locale }: { locale: DashLocale }) {
  const t = BOT_ANALYTICS_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={BotAnalyticsArt}
      sections={[
        { title: t.noJsTitle, body: t.noJsBody },
        { title: t.checkTitle, body: t.checkBody },
        { title: t.verdictsTitle, bullets: [...t.verdictsBullets] },
        { title: t.preferenceTitle, body: t.preferenceBody },
        {
          title: t.logsTitle,
          body: t.logsBody,
          link: { href: "/visibility", label: t.fixLink },
        },
        { title: t.verifyTitle, body: t.verifyBody },
        // A promise about the tenant's data, not a step in the sequence.
        { tone: "note", title: t.piiTitle, body: t.piiBody },
      ]}
    />
  );
}
