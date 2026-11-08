// Social posting stays in our sister product EchoPilot (2026-11-08). No copy
// may say Echorank itself schedules or publishes social posts: every sentence
// a visitor or customer reads that speaks of scheduling or publishing social
// posts names EchoPilot. The pricing FAQ answers the question once, and every
// channel named comes from ECHOPILOT_CHANNELS.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEO_TOOLS_COPY, dashNav } from "@/lib/i18n/dashboard";
import { ECHOPILOT_COPY } from "@/lib/i18n/echopilot";
import { HOME_TOOLS, HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { HELP_ARTICLES } from "@/lib/help-articles";
import { FAQ } from "@/app/[locale]/faq-data";
import { pricingFaq } from "@/lib/pricing-page/faq";
import { TECHNICAL_GEO_HTML } from "@/app/[locale]/technical-geo/landing-html";
import { SEO_TOOL_GROUPS, seoToolCounts } from "@/lib/seo-tools";
import {
  ECHOPILOT_CHANNELS,
  ECHOPILOT_LAUNCH_OFFER,
  ECHOPILOT_PRICING_URL,
  echopilotLaunchOfferOpen,
} from "@/lib/echopilot";

const ROOT = process.cwd();
const LOCALES = ["en", "fr", "de-CH"] as const;

/** A sentence about scheduling or publishing on social media, in en, fr or de. */
const SOCIAL_WORD = String.raw`(social|réseaux sociaux|médias sociaux|social-media|facebook|linkedin|instagram)`;
const ACTION_WORD = String.raw`(schedul|publish|programm|publi[ée]|publication|planen|veröffentlich|terminier)`;
const SOCIAL_CLAIM = new RegExp(
  `${SOCIAL_WORD}[^.?!\\n]{0,80}${ACTION_WORD}|${ACTION_WORD}[^.?!\\n]{0,80}${SOCIAL_WORD}`,
  "i",
);

/** Every string inside a catalog value, recursively. */
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

/** Sentences that talk about scheduling/publishing social posts without naming EchoPilot. */
function unattributed(texts: string[]): string[] {
  return texts
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .filter((s) => SOCIAL_CLAIM.test(s) && !/EchoPilot/.test(s));
}

const textOf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

describe("no copy says Echorank schedules or publishes social posts", () => {
  it("the hub, nav, tool page and homepage tool grid", () => {
    expect(unattributed(strings(SEO_TOOLS_COPY))).toEqual([]);
    expect(unattributed(strings(dashNav))).toEqual([]);
    // The tool page is EchoPilot's page as a whole: its bullets sit under
    // "What EchoPilot does", so the title and the lead carry the name.
    for (const l of LOCALES) {
      expect(ECHOPILOT_COPY[l].title).toContain("EchoPilot");
      expect(ECHOPILOT_COPY[l].lead).toContain("EchoPilot");
      expect(ECHOPILOT_COPY[l].whatTitle).toContain("EchoPilot");
    }
    expect(unattributed(strings(HOME_TOOLS))).toEqual([]);
    expect(unattributed(strings(HOME_PRICING_CHROME))).toEqual([]);
  });

  it("FAQs (homepage and pricing, which feed the FAQPage JSON-LD), help articles", () => {
    // A question and its answer are read together: the question may ask, the
    // answer must name EchoPilot.
    const pairs = [
      ...Object.values(FAQ).flatMap((f) => f.items.map((i) => `${i.q} ${i.a}`)),
      ...["en", "en-CA", "fr", "fr-CA", "de-CH"].flatMap((l) =>
        pricingFaq(l, { savePct: 20, freeCrawler: true }).map((i) => `${i.q} ${i.a}`),
      ),
    ];
    for (const p of pairs) {
      if (SOCIAL_CLAIM.test(p)) expect(p, p).toMatch(/EchoPilot/);
    }
    expect(unattributed(strings(HELP_ARTICLES))).toEqual([]);
  });

  it("standalone landing pages and llms.txt", () => {
    const dir = join(ROOT, "src/app/[locale]");
    const payloads = readdirSync(dir)
      .map((n) => join(dir, n, "landing-html.ts"))
      .filter((p) => existsSync(p));
    expect(payloads.length).toBeGreaterThan(3);
    for (const p of payloads) expect(unattributed([textOf(readFileSync(p, "utf8"))]), p).toEqual([]);
    expect(unattributed([readFileSync(join(ROOT, "public/llms.txt"), "utf8")])).toEqual([]);
    expect(TECHNICAL_GEO_HTML).toContain("Social posting, by EchoPilot");
  });

  it("the old Social Media Manager names are gone from every catalog and page", () => {
    const OLD = /Social Media Manager|Social-Media-Manager|Gestionnaire de médias sociaux|social_media_manager/;
    const copy = [
      JSON.stringify(SEO_TOOLS_COPY),
      JSON.stringify(dashNav),
      JSON.stringify(HOME_TOOLS),
      TECHNICAL_GEO_HTML,
      readFileSync(join(ROOT, "public/llms.txt"), "utf8"),
    ];
    for (const c of copy) expect(c).not.toMatch(OLD);
    expect(SEO_TOOL_GROUPS.flatMap((g) => g.tools).map((t) => t.id)).not.toContain("social_media_manager");
  });
});

describe("the FAQ answer", () => {
  it("en: exactly the agreed question and answer", () => {
    const item = pricingFaq("en", { savePct: 20, freeCrawler: true }).find((i) => i.id === "social");
    expect(item).toEqual({
      id: "social",
      q: "Do you schedule social posts?",
      a: "Yes, through our sister product EchoPilot, which publishes to Facebook and LinkedIn.",
    });
  });

  it.each(LOCALES)("%s: answered, naming EchoPilot and every channel", (l) => {
    const item = pricingFaq(l, { savePct: 20, freeCrawler: true }).find((i) => i.id === "social")!;
    expect(item.q.length).toBeGreaterThan(10);
    expect(item.a).toContain("EchoPilot");
    for (const c of ECHOPILOT_CHANNELS) expect(item.a).toContain(c);
  });

  it("fr and de-CH are not English, and de-CH has no ß", () => {
    const fr = pricingFaq("fr", { savePct: 20, freeCrawler: true }).find((i) => i.id === "social")!;
    const de = pricingFaq("de-CH", { savePct: 20, freeCrawler: true }).find((i) => i.id === "social")!;
    expect(fr.a).toMatch(/produit frère/);
    expect(de.a).toMatch(/Schwesterprodukt/);
    expect(`${de.q} ${de.a} ${strings(ECHOPILOT_COPY["de-CH"]).join(" ")}`).not.toContain("ß");
  });
});

describe("the hub card and its page", () => {
  const card = SEO_TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.id === "social_posting")!;

  it("is a partner card at /visibility/tools/social-posting, not counted as an Echorank tool", () => {
    expect(card).toMatchObject({ href: "/visibility/tools/social-posting", partner: "echopilot" });
    expect(card.comingSoon).toBeUndefined();
    expect(seoToolCounts().total).toBe(SEO_TOOL_GROUPS.flatMap((g) => g.tools).length - 1);
  });

  it.each(LOCALES)("%s: names EchoPilot, the four things it does, and only its channels", (l) => {
    const t = ECHOPILOT_COPY[l];
    expect(SEO_TOOLS_COPY[l].items.social_posting.name).toBe(t.title);
    expect(t.title).toContain("EchoPilot");
    expect(t.features).toHaveLength(4);
    const all = [...strings(t), SEO_TOOLS_COPY[l].items.social_posting.description].join(" ");
    for (const c of ECHOPILOT_CHANNELS) expect(all).toContain(c);
    expect(all).not.toMatch(/Instagram|TikTok|Twitter|\bX\b|YouTube|Pinterest|Threads|Google Business|Bluesky/);
  });

  it.each(LOCALES)("%s: the launch-offer line reads the config", (l) => {
    const offer = ECHOPILOT_COPY[l].offer;
    expect(offer).toContain(String(ECHOPILOT_LAUNCH_OFFER.percentOff));
    expect(offer).toMatch(/2027/);
    expect(offer).toMatch(/22/);
  });

  it("the offer shows through February 22, 2027 (New York) and not after", () => {
    expect(echopilotLaunchOfferOpen(new Date("2026-11-08T12:00:00Z"))).toBe(true);
    expect(echopilotLaunchOfferOpen(new Date("2027-02-23T04:59:59Z"))).toBe(true);
    expect(echopilotLaunchOfferOpen(new Date("2027-02-23T05:00:00Z"))).toBe(false);
  });

  it("the CTA goes to EchoPilot's pricing with the agreed UTM tags", () => {
    expect(ECHOPILOT_PRICING_URL).toBe(
      "https://echopilotlabs.com/pricing?utm_source=echorank&utm_medium=app&utm_campaign=social",
    );
    const page = readFileSync(join(ROOT, "src/app/(dashboard)/visibility/tools/social-posting/page.tsx"), "utf8");
    expect(page).toContain("echopilotLaunchOfferOpen()");
    expect(page).toContain("<EchopilotCta");
  });

  it("the old URL redirects to the new page", () => {
    const old = readFileSync(join(ROOT, "src/app/(dashboard)/visibility/tools/social-media-manager/page.tsx"), "utf8");
    expect(old).toContain('permanentRedirect("/visibility/tools/social-posting")');
    expect(old).not.toContain("feature-scaffold");
  });
});
