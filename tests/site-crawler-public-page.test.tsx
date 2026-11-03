// /[locale]/site-crawler — the crawler's public page.
//
// What this protects: the page never lists a capability that is not shipped
// (gates read the registry and the flags at render), never prints a rule count
// of its own (the number is derived), and its FAQPage markup describes exactly
// the questions it renders.
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The registry, stubbable per test. Unset = the real one.
const stub = vi.hoisted(() => ({ rules: null as null | { family: string }[] }));
vi.mock("@/lib/crawl-rules", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crawl-rules")>();
  return {
    ...real,
    get RULES() {
      return stub.rules ?? real.RULES;
    },
  };
});

import Page, { generateMetadata } from "@/app/[locale]/site-crawler/page";
import { RULES } from "@/lib/crawl-rules";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { RULE_COUNT, ruleCountLabel } from "@/lib/site-crawler/rule-count";
import {
  CRAWL_CAPABILITIES,
  CRAWL_FEATURE_ROWS,
  capabilityBody,
  gateOpen,
  visibleCapabilities,
  visibleFaq,
} from "@/lib/site-crawler/marketing-copy";

const ROOT = join(__dirname, "..");
const render = async (locale: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) }));
const anchors = (html: string) => [...html.matchAll(/<h3 id="([^"]+)"/g)].map((m) => m[1]);
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]!);
    return (data["@graph"] ?? [data]) as Record<string, unknown>[];
  });

afterEach(() => {
  stub.rules = null;
});

