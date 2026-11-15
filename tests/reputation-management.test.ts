// /reputation-management, the reputation hub landing (2026-11-15), and the
// /reputation-tools cards it sits over. Both payloads are hand-written HTML;
// every price and location cap on them comes from PLAN_CONFIGS at request
// time, so a price change cannot leave a stale number on either page (the
// 2026-07-31 JSON-LD drift, and /reputation-tools' $79 / $199 / $499).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { REPUTATION_MANAGEMENT_HTML } from "@/app/[locale]/reputation-management/landing-html";
import { GET as reputationManagement } from "@/app/[locale]/reputation-management/route";
import { PRICED_PLANS, withPlanPriceSpans } from "@/app/[locale]/reputation-management/prices";
import { GET as reputationTools } from "@/app/[locale]/reputation-tools/route";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

async function rendered(get: () => Response | Promise<Response>) {
  const res = await get();
  return { res, html: await res.text() };
}

/** data-plan-price → the number the card shows. */
function cardPrices(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<span class="amt" data-plan-price="([A-Z_]+)">([^<]*)<\/span>/g)) out[m[1]!] = m[2]!;
  return out;
}

describe("/reputation-management", () => {
  it("embeds the owner's file byte for byte (sha256 5479598816eb…6a67245, plus its final newline)", () => {
    expect(createHash("sha256").update(`${REPUTATION_MANAGEMENT_HTML}\n`).digest("hex")).toBe(
      "5479598816eb5d11ce20a2f326cf1620709c08bf56ec661c9c8b9d9de6a67245",
    );
  });

  it("is a String.raw payload with no backtick and no ${ in it", () => {
    const src = read("src/app/[locale]/reputation-management/landing-html.ts");
    expect(src).toContain("String.raw`<!DOCTYPE html>");
    const body = src.slice(src.indexOf("String.raw`") + "String.raw`".length, src.lastIndexOf("`;"));
    expect(body).not.toContain("`");
    expect(body).not.toContain("${");
  });

  it("serves HTML with technical-geo's headers", async () => {
    const { res } = await rendered(reputationManagement);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("prints each plan's monthly price from PLAN_CONFIGS", async () => {
    const { html } = await rendered(reputationManagement);
    const prices = cardPrices(html);
    expect(Object.keys(prices)).toEqual([...PRICED_PLANS]);
    for (const plan of PRICED_PLANS) expect(prices[plan], plan).toBe(String(PLAN_CONFIGS[plan].monthlyPrice));
  });

  it("serves the config, not the typed number, when the two disagree", () => {
    const html = withPlanPriceSpans(
      REPUTATION_MANAGEMENT_HTML.replace('data-plan-price="GROWTH">177<', 'data-plan-price="GROWTH">999<'),
    );
    expect(cardPrices(html).GROWTH).toBe(String(PLAN_CONFIGS.GROWTH.monthlyPrice));
  });

  it("refuses a payload it cannot price", () => {
    expect(() => withPlanPriceSpans("<p>no cards</p>")).toThrow(/found none/);
    expect(() =>
      withPlanPriceSpans(REPUTATION_MANAGEMENT_HTML.replace('data-plan-price="AGENCY"', 'data-plan-price="ENTERPRISE"')),
    ).toThrow(/unknown data-plan-price ENTERPRISE/);
  });

  it("keeps its canonical on /en", async () => {
    const { html } = await rendered(reputationManagement);
    expect(html).toContain('<link rel="canonical" href="https://echorank360.com/en/reputation-management">');
  });

  it("is registered for the sitemap at 0.8", () => {
    const route = LOCALIZED_ROUTES.find((r) => r.path === "/reputation-management");
    expect(route?.priority).toBe(0.8);
  });

  it("links to every page of the suite it is the hub for", () => {
    for (const p of ["/reputation-tools", "/reputation-engine", "/reputation-risk", "/customer-feedback", "/act-on-signals"]) {
      expect(REPUTATION_MANAGEMENT_HTML, p).toContain(`href="/en${p}"`);
    }
  });

  it("is linked from the homepage's foundation section, next to /reputation-tools, en and fr", () => {
    const home = read("src/app/[locale]/HomeClient.tsx");
    const section = home.slice(home.indexOf("{t.trad.label}"), home.indexOf("{/* 9. HISTORY */}"));
    expect(section).toContain('href={L("/reputation-tools")}');
    expect(section).toContain('<Link className={s.btn} href={L("/reputation-management")}>{t.trad.overviewCta}</Link>');
    expect(home).toContain('overviewCta: "Reputation management overview →"');
    expect(home).toContain(`overviewCta: "Gestion de la réputation — vue d'ensemble →"`);
  });
});

describe("/reputation-tools cards", () => {
  it("print the monthly and yearly prices and the location caps from PLAN_CONFIGS", async () => {
    const { html } = await rendered(reputationTools);
    for (const plan of PRICED_PLANS) {
      const c = PLAN_CONFIGS[plan];
      const m = String(c.monthlyPrice);
      const y = c.annualPrice.toFixed(2);
      expect(html, plan).toContain(`<span class="amt" data-m="${m}" data-y="${y}">${m}</span>`);
    }
    expect(html).toContain(`<li><span class="m">✓</span>${PLAN_CONFIGS.STARTER.quotaDefaults.maxLocations} business location</li>`);
    expect(html).toContain(`Up to ${PLAN_CONFIGS.GROWTH.quotaDefaults.maxLocations} locations</li>`);
    expect(html).toContain(`Up to ${PLAN_CONFIGS.AGENCY.quotaDefaults.maxLocations} locations &amp; client profiles`);
    expect(html).not.toMatch(/nlimited locations/);
    expect(html).not.toMatch(/__(?:AMT|LOCATIONS)_/);
  });

  it("carry no typed amount in the payload", () => {
    const src = read("src/app/[locale]/reputation-tools/landing-html.ts");
    expect(src).not.toMatch(/class="amt"[^>]*>\d/);
    expect(src).not.toMatch(/data-[my]="\d/);
  });
});
