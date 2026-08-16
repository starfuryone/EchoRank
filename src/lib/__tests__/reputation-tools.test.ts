// Reputation Tools hub config — the same parity discipline as seo-tools.test.ts.
//
// Two things this file is really guarding:
//
// 1. EVERY CARD REACHES A REAL ROUTE. The whole premise of the consolidation is
//    that nothing moved, so a card pointing at a page that does not exist would
//    break navigation that used to work from the sidebar.
// 2. LOCKS MIRROR THE DESTINATION. A card's `feature` must be the gate its
//    destination actually enforces. Getting that wrong in one direction sends
//    people to a wall; in the other it hides something they paid for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALL_REPUTATION_TOOLS,
  REPUTATION_TOOL_GROUPS,
  REPUTATION_HUB,
  canSeeReputationHub,
  toolLockState,
  visibleReputationGroups,
} from "@/lib/reputation-tools";
import { REPUTATION_COPY } from "@/lib/i18n/dashboard";
import { dashNav } from "@/lib/i18n/dashboard";
import { hasFeature } from "@/lib/feature-flags";
import type { PlanType } from "@/generated/prisma";

const LOCALES = ["en", "fr", "de-CH"] as const;
const APP_DIR = join(process.cwd(), "src", "app", "(dashboard)");

/** The eleven surfaces this hub replaced in the sidebar. */
const CONSOLIDATED_PATHS = [
  "/customers",
  "/feedback",
  "/campaigns",
  "/recovery",
  "/analytics",
  "/intelligence",
  "/monitoring",
  "/imports",
  "/extension",
  "/templates",
  "/review-links",
];

test("every consolidated sidebar path has a card", () => {
  assert.deepEqual(
    ALL_REPUTATION_TOOLS.map((t) => t.href).sort(),
    [...CONSOLIDATED_PATHS].sort(),
    "a surface lost its sidebar row without gaining a card",
  );
});

test("every card href resolves to a real route file", () => {
  // The parity check that matters: nothing moved, so every destination must
  // still exist on disk.
  for (const tool of ALL_REPUTATION_TOOLS) {
    const page = join(APP_DIR, tool.href, "page.tsx");
    assert.ok(existsSync(page), `${tool.id}: no route at ${tool.href}`);
  }
});

test("the hub page itself exists", () => {
  assert.ok(existsSync(join(APP_DIR, REPUTATION_HUB, "page.tsx")));
});

test("tool ids and hrefs are unique", () => {
  const ids = ALL_REPUTATION_TOOLS.map((t) => t.id);
  const hrefs = ALL_REPUTATION_TOOLS.map((t) => t.href);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("group ids are unique and every group has tools", () => {
  const ids = REPUTATION_TOOL_GROUPS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of REPUTATION_TOOL_GROUPS) {
    assert.ok(g.tools.length > 0, `${g.id} is empty`);
  }
});

test("every locale catalog covers every group and tool", () => {
  for (const locale of LOCALES) {
    const copy = REPUTATION_COPY[locale];
    assert.ok(copy.hubTitle.length, `${locale} hubTitle`);
    assert.ok(copy.hubSubtitle.length, `${locale} hubSubtitle`);
    assert.ok(copy.lockedBadge.length && copy.upgradeCta.length, `${locale} lock copy`);
    assert.ok(copy.lockedHint("Agency").includes("Agency"), `${locale} lockedHint interpolation`);
    for (const g of REPUTATION_TOOL_GROUPS) {
      assert.ok(copy.groups[g.id]?.length, `${locale} group ${g.id}`);
    }
    for (const tool of ALL_REPUTATION_TOOLS) {
      const item = copy.items[tool.id];
      assert.ok(item?.name?.length, `${locale} name ${tool.id}`);
      assert.ok(item?.description?.length, `${locale} description ${tool.id}`);
    }
  }
});

test("fr and de-CH are translated, not English passed through", () => {
  for (const locale of ["fr", "de-CH"] as const) {
    const copy = REPUTATION_COPY[locale];
    assert.notEqual(copy.hubSubtitle, REPUTATION_COPY.en.hubSubtitle, `${locale} hubSubtitle`);
    for (const tool of ALL_REPUTATION_TOOLS) {
      assert.notEqual(
        copy.items[tool.id].description,
        REPUTATION_COPY.en.items[tool.id].description,
        `${locale} ${tool.id} description is still English`,
      );
    }
  }
});

test("de-CH uses ss, never the eszett", () => {
  assert.ok(!JSON.stringify(REPUTATION_COPY["de-CH"]).includes("ß"));
});

test("the hub has a nav label in all three catalogs", () => {
  for (const locale of LOCALES) {
    assert.ok(dashNav[locale][REPUTATION_HUB]?.length, `${locale} nav label`);
  }
});

// ── Lock state ──────────────────────────────────────────────────────────────

test("a card with no feature is never locked", () => {
  const plans: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
  for (const tool of ALL_REPUTATION_TOOLS.filter((t) => !t.feature)) {
    for (const plan of plans) {
      assert.equal(toolLockState(tool, plan).locked, false, `${tool.id} on ${plan}`);
    }
  }
});

test("monitoring is locked below Agency and open at Agency", () => {
  const monitoring = ALL_REPUTATION_TOOLS.find((t) => t.id === "monitoring")!;
  assert.equal(monitoring.feature, "reputation_monitoring");
  assert.equal(toolLockState(monitoring, "STARTER").locked, true);
  assert.equal(toolLockState(monitoring, "GROWTH").locked, true);
  assert.equal(toolLockState(monitoring, "AGENCY").locked, false);
  assert.equal(toolLockState(monitoring, "ENTERPRISE").locked, false);
  assert.equal(toolLockState(monitoring, "STARTER").requiredPlan, "AGENCY");
});

test("intelligence is locked below Growth", () => {
  const intelligence = ALL_REPUTATION_TOOLS.find((t) => t.id === "intelligence")!;
  assert.equal(intelligence.feature, "ai_analysis");
  assert.equal(toolLockState(intelligence, "STARTER").locked, true);
  assert.equal(toolLockState(intelligence, "GROWTH").locked, false);
  assert.equal(toolLockState(intelligence, "STARTER").requiredPlan, "GROWTH");
});

test("every declared feature is one the plan matrix actually knows", () => {
  // A typo'd feature name would silently lock a card forever, since no plan
  // would ever carry it.
  for (const tool of ALL_REPUTATION_TOOLS) {
    if (!tool.feature) continue;
    const anyPlanHasIt = (["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as PlanType[]).some((p) =>
      hasFeature(p, tool.feature!),
    );
    assert.ok(anyPlanHasIt, `${tool.id}: no plan carries ${tool.feature}`);
  }
});

test("a locked card still names the plan that unlocks it", () => {
  const monitoring = ALL_REPUTATION_TOOLS.find((t) => t.id === "monitoring")!;
  const state = toolLockState(monitoring, "STARTER");
  assert.equal(state.locked, true);
  assert.ok(state.requiredPlan, "locked cards must say what unlocks them");
});

test("no plan means locked, not open", () => {
  const monitoring = ALL_REPUTATION_TOOLS.find((t) => t.id === "monitoring")!;
  assert.equal(toolLockState(monitoring, null).locked, true);
  assert.equal(toolLockState(monitoring, undefined).locked, true);
});

// ── Route allowlist ─────────────────────────────────────────────────────────

test("every plan sees every group and every card", () => {
  for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as PlanType[]) {
    const groups = visibleReputationGroups(plan);
    assert.equal(groups.length, REPUTATION_TOOL_GROUPS.length, `${plan} group count`);
    const shown = groups.flatMap((g) => g.tools).length;
    assert.equal(shown, ALL_REPUTATION_TOOLS.length, `${plan} card count`);
    assert.equal(canSeeReputationHub(plan), true, `${plan} hub link`);
  }
});

test("a signed-out visitor sees nothing", () => {
  assert.deepEqual(visibleReputationGroups(null), []);
  assert.equal(canSeeReputationHub(null), false);
});

// ── Sidebar ─────────────────────────────────────────────────────────────────

test("the sidebar links to the hub and to none of the eleven", () => {
  const sidebar = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar.tsx"),
    "utf8",
  );
  const navBlock = sidebar.slice(sidebar.indexOf("const navItems"), sidebar.indexOf("] as const;"));

  assert.ok(navBlock.includes(`href: "${REPUTATION_HUB}"`), "hub link missing from sidebar");
  for (const path of CONSOLIDATED_PATHS) {
    assert.ok(
      !navBlock.includes(`href: "${path}"`),
      `${path} is still a sidebar row — it belongs in the hub`,
    );
  }
});

