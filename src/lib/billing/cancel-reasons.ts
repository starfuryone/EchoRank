// src/lib/billing/cancel-reasons.ts — the optional "why are you leaving" field.
//
// OPTIONAL AND NEVER BLOCKING. No reason, an unknown reason or an empty note
// all cancel exactly the same way: an unrecognised value is dropped, never
// turned into a 400. The reason goes to Stripe's own cancellation_details
// (so the Stripe dashboard shows it) and into the audit log.
//
// Dependency-free: the confirmation page's select reads CANCEL_REASONS too.

export const CANCEL_REASONS = [
  "too_expensive",
  "missing_feature",
  "switching",
  "not_using",
  "other",
] as const;

/**
 * Earlier keys still accepted, as what they became: "used_once" ("Only
 * needed it once") is "not_using" since 2026-11-16. Audit rows written before
 * keep the old word.
 */
const LEGACY_REASONS: Record<string, (typeof CANCEL_REASONS)[number]> = { used_once: "not_using" };

export type CancelReason = (typeof CANCEL_REASONS)[number];

/** The free-text note is cut, not refused, past this length. */
export const CANCEL_NOTE_MAX = 500;

/** Stripe's fixed feedback vocabulary for each of ours. */
export const STRIPE_FEEDBACK: Record<
  CancelReason,
  "too_expensive" | "missing_features" | "unused" | "switched_service" | "other"
> = {
  too_expensive: "too_expensive",
  missing_feature: "missing_features",
  switching: "switched_service",
  not_using: "unused",
  other: "other",
};

export interface CancelInput {
  reason: CancelReason | null;
  note: string | null;
}

/** Whatever the client sent, as a CancelInput. Never throws. */
export function parseCancelInput(body: unknown): CancelInput {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const asked =
    typeof raw.reason === "string" ? (Object.hasOwn(LEGACY_REASONS, raw.reason) ? LEGACY_REASONS[raw.reason] : raw.reason) : null;
  const reason = asked && (CANCEL_REASONS as readonly string[]).includes(asked) ? (asked as CancelReason) : null;
  const note =
    typeof raw.note === "string" && raw.note.trim().length > 0
      ? raw.note.trim().slice(0, CANCEL_NOTE_MAX)
      : null;
  return { reason, note };
}
