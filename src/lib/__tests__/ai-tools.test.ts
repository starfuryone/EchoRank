// AI hub config — the same parity discipline as reputation-tools.test.ts.
//
// Four things this file is really guarding:
//
// 1. EVERY CARD REACHES A REAL ROUTE. The premise of the consolidation is that
//    nothing moved, so a card pointing at a page that does not exist would
//    break navigation that used to work from the sidebar.
// 2. NO CARD CAN 404. AI Search Intelligence sits behind a build-progress
//    switch whose route calls notFound() when it is off. The card must be
//    HIDDEN in that state, not locked — a locked card promises something that
//    does not answer.
// 3. THE SIDEBAR ROW POINTS AT THE HUB. One row for AI, targeting /ai, keeping
//    its icon, and NOT pointing at /visibility any more.
// 4. THE ROW STILL LIGHTS FOR /visibility/*. The retarget is exactly the kind
//    of change that leaves a whole route subtree with no highlighted row, and
//    nobody notices until they are three levels deep.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AI_HUB,
  AI_TOOL_GROUPS,
  ALL_AI_TOOLS,
  canSeeAiHub,
  visibleAiGroups,
  type AiRolloutState,
} from "@/lib/ai-tools";
import { AI_HUB_COPY, dashNav } from "@/lib/i18n/dashboard";
import { navMatchLength, activeNavHref } from "@/components/layout/sidebar";
import type { PlanType } from "@/generated/prisma";

const LOCALES = ["en", "fr", "de-CH"] as const;
const PLANS: PlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
const APP_DIR = join(process.cwd(), "src", "app", "(dashboard)");

const ALL_ON: AiRolloutState = { ai_search: true };
const ALL_OFF: AiRolloutState = { ai_search: false };

/** The exact card set, approved deliberately. Keywords Explorer is NOT here:
 *  it is keyword research, already a card in the SEO Tools hub, and listing it
 *  twice would blur what each hub is for. */
const EXPECTED_HREFS: Record<string, string> = {
  ai_visibility: "/visibility",
  ai_search: "/visibility/ai-search",
  custom_prompts: "/visibility/tools/custom-prompts",
  ai_attribution: "/visibility/tools/ai-attribution",
  citation_finder: "/visibility/tools/citation-finder",
};

// ─── Cards and routes ───────────────────────────────────────────────────────

test("the card set is exactly the approved one", () => {
  assert.deepEqual(
    Object.fromEntries(ALL_AI_TOOLS.map((t) => [t.id, t.href])),
    EXPECTED_HREFS,
  );
});

test("every card href resolves to a real route file", () => {
  // Nothing moved, so every destination must still exist on disk.
  for (const tool of ALL_AI_TOOLS) {
    const page = join(APP_DIR, tool.href, "page.tsx");
    assert.ok(existsSync(page), `${tool.id}: no route at ${tool.href}`);
  }
});

test("the hub itself is a real route at /ai", () => {
  assert.equal(AI_HUB, "/ai");
  assert.ok(existsSync(join(APP_DIR, "ai", "page.tsx")), "no route at /ai");
});

test("NO ROUTES MOVED — /visibility is still the dashboard, not a redirect", () => {
  // The whole reason the hub took a new path. If someone later "tidies" this by
  // moving the dashboard under the hub, every marketing link, onboarding email
  // (src/lib/onboarding-email.ts) and notification href breaks silently.
  const page = readFileSync(join(APP_DIR, "visibility", "page.tsx"), "utf8");
  assert.ok(!page.includes("redirect("), "/visibility became a redirect");
  assert.ok(page.includes("VisibilityPageClient"), "/visibility stopped rendering the dashboard");
});

test("ids are unique and every card belongs to exactly one group", () => {
  const ids = ALL_AI_TOOLS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    AI_TOOL_GROUPS.map((g) => g.id),
    ["answers", "traffic"],
  );
  for (const group of AI_TOOL_GROUPS) assert.ok(group.tools.length >= 1, group.id);
});

// ─── Rollout gating ─────────────────────────────────────────────────────────

test("a rolled-out-but-off card is HIDDEN, never rendered", () => {
  // Its route calls notFound() in this state. A card would be a link to a 404.
  const shown = visibleAiGroups("GROWTH", ALL_OFF).flatMap((g) => g.tools).map((t) => t.id);
  assert.ok(!shown.includes("ai_search"), "AI Search card rendered while its rollout is off");
  assert.deepEqual(shown, [
    "ai_visibility",
    "custom_prompts",
    "citation_finder",
    "ai_attribution",
  ]);
});

test("the same card appears once its switch is on", () => {
  const shown = visibleAiGroups("GROWTH", ALL_ON).flatMap((g) => g.tools).map((t) => t.id);
  assert.deepEqual(shown, [
    "ai_visibility",
    "ai_search",
    "custom_prompts",
    "citation_finder",
    "ai_attribution",
  ]);
});

test("every card with a rollout names one the config knows", () => {
  for (const tool of ALL_AI_TOOLS) {
    if (!tool.rollout) continue;
    assert.ok(tool.rollout in ALL_ON, `${tool.id}: unknown rollout ${tool.rollout}`);
  }
});

