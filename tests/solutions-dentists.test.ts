// /[locale]/solutions/industries/dentists (ECHORANK-DENTISTS-PAGE, 2026-11-09).
//
// The page is config: a taxonomy item plus a solutions-detail entry carrying
// its meta title, hero CTAs, three graphics, cards and FAQ. These tests pin
// what the brief asked for and what the config cannot express by itself: the
// graphics exist and are sized, the FAQPage markup is the FAQ on the page, the
// engine names and location counts are read rather than written, the two
// sibling pages link here, and nothing claims HIPAA compliance.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page, { generateMetadata } from "@/app/[locale]/solutions/[category]/[slug]/page";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { OG_IMAGE_PATH } from "@/lib/seo/constants";
import { DENTISTS_HREF, detailFor, enginesOnEveryPlan, hasMultiLocationPlans } from "@/lib/solutions-detail";
import { itemBySlug } from "@/lib/solutions-taxonomy";

const ROOT = join(__dirname, "..");
const SVG_DIR = join(ROOT, "public/solutions/dentists");
const BASES = ["en", "fr"] as const;

const render = async (locale: string, category: string, slug: string) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, category, slug }) }));
const dentists = (locale: string) => render(locale, "industries", "dentists");

/** renderToStaticMarkup escapes text; undo the five entities it emits. */
const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function jsonLd(html: string): { "@graph": Array<Record<string, unknown>> } | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

describe("the dentists page", () => {
  it("is an industries item, so the route, the nav and the sitemap pick it up", () => {
    const item = itemBySlug("industries", "dentists");
    expect(item?.en.label).toBe("Dentists & dental clinics");
    expect(item?.fr.label).toBe("Dentistes et cliniques dentaires");
    expect(DENTISTS_HREF).toBe("/solutions/industries/dentists");
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain(DENTISTS_HREF);
  });

  it("is in the By industry mega-menu column in both locales", () => {
    for (const base of BASES) {
      const html = renderToStaticMarkup(createElement(PublicNav, { locale: base }));
      expect(html).toContain(`href="/${base}${DENTISTS_HREF}"`);
      expect(decode(html)).toContain(itemBySlug("industries", "dentists")![base].label);
    }
  });

  it("renders both locales with every section and no missing copy", async () => {
    for (const base of BASES) {
      const html = await dentists(base);
      const d = detailFor("dentists", base)!;
      const text = decode(html);
      expect(text).toContain(itemBySlug("industries", "dentists")![base].h1);
      // Hero eyebrow: "/ 01 — By industry" | "/ 01 — Par secteur".
      expect(text).toContain(`/ 01</b> — <a href="/${base}/solutions/industries">${base === "en" ? "By industry" : "Par secteur"}</a>`);
      for (const sec of d.prose!) {
        expect(text).toContain(sec.h2);
        for (const p of sec.paras) expect(text).toContain(p);
      }
      for (const card of d.cards) expect(text).toContain(card.body);
      for (const n of ["01", "02", "03", "04", "05", "06", "07"]) expect(html).toContain(`/ ${n}`);
      expect(html).not.toContain("/ 08");
      expect(html).not.toMatch(/undefined|>null</);
    }
    expect(decode(await dentists("fr"))).toContain("Les patients demandent d'abord à l'assistant");
  });

  it("folds the regional locales onto en/fr", async () => {
    expect(decode(await dentists("fr-CA"))).toContain("Echorank pour les dentistes et les cliniques dentaires");
    expect(decode(await dentists("de-CH"))).toContain("Echorank for dentists and dental clinics");
  });

  it("carries both hero CTAs, and ?src=solutions-dentists on the pricing links", async () => {
    for (const base of BASES) {
      const html = await dentists(base);
      const hero = html.slice(0, html.indexOf("/ 02"));
      expect(hero).toContain(`href="/${base}/pricing?src=solutions-dentists"`);
      expect(hero).toContain(`href="/${base}/free-audit"`);
      // Footer CTA too; no bare /pricing link left in the page body (the
      // shared nav and footer keep their own plain Pricing links).
      const body = html.slice(html.indexOf("</nav>"), html.indexOf("<footer"));
      expect(body.match(/pricing\?src=solutions-dentists/g)?.length).toBe(2);
      expect(body).not.toContain(`href="/${base}/pricing"`);
    }
  });

  it("uses the brief's titles, engine names from the catalogue, and the shared OG card", async () => {
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en", category: "industries", slug: "dentists" }) });
    const fr = await generateMetadata({ params: Promise.resolve({ locale: "fr", category: "industries", slug: "dentists" }) });
    expect(en.title).toEqual({ absolute: "Echorank for dentists: be the practice AI assistants recommend | Echorank360" });
    expect(fr.title).toEqual({ absolute: "Echorank pour les dentistes : soyez la clinique que l'IA recommande | Echorank360" });
    const engines = enginesOnEveryPlan();
    expect(engines).toEqual(
      [...ENGINE_CATALOGUE].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, engines.length).map((e) => e.displayName),
    );
    expect(engines.length).toBeGreaterThan(0);
    for (const name of engines) {
      expect(en.description).toContain(name);
      expect(fr.description).toContain(name);
    }
    expect(en.description).toMatch(/^Track whether .+ name your practice for implants, emergencies and more\. Front-desk review links, local checks, no patient data\.$/);
    expect(fr.description).toMatch(/^Vérifiez si .+ citent votre clinique pour les implants, les urgences et plus\. Liens d'avis à l'accueil, vérifications locales, aucune donnée patient\.$/);
    const og = (en.openGraph as { images: Array<{ url: string }> }).images[0].url;
    expect(og.endsWith(OG_IMAGE_PATH)).toBe(true);
  });
});

