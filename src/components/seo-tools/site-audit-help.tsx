"use client";

// Site Audit page help: outlined "Help" button beside the primary action,
// opening the shared Modal — the pattern established by Review Links and
// followed by Rank Tracker, Backlinks and Lighthouse.
//
// Accessibility comes from src/components/ui/modal.tsx (role="dialog",
// aria-modal, Escape and backdrop close, Tab focus trap, focus restore,
// scroll lock). Nothing is re-implemented here.

import { useState } from "react";
import Link from "next/link";
import { CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CRAWL_PAGES_PER_PLAN } from "@/lib/site-audit/options";
import { SITE_AUDIT_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

function Entry({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{body}</p>
    </section>
  );
}

export function SiteAuditHelpButton({ locale }: { locale: DashLocale }) {
  const t = SITE_AUDIT_HELP_COPY[locale];
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" aria-label={t.buttonAria} onClick={() => setOpen(true)}>
        <CircleQuestionMark className="mr-2 h-4 w-4 text-blue-600" aria-hidden="true" />
        {t.button}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        closeLabel={t.close}
        className="max-w-2xl"
      >
        <div className="space-y-5 pb-1">
          <p className="text-sm leading-relaxed text-gray-600">{t.intro}</p>

          <Entry title={t.scoreTitle} body={t.scoreBody} />
          <Entry title={t.severityTitle} body={t.severityBody} />
          {/* Page caps come from the plan config, never written into the copy,
              so the help text cannot claim a limit the code does not enforce. */}
          <Entry
            title={t.limitsTitle}
            body={t.limitsBody(
              CRAWL_PAGES_PER_PLAN.STARTER,
              CRAWL_PAGES_PER_PLAN.GROWTH,
              CRAWL_PAGES_PER_PLAN.AGENCY,
            )}
          />

          {/* The two audits are the single most confusable pair in the product
              — same word, different product. Called out, not buried. */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <h3 className="text-xs font-semibold text-blue-900">{t.vsVisibilityTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-blue-800">{t.vsVisibilityBody}</p>
            <Link
              href="/visibility"
              onClick={() => setOpen(false)}
              className="mt-1.5 inline-block text-xs font-medium text-blue-700 underline hover:text-blue-900"
            >
              /visibility
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
