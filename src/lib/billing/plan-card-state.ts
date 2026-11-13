// src/lib/billing/plan-card-state.ts — which story the Billing plan card tells.
//
// CANCEL-FAIR-PLAY rule 6: the card always says what is true, with dates —
// a trial and when it ends, a plan and when it renews, a cancellation and
// when access ends, or a plan that has ended. One pure function, read by the
// card, the confirmation page and the tests, so they cannot disagree.
//
// Dependency-free: imported by Client Components.

export type PlanCardState = "trial" | "renewing" | "cancelling" | "ended" | "past_due" | "none";

export interface PlanCardInput {
  /** Subscription.status, else Tenant.billingStatus (what /api/billing returns). */
  status: string | null | undefined;
  cancelAtPeriodEnd: boolean;
}

export function planCardState({ status, cancelAtPeriodEnd }: PlanCardInput): PlanCardState {
  if (status === "CANCELED" || status === "CANCELLED") return "ended";
  const live = status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE";
  if (live && cancelAtPeriodEnd) return "cancelling";
  if (status === "TRIALING") return "trial";
  if (status === "ACTIVE") return "renewing";
  if (status === "PAST_DUE") return "past_due";
  return "none";
}

/** Which buttons the card shows next to "Payment method & invoices". */
export function planCardAction(state: PlanCardState): "cancel" | "resume" | null {
  if (state === "trial" || state === "renewing" || state === "past_due") return "cancel";
  if (state === "cancelling") return "resume";
  return null;
}

/**
 * A period date as the customer reads it. UTC, so the server render and the
 * client render agree (the email uses the tenant's own zone, like the
 * trial-ending notice does).
 */
export function formatPeriodDate(iso: string | Date, locale: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(d);
}
