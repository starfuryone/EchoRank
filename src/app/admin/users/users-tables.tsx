"use client";

// /admin/users tables and the staff cancel dialog. English only, like the
// rest of /admin; the dashboard's light look (Tailwind, Card-like panels).
//
// PROPS ARE DATA ONLY: rows of strings, numbers, booleans and ISO dates from
// the server page (tests/rsc-client-props.test.ts). Callbacks live inside this
// module, between client components.
//
// CANCEL: one button per row, a dialog with the tenant, plan and end date,
// "At period end" (default) or "Immediately", no refunds. POST
// /api/admin/users/cancel; on success every row of that tenant takes the
// state the server read back, at once, without a reload. A refusal is shown.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminUserRow, CancelRequestRow, TenantBillingState } from "@/lib/admin/users";

const date = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso)) : "—";

const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
const td = "whitespace-nowrap px-3 py-2 text-sm text-gray-800";

function StatusCell({ billingStatus, subscriptionStatus, cancelAtPeriodEnd }: { billingStatus: string; subscriptionStatus: string | null; cancelAtPeriodEnd: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">{billingStatus}</span>
      {subscriptionStatus && subscriptionStatus !== billingStatus && (
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700" title="Subscription row status">
          sub {subscriptionStatus}
        </span>
      )}
      {cancelAtPeriodEnd && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">cancelling</span>}
    </span>
  );
}

interface Target {
  tenantId: string;
  tenantName: string;
  plan: string;
  periodEnd: string | null;
  hasStripeSubscription: boolean;
}

function CancelDialog({ target, onClose, onDone }: { target: Target; onClose: () => void; onDone: (t: TenantBillingState, message: string) => void }) {
  const [when, setWhen] = useState<"period_end" | "now">("period_end");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: target.tenantId, when }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; reason?: string; path?: string; changed?: boolean; tenant?: TenantBillingState | null };
      if (!res.ok || !body.ok || !body.tenant) {
        setError(`${res.status}: ${body.error ?? "The cancel failed."}${body.reason ? ` (${body.reason})` : ""}`);
        if (body.tenant) onDone(body.tenant, "");
        return;
      }
      const what = body.path === "manual" ? "Billing status set to CANCELED (no Stripe subscription)." : when === "now" ? "Subscription ended now at Stripe." : "Set to cancel at period end at Stripe.";
      onDone(body.tenant, body.changed ? what : "Nothing to change: it was already in that state.");
      onClose();
    } catch (err) {
      setError(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Cancel ${target.tenantName}`}>
      <div className="space-y-4 px-6 py-5" data-testid="admin-cancel-dialog">
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Tenant</dt>
          <dd className="text-gray-900" data-testid="admin-cancel-tenant">{target.tenantName}</dd>
          <dt className="text-gray-500">Plan</dt>
          <dd className="text-gray-900" data-testid="admin-cancel-plan">{target.plan}</dd>
          <dt className="text-gray-500">Period ends</dt>
          <dd className="text-gray-900" data-testid="admin-cancel-end">{date(target.periodEnd)}</dd>
        </dl>
        {!target.hasStripeSubscription && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No Stripe subscription: either choice sets billingStatus to CANCELED in the database.
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">When</legend>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="radio" name="when" value="period_end" checked={when === "period_end"} onChange={() => setWhen("period_end")} />
            <span>
              <b>At period end</b> (default). Access lasts until {date(target.periodEnd)}; no further charge.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="radio" name="when" value="now" checked={when === "now"} onChange={() => setWhen("now")} />
            <span>
              <b>Immediately</b>. Access ends now. No refund, no proration.
            </span>
          </label>
        </fieldset>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="admin-cancel-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Keep
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy} data-testid="admin-cancel-confirm">
            {when === "now" ? "Cancel immediately" : "Cancel at period end"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function canCancel(r: { billingStatus: string; subscriptionStatus: string | null; cancelAtPeriodEnd: boolean; hasStripeSubscription: boolean }) {
  if (r.hasStripeSubscription) return r.subscriptionStatus !== "CANCELED";
  return r.billingStatus !== "CANCELED" && r.billingStatus !== "NONE";
}

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status" data-testid="admin-cancel-notice">
      {text}
    </p>
  );
}

export function UsersTable({ rows: initial }: { rows: AdminUserRow[] }) {
  const [rows, setRows] = useState(initial);
  const [target, setTarget] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = (t: TenantBillingState, message: string) => {
    setRows((rs) => rs.map((r) => (r.tenantId === t.tenantId ? { ...r, ...t } : r)));
    if (message) setNotice(message);
  };

  return (
    <div>
      <Notice text={notice} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200" data-testid="admin-users-table">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "Tenant", "Role", "Plan", "Status", "Trial / period end", "Created", "Last login", "Stripe", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.memberId} data-tenant={r.tenantId}>
                <td className={td}>{r.name ?? "—"}</td>
                <td className={td}>{r.email}</td>
                <td className={td}>
                  {r.tenantName} <span className="text-xs text-gray-400">{r.tenantSlug}</span>
                </td>
                <td className={td}>{r.role}</td>
                <td className={td}>{r.plan}</td>
                <td className={td} data-testid="admin-row-status">
                  <StatusCell billingStatus={r.billingStatus} subscriptionStatus={r.subscriptionStatus} cancelAtPeriodEnd={r.cancelAtPeriodEnd} />
                </td>
                <td className={td}>{date(r.periodEnd)}</td>
                <td className={td}>{date(r.createdAt)}</td>
                <td className={td}>{date(r.lastLoginAt)}</td>
                <td className={td}>
                  {r.stripeCustomerUrl ? (
                    <a href={r.stripeCustomerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                      {r.stripeCustomerId}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td}>
                  {canCancel(r) && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="admin-cancel"
                      onClick={() => setTarget({ tenantId: r.tenantId, tenantName: r.tenantName, plan: r.plan, periodEnd: r.periodEnd, hasStripeSubscription: r.hasStripeSubscription })}
                    >
                      Cancel…
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={11}>
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {target && <CancelDialog target={target} onClose={() => setTarget(null)} onDone={apply} />}
    </div>
  );
}

export function CancelRequestsTable({ rows: initial }: { rows: CancelRequestRow[] }) {
  const [rows, setRows] = useState(initial.map((r) => ({ ...r, billingStatus: r.status as string, subscriptionStatus: r.status as string | null, cancelAtPeriodEnd: true, hasStripeSubscription: true })));
  const [target, setTarget] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = (t: TenantBillingState, message: string) => {
    setRows((rs) => rs.map((r) => (r.tenantId === t.tenantId ? { ...r, ...t, accessEndsAt: t.periodEnd ?? r.accessEndsAt } : r)));
    if (message) setNotice(message);
  };

  return (
    <div>
      <Notice text={notice} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200" data-testid="admin-cancel-requests">
          <thead className="bg-gray-50">
            <tr>
              {["Tenant", "Plan", "Status", "Requested", "Access ends", "Stripe", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.tenantId} data-tenant={r.tenantId}>
                <td className={td}>
                  {r.tenantName} <span className="text-xs text-gray-400">{r.tenantSlug}</span>
                </td>
                <td className={td}>{r.plan}</td>
                <td className={td}>
                  <StatusCell billingStatus={r.billingStatus} subscriptionStatus={r.subscriptionStatus} cancelAtPeriodEnd={r.cancelAtPeriodEnd} />
                </td>
                <td className={td}>{r.requestedAt ? date(r.requestedAt) : <span title="Cancelled outside the app (Stripe portal or dashboard)">outside the app</span>}</td>
                <td className={td}>{date(r.accessEndsAt)}</td>
                <td className={td}>
                  {r.stripeCustomerUrl ? (
                    <a href={r.stripeCustomerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td}>
                  {canCancel(r) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget({ tenantId: r.tenantId, tenantName: r.tenantName, plan: r.plan, periodEnd: r.accessEndsAt, hasStripeSubscription: r.hasStripeSubscription })}
                    >
                      Cancel…
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={7}>
                  No subscription is set to cancel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {target && <CancelDialog target={target} onClose={() => setTarget(null)} onDone={apply} />}
    </div>
  );
}
