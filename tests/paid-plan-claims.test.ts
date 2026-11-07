// tests/paid-plan-claims.test.ts
//
// "INCLUDED IN EVERY PAID PLAN" STOPPED BEING TRUE ON 2026-11-07.
//
// The $29 AI Visibility plan is a paid plan with no SEO tools, no crawler and
// no reputation tools (src/lib/plan-access.ts). Every claim that something is
// "included in every paid plan" was rewritten to "every plan from Starter" —
// this keeps a new one from creeping back into copy.
//
// Comments are skipped: they describe code, not the product. The one true
// sentence left in that shape is the trial ("Every paid plan starts with a
// 7-day free trial"), which the AI plan has too, so it is allowed.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const CLAIM =
  /every paid plan|all paid plans|with a paid plan|chaque forfait payant|tous les forfaits payants|avec un forfait payant|jedem kostenpflichtigen|allen kostenpflichtigen|kostenpflichtigen Abo enthalten/i;

/** The trial is on every plan, AI Visibility included. */
const ALLOWED = /every paid plan starts with a \d+-day free trial/i;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.bak[.-]/.test(name)) out.push(p);
  }
  return out;
}

/** Lines that are code or copy, not comments. */
function copyLines(src: string): Array<{ n: number; text: string }> {
  return src
    .split("\n")
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));
}

describe("no copy claims something is in every paid plan", () => {
  it("finds none under src/", () => {
    const hits: string[] = [];
    for (const f of files(join(ROOT, "src"))) {
      for (const { n, text } of copyLines(readFileSync(f, "utf8"))) {
        if (CLAIM.test(text) && !ALLOWED.test(text)) hits.push(`${relative(ROOT, f)}:${n}: ${text.trim().slice(0, 140)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("checks public/llms.txt too", () => {
    const txt = readFileSync(join(ROOT, "public/llms.txt"), "utf8");
    const bad = txt.split("\n").filter((l) => CLAIM.test(l) && !ALLOWED.test(l));
    expect(bad).toEqual([]);
  });

  it("would catch the sentences it replaced", () => {
    for (const s of [
      "Included in every paid plan",
      "Inclus dans chaque forfait payant",
      "In einem kostenpflichtigen Abo enthalten.",
      "Included with a paid plan.",
    ]) {
      expect(CLAIM.test(s), s).toBe(true);
    }
    expect(ALLOWED.test("Every paid plan starts with a 7-day free trial.")).toBe(true);
  });
});
