// tests/checkout-consent-carry.test.ts
//
// THE SINGLE MOST LIKELY BUG IN THE FUNNEL, PINNED DOWN.
//
// /api/billing/checkout validates consent BEFORE its auth branch (a165a4f).
// The register form's resumed call therefore has to present the consent the
// visitor gave on /pricing, one full-page navigation earlier. When it does not,
// every party to the failure is silent: the route answers 400 consent_required,
// the form's `if (r.ok && d.url)` quietly fails, and a brand-new customer who
// typed their card details' worth of intent lands on a dashboard with no
// subscription and no message.
//
// That was the state of the code before this change: register-form.tsx posted
// {tier, interval, locale} and no consent at all, so the resume was dead on
// arrival 100% of the time.
//
// These tests cover the carrier itself. The two ends are asserted where they
// live: the gate's position in tests/checkout-funnel.test.ts, and the fact that
// a missing consent must not be invented in the round-trip test at the bottom.

/// <reference lib="dom" />
// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_DOCUMENT_IDS, CONSENT_VERSION, checkConsent } from "@/lib/consent-config";
import { stashCheckoutConsent, takeCheckoutConsent } from "@/lib/checkout-consent";

const PAYLOAD = {
  accepted: true as const,
  version: CONSENT_VERSION,
  timestamp: "2026-08-19T10:00:00.000Z",
  documents: [...CONSENT_DOCUMENT_IDS],
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("the consent carried across the register hop", () => {
  it("survives the round trip intact", async () => {
    stashCheckoutConsent(PAYLOAD);

    expect(takeCheckoutConsent()).toEqual(PAYLOAD);
  });

  it("SATISFIES the server gate it exists for", () => {
    // The end-to-end assertion, made against the real validator rather than a
    // restatement of it: whatever comes out of the carrier must be something
    // checkConsent() accepts, or the resume 400s and the customer is stranded.
    stashCheckoutConsent(PAYLOAD);
    const carried = takeCheckoutConsent();

    expect(checkConsent(carried)).toEqual({ ok: true });
  });

  it("preserves the timestamp rather than restamping it", () => {
    // It records when the box was ticked — on /pricing — not when the resumed
    // call happened to fire. Restamping would make the compliance record say
    // the consent happened after the registration it preceded.
    stashCheckoutConsent(PAYLOAD);

    expect(takeCheckoutConsent()?.timestamp).toBe("2026-08-19T10:00:00.000Z");
  });

  it("is SINGLE USE — a second checkout cannot inherit it", () => {
    // Otherwise an unrelated later purchase in the same tab would ride on an
    // acceptance the visitor gave for a different one.
    stashCheckoutConsent(PAYLOAD);

    expect(takeCheckoutConsent()).not.toBeNull();
    expect(takeCheckoutConsent()).toBeNull();
  });

  it("returns null when nothing was stashed", () => {
    // The direct-URL case: someone opens /register?plan=…&checkout=1 by hand.
    // The form must fall back rather than fabricate a consent.
    expect(takeCheckoutConsent()).toBeNull();
  });

  it("returns null for a corrupted value, and clears it", () => {
    sessionStorage.setItem("echorank:checkout-consent", "{not json");

    expect(takeCheckoutConsent()).toBeNull();
    expect(sessionStorage.getItem("echorank:checkout-consent")).toBeNull();
  });

  it("rejects a stored payload that does not claim acceptance", () => {
    sessionStorage.setItem(
      "echorank:checkout-consent",
      JSON.stringify({ ...PAYLOAD, accepted: false }),
    );

    expect(takeCheckoutConsent()).toBeNull();
  });

  it("a stale version survives the carrier but is REFUSED by the gate", () => {
    // Deliberate division of labour: the carrier does not second-guess the
    // version, the server does. This is the case where the resume legitimately
    // fails and the form's fallback is what saves the customer — which is why
    // that fallback is not optional.
    stashCheckoutConsent({ ...PAYLOAD, version: "2026-01-01" });
    const carried = takeCheckoutConsent();

    expect(carried).not.toBeNull();
    expect(checkConsent(carried).ok).toBe(false);
  });
});
