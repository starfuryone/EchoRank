"use client";

// The crawler's "How to" walkthrough for one view, on the shared <Modal>
// (Esc, focus trap, focus back to the trigger). Loaded on demand by
// CrawlerHeader, like the Help modal. One step at a time: a numbered step
// list (buttons, aria-current="step"), the step's pictogram, title and text,
// Previous / Next (also ← / →), and "Don't show again" for this view.

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { HOWTO_ART, HOWTO_COPY, type HowtoView } from "@/lib/site-crawler/howto-copy";
import { HowtoArt } from "./howto-art";

export default function CrawlerHowtoModal({
  view,
  locale,
  onClose,
  dontShow,
  onDontShow,
}: {
  view: HowtoView;
  locale: DashLocale;
  onClose: () => void;
  dontShow: boolean;
  onDontShow: (off: boolean) => void;
}) {
  const copy = HOWTO_COPY[locale];
  const ui = copy.ui;
  const walk = copy.views[view];
  const art = HOWTO_ART[view];
  const [i, setI] = useState(0);
  const last = walk.steps.length - 1;
  const step = walk.steps[i]!;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));

  return (
    <Modal open onClose={onClose} title={walk.title} closeLabel={ui.close} className="max-w-xl">
      <div
        data-testid="howto"
        data-view={view}
        onKeyDown={(e) => {
          // ← / → move between steps, except while typing or choosing.
          const tag = (e.target as HTMLElement).tagName;
          if (tag === "INPUT" && (e.target as HTMLInputElement).type !== "checkbox") return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(i + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(i - 1);
          }
        }}
        className="space-y-4"
      >
        <ol aria-label={ui.stepsLabel} className="flex flex-wrap gap-2" data-testid="howto-steps">
          {walk.steps.map((s, n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => go(n)}
                aria-current={n === i ? "step" : undefined}
                aria-label={ui.goToStep(String(n + 1), s.title)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  n === i ? "bg-emerald-700 text-white" : n < i ? "bg-emerald-50 text-emerald-800" : "border border-gray-300 bg-white text-gray-700"
                }`}
              >
                {n + 1}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-start gap-4 sm:flex-row" aria-live="polite" data-testid="howto-step">
          <span className="rounded-xl bg-gray-50 p-2">
            <HowtoArt id={art[i]!} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-600">{ui.stepOf(String(i + 1), String(walk.steps.length))}</p>
            <h3 className="mt-0.5 text-base font-semibold text-gray-900">{step.title}</h3>
            <p className="mt-1 text-sm text-gray-700">{step.body}</p>
          </div>
        </div>

        {walk.note && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" data-testid="howto-note">
            <p className="font-semibold">{walk.note.title}</p>
            <p className="mt-0.5">{walk.note.body}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={dontShow} onChange={(e) => onDontShow(e.target.checked)} data-testid="howto-dontshow" />
            {ui.dontShow}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(i - 1)}
              disabled={i === 0}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
              {ui.previous}
            </button>
            <button
              type="button"
              onClick={() => (i === last ? onClose() : go(i + 1))}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {i === last ? ui.done : ui.next}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
