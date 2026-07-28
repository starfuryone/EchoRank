"use client";

// Rank Tracker page help: outlined "Help" button beside the primary action,
// opening the shared Modal — the same shape the Review Links page uses.
//
// Accessibility comes from src/components/ui/modal.tsx, which already provides
// role="dialog", aria-modal, Escape and backdrop close, a Tab focus trap,
// focus restore on close, and background scroll lock. Nothing is re-implemented
// here.
//
// The plan numbers in step 1 are read from the Rank Tracker config rather than
// written into the copy, so the help text cannot claim a cap the code does not
// enforce.

import { useState } from "react";
import Link from "next/link";
import { CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RankTrackerFlowArt } from "@/components/help/rank-tracker-help-art";
import { RANK_TRACKED_KEYWORDS } from "@/lib/rank-tracker/options";
import { RANK_TRACKER_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

/** Keyword discovery lives on the existing Keywords Explorer surface. */
const KEYWORDS_HREF = "/visibility/keywords";

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700"
      >
        {index}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="mt-1 space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
      </div>
    </section>
  );
}

export function RankTrackerHelpButton({ locale }: { locale: DashLocale }) {
  const t = RANK_TRACKER_HELP_COPY[locale];
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
          <RankTrackerFlowArt />

          <Step index={1} title={t.step1Title}>
            <p>{t.step1Body}</p>
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
              {t.step1Plans(RANK_TRACKED_KEYWORDS.GROWTH, RANK_TRACKED_KEYWORDS.AGENCY)}
            </p>
          </Step>

          <Step index={2} title={t.step2Title}>
            <p>{t.step2Body}</p>
          </Step>

          <Step index={3} title={t.step3Title}>
            <p>{t.step3Body}</p>
          </Step>

          <Step index={4} title={t.step4Title}>
            <ul className="space-y-1.5">
              {t.tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                  />
                  {tip}
                </li>
              ))}
            </ul>
          </Step>

          <p className="border-t border-gray-200 pt-4 text-sm text-gray-600">
            {t.findKeywordsIntro}{" "}
            <Link
              href={KEYWORDS_HREF}
              onClick={() => setOpen(false)}
              className="font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t.findKeywordsLink} →
            </Link>
          </p>
        </div>
      </Modal>
    </>
  );
}