describe("graphics", () => {
  const FILES = BASES.flatMap((b) => ["ai-answer", "review-flow", "tracking"].map((n) => `dentists-${n}-${b}.svg`));

  it("ships the six SVGs in public/solutions/dentists/", () => {
    expect(readdirSync(SVG_DIR).sort()).toEqual([...FILES].sort());
  });

  it("renders each in sections /03–/05, lazy, sized from the SVG, alt from its <title>", async () => {
    for (const base of BASES) {
      const html = await dentists(base);
      // The hero's AI Visibility emblem is the page's only other <img>.
      const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]).filter((t) => !t.includes("data-av-emblem"));
      expect(imgs).toHaveLength(3);
      for (const [i, name] of ["ai-answer", "review-flow", "tracking"].entries()) {
        const file = `dentists-${name}-${base}.svg`;
        const svg = readFileSync(join(SVG_DIR, file), "utf8");
        const title = svg.match(/<title>([^<]+)<\/title>/)![1];
        const [, w, h] = svg.match(/<svg[^>]*\swidth="(\d+)"\s+height="(\d+)"/)!;
        const tag = imgs[i];
        expect(tag).toContain(`src="/solutions/dentists/${file}"`);
        expect(decode(tag)).toContain(`alt="${title}"`);
        expect(tag).toContain(`width="${w}"`);
        expect(tag).toContain(`height="${h}"`);
        expect(tag).toContain('loading="lazy"');
        // Each graphic sits in its own prose section, /03, /04, /05.
        const at = html.indexOf(tag);
        const label = html.lastIndexOf("<b>/ ", at);
        expect(html.slice(label, label + 7)).toBe(`<b>/ 0${i + 3}`);
      }
    }
  });

  it("references no photo", async () => {
    for (const base of BASES) {
      const html = await dentists(base);
      expect(html).not.toMatch(/\.(webp|jpe?g|png|avif|gif)\b/i);
    }
  });
});

