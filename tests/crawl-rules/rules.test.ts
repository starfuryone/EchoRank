// tests/crawl-rules/rules.test.ts — runs every family's fixture cases.
/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { run, type RuleCase } from "./harness";

const modules = import.meta.glob<{ default: RuleCase[] }>("./cases/*.ts", { eager: true });

it("every case module exports a RuleCase[]", () => {
  for (const mod of Object.values(modules)) expect(Array.isArray(mod.default)).toBe(true);
});

for (const [path, mod] of Object.entries(modules)) {
  describe(path.replace(/^\.\/cases\/|\.ts$/g, ""), () => {
    it.each(mod.default.map((c) => [`${c.rule} — ${c.name}`, c] as const))("%s", (_label, c) => {
      const found = run(c);
      if (c.fires) {
        expect(found, "expected the rule to fire").not.toBeNull();
        if (c.evidence) expect(found).toMatchObject(c.evidence);
      } else {
        expect(found, "expected the rule NOT to fire").toBeNull();
      }
    });
  });
}
