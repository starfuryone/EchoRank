// Competitors i18n: every locale carries the full key set (missing keys would
// render as `undefined` in the panel), function-valued entries stay functions,
// and metadata titles stay bare — the root layout appends "| Echorank360".
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPETITORS_HELP_COPY,
  COMPETITORS_PAGE_COPY,
  COMPETITORS_PANEL_COPY,
} from "../i18n/dashboard";

const LOCALES = ["en", "fr", "de-CH"] as const;

test("COMPETITORS_PAGE_COPY key parity across locales", () => {
  const enKeys = Object.keys(COMPETITORS_PAGE_COPY.en).sort();
  for (const loc of LOCALES) {
    assert.deepEqual(Object.keys(COMPETITORS_PAGE_COPY[loc]).sort(), enKeys, loc);
  }
});

test("COMPETITORS_PANEL_COPY key parity + value kinds across locales", () => {
  const en = COMPETITORS_PANEL_COPY.en as Record<string, unknown>;
  const enKeys = Object.keys(en).sort();
  for (const loc of LOCALES) {
    const copy = COMPETITORS_PANEL_COPY[loc] as Record<string, unknown>;
    assert.deepEqual(Object.keys(copy).sort(), enKeys, loc);
    for (const k of enKeys) {
      assert.equal(typeof copy[k], typeof en[k], `${loc}.${k}`);
    }
  }
});

test("panel copy functions produce non-empty localized strings", () => {
  for (const loc of LOCALES) {
    const t = COMPETITORS_PANEL_COPY[loc];
    assert.ok(t.refreshSummary(3, 0).length > 0, loc);
    assert.ok(t.refreshSummary(1, 2).length > 0, loc);
    assert.ok(t.linkingNotice("Super C").includes("Super C"), loc);
    assert.ok(t.placesErrorTag("http_404").includes("http_404"), loc);
    assert.ok(t.limitReached(20).includes("20"), loc);
  }
});

test("COMPETITORS_HELP_COPY structure parity across locales", () => {
  const en = COMPETITORS_HELP_COPY.en;
  const enKeys = Object.keys(en).sort();
  for (const loc of LOCALES) {
    const t = COMPETITORS_HELP_COPY[loc];
    assert.deepEqual(Object.keys(t).sort(), enKeys, loc);
    assert.deepEqual(Object.keys(t.labels).sort(), Object.keys(en.labels).sort(), loc);
    assert.equal(t.metrics.length, en.metrics.length, `${loc} metrics length`);
    for (const [i, m] of t.metrics.entries()) {
      for (const field of ["title", "meaning", "why", "action"] as const) {
        assert.ok(m[field].length > 0, `${loc} metrics[${i}].${field}`);
      }
    }
    assert.equal(t.s4Bullets.length, en.s4Bullets.length, `${loc} bullets length`);
    for (const b of t.s4Bullets) assert.ok(b.length > 0, loc);
  }
});

test("help copy uses only sanctioned branding (never CamelCase)", () => {
  for (const loc of LOCALES) {
    const flat = JSON.stringify(COMPETITORS_HELP_COPY[loc]);
    assert.ok(!flat.includes("EchoRank"), `${loc}: CamelCase brand found`);
  }
});

test("metadata titles are bare (layout template appends the brand)", () => {
  for (const loc of LOCALES) {
    const t = COMPETITORS_PAGE_COPY[loc];
    assert.ok(t.metaTitle.length > 0, loc);
    assert.ok(!t.metaTitle.includes("Echorank360"), loc);
    assert.ok(t.metaDescription.length > 0, loc);
  }
});
