"use client";

// The plan & billing card's buttons on /plan (PLAN-HUB Part 2). The two that
// act — the Stripe portal and Resume — are POSTs, as on /billing; the rest are
// links: Manage subscription and Change plan to /billing, Cancel to the
// CANCEL-FAIR-PLAY confirmation page /billing/cancel.
//
// Same rules as the /billing plan card: Cancel is a first-class button the
// size and weight of the others, Resume is one click while access remains,
// the portal button is absent without a Stripe customer, and a role that
// cannot manage billing sees who can instead of buttons.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OUTLINE_BUTTON_CLASS } from "@/components/billing/plan-status-card";
import type { PlanCardState } from "@/lib/billing/plan-card-state";
import type { PlanHubCopy } from "@/lib/i18n/plan-hub";

export function PlanBillingActions({
  t,
  state,
  canManage,
  ownerName,
  hasPortal,
}: {
  t: PlanHubCopy;
  state: PlanCardState;
  canManage: boolean;
  ownerName: string | null;
  hasPortal: boolean;
}) {
  const router = useRouter();
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState(false);

  async function openPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    setPortalError(false);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("portal failed");
      window.location.assign(data.url);
    } catch {
      setPortalError(true);
      setPortalBusy(false);
    }
  }

  async function resume() {
    if (resumeBusy) return;
    setResumeBusy(true);
    setResumeError(false);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      if (!res.ok) throw new Error("resume failed");
      router.refresh();
    } catch {
      setResumeError(true);
    } finally {
      setResumeBusy(false);
    }
  }

  const cancellable = state === "trial" || state === "renewing" || state === "past_due";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/billing" className={OUTLINE_BUTTON_CLASS} data-testid="plan-manage">
          {t.manage}
        </Link>
        {canManage && hasPortal && (
          <Button variant="outline" onClick={openPortal} disabled={portalBusy} data-testid="plan-portal">
            {t.portal}
          </Button>
        )}
        <Link href="/billing#plans" className={OUTLINE_BUTTON_CLASS} data-testid="plan-change">
          {t.changePlan}
        </Link>
        {canManage && cancellable && (
          <Link href="/billing/cancel" className={OUTLINE_BUTTON_CLASS} data-testid="plan-cancel">
            {t.cancel}
          </Link>
        )}
        {canManage && state === "cancelling" && (
          <Button variant="outline" onClick={resume} loading={resumeBusy} data-testid="plan-resume">
            {t.resume}
          </Button>
        )}
      </div>
      {!canManage && (
        <p className="mt-2 text-sm text-gray-600" data-testid="plan-owner-only">
          {t.ownerOnly(ownerName)}
        </p>
      )}
      {portalError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {t.portalError}
        </p>
      )}
      {resumeError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {t.resumeError}
        </p>
      )}
    </div>
  );
}
