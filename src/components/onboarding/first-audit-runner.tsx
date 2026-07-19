"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VisibilityReportButton } from "@/components/visibility/VisibilityReportButton";
import { ONBOARDING_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const AUDIT_TIMEOUT_MS = 30_000;

type Phase = "idle" | "running" | "done" | "failed" | "hidden";

/**
 * Auto-runs the tenant's first audit on their stored domain when they arrive
 * on /visibility from the welcome step (?onboarding=1) or still have a stored
 * domain with no audit yet. Renders as a slim banner above the page content:
 * running state, success ("Your first AI Visibility audit" + PDF button), or
 * a retry card on failure/timeout. The page itself is never blocked.
 */
export function FirstAuditRunner({
  locale = "en",
  triggered,
  onResult,
}: {
  locale?: DashLocale;
  /** true when the page was opened with ?onboarding=1 */
  triggered: boolean;
  /** Injects the finished audit into the page's normal result state. */
  onResult: (audit: unknown, url: string) => void;
}) {
  const t = ONBOARDING_COPY[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const [domain, setDomain] = useState<string | null>(null);
  const started = useRef(false);

  const run = async (target: string) => {
    setPhase("running");
    try {
      const res = await fetch("/api/ai/visibility/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, crawl: true, persist: true }),
        signal: AbortSignal.timeout(AUDIT_TIMEOUT_MS),
      });
      const data = await res.json();
      if (!res.ok || data.error || typeof data.score !== "number") throw new Error();
      onResult(data, target);
      setPhase("done");
      fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "first_audit_done", score: data.score }),
      }).catch(() => {});
    } catch {
      setPhase("failed");
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const json = await res.json();
        const pending = Boolean(json?.firstAudit?.pending);
        const target: string | null = json?.domain ?? null;
        if (!target || json.hidden || json.dismissed) return;
        if (!triggered && !pending) return;
        if (!pending) return; // already audited — nothing to do
        setDomain(target);
        run(target);
      } catch {
        /* non-critical */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered]);

  if (phase === "idle" || phase === "hidden") return null;

  if (phase === "running") {
    return (
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
        <CardContent className="flex items-center gap-3 py-4">
          <Sparkles className="h-5 w-5 animate-pulse text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{t.runningTitle}</p>
            <p className="text-xs text-gray-500">{t.runningSub}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "failed") {
    return (
      <Card className="border-amber-100 bg-amber-50/60">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t.retryTitle}</p>
            <p className="text-xs text-gray-500">{t.retrySub}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPhase("hidden")}>
              {t.skipForNow}
            </Button>
            <Button size="sm" onClick={() => domain && run(domain)}>
              {t.retryCta}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // done — the one-line first-audit banner
  return (
    <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <Sparkles className="h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{t.bannerTitle}</p>
          <p className="text-xs text-gray-500">{t.bannerSub}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Fresh mount → fresh availability probe (the audit is persisted now). */}
          <VisibilityReportButton />
          <button
            onClick={() => setPhase("hidden")}
            aria-label={t.dismissAria}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
