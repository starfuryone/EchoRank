// src/lib/consent-config.ts
//
// The documents a buyer must accept before checkout, and the version of that
// acceptance. Read by the client gate AND by the checkout route — one source of
// truth, the same shape as seo-tools.ts.
//
// NO API ENDPOINT, deliberately. The reference implementation fetches its
// consent config at runtime and needs a fail-closed path for when that fetch
// breaks. A typed module has no fetch and therefore no failure mode: the client
// cannot render a document list the server will reject, because they are the
// same array.
//
// PURE — no Prisma, no env, no React. It is imported into a client component,
// so anything server-only here would end up in the browser bundle (the mistake
// src/lib/free-tools/public-constants.ts exists to correct).
//
// BUMPING THE VERSION INVALIDATES EVERY PRIOR CONSENT. That is the point: it is
// what §8.2 of the Subscription Agreement means by recording "consent version".
// Bump it when the wording of any listed document changes materially, not when a
// typo is fixed — every checkout after the bump re-asks, and stale-version
// requests are rejected with 400.

/** Date-stamped. Bump on a material change to any listed document. */
// Day-stamped from here on. The month-granular "2026-08" could not express a
// second material change inside the same month, and the Subscription Agreement
// was revised on 2026-08-12 after being published on 2026-08-07 — both August.
export const CONSENT_VERSION = "2026-08-12";

export type ConsentDocumentId =
  | "subscription_agreement"
  | "terms"
  | "privacy"
  | "cookies";

export interface ConsentDocument {
  id: ConsentDocumentId;
  /** Key into the consent copy catalog; never a display string. */
  labelKey: "subscriptionAgreement" | "terms" | "privacy" | "cookies";
  /** Locale-less path. The gate prefixes the active locale. */
  href: string;
}

/**
 * Exactly four. The reference implementation carries a fifth
 * ("No Financial Advice") that belongs to a different product and is not
 * applicable here.
 */
export const CONSENT_DOCUMENTS: readonly ConsentDocument[] = [
  { id: "subscription_agreement", labelKey: "subscriptionAgreement", href: "/legal/subscription-agreement" },
  { id: "terms", labelKey: "terms", href: "/legal/terms" },
  { id: "privacy", labelKey: "privacy", href: "/legal/privacy" },
  { id: "cookies", labelKey: "cookies", href: "/legal/cookies" },
] as const;

/** Every id, in config order — what a valid consent payload must contain. */
export const CONSENT_DOCUMENT_IDS: readonly ConsentDocumentId[] =
  CONSENT_DOCUMENTS.map((d) => d.id);

/** The payload the client sends and the checkout route validates. */
export interface ConsentPayload {
  accepted: boolean;
  /** ISO 8601, client clock. Recorded, never trusted for authorization. */
  timestamp: string;
  version: string;
  documents: string[];
}

export interface ConsentCheck {
  ok: boolean;
  /** Why it failed, for logs — never returned to the caller verbatim. */
  reason?: "missing" | "not_accepted" | "stale_version" | "missing_documents";
}

/**
 * Server-side validation. Shared so the rule cannot drift between flows.
 *
 * Checks acceptance, that the version is the CURRENT one (an old checkout tab
 * left open across a version bump must re-consent), and that every configured
 * document id is present. Extra ids are tolerated — a client that sends a
 * document we have since removed is not lying about what it accepted.
 */
export function checkConsent(value: unknown): ConsentCheck {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "missing" };
  const c = value as Partial<ConsentPayload>;

  if (c.accepted !== true) return { ok: false, reason: "not_accepted" };
  if (c.version !== CONSENT_VERSION) return { ok: false, reason: "stale_version" };

  const sent = new Set(Array.isArray(c.documents) ? c.documents : []);
  if (!CONSENT_DOCUMENT_IDS.every((id) => sent.has(id))) {
    return { ok: false, reason: "missing_documents" };
  }
  return { ok: true };
}
