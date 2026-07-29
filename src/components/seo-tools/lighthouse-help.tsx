"use client";

// Lighthouse page help: outlined "Help" button beside the primary action,
// opening the shared Modal — the pattern established by Review Links and
// followed by Rank Tracker and Backlinks.
//
// Accessibility comes from src/components/ui/modal.tsx, which already provides
// role="dialog", aria-modal, Escape and backdrop close, a Tab focus trap,
// focus restore on close, and background scroll lock.

import { useState } from "react";
import { CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LIGHTHOUSE_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

function Entry({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{body}</p>
    </section>
  );
}

export function LighthouseHelpButton({ locale }: { locale: DashLocale }) {
  const t = LIGHTHOUSE_HELP_COPY[locale];
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

          <Entry title={t.labFieldTitle} body={t.labFieldBody} />
          <Entry title={t.scoresTitle} body={t.scoresBody} />
          <Entry title={t.devicesTitle} body={t.devicesBody} />

          {/* Score volatility is a caveat, not a step — it is the single most
              common source of "your tool is wrong" support tickets. */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <h3 className="text-xs font-semibold text-blue-900">{t.fluctuationTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-blue-800">{t.fluctuationBody}</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
