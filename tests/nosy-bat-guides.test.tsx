// @vitest-environment jsdom
//
// The Nosy Bat guides (NOSY-BAT-GUIDES.md, src/lib/learn-nosy-bat.ts): each
// renders in en and fr with its own French body, canonicals to its own base,
// carries Article (+ HowTo where the spec asks) JSON-LD that matches what is
// on screen, places its diagrams with a <title> and a caption, places its
// three CTAs where the spec says, and never sends a CTA to registration.
// axe runs over one guide. Every guide added to NOSY_BAT_GUIDES is picked up.
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import GuidePage, { generateMetadata } from "@/app/[locale]/learn/guides/[slug]/page";
import { NOSY_BAT_GUIDES } from "@/lib/learn-nosy-bat";
import { guideCopy, howToSteps, headingId, learnRoutes, type LearnBlock } from "@/lib/learn-content";
import { NB_ART, HEROES } from "@/components/learn/nosy-bat-art";
import { guideCtas } from "@/lib/site-crawler/marketing-copy";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";

const HOWTO = new Set(["how-to-find-broken-links", "xml-sitemap-generator", "how-to-audit-a-site-migration"]);

const render = async (locale: string, slug: string) =>
  renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ locale, slug }) }));

function graphOf(html: string): Record<string, unknown>[] {
  const m = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  expect(m, "no JSON-LD script").not.toBeNull();
  const data = JSON.parse(m![1]) as { "@graph"?: Record<string, unknown>[] };
  return data["@graph"] ?? [data as Record<string, unknown>];
}

const isStep = (b: LearnBlock) => (b.k === "h2" || b.k === "h3") && /^\d+\.\s/.test(b.t);

