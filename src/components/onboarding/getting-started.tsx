"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
}: {
  open: boolean;
  onClose: () => void;
  firstStepHref: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Welcome to EchoRank 360">
      <div className="space-y-4 text-sm leading-relaxed text-gray-600">
        <p>
          EchoRank helps you collect customer feedback, turn happy customers into
          public reviews, and catch unhappy ones before they post — plus see how
          visible your business is to AI answer engines.
        </p>
        <p className="rounded-lg bg-blue-50 p-3 text-blue-900">
          <strong>Start here:</strong> add a customer, then send your first
          feedback request. The checklist on your dashboard walks you through the
          rest — it checks itself off as you go.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={onClose}>
          Explore on my own
        </Button>
        <Link href={firstStepHref} onClick={onClose}>
          <Button>
            Add my first customer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Modal>
  );
}

export function GettingStarted() {
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
      />

      {showCard && (
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
          <CardContent className="py-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Get started with EchoRank
                  </h3>
                  <p className="text-sm text-gray-500">
                    {state.completedCount} of {state.totalCount} done — finish
                    setup to start collecting reviews.
                  </p>
                </div>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss getting started"
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
                        <span className="text-xs text-gray-400">(optional)</span>
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
                        <span className="text-xs text-gray-400">(optional)</span>
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