describe("/site-crawler", () => {
  it("renders in en and fr", async () => {
    const en = await render("en");
    expect(en).toContain("The site crawler that shows its evidence.");
    expect(en).toContain(`src="${CRAWLER_BRAND.logoOnDark}"`);
    const fr = await render("fr");
    expect(fr).toContain("Le robot d&#x27;exploration qui montre ses preuves.");
    expect(fr).toContain("Ce que");
  });

  it("is registered at priority 0.7", () => {
    expect(LOCALIZED_ROUTES.find((r) => r.path === "/site-crawler")?.priority).toBe(0.7);
  });

  it("titles the page with the brand and the OG card", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toEqual({ absolute: `${CRAWLER_BRAND.name} — site crawler by Echorank` });
    expect(JSON.stringify(meta.openGraph)).toContain("/nosy-bat/og.png");
  });

  it("with an empty registry renders only always-on and flag-on items", async () => {
    stub.rules = [];
    const ids = anchors(await render("en"));
    const expected = CRAWL_CAPABILITIES.filter((c) => "always" in c.gate || ("flag" in c.gate && FLAGS[c.gate.flag])).map(
      (c) => c.id,
    );
    expect(ids).toEqual(expected);
    expect(ids).toContain("csv-export");
  });

  it("with a registry of response_codes only renders its capabilities and nothing else gated", async () => {
    stub.rules = [{ family: "response_codes" }];
    const ids = anchors(await render("en"));
    const families = CRAWL_CAPABILITIES.filter((c) => "family" in c.gate).map((c) => c.id);
    const rendered = ids.filter((id) => families.includes(id));
    expect(rendered).toEqual(
      CRAWL_CAPABILITIES.filter((c) => "family" in c.gate && c.gate.family === "response_codes").map((c) => c.id),
    );
    expect(rendered).toContain("response-codes");
  });

  it("hides the feature-table rows whose gate is closed", async () => {
    stub.rules = [];
    const html = await render("en");
    expect(html).toContain("Free technical support");
    expect(html).toContain("Save &amp; open crawls");
    expect(html).not.toContain("Audit hreflang attributes");
    // A flag still off (4c).
    expect(html).not.toContain("Crawl comparison");
  });

  it("4a: the kept-crawls cap is read from plan-config", async () => {
    const html = await render("en");
    for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(html).toContain(`Last ${PLAN_CONFIGS[p].crawlsKept} crawls kept`);
    }
  });

  it("reads table caps from plan-config, never from a literal", async () => {
    const html = await render("en");
    for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(html).toContain(`${PLAN_CONFIGS[p].crawlUrlCap.toLocaleString("en-US")} URLs per crawl`);
    }
  });

  it("emits FAQPage markup with exactly the questions it renders", async () => {
    for (const locale of ["en", "fr"]) {
      const html = await render(locale);
      const faq = jsonLd(html).find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
      const rendered = [...html.matchAll(/<h3 class="[^"]*faqQ[^"]*">([^<]+)<\/h3>/g)].map((m) => m[1]);
      expect(faq.mainEntity.length).toBe(rendered.length);
      expect(rendered.length).toBeGreaterThan(0);
    }
  });

  it("marks the crawler as part of the Echorank application, with offers", async () => {
    const nodes = jsonLd(await render("en"));
    const crawler = nodes.find((n) => n["@type"] === "SoftwareApplication" && String(n["@id"]).endsWith("/site-crawler#software"));
    const app = nodes.find((n) => n["@type"] === "SoftwareApplication" && n !== crawler);
    expect(crawler?.isPartOf).toEqual({ "@id": app?.["@id"] });
    expect((crawler?.offers as unknown[]).length).toBeGreaterThan(0);
  });

  it("never prints a rule count of its own", async () => {
    // Same pattern as the homepage test: every "N rules / N checks" on the page
    // is the derived label.
    expect(RULE_COUNT).toBe(RULES.length);
    for (const locale of ["en", "fr"]) {
      const html = await render(locale);
      const counts = [...html.matchAll(/\b(\d{2,3}\+?) (checks|rules|vérifications|règles)\b/g)].map((m) => m[1]);
      expect(counts.length).toBeGreaterThan(0);
      for (const n of counts) expect(n).toBe(ruleCountLabel());
    }
    for (const file of ["src/app/[locale]/site-crawler/page.tsx", "src/lib/site-crawler/marketing-copy.ts"]) {
      expect(readFileSync(join(ROOT, file), "utf8")).not.toMatch(/\b\d{2,3}\+? (checks|rules|vérifications|règles)\b/);
    }
  });

  it("rounds the count down, never up", () => {
    expect(ruleCountLabel(183)).toBe("180+");
    expect(ruleCountLabel(130)).toBe("130+");
    expect(ruleCountLabel(99)).toBe("99");
  });

  it("gives every capability a unique id, used as its anchor", async () => {
    const ids = CRAWL_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const html = await render("en");
    const shown = visibleCapabilities({ families: new Set(RULES.map((r) => r.family)) }).map((c) => c.id);
    expect(anchors(html)).toEqual(shown);
    expect(new Set(CRAWL_FEATURE_ROWS.map((r) => r.id)).size).toBe(CRAWL_FEATURE_ROWS.length);
  });

  it("evaluates each gate kind", () => {
    const ctx = { families: new Set(["links"]), flags: { ...FLAGS, "crawl.links": true } };
    expect(gateOpen({ always: true }, ctx)).toBe(true);
    expect(gateOpen({ family: "links" }, ctx)).toBe(true);
    expect(gateOpen({ family: "amp" }, ctx)).toBe(false);
    expect(gateOpen({ flag: "crawl.links" }, ctx)).toBe(true);
    expect(gateOpen({ flag: "crawl.formsAuth" }, ctx)).toBe(false);
  });

  it("names Lighthouse in the mobile card only once crawl.psi ships", () => {
    const mobile = CRAWL_CAPABILITIES.find((c) => c.id === "mobile-usability")!;
    for (const base of ["en", "fr"] as const) {
      expect(capabilityBody(mobile, base, { ...FLAGS, "crawl.psi": false })).not.toMatch(/Lighthouse/);
      expect(capabilityBody(mobile, base, { ...FLAGS, "crawl.psi": true })).toMatch(/Lighthouse/);
    }
  });

  it("claims JavaScript redirects only with rendering, and never a sitemap-only crawl", () => {
    const body = (id: string, flags: Flags) =>
      ["en", "fr"].map((b) => capabilityBody(CRAWL_CAPABILITIES.find((c) => c.id === id)!, b as "en" | "fr", flags));
    const off = { ...FLAGS, "crawl.render": false, "crawl.listMode": false };
    const on = { ...FLAGS, "crawl.render": true, "crawl.listMode": true };
    for (const t of body("redirects", off)) expect(t).not.toMatch(/JavaScript/);
    for (const t of body("redirects", on)) expect(t).toMatch(/JavaScript/);
    for (const t of body("sitemap-analysis", off)) expect(t).not.toMatch(/on its own|seul/);
    // List mode checks a pasted URL list; nothing crawls a sitemap on its own.
    for (const t of body("sitemap-analysis", on)) expect(t).not.toMatch(/on its own|seul/);
  });

  it("describes render mode as the three modes it has, not a page picker", () => {
    const ctx = { families: new Set<string>(), flags: { ...FLAGS, "crawl.render": true }, plans: PLAN_CONFIGS };
    const faq = visibleFaq(ctx, "en").find((f) => /JavaScript/.test(f.q))!;
    expect(faq.a).toMatch(/off, thin pages or all pages, within your plan's rendered-page cap/);
    expect(faq.a).not.toMatch(/pages you choose/);
  });

  it("says 'your whole team' only while plans carry no seat cap", () => {
    // The Hosted card reads the seat rule from plan-config. If a seat cap is
    // added there, this fails until the card reads it.
    for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(Object.keys(PLAN_CONFIGS[p]).filter((k) => /seat|member|user/i.test(k))).toEqual([]);
    }
  });
});
