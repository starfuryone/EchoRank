"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AddClientModal } from "@/components/onboarding/add-client-modal";
import { NosyBatIcon } from "@/components/seo-tools/nosy-bat-icon";
import { ONBOARDING_COPY, type DashLocale, type OnboardingCopy } from "@/lib/i18n/dashboard";
import type { OnboardingCrawl } from "@/lib/onboarding";

interface Step {
  key: string;
  href: string;
  done: boolean;
  /** crawl_site only (src/lib/onboarding.ts). */
  crawl?: OnboardingCrawl;
}

/** How often the card re-reads a running crawl's page count (the crawler page polls at 3 s). */
export const CRAWL_STEP_POLL_MS = 5_000;
interface OnboardingState {
  steps: Step[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  dismissed: boolean;
  hidden: boolean;
  intent: "business" | "agency" | null;
}

/**
 * The 6-item first-steps checklist (dismissible), shown on /dashboard and
 * /visibility. Done-detection is entirely server-side (/api/onboarding GET);
 * hidden for tenants older than ONBOARDING_WINDOW_DAYS (180) or with audits
 * predating onboarding. This said 14 days, which was never the trial length
 * and no longer matches the constant either.
 */
export function OnboardingChecklist({ locale = "en" }: { locale?: DashLocale }) {
  const t = ONBOARDING_COPY[locale];
  const [state, setState] = useState<OnboardingState | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  // Bumped when a running crawl settles: re-reads the checklist, which flips
  // the crawler step to done (or back to its button after a failed crawl).
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const json: OnboardingState = await res.json();
        if (active) setState(json);
      } catch {
        /* onboarding is non-critical — fail silent */
      }
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  // The crawler step's live count: while a crawl runs (and none has completed
  // yet), poll that crawl — the same endpoint the crawler page polls.
  const crawlStep = state?.steps.find((s) => s.key === "crawl_site");
  const runningId = crawlStep && !crawlStep.done ? (crawlStep.crawl?.running?.id ?? null) : null;
  const [livePages, setLivePages] = useState<{ id: string; pages: number } | null>(null);
  useEffect(() => {
    if (!runningId) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/seo/v1/crawl/${encodeURIComponent(runningId)}`);
        if (!res.ok || !active) return;
        const fresh: { status: string; pagesCrawled: number } = await res.json();
        if (!active) return;
        if (fresh.status === "QUEUED" || fresh.status === "RUNNING") {
          setLivePages({ id: runningId, pages: fresh.pagesCrawled });
        } else {
          clearInterval(timer);
          setReload((n) => n + 1);
        }
      } catch {
        /* non-critical: the count just stops moving */
      }
    }, CRAWL_STEP_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [runningId]);

  const dismiss = () => {
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => {});
  };

  if (!state || state.hidden || state.dismissed || state.allComplete) return null;

  return (
    <>
      <AddClientModal
        locale={locale}
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
      />
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
        <CardContent className="py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {t.checklistTitle}
                </h3>
                <p className="text-sm text-gray-500">
                  {t.progress(state.completedCount, state.totalCount)}
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              aria-label={t.dismissAria}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* progress bar */}
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{
                width: `${
                  state.totalCount > 0
                    ? (state.completedCount / state.totalCount) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <ul className="space-y-1">
            {state.steps.map((step) => {
              const label = t.steps[step.key] ?? step.key;
              if (step.key === "crawl_site" && step.crawl) {
                const live = livePages && livePages.id === step.crawl.running?.id ? livePages.pages : null;
                return <CrawlStepRow key={step.key} step={step} crawl={step.crawl} label={label} t={t} locale={locale} livePages={live} />;
              }
              if (step.done) {
                return (
                  <li key={step.key}>
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-400">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                      <span className="line-through">{label}</span>
                    </div>
                  </li>
                );
              }
              const row = (
                <>
                  <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                  <span className="font-medium">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-gray-400" />
                </>
              );
              return (
                <li key={step.key}>
                  {step.key === "add_client" ? (
                    <button
                      onClick={() => setClientModalOpen(true)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50"
                    >
                      {row}
                    </button>
                  ) : (
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-blue-50"
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

/**
 * The crawler step: the crawler's emblem in the status slot (h-5 w-5, the
 * size of the circles beside it; currentColor, so grey → blue while it runs →
 * green when done), the step's name, and one of three faces:
 *   - to do: the one-line pitch (rule count from the registry) and the button,
 *     "Start a crawl" → /crawler?url=<domain>, or "See plans" → /pricing on a
 *     tier that cannot crawl;
 *   - running: "Crawling… N of CAP pages", N polled live;
 *   - done: "Crawled N pages · health NN/100" and a link to those results.
 * The name is plain text, never a link's or a button's name: the sidebar's
 * crawler row stays the only control on the page called by it.
 */
function CrawlStepRow({
  step,
  crawl,
  label,
  t,
  locale,
  livePages,
}: {
  step: Step;
  crawl: OnboardingCrawl;
  label: string;
  t: OnboardingCopy;
  locale: DashLocale;
  livePages: number | null;
}) {
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const running = !step.done && crawl.running ? crawl.running : null;
  const tone = step.done ? "text-green-500" : running ? "text-blue-600" : "text-gray-400";
  return (
    <li data-testid="onboarding-step-crawl_site" data-state={step.done ? "done" : running ? "running" : "todo"}>
      <div className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm">
        <NosyBatIcon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <span className={step.done ? "text-gray-400 line-through" : "font-medium text-gray-700"}>{label}</span>
          {step.done && crawl.latest ? (
            <p className="mt-0.5 text-xs text-gray-600" data-testid="crawl-step-done">
              {t.crawl.done(int.format(crawl.latest.pages), crawl.latest.health === null ? null : int.format(crawl.latest.health))}
              {" · "}
              <Link href={step.href} className="font-medium text-blue-600 hover:underline">
                {t.crawl.results}
              </Link>
            </p>
          ) : running ? (
            <p className="mt-0.5 text-xs text-blue-700" data-testid="crawl-step-running">
              <span aria-live="polite">{t.crawl.crawling(int.format(livePages ?? running.pages), int.format(running.cap))}</span>
              {" · "}
              <Link href={step.href} className="font-medium text-blue-600 hover:underline">
                {t.crawl.viewProgress}
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">{t.crawl.line(crawl.rules)}</p>
          )}
        </div>
        {!step.done && !running && (
          <Link
            href={step.href}
            data-testid="crawl-step-cta"
            className="shrink-0 self-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            {crawl.canCrawl ? t.crawl.start : t.crawl.seePlans}
          </Link>
        )}
      </div>
    </li>
  );
}
