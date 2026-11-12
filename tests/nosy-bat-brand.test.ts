// @vitest-environment jsdom
// Nosy Bat™ branding: the wordmarks and emblems are well-formed SVGs (sizes
// and viewBoxes in tests/nosy-bat-logo.test.tsx), the UA keeps the
// Echorank360Bot token robots.txt rules key on, and the name is spelled out
// only in brand.ts and the i18n catalogs — every other surface reads it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { CRAWLER_USER_AGENT } from "@/lib/site-crawler/constants";

const ROOT = join(__dirname, "..");
const ASSETS = [CRAWLER_BRAND.mark, CRAWLER_BRAND.markOnDark, CRAWLER_BRAND.logo, CRAWLER_BRAND.logoOnDark, CRAWLER_BRAND.logoOnDarkAccent];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|css|md|json)$/.test(name)) out.push(p);
  }
  return out;
}

describe("Nosy Bat brand", () => {
  it.each(ASSETS)("%s is an SVG with a viewBox", (asset) => {
    const xml = readFileSync(join(ROOT, "public", asset), "utf8");
    const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.nodeName).toBe("svg");
    expect(doc.documentElement.getAttribute("viewBox")).toMatch(/^[\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
  });

  it("keeps the Echorank360Bot token and the crawler sends that UA", () => {
    expect(CRAWLER_BRAND.ua.startsWith("Echorank360Bot/")).toBe(true);
    expect(CRAWLER_USER_AGENT).toBe(CRAWLER_BRAND.ua);
  });

  it("spells the name only in brand.ts and the i18n catalogs", () => {
    const allowed = new Set([
      "src/lib/site-crawler/brand.ts",
      "src/lib/i18n/dashboard.ts",
      // The Subscription Agreement's §1.1 lines are pinned legal text (since
      // 2026-11-12 they name the plan): a brand rename must not silently change
      // what buyers consented to. tests/nosy-bat-plan.test.tsx holds that line
      // to CRAWLER_BRAND.name, so a rename still fails loudly there.
      "src/app/[locale]/legal/_content/subscription-agreement.tsx",
    ]);
    const offenders = walk(join(ROOT, "src"))
      .map((p) => p.slice(ROOT.length + 1))
      .filter((p) => !allowed.has(p) && readFileSync(join(ROOT, p), "utf8").includes("Nosy Bat"));
    expect(offenders).toEqual([]);
  });
});
