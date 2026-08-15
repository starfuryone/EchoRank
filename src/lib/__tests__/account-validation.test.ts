// Unit tests for the /settings/account tenant-rename server action's
// validation and write-shaping. Pure functions, no DB and no next/headers,
// which is why the schema lives outside the "use server" module.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTenantName,
  buildTenantNameUpdate,
  parseRevenueAssumptions,
  buildRevenueAssumptionsUpdate,
  TENANT_NAME_MAX,
  AVG_SALE_VALUE_MAX,
  CONV_RATE_DEFAULT,
  AVG_SALE_VALUE_DEFAULT,
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

// ─── AI revenue assumptions ─────────────────────────────────────────────────
//
// The bounds are not cosmetic. convRate = 0 makes `won` identically zero, which
// a customer reads as a data outage rather than as their own input; avgSaleValue
// = 0 does the same to both headline figures on /visibility/tools/revenue. Both
// bounds exist again as Postgres CHECK constraints, as a backstop under any
// future path that skips this parse.

test("accepts assumptions inside the bounds", () => {
  const r = parseRevenueAssumptions({ convRate: "0.35", avgSaleValue: "1250" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.convRate, 0.35);
  assert.equal(r.ok && r.avgSaleValue, 1250);
});

test("accepts the schema defaults unchanged", () => {
  const r = parseRevenueAssumptions({
    convRate: CONV_RATE_DEFAULT,
    avgSaleValue: AVG_SALE_VALUE_DEFAULT,
  });
  assert.equal(r.ok, true);
});

test("accepts a close rate of exactly 1 but not 0", () => {
  // 0 < convRate <= 1: everyone closing is unusual, nobody closing is a value
  // that silently zeroes the whole page.
  assert.equal(parseRevenueAssumptions({ convRate: "1", avgSaleValue: "10" }).ok, true);

  const zero = parseRevenueAssumptions({ convRate: "0", avgSaleValue: "10" });
  assert.equal(zero.ok, false);
  assert.equal(!zero.ok && zero.errorKey, "errorConvRate");
});

test("rejects a close rate above 1", () => {
  // Would claim more sales than leads.
  for (const bad of ["1.01", "2", "100"]) {
    const r = parseRevenueAssumptions({ convRate: bad, avgSaleValue: "10" });
    assert.equal(r.ok, false, bad);
    assert.equal(!r.ok && r.errorKey, "errorConvRate", bad);
  }
});

test("rejects a negative or zero sale value", () => {
  for (const bad of ["0", "-1", "-0.01"]) {
    const r = parseRevenueAssumptions({ convRate: "0.3", avgSaleValue: bad });
    assert.equal(r.ok, false, bad);
    assert.equal(!r.ok && r.errorKey, "errorAvgSaleValue", bad);
  }
});

test("rejects a sale value above the typo ceiling", () => {
  const r = parseRevenueAssumptions({
    convRate: "0.3",
    avgSaleValue: String(AVG_SALE_VALUE_MAX + 1),
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.errorKey, "errorAvgSaleValue");
});

test("rejects non-numeric and non-finite input rather than storing NaN", () => {
  for (const bad of ["", "abc", "Infinity", "NaN", null, undefined, {}]) {
    const r = parseRevenueAssumptions({ convRate: bad, avgSaleValue: "10" });
    assert.equal(r.ok, false, String(bad));
  }
});

test("accepts a comma decimal separator", () => {
  // fr and de-CH users type "0,35". Coercing with a bare Number() would yield
  // NaN and blame the value rather than the separator.
  const r = parseRevenueAssumptions({ convRate: "0,35", avgSaleValue: "1250,50" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.convRate, 0.35);
  assert.equal(r.ok && r.avgSaleValue, 1250.5);
});

// The security-relevant assertion, same as the rename above: scoped to the
// caller's tenant id, and touching only the two assumption columns.
test("assumptions update is scoped to the given tenant and writes only the two columns", () => {
  const args = buildRevenueAssumptionsUpdate("tenant_abc", 0.4, 900);
  assert.deepEqual(args.where, { id: "tenant_abc" });
  assert.deepEqual(args.data, { convRate: 0.4, avgSaleValue: 900 });
  assert.deepEqual(Object.keys(args.data).sort(), ["avgSaleValue", "convRate"]);
});

test("a tenant id in the assumptions payload cannot redirect the write", () => {
  const parsed = parseRevenueAssumptions({
    convRate: "0.4",
    avgSaleValue: "900",
    id: "other_tenant",
  } as never);
  assert.equal(parsed.ok, true);
  const args = buildRevenueAssumptionsUpdate(
    "session_tenant",
    parsed.ok ? parsed.convRate : 0,
    parsed.ok ? parsed.avgSaleValue : 0,
  );
  assert.equal(args.where.id, "session_tenant");
  assert.ok(!("id" in args.data));
});