describe.each(NOSY_BAT_GUIDES.map((g) => [g.slug, g] as const))("%s", (slug, guide) => {
  it("is a registered learn route at sitemap priority 0.6", () => {
    const path = `/learn/guides/${slug}`;
    expect(learnRoutes()).toContain(path);
    expect(LOCALIZED_ROUTES.find((r) => r.path === path)?.priority).toBe(0.6);
  });

  it.each(["en", "fr"] as const)("renders in %s with its own body and no English-only notice", async (l) => {
    const html = await render(l, slug);
    const copy = guideCopy(guide, l);
    expect(html).toContain(copy.title.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("n'est pour l'instant disponible qu'en anglais");
    expect(html).not.toContain("n&#x27;est pour l&#x27;instant disponible");
    const firstH2 = copy.body.find((b) => b.k === "h2") as { t: string };
    expect(html).toContain(`id="${headingId(firstH2.t)}"`);
  });

  it("has a French body of the same shape as the English one", () => {
    const en = guide.body;
    const fr = guide.fr?.body ?? [];
    expect(fr.map((b) => b.k)).toEqual(en.map((b) => b.k));
    // Same diagrams and CTAs at the same positions.
    expect(fr.filter((b) => b.k === "figure")).toEqual(en.filter((b) => b.k === "figure"));
    expect(fr.filter((b) => b.k === "guideCta")).toEqual(en.filter((b) => b.k === "guideCta"));
    // Untranslated product names: the brand stays as it is.
    expect(guide.fr?.title).toBeTruthy();
  });

  it.each([
    ["en", "en"],
    ["en-CA", "en"],
    ["de-CH", "en"],
    ["fr", "fr"],
    ["fr-CA", "fr"],
  ] as const)("canonical for %s points at /%s", async (l, base) => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: l, slug }) });
    expect(String(meta.alternates?.canonical)).toMatch(new RegExp(`/${base}/learn/guides/${slug}$`));
  });

  it.each(["en", "fr"] as const)("JSON-LD (%s): Article, plus HowTo built from the numbered steps on screen", async (l) => {
    const html = await render(l, slug);
    const graph = graphOf(html);
    const art = graph.find((n) => n["@type"] === "Article");
    expect(art?.inLanguage).toBe(l);
    expect(String(art?.url)).toContain(`/${l}/learn/guides/${slug}`);
    const how = graph.find((n) => n["@type"] === "HowTo") as { step: { name: string; text: string; url: string; position: number }[] } | undefined;
    if (!HOWTO.has(slug)) {
      expect(how).toBeUndefined();
      return;
    }
    expect(how).toBeDefined();
    const steps = howToSteps(guideCopy(guide, l).body);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(how!.step.map((s) => s.position)).toEqual(steps.map((_, i) => i + 1));
    for (const s of how!.step) {
      expect(s.name).not.toMatch(/\*\*|`/);
      expect(s.text.length).toBeGreaterThan(20);
      // Each step deep-links a heading that exists on the page.
      const anchor = s.url.split("#")[1];
      expect(html).toContain(`id="${anchor}"`);
    }
  });

  it("places three diagrams, each with a <title> and the caption it names", async () => {
    for (const l of ["en", "fr"] as const) {
      const html = await render(l, slug);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const figs = [...doc.querySelectorAll("figure[data-nb-art]")];
      expect(figs).toHaveLength(3);
      for (const f of figs) {
        const svg = f.querySelector("svg")!;
        expect(svg.getAttribute("viewBox")).toBe("0 0 640 360");
        expect(svg.getAttribute("role")).toBe("img");
        const title = svg.querySelector("title");
        expect(title?.textContent?.trim()).toBeTruthy();
        expect(svg.getAttribute("aria-labelledby")).toBe(title?.id);
        const cap = doc.getElementById(svg.getAttribute("aria-describedby")!);
        expect(cap?.tagName).toBe("FIGCAPTION");
        expect(cap?.textContent?.trim().length).toBeGreaterThan(20);
        // No raster: nothing but vector shapes and text inside.
        expect(svg.querySelector("image, foreignObject")).toBeNull();
      }
    }
    for (const b of guide.body) if (b.k === "figure") expect(NB_ART[b.art], b.art).toBeDefined();
  });

  it("has a hero above the title", async () => {
    expect(guide.hero && HEROES[guide.hero]).toBeTruthy();
    const html = await render("en", slug);
    expect(html.indexOf(`data-nb-hero="${guide.hero}"`)).toBeGreaterThan(-1);
    expect(html.indexOf(`data-nb-hero="${guide.hero}"`)).toBeLessThan(html.indexOf("<h1"));
  });

  it("places the inline CTA after step 1, a nudge later, and the closing card before Related", async () => {
    const body = guide.body;
    const firstStep = body.findIndex(isStep);
    const secondStep = body.findIndex((b, i) => i > firstStep && isStep(b));
    const inline = body.findIndex((b) => b.k === "guideCta" && b.at === "inline");
    const nudge = body.findIndex((b) => b.k === "guideCta" && b.at === "nudge");
    expect(inline).toBeGreaterThan(firstStep);
    expect(inline).toBeLessThan(secondStep);
    expect(nudge).toBeGreaterThan(inline);
    expect(guideCtas[slug]).toBeDefined();

    for (const l of ["en", "fr"] as const) {
      const html = await render(l, slug);
      const at = (v: string) => html.indexOf(`data-guide-cta="${v}"`);
      expect(at("inline")).toBeGreaterThan(-1);
      expect(at("nudge")).toBeGreaterThan(at("inline"));
      expect(at("closing")).toBeGreaterThan(at("nudge"));
      const related = l === "fr" ? "Pour aller plus loin" : "Keep going";
      expect(at("closing")).toBeLessThan(html.indexOf(related));
      // Signed out on the server: See plans → /{locale}/pricing, plus the free crawl.
      expect(html).toContain(`href="/${l}/pricing"`);
      expect(html).toContain(`href="/${l}/free-tools/site-crawler"`);
      expect(html).not.toMatch(/href="[^"]*\/register/);
    }
  });

  it("cross-links the other guides it names, in both languages", () => {
    for (const r of [...guide.related, ...(guide.fr?.related ?? [])]) {
      if (!r.href.startsWith("/learn/guides/")) continue;
      expect(learnRoutes()).toContain(r.href);
    }
  });
});

describe("accessibility", () => {
  it("axe finds no serious or critical violation on the first guide (en and fr)", async () => {
    for (const l of ["en", "fr"] as const) {
      const html = await render(l, NOSY_BAT_GUIDES[0].slug);
      document.documentElement.lang = l;
      document.body.innerHTML = html;
      const res = await axe.run(document.body, {
        resultTypes: ["violations"],
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
      const bad = res.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(bad).toEqual([]);
    }
  });
});