test("a group that empties out is dropped, not rendered as a bare heading", () => {
  // Today no group empties, so this asserts the mechanism rather than a state:
  // every returned group carries at least one card in both rollout states.
  for (const rollouts of [ALL_ON, ALL_OFF]) {
    for (const group of visibleAiGroups("GROWTH", rollouts)) {
      assert.ok(group.tools.length > 0, group.id);
    }
  }
});

test("no tier is route-confined, but a signed-out visitor sees nothing", () => {
  for (const plan of PLANS) {
    assert.equal(visibleAiGroups(plan, ALL_ON).flatMap((g) => g.tools).length, 5, plan);
    assert.ok(canSeeAiHub(plan), plan);
  }
  assert.deepEqual(visibleAiGroups(null, ALL_ON), []);
  assert.deepEqual(visibleAiGroups(undefined, ALL_ON), []);
  assert.ok(!canSeeAiHub(null));
});

// ─── Copy ───────────────────────────────────────────────────────────────────

test("every locale covers the hub, both groups and every card", () => {
  for (const locale of LOCALES) {
    const copy = AI_HUB_COPY[locale];
    assert.ok(copy.hubTitle.length && copy.hubSubtitle.length, locale);
    for (const group of AI_TOOL_GROUPS) {
      assert.ok(copy.groups[group.id]?.length, `${locale} group ${group.id}`);
    }
    for (const tool of ALL_AI_TOOLS) {
      const item = copy.items[tool.id];
      assert.ok(item?.name?.length, `${locale} name ${tool.id}`);
      assert.ok(item?.description?.length, `${locale} description ${tool.id}`);
    }
  }
});

test("the sidebar row is labelled in every locale", () => {
  for (const locale of LOCALES) {
    assert.ok(dashNav[locale][AI_HUB]?.length, `${locale} label for ${AI_HUB}`);
    // /visibility keeps its own label: it is still a real page and the header
    // title resolves from this same table.
    assert.ok(dashNav[locale]["/visibility"]?.length, `${locale} label for /visibility`);
  }
});

test("copy never uses CamelCase branding", () => {
  assert.ok(!JSON.stringify(AI_HUB_COPY).includes("EchoRank"));
});

// ─── Sidebar wiring ─────────────────────────────────────────────────────────

test("the sidebar has ONE AI row, pointing at the hub, keeping its icon", () => {
  const sidebar = readFileSync(
    join(process.cwd(), "src", "components", "layout", "sidebar.tsx"),
    "utf8",
  );
  const navBlock = sidebar.slice(sidebar.indexOf("const navItems"), sidebar.indexOf("] as const;"));
  const hrefs = [...navBlock.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);

  assert.ok(hrefs.includes(AI_HUB), "no /ai row in the sidebar");
  assert.ok(!hrefs.includes("/visibility"), "/visibility still has its own sidebar row");
  assert.equal(hrefs.filter((h) => h === AI_HUB).length, 1, "more than one AI row");
  // The icon is unchanged — the row is the same row, retargeted.
  assert.match(navBlock, /href: "\/ai", icon: ScanEye/);
});

// ─── Active highlighting ────────────────────────────────────────────────────

const NAV = [
  { href: "/dashboard" },
  { href: "/reputation" },
  { href: "/ai", activePrefixes: ["/visibility"] },
  { href: "/visibility/tools" },
  { href: "/visibility/tools/ai-content-helper" },
  { href: "/help" },
];

test("the AI row lights for the hub and for every /visibility/* surface", () => {
  for (const path of [
    "/ai",
    "/visibility",
    "/visibility/ai-search",
    "/visibility/ai-search/setup",
    "/visibility/keywords",
  ]) {
    assert.equal(activeNavHref(NAV, path), "/ai", path);
  }
});

test("but SEO Tools still wins its own subtree — longest claim, not first", () => {
  // The failure this guards: /ai claims /visibility as a prefix, so a naive
  // "first match wins" would steal every tool route from the SEO Tools row.
  assert.equal(activeNavHref(NAV, "/visibility/tools"), "/visibility/tools");
  assert.equal(activeNavHref(NAV, "/visibility/tools/ai-lens"), "/visibility/tools");
  assert.equal(
    activeNavHref(NAV, "/visibility/tools/ai-content-helper"),
    "/visibility/tools/ai-content-helper",
  );
  assert.equal(
    activeNavHref(NAV, "/visibility/tools/ai-content-helper/social"),
    "/visibility/tools/ai-content-helper",
  );
});

test("a prefix claim matches the segment, never a bare string prefix", () => {
  // "/visibility-archive" must not match the "/visibility" claim.
  assert.equal(navMatchLength({ href: "/ai", activePrefixes: ["/visibility"] }, "/visibility-archive"), -1);
  assert.equal(navMatchLength({ href: "/ai" }, "/airport"), -1);
});

test("an unclaimed route highlights nothing rather than guessing", () => {
  assert.equal(activeNavHref(NAV, "/billing"), "");
  assert.equal(navMatchLength({ href: "/ai" }, "/billing"), -1);
});
