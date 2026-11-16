"use client";

// The plan & billing card's buttons on /plan (PLAN-HUB Part 2).
//
// CANCEL is our own: "Cancel subscription" opens a confirm dialog with the
// plan and "Access until <date>", an optional reason and note, and one
// button that POSTs /api/billing/cancel (cancel_at_period_end at Stripe; the
// customer keeps access until then). No Stripe portal redirect. On success the
// card re-renders from the server (router.refresh): the status reads
// "Cancelled, access until <date>" and Resume takes Cancel's place.
// RESUME is one POST to /api/billing/resume while access remains.
// Both are the tenant OWNER's (canCancel); everyone else is told who can.
// Neither shows without a Stripe plan subscription (hasSubscription).
//
// The other buttons: Manage subscription and Change plan link to /billing;
// the Stripe portal (payment method, invoices) is OWNER/ADMIN (canManage).
//
// PROPS ARE DATA ONLY. Rendered by the server <PlanHub>, so a function in a
// prop is a 500 ("Functions cannot be passed directly to Client Components";
// /plan, 2026-11-15). The copy is read here from the locale, and the date
// arrives formatted. tests/rsc-client-props.test.ts.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { OUTLINE_BUTTON_CLASS } from "@/components/billing/plan-status-card";
import type { PlanCardState } from "@/lib/billing/plan-card-state";
import { CANCEL_NOTE_MAX, CANCEL_REASONS } from "@/lib/billing/cancel-reasons";
import { BILLING_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { PLAN_HUB_COPY } from "@/lib/i18n/plan-hub";

type Failure = { reason?: string; error?: string; ownerName?: string | null };

export function PlanBillingActions({
  locale,
  state,
  canManage,
  canCancel,
  ownerName,
  hasPortal,
  hasSubscription,
  planName,
  periodEndLabel,
}: {
  locale: DashLocale;
  state: PlanCardState;
  canManage: boolean;
  canCancel: boolean;
  ownerName: string | null;
  hasPortal: boolean;
  hasSubscription: boolean;
  planName: string;
  /** Trial end, renewal, or the day access ends; already formatted. */
  periodEndLabel: string | null;
}) {
  const t = PLAN_HUB_COPY[locale];
  const b = BILLING_COPY[locale];
  const router = useRouter();
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  /** What the server said, in the visitor's language. Never swallowed. */
  function failureText(res: Response, body: Failure, fallback: string): string {
    if (res.status === 403 && body.reason === "role") return t.ownerOnly(body.ownerName ?? ownerName);
    if (res.status === 429) return t.rateLimited;
    if (res.status === 409 && body.reason === "no_subscription") return b.cancelNothing;
    return fallback;
  }

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
    setResumeError(null);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Failure;
        setResumeError(failureText(res, body, t.resumeError));
        return;
      }
      router.refresh();
    } catch {
      setResumeError(t.resumeError);
    } finally {
      setResumeBusy(false);
    }
  }

  async function confirmCancel() {
    if (cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason || null, note: note.trim() || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Failure;
        setCancelError(failureText(res, body, b.cancelError));
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      setCancelError(b.cancelError);
    } finally {
      setCancelBusy(false);
    }
  }

  const cancellable = state === "trial" || state === "renewing" || state === "past_due";
  const showCancel = canCancel && hasSubscription && cancellable;
  const showResume = canCancel && hasSubscription && state === "cancelling";

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
        {showCancel && (
          <Button
            variant="outline"
            onClick={() => {
              setCancelError(null);
              setDialogOpen(true);
            }}
            data-testid="plan-cancel"
          >
            {t.cancel}
          </Button>
        )}
        {showResume && (
          <Button variant="outline" onClick={resume} loading={resumeBusy} data-testid="plan-resume">
            {t.resume}
          </Button>
        )}
      </div>
      {!canCancel && hasSubscription && (
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
        <p className="mt-2 text-xs text-red-600" role="alert" data-testid="plan-resume-error">
          {resumeError}
        </p>
      )}

      <Modal open={dialogOpen} onClose={() => !cancelBusy && setDialogOpen(false)} title={b.cancelPageTitle(planName)} closeLabel={t.cancelDialogClose}>
        <div className="space-y-4 px-6 py-5" data-testid="plan-cancel-dialog">
          <ul className="space-y-1 text-sm text-gray-800">
            <li data-testid="plan-cancel-plan">{t.planLine(planName)}</li>
            {periodEndLabel && <li data-testid="plan-cancel-until">{t.accessUntil(periodEndLabel)}</li>}
            <li>{state === "trial" ? b.factNoChargeTrial : b.factNoChargePaid}</li>
          </ul>
          <div>
            <label htmlFor="plan-cancel-reason" className="block text-sm font-medium text-gray-700">
              {b.reasonLabel}
            </label>
            <select
              id="plan-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{b.reasonPlaceholder}</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {b.reasons[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="plan-cancel-note" className="block text-sm font-medium text-gray-700">
              {b.noteLabel}
            </label>
            <textarea
              id="plan-cancel-note"
              value={note}
              maxLength={CANCEL_NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {cancelError && (
            <p className="text-sm text-red-600" role="alert" data-testid="plan-cancel-error">
              {cancelError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={cancelBusy} data-testid="plan-cancel-keep">
              {b.keepPlan}
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelBusy} data-testid="plan-cancel-confirm">
              {cancelBusy ? b.cancelBusy : b.confirmCancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
