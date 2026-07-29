"use client";

// Site Audit help — copy + illustration bound onto the shared ToolHelpModal.

import { ToolHelpModal } from "@/components/seo-tools/ToolHelpModal";
import { SiteAuditArt } from "@/components/seo-tools/help-illustrations/site-audit";
import { CRAWL_PAGES_PER_PLAN } from "@/lib/site-audit/options";
import { SITE_AUDIT_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function SiteAuditHelpButton({ locale }: { locale: DashLocale }) {
  const t = SITE_AUDIT_HELP_COPY[locale];

  return (
    <ToolHelpModal
      title={t.title}
      closeLabel={t.close}
      buttonLabel={t.button}
      buttonAria={t.buttonAria}
      intro={t.intro}
      illustration={SiteAuditArt}
      sections={[
        { title: t.scoreTitle, body: t.scoreBody },
        { title: t.severityTitle, body: t.severityBody },
        {
          title: t.limitsTitle,
          // Page caps come from the plan config, never written into the copy.
          body: t.limitsBody(
            CRAWL_PAGES_PER_PLAN.STARTER,
            CRAWL_PAGES_PER_PLAN.GROWTH,
            CRAWL_PAGES_PER_PLAN.AGENCY,
          ),
        },
        // The two audits are the most confusable pair in the product.
        {
          tone: "note",
          title: t.vsVisibilityTitle,
          body: t.vsVisibilityBody,
          link: { href: "/visibility", label: "/visibility" },
        },
      ]}
    />
  );
}
