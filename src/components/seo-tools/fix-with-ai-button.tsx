"use client";

// "Fix with AI" — the entry point the Action Agent is reached from.
//
// ONE COMPONENT, EVERY SURFACE. It lives on /visibility (schema and FAQ for the
// audited page) and /monitoring (a batch of review replies), and it will live
// on whatever surface v2 adds. Each of those pages already knows its own
// target; none of them should know the queue's API shape, the budget's error
// codes or the copy that explains a reset date.
//
// IT ENQUEUES AND SAYS SO. The generation is a queued job, so this button never
// waits for a draft and never renders one. What it renders is "queued, nothing
// is published, here is where to read it" — because the alternative, a spinner
// that resolves into content, is exactly the shape that makes a customer
// believe the fix has been applied.
//
// THE 429 IS THE INTERESTING CASE. An exhausted tenant is refused HERE, on the
// click, with the reset date the route returns — see marketingBudgetResetsAt.
// This is the surface furthest from the usage meter, so it is the one where
// "you are out of budget" with no date would be the least actionable.

import { useCallback, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTION_AGENT_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const INTL_LOCALE: Record<DashLocale, string> = { en: "en", fr: "fr", "de-CH": "de-CH" };

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => values[key] ?? "");
}

export function FixWithAiButton({
  locale,
  kind,
  url,
  reviewLimit,
  label,
  variant = "outline",
  size = "sm",
  className,
}: {
  locale: DashLocale;
  kind: "schema" | "faq" | "review_reply";
  /** Required for the page-shaped kinds. */
  url?: string;
  /** Only read for review_reply. */
  reviewLimit?: number;
  /** Overrides the default per-kind label. */
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const copy = ACTION_AGENT_COPY[locale];
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");
  const [error, setError] = useState<string | null>(null);

  const enqueue = useCallback(async () => {
    setState("busy");
    setError(null);
    try {
      const response = await fetch("/api/action-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          locale,
          ...(kind === "review_reply" ? { reviewLimit: reviewLimit ?? 5 } : { url }),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        resetsAt?: string;
      };
      if (!response.ok) {
        if (data.code === "BUDGET_EXCEEDED" && data.resetsAt) {
          throw new Error(
            interpolate(copy.errBudget, {
              date: new Intl.DateTimeFormat(INTL_LOCALE[locale], {
                dateStyle: "long",
              }).format(new Date(data.resetsAt)),
            }),
          );
        }
        if (data.code === "PLAN_LOCKED") throw new Error(copy.errLocked);
        if (data.code === "PAGE_UNREACHABLE") throw new Error(copy.errPage);
        throw new Error(data.error ?? copy.errGeneric);
      }
      setState("queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errGeneric);
      setState("idle");
    }
  }, [copy, kind, locale, reviewLimit, url]);

  if (state === "queued") {
    return (
      <div className={className}>
        <p className="text-sm text-green-700">{copy.fixWithAiQueued}</p>
        <Link
          href="/visibility/tools/action-agent"
          className="mt-1 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {copy.openQueue}
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        variant={variant}
        size={size}
        loading={state === "busy"}
        disabled={state === "busy" || (kind !== "review_reply" && !url)}
        onClick={() => void enqueue()}
      >
        <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {label ?? (kind === "review_reply" ? copy.fixWithAiReviews : copy.fixWithAi)}
      </Button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
