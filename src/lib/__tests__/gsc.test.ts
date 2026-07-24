// GSC unit tests: AES-256-GCM roundtrip + tamper detection, and OAuth state
// sign/verify (tenant binding, expiry, signature). Pure functions, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptToken, decryptToken } from "../gsc/crypto";
import { signState, verifyState } from "../gsc/state";
import { GSC_COPY } from "../i18n/dashboard";

const KEY = "test-secret-key-of-any-shape";

test("encrypt/decrypt roundtrip; unique IV per call", () => {
  const token = "1//refresh-token-EXAMPLE-abc123";
  const enc1 = encryptToken(token, KEY);
  const enc2 = encryptToken(token, KEY);
  assert.notEqual(enc1, enc2); // random IV
  assert.ok(enc1.startsWith("v1:"));
  assert.ok(!enc1.includes(token));
  assert.equal(decryptToken(enc1, KEY), token);
  assert.equal(decryptToken(enc2, KEY), token);
});

test("decrypt rejects tampering and wrong keys", () => {
  const enc = encryptToken("secret-token", KEY);
  const parts = enc.split(":");
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}AA`;
  assert.throws(() => decryptToken(tampered, KEY));
  assert.throws(() => decryptToken(enc, "a-different-key"));
  assert.throws(() => decryptToken("v2:a:b:c", KEY));
});

test("state binds to tenant, expires, and rejects forgery", () => {
  const now = 1_700_000_000_000;
  const state = signState("tenant_abc", KEY, now);
  assert.equal(verifyState(state, KEY, now + 60_000), "tenant_abc");
  // expired (16 min later; TTL is 15)
  assert.equal(verifyState(state, KEY, now + 16 * 60_000), null);
  // wrong secret
  assert.equal(verifyState(state, "other-key", now), null);
  // tampered payload keeps old signature → reject
  const [payload, sig] = [state.slice(0, state.lastIndexOf(".")), state.slice(state.lastIndexOf(".") + 1)];
  const forged = `${Buffer.from(`tenant_evil.${now + 999999}.x`).toString("base64url")}.${sig}`;
  assert.equal(verifyState(forged, KEY, now), null);
  assert.ok(payload.length > 0);
  // garbage
  assert.equal(verifyState("not-a-state", KEY, now), null);
  assert.equal(verifyState("", KEY, now), null);
});

test("two states for the same tenant differ (nonce)", () => {
  const now = 1_700_000_000_000;
  assert.notEqual(signState("t1", KEY, now), signState("t1", KEY, now));
});

test("gsc copy complete in all locales incl. error codes", () => {
  const codes = ["denied", "bad_state", "no_refresh_token", "no_properties", "exchange_failed"];
  for (const locale of ["en", "fr", "de-CH"] as const) {
    const c = GSC_COPY[locale];
    assert.ok(c.connectTitle.length && c.connectBody.length && c.reauthBanner.length);
    assert.ok(c.pickTitle.length && c.emptyData.length && c.disconnectConfirm.length);
    assert.ok(c.lastSync("2026-01-01").includes("2026-01-01"));
    assert.ok(c.syncDone(5).length);
    for (const code of codes) assert.ok(c.errors[code]?.length, `${locale} error ${code}`);
  }
  assert.ok(!JSON.stringify(GSC_COPY).includes("EchoRank"));
});
