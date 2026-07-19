"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AddClientModal } from "@/components/onboarding/add-client-modal";
import { ONBOARDING_COPY, type DashLocale } from "@/lib/i18n/dashboard";

interface Step {
  key: string;
  href: string;
  done: boolean;
}
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
 * The 5-item first-steps checklist (dismissible), shown on /dashboard and
 * /visibility. Done-detection is entirely server-side (/api/onboarding GET);
 * hidden for tenants older than 14 days or with audits predating onboarding.
 */
export function OnboardingChecklist({ locale = "en" }: { locale?: DashLocale }) {
  const t = ONBOARDING_COPY[locale];
  const [state, setState] = useState<OnboardingState | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);

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
  }, []);

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