test("the sidebar order is the agreed one", () => {
  const sidebar = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar.tsx"),
    "utf8",
  );
  const navBlock = sidebar.slice(sidebar.indexOf("const navItems"), sidebar.indexOf("] as const;"));
  const hrefs = [...navBlock.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, [
    "/dashboard",
    "/reputation",
    // Was "/visibility". The AI surfaces got the same treatment the reputation
    // ones did: one row, one hub at /ai. The row kept its position and its
    // icon; only its target moved, and /visibility is now a card on that hub.
    // The row still lights up for /visibility/* — see activePrefixes in
    // sidebar.tsx and the render assertions in tests/nav-links.test.ts.
    "/ai",
    // The Pro AI Assistant, directly under the AI row: it answers questions
    // ABOUT the data that hub renders, so it belongs beside it rather than in
    // the administration block. It does NOT reopen the "one row per feature"
    // pattern this suite guards against — it is a single link to one surface,
    // and unlike the eleven consolidated rows it is gated: the row only
    // renders when the layout passes assistantVisible (paid plan plus both
    // kill switches). See tests/assistant-pro-ui.test.tsx.
    "/assistant",
    "/visibility/tools",
    "/visibility/tools/ai-content-helper",
    "/team",
    "/settings",
    "/settings/account",
    "/billing",
    // Notifications sits with the administration block, above Help.
    "/notifications",
    // Help is the last row, added deliberately after the nine-row
    // consolidation. It is not a reputation surface and does not reopen the
    // "one row per feature" pattern this suite guards against: it is a single
    // link to the knowledge-base hub, ungated on every tier.
    "/help",
  ]);
});

test("Team stays in the sidebar — administration, not a reputation tool", () => {
  const sidebar = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar.tsx"),
    "utf8",
  );
  assert.ok(sidebar.includes('href: "/team"'));
  assert.ok(!ALL_REPUTATION_TOOLS.some((t) => t.href === "/team"));
});

test("every sidebar row still has a label in all three catalogs", () => {
  const sidebar = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar.tsx"),
    "utf8",
  );
  const navBlock = sidebar.slice(sidebar.indexOf("const navItems"), sidebar.indexOf("] as const;"));
  const hrefs = [...navBlock.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  for (const locale of LOCALES) {
    for (const href of hrefs) {
      assert.ok(dashNav[locale][href]?.length, `${locale} has no label for ${href}`);
    }
  }
});
