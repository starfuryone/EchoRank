"use client";

import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Reusable page-help modal: structured, scannable sections with optional
 * decorative illustrations and "metric cards" (what it means → why it
 * matters → what to do). Pages supply a content module that maps their
 * i18n copy + art into HelpSection[]; see CompetitorsHelp.tsx for the
 * reference adopter. /intelligence/risk and tool pages can reuse as-is.
 */

export interface HelpMetric {
  title: string;
  meaning: string;
  why: string;
  action: string;
  /** Small decorative inline graphic rendered next to the title. */
  art?: ReactNode;
}

export interface HelpSection {
  heading: string;
  /** Decorative illustration shown beside the heading (aria-hidden). */
  art?: ReactNode;
  paragraphs?: string[];
  /** Highlighted callout below the paragraphs. */
  note?: string;
  metrics?: HelpMetric[];
  bullets?: string[];
}

export interface HelpLabels {
  meaning: string;
  why: string;
  action: string;
}

export function HelpModal({
  open,
  onClose,
  title,
  closeLabel,
  labels,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  labels: HelpLabels;
  sections: HelpSection[];
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} closeLabel={closeLabel} className="max-w-2xl">
      <div className="space-y-6 pb-2">
        {sections.map((s, i) => (
          <section key={i}>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{s.heading}</h3>
                {s.paragraphs?.map((p, j) => (
                  <p key={j} className="mt-1.5 text-sm leading-relaxed text-gray-600">{p}</p>
                ))}
              </div>
              {s.art && (
                <div aria-hidden="true" className="shrink-0">
                  {s.art}
                </div>
              )}
            </div>
            {s.note && (
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
                {s.note}
              </div>
            )}
            {s.metrics && (
              <dl className="mt-3 space-y-3">
                {s.metrics.map((m, j) => (
                  <div key={j} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <dt className="flex items-center justify-between gap-3 text-sm font-medium text-gray-900">
                      <span>{m.title}</span>
                      {m.art && <span aria-hidden="true" className="shrink-0">{m.art}</span>}
                    </dt>
                    <dd className="mt-1.5 space-y-1 text-xs leading-relaxed text-gray-600">
                      <p><span className="font-semibold text-blue-700">{labels.meaning}: </span>{m.meaning}</p>
                      <p><span className="font-semibold text-violet-700">{labels.why}: </span>{m.why}</p>
                      <p><span className="font-semibold text-emerald-700">{labels.action}: </span>{m.action}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {s.bullets && (
              <ul className="mt-2 space-y-1.5">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-gray-600">
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}

/** "?" trigger that owns the open state and renders the modal. */
export function HelpButton({
  label,
  ariaLabel,
  title,
  closeLabel,
  labels,
  sections,
}: {
  label: string;
  ariaLabel: string;
  title: string;
  closeLabel: string;
  labels: HelpLabels;
  sections: HelpSection[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" aria-label={ariaLabel} onClick={() => setOpen(true)}>
        <HelpCircle className="mr-1.5 h-4 w-4 text-blue-600" aria-hidden="true" /> {label}
      </Button>
      <HelpModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        closeLabel={closeLabel}
        labels={labels}
        sections={sections}
      />
    </>
  );
}
