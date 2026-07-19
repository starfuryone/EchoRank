"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  GETTING_STARTED_COPY,
  type DashLocale,
  type GettingStartedCopy,
} from "@/lib/i18n/dashboard";

interface Step {
  key: string;
  label: string;
  href: string;
  done: boolean;
  optional: boolean;
}
interface OnboardingState {
  steps: Step[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  welcomeSeen: boolean;
  dismissed: boolean;
}

function WelcomeModal({
  open,
  onClose,
  firstStepHref,
  t,
}: {
  open: boolean;
  onClose: () => void;
  firstStepHref: string;
  t: GettingStartedCopy;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.welcomeTitle}>
      <div className="space-y-4 text-sm leading-relaxed text-gray-600">
        <p>{t.welcomeP1}</p>
        <p className="rounded-lg bg-blue-50 p-3 text-blue-900">
          <strong>{t.welcomeStartStrong}</strong>
          {t.welcomeStartRest}
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={onClose}>
          {t.exploreButton}
        </Button>
        <Link href={firstStepHref} onClick={onClose}>
          <Button>
            {t.addFirstCustomer}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Modal>
  );
}

export function GettingStarted({ locale = "en" }: { locale?: DashLocale }) {
  const t = GETTING_STARTED_COPY[locale];
  const [state, setState] = useState<OnboardingState | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const json: OnboardingState = await res.json();
        if (!active) return;
        setState(json);
        if (!json.welcomeSeen && !json.dismissed) {
          setWelcomeOpen(true);
          fetch("/api/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "welcome_seen" }),
          }).catch(() => {});
        }
      } catch {
        /* onboarding is non-critical — fail silent */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = async () => {
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => {});
  };

  if (!state) return null;

  const firstStepHref =
    state.steps.find((s) => !s.done && !s.optional)?.href ?? "/customers";

  // Once complete or dismissed, the card disappears — but keep the welcome
  // modal mountable so a first-login user still sees it this session.
  const showCard = !state.allComplete && !state.dismissed;

  return (
    <>
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        firstStepHref={firstStepHref}
        t={t}
      />

      {showCard && (
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
          <CardContent className="py-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.cardTitle}
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
              {state.steps.map((step) => (
                <li key={step.key}>
                  {step.done ? (
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-400">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                      <span className="line-through">{step.label}</span>
                      {step.optional && (
                        <span className="text-xs text-gray-400">{t.optional}</span>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-blue-50"
                    >
                      <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                      <span className="font-medium">{step.label}</span>
                      {step.optional && (
                        <span className="text-xs text-gray-400">{t.optional}</span>
                      )}
                      <ArrowRight className="ml-auto h-4 w-4 text-gray-400" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