describe("FAQ", () => {
  it("emits FAQPage JSON-LD equal to the rendered FAQ, and nothing else", async () => {
    for (const base of BASES) {
      const html = await dentists(base);
      const graph = jsonLd(html)!["@graph"];
      expect(graph).toHaveLength(1);
      expect(graph[0]["@type"]).toBe("FAQPage");
      expect(graph[0]["@id"]).toBe(`https://echorank360.com/${base}${DENTISTS_HREF}#faq`);
      const marked = (graph[0].mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q) => ({
        q: q.name,
        a: q.acceptedAnswer.text,
      }));
      const shownQ = [...html.matchAll(/<h3 class="[^"]*">([\s\S]*?)<\/h3>/g)].map((m) => decode(m[1]));
      const faqHtml = html.slice(html.indexOf('id="faq"'));
      const shownA = [...faqHtml.matchAll(/<p class="[^"]*faqA[^"]*">([\s\S]*?)<\/p>/g)].map((m) => decode(m[1]));
      expect(marked).toHaveLength(6);
      expect(marked).toEqual(shownQ.map((q, i) => ({ q, a: shownA[i] })));
      expect(marked).toEqual(detailFor("dentists", base)!.faq);
    }
  });

  it("answers the engines question from the catalogue and the plans' allowances", () => {
    const all = [...ENGINE_CATALOGUE].sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.displayName);
    for (const base of BASES) {
      const a = detailFor("dentists", base)!.faq![2].a;
      // Every engine some plan can reach is named; nothing else is.
      const reachable = PLAN_ORDER.some((p) => PLAN_CONFIGS[p].aiCheckup.providers === null)
        ? all
        : all.slice(0, Math.max(...PLAN_ORDER.map((p) => PLAN_CONFIGS[p].aiCheckup.providers ?? 0)));
      for (const name of reachable) expect(a, `${base} ${name}`).toContain(name);
      expect(a.startsWith(base === "en" ? "Every plan checks " : "Chaque forfait vérifie ")).toBe(true);
    }
    // Today's catalogue and plans, spelled out once so a change is noticed.
    expect(detailFor("dentists", "en")!.faq![2].a).toBe(
      "Every plan checks ChatGPT, Google AI Overviews and Gemini. Starter, Growth and Agency also check Claude. " +
        "Enterprise can cover every engine we support, adding Perplexity, Grok, Mistral and Llama.",
    );
  });

  it("answers the locations question from PLAN_CONFIGS, and shows card 4 only with multi-location plans", () => {
    expect(hasMultiLocationPlans()).toBe(true);
    for (const base of BASES) {
      const d = detailFor("dentists", base)!;
      for (const p of PLAN_ORDER) {
        const n = PLAN_CONFIGS[p].quotaDefaults.maxLocations;
        const count = n < 0 ? (base === "fr" ? "illimité" : "unlimited") : String(n);
        expect(d.faq![4].a).toContain(`${count} ${base === "fr" ? "avec" : "on"} ${PLAN_CONFIGS[p].name}`);
      }
      expect(d.cards).toHaveLength(4);
    }
  });

  it("says reply drafts follow the rule, because the healthcare guardrail exists and is wired in", async () => {
    // e5bebb43: src/lib/review-replies/healthcare-guardrail.ts, enforced on
    // every reply-drafting path (tests/healthcare-reply-guardrail.test.ts).
    // If the guardrail goes, this sentence must go with it.
    const guardrail = readFileSync(join(ROOT, "src/lib/review-replies/healthcare-guardrail.ts"), "utf8");
    expect(guardrail).toContain("export function enforceHealthcareReply");
    for (const f of ["src/app/api/ai/respond/route.ts", "src/lib/action-agent/generate.ts"]) {
      expect(readFileSync(join(ROOT, f), "utf8"), f).toContain("enforceHealthcareReply(");
    }
    // Dental tenants are in scope.
    const { isHealthcareCategory } = await import("@/lib/review-replies/healthcare-guardrail");
    expect(isHealthcareCategory("Dentist")).toBe(true);
    expect(decode(await dentists("en"))).toContain(
      "keep public replies general: thank the reviewer without confirming they're a patient or mentioning their treatment. Echorank's reply drafts follow that rule.",
    );
    expect(decode(await dentists("fr"))).toContain(
      "ni mentionner son soin. Les brouillons de réponse d'Echorank respectent cette règle.",
    );
  });

  it("the healthcare page's privacy-safe-responses claim matches the guardrail", async () => {
    // Replies are general by design (the guardrail strips anything specific to
    // the review), so the card says "warm and general", not "specific".
    for (const base of BASES) {
      const card = detailFor("healthcare", base)!.cards[0];
      expect(card.title).toBe(base === "en" ? "Privacy-safe responses" : "Réponses conformes au secret");
      expect(card.body).toMatch(base === "en" ? /warm and general, never confirming a care relationship/ : /chaleureuse et générale — sans jamais confirmer une relation de soin/);
      expect(card.body).not.toMatch(/specific|précise/);
    }
    const { isHealthcareCategory } = await import("@/lib/review-replies/healthcare-guardrail");
    expect(isHealthcareCategory("Healthcare practice")).toBe(true);
  });
});

describe("links from the sibling pages", () => {
  it.each([
    ["professional-services"],
    ["healthcare"],
  ])("%s links to the dentists page in both locales", async (slug) => {
    for (const base of BASES) {
      const html = await render(base, "industries", slug);
      const line = html.match(/<p [^>]*data-testid="solution-related"[^>]*><a href="([^"]+)">([^<]+)<\/a><\/p>/);
      expect(line, `${slug}.${base}`).toBeTruthy();
      expect(line![1]).toBe(`/${base}${DENTISTS_HREF}`);
      expect(decode(line![2])).toBe(
        base === "en"
          ? "Running a dental practice? See Echorank for dentists →"
          : "Vous dirigez une clinique dentaire ? Voir Echorank pour les dentistes →",
      );
      // The href resolves: it is a real taxonomy item under its own category.
      const [, , , category, item] = line![1].split("/");
      expect(itemBySlug(category, item)).toBeTruthy();
      // No JSON-LD pattern is invented on pages without a FAQ.
      expect(jsonLd(html)).toBeNull();
    }
  });
});

describe("no HIPAA compliance claim", () => {
  // The only permitted occurrences are QUESTIONS (the FAQ asks it; the answer
  // says Echorank is not built for health data). A statement fails.
  const CLAIM = /hipaa[\s-]+compliant|conforme à la hipaa|hipaa[\s-]+compliance/gi;
  const TEXT = /\.(tsx?|mts|md|html|txt|json|svg)$/;
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "generated" || name.includes(".bak")) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) yield* walk(p);
      else if (TEXT.test(name)) yield p;
    }
  }

  it("states it nowhere in src/ or public/", () => {
    const offenders: string[] = [];
    for (const top of ["src", "public"]) {
      const dir = join(ROOT, top);
      if (!existsSync(dir)) continue;
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(CLAIM)) {
          const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 3);
          if (!after.includes("?")) offenders.push(`${file.slice(ROOT.length + 1)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
