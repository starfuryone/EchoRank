// src/app/[locale]/legal/_content/registry.ts
//
// Consent document id -> a DYNAMIC import of that document's body.
//
// The imports are thunks, not top-level imports, and that is the entire point:
// the pricing page must not carry five legal documents in its bundle for the
// sake of a modal most visitors never open. Each body is fetched the first time
// someone actually asks to read it.
//
// Keyed by ConsentDocumentId so the modal cannot be asked for a document the
// consent config does not list — the map is exhaustive by type, so adding an id
// to consent-config.ts fails to compile until its loader exists here.

import type { ConsentDocumentId } from "@/lib/consent-config";
import type { LegalDoc } from "./types";

type Loader = () => Promise<(locale: string) => LegalDoc>;

export const LEGAL_DOC_LOADERS: Record<ConsentDocumentId, Loader> = {
  subscription_agreement: async () =>
    (await import("./subscription-agreement")).buildSubscriptionAgreement,
  terms: async () => (await import("./terms")).buildTerms,
  privacy: async () => (await import("./privacy")).buildPrivacy,
  cookies: async () => (await import("./cookies")).buildCookies,
};

export async function loadLegalDoc(
  id: ConsentDocumentId,
  locale: string,
): Promise<LegalDoc> {
  const build = await LEGAL_DOC_LOADERS[id]();
  return build(locale);
}
