// Unit tests for the /settings/account tenant-rename server action's
// validation and write-shaping. Pure functions, no DB and no next/headers,
// which is why the schema lives outside the "use server" module.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTenantName,
  buildTenantNameUpdate,
  TENANT_NAME_MAX,
} from "../account-validation";
import { ACCOUNT_COPY } from "../i18n/account";

test("accepts a normal name and trims surrounding whitespace", () => {
  const r = parseTenantName({ name: "  Acme Dental  " });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.name, "Acme Dental");
});

test("rejects empty and whitespace-only names", () => {
  for (const bad of ["", "   ", "\t\n"]) {
    const r = parseTenantName({ name: bad });
    assert.equal(r.ok, false, `expected rejection for ${JSON.stringify(bad)}`);
    assert.equal(!r.ok && r.errorKey, "errorEmpty");
  }
});

test("accepts exactly the max length and rejects one over", () => {
  const atMax = "a".repeat(TENANT_NAME_MAX);
  assert.equal(parseTenantName({ name: atMax }).ok, true);

  const overMax = parseTenantName({ name: "a".repeat(TENANT_NAME_MAX + 1) });
  assert.equal(overMax.ok, false);
  assert.equal(!overMax.ok && overMax.errorKey, "errorTooLong");
});

test("length is measured after trimming", () => {
  const padded = `  ${"a".repeat(TENANT_NAME_MAX)}  `;
  assert.equal(parseTenantName({ name: padded }).ok, true);
});

test("rejects non-string and missing input without throwing", () => {
  for (const bad of [undefined, null, 42, {}, [], true]) {
    const r = parseTenantName({ name: bad });
    assert.equal(r.ok, false, `expected rejection for ${JSON.stringify(bad)}`);
  }
  assert.equal(parseTenantName(undefined).ok, false);
  assert.equal(parseTenantName("not an object").ok, false);
});

test("every error key resolves to copy in all three catalogs", () => {
  const keys = ["errorEmpty", "errorTooLong", "errorGeneric"] as const;
  for (const locale of ["en", "fr", "de-CH"] as const) {
    for (const k of keys) {
      const msg = ACCOUNT_COPY[locale][k];
      assert.equal(typeof msg, "string");
      assert.ok(msg.length > 0, `${locale}.${k} is empty`);
    }
  }
});

test("de-CH copy never uses ß", () => {
  for (const value of Object.values(ACCOUNT_COPY["de-CH"])) {
    assert.ok(!value.includes("ß"), `found ß in: ${value}`);
  }
});

test("catalogs expose identical key sets (no missing translation)", () => {
  const en = Object.keys(ACCOUNT_COPY.en).sort();
  for (const locale of ["fr", "de-CH"] as const) {
    assert.deepEqual(Object.keys(ACCOUNT_COPY[locale]).sort(), en, `${locale} key mismatch`);
  }
});

// The security-relevant assertion: the write is always scoped to the caller's
// tenant id and touches only `name`. A regression here is a cross-tenant write.
test("update is scoped to the given tenant and writes only name", () => {
  const args = buildTenantNameUpdate("tenant_abc", "New Name");
  assert.deepEqual(args.where, { id: "tenant_abc" });
  assert.deepEqual(args.data, { name: "New Name" });
  assert.deepEqual(Object.keys(args.data), ["name"]);
});

test("a tenant id in the payload cannot redirect the write", () => {
  // Even if a caller smuggles an id through the form, parse drops it and the
  // update is built from the session tenant id alone.
  const parsed = parseTenantName({ name: "Evil", id: "other_tenant" } as never);
  assert.equal(parsed.ok, true);
  const args = buildTenantNameUpdate("session_tenant", parsed.ok ? parsed.name : "");
  assert.equal(args.where.id, "session_tenant");
  assert.ok(!("id" in args.data));
});
