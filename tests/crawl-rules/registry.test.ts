// tests/crawl-rules/registry.test.ts
//
// The registry's contract: ids unique, dotted and family-prefixed (they are
// public API — the Issues tab, CSV and the public library key on them); every
// rule has EN copy and no copy is orphaned; every rule has at least one fixture
// case that fires and one that does not; the package imports nothing outside
// itself.
/// <reference types="vite/client" />

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { AXE_RULES, RULE_COPY, RULE_FAMILIES, RULES } from "@/lib/crawl-rules";
import type { RuleCase } from "./harness";

const cases = Object.values(import.meta.glob<{ default: RuleCase[] }>("./cases/*.ts", { eager: true })).flatMap(
  (m) => m.default,
);

describe("rule registry", () => {
  it("ids are unique, dotted, lower snake case and prefixed by their family", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(RULE_FAMILIES).toContain(r.family);
      expect(r.id).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/);
      expect(r.id.startsWith(`${r.family}.`), r.id).toBe(true);
    }
  });

  it("every rule has EN copy, and no copy is orphaned", () => {
    for (const r of RULES) {
      const c = RULE_COPY[r.id];
      expect(c, r.id).toBeDefined();
      expect(c!.name.trim(), r.id).not.toBe("");
      expect(c!.description.trim(), r.id).not.toBe("");
      expect(c!.howToFix.trim(), r.id).not.toBe("");
      // Brand casing (CLAUDE.md, Copy): built so this file does not trip its own scan.
      expect(JSON.stringify(c), r.id).not.toMatch(new RegExp(["Echo", "Rank"].join("[ -]?")));
    }
    const ids = new Set(RULES.map((r) => r.id));
    expect(Object.keys(RULE_COPY).filter((k) => !ids.has(k))).toEqual([]);
  });

  it("every rule has a fixture case that fires and one that does not", () => {
    const missing: string[] = [];
    for (const r of RULES) {
      const mine = cases.filter((c) => c.rule === r.id);
      if (!mine.some((c) => c.fires)) missing.push(`${r.id} (positive)`);
      if (!mine.some((c) => !c.fires)) missing.push(`${r.id} (negative)`);
    }
    expect(missing).toEqual([]);
    const ids = new Set(RULES.map((r) => r.id));
    expect(cases.filter((c) => !ids.has(c.rule)).map((c) => c.rule)).toEqual([]);
  });

  it("site rules carry no `applies`, and `requires` names known capabilities", () => {
    for (const r of RULES) {
      if (r.scope === "site") expect("applies" in r, r.id).toBe(false);
      for (const cap of r.requires ?? []) expect(["render", "psi", "spell"]).toContain(cap);
    }
  });

  // Kind pins: a decision recorded in SITE-CRAWLER-PHASE3.md, not a default.
  it("directives: a directive merely present is a warning; conflicts and placement are issues", () => {
    for (const r of RULES.filter((x) => x.family === "directives")) {
      const present = !/(conflict|in_sitemap|outside_head)/.test(r.id);
      expect(r.kind, r.id).toBe(present ? "warning" : "issue");
    }
  });
});

describe("Phase 3b families", () => {
  it("accessibility: one rule per generated axe rule, kind from axe's impact", () => {
    const a11y = RULES.filter((r) => r.family === "accessibility");
    expect(a11y.length).toBe(AXE_RULES.length);
    const want = { critical: "issue", serious: "issue", moderate: "warning", minor: "opportunity" } as const;
    for (const m of AXE_RULES) {
      const r = a11y.find((x) => x.id === `accessibility.${m.axeId.replace(/-/g, "_")}`);
      expect(r, m.axeId).toBeDefined();
      expect(r!.kind, m.axeId).toBe(want[m.impact]);
      expect(r!.requires).toEqual(["render"]);
      expect(RULE_COPY[r!.id]!.howToFix).toContain(m.helpUrl);
    }
  });

  it("accessibility and mobile rules all require render; javascript except the two raw-HTML rules", () => {
    for (const r of RULES.filter((x) => x.family === "mobile")) expect(r.requires, r.id).toEqual(["render"]);
    const raw = RULES.filter((x) => x.family === "javascript" && !x.requires).map((r) => r.id);
    expect(raw.sort()).toEqual(["javascript.ajax_crawling_scheme", "javascript.enable_rendering"]);
  });

  it("mobile does not duplicate validation's viewport rule", () => {
    expect(RULES.filter((r) => /viewport_missing|missing_viewport/.test(r.id)).map((r) => r.id)).toEqual(["validation.missing_viewport"]);
  });
});

describe("package boundary", () => {
  const root = join(process.cwd(), "packages/crawl-rules/src");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts")) files.push(p);
    }
  };
  walk(root);

  it.each(files.map((f) => [relative(root, f), f]))("%s imports only from inside the package", (_n, f) => {
    const src = readFileSync(f, "utf8");
    const specs = [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    // Relative imports, plus the two data packages hreflang validation uses
    // (declared in packages/crawl-rules/package.json). Nothing else.
    for (const s of specs) expect(s, s).toMatch(/^(\.\.?\/|iso-639-1$|i18n-iso-countries\/index$)/);
    expect(src).not.toMatch(/\brequire\(|process\.|\bfetch\(|Buffer\b/);
  });
});
