// @vitest-environment jsdom
//
// /[locale]/ai-visibility, the AI Visibility plan's landing page (ECHORANK-AI-
// VISIBILITY-PAGES.md Phase 1, 2026-11-10): rendered from config, only live
// engines named, only shipped features listed, the FAQPage and Offer JSON-LD
// match the page, every CTA has a target, no /#pricing, every locale served.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/ai-visibility",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));

import Page, { generateMetadata } from "@/app/[locale]/ai-visibility/page";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { AV_COPY } from "@/lib/ai-visibility-landing/copy";
import { AV_FEATURES, allowanceRows, avShippedFeatures, starterAdds } from "@/lib/ai-visibility-landing/facts";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { KEYWORD_SCAN_LIMIT_PER_DAY } from "@/lib/keyword-scan-limits";
import { PLAN_CONFIGS } from "@/lib/plan-config";

const ROOT = join(__dirname, "..");
const P = (locale: string) => ({ params: Promise.resolve({ locale }) });
const render = async (locale = "en") => renderToStaticMarkup(await Page(P(locale)));
const doc = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};
const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const graph = (el: Element) =>
  JSON.parse(el.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"] as Record<string, unknown>[];

// DataForSEO powers the first three engines (ChatGPT, AI Overviews, Gemini); Claude needs its own key.
const DFS = { DATAFORSEO_LOGIN: "x", DATAFORSEO_PASSWORD: "y" };
function stubEnv(vars: Record<string, string>) {
  for (const k of ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "ANTHROPIC_API_KEY", "PERPLEXITY_API_KEY", "XAI_API_KEY", "MISTRAL_API_KEY", "LLAMA_API_HOST"]) {
    vi.stubEnv(k, vars[k] ?? "");
  }
}
beforeEach(() => stubEnv(DFS));
afterEach(() => vi.unstubAllEnvs());

describe("renders from config", () => {
  it("the hero CTA carries the AI Visibility price and the checkout pattern; the closing CTA is the same", async () => {
    const el = doc(await render());
    const price = PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice;
    const cta = el.querySelector('[data-testid="av-cta-primary"]')!;
    expect(text(cta)).toBe(`Start AI Visibility: $${price}/mo`);
    expect(cta.getAttribute("href")).toBe("/en/pricing?plan=ai_visibility&src=ai-visibility-hero");
    const fin = el.querySelector('[data-testid="av-cta-final"]')!;
    expect([text(fin), fin.getAttribute("href")]).toEqual([text(cta), cta.getAttribute("href")]);
    expect(el.querySelector('[data-testid="av-cta-check"]')!.getAttribute("href")).toBe("/en/ai-visibility-check");
  });

  it("changing a plan's allowance in config changes the page (table, FAQ, steps)", async () => {
    const shape = PLAN_CONFIGS.AI_VISIBILITY.aiCheckup;
    const before = { ...shape };
    try {
      (shape as { prompts: number }).prompts = 37;
      (shape as { repetitions: number }).repetitions = 4;
      const el = doc(await render());
      const row = el.querySelector('[data-testid="av-allowances"] tr[data-plan="AI_VISIBILITY"]')!;
      expect(text(row)).toContain("37");
      expect(text(row)).toContain("4 times");
      expect(text(el)).toContain("up to 37 prompts on AI Visibility");
      expect(text(el.querySelector("#how"))).toContain("asked 4 times per engine");
    } finally {
      Object.assign(shape, before);
    }
    const el = doc(await render());
    expect(text(el.querySelector('[data-testid="av-allowances"] tr[data-plan="AI_VISIBILITY"]'))).toContain(String(before.prompts));
  });

  it("the allowance table has the four self-serve plans, each row from config", async () => {
    const el = doc(await render());
    const rows = [...el.querySelectorAll('[data-testid="av-allowances"] tbody tr')];
    expect(rows.map((r) => r.getAttribute("data-plan"))).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
    for (const r of rows) {
      const c = PLAN_CONFIGS[r.getAttribute("data-plan") as "STARTER"];
      expect(text(r)).toContain(c.name);
      expect(text(r)).toContain(String(c.aiCheckup.prompts));
    }
  });

  it("the keyword scan's daily limit is the route's own constant", async () => {
    const html = await render();
    expect(text(doc(html).querySelector("#how"))).toContain(`${KEYWORD_SCAN_LIMIT_PER_DAY} scans a day`);
    expect(readFileSync(join(ROOT, "src/app/api/av/keywords/route.ts"), "utf8")).toContain("LIMIT_PER_DAY = KEYWORD_SCAN_LIMIT_PER_DAY");
  });

  it("nothing in the copy module or the page types a price, a prompt count or an engine name", () => {
    const names = ENGINE_CATALOGUE.map((e) => e.displayName);
    for (const f of ["src/lib/ai-visibility-landing/copy.ts", "src/app/[locale]/ai-visibility/page.tsx"]) {
      // The kept H1 ("When someone asks ChatGPT…") and the page title name the
      // category leader on purpose; every other engine mention is computed.
      const src = readFileSync(join(ROOT, f), "utf8")
        .split("\n")
        .filter((line) => !/^\s+(h1a|title): /.test(line))
        .join("\n");
      for (const n of names) expect(src, `${f}: ${n}`).not.toMatch(new RegExp(`\\b${n}\\b`));
      expect(src, f).not.toMatch(/\$\d/);
      expect(src, f).not.toMatch(/\b\d+ (AI )?prompts\b/);
    }
  });
});

describe("engines", () => {
  it("names only the engines this box can call, from the registry", async () => {
    const el = doc(await render());
    const av = text(el.querySelector('[data-testid="av-engines"]'));
    expect(av).toBe("AI Visibility asks ChatGPT, Google AI Overviews, and Gemini.");
    // Claude has no key here: not in the hero, the table or the FAQ.
    for (const sel of ['[data-testid="av-engines"]', '[data-testid="av-allowances"]', "#faq", '[data-testid="av-example"]']) {
      expect(text(el.querySelector(sel)), sel).not.toContain("Claude");
    }
    // With its key, it appears where a plan takes four engines.
    stubEnv({ ...DFS, ANTHROPIC_API_KEY: "k" });
    const el2 = doc(await render());
    expect(text(el2.querySelector('[data-testid="av-allowances"] tr[data-plan="STARTER"]'))).toContain("Claude");
    expect(text(el2.querySelector('[data-testid="av-allowances"] tr[data-plan="AI_VISIBILITY"]'))).not.toContain("Claude");
  });

  it("every engine name on the page is in the registry", async () => {
    stubEnv({ ...DFS, ANTHROPIC_API_KEY: "k", PERPLEXITY_API_KEY: "k" });
    const page = text(doc(await render()));
    const known = new Set(ENGINE_CATALOGUE.map((e) => e.displayName));
    for (const n of ["Copilot", "Bing Chat", "DeepSeek", "Meta AI", "You.com"]) expect(page).not.toContain(n);
    for (const r of allowanceRows()) for (const e of r.engines) expect(known.has(e)).toBe(true);
  });

  it("the example's alert names an engine the AI Visibility plan really asks, with a relative date", async () => {
    const el = doc(await render());
    const ex = text(el.querySelector('[data-testid="av-example"]'));
    expect(ex).toContain("Example");
    expect(ex).toContain("Dropped from Gemini answers · 3 days ago");
    expect(ex).not.toMatch(/Jul 9|9 juil|9\. Juli/);
  });
});

describe("only shipped features", () => {
  it("lists exactly the AI Visibility plan's features (feature-flags), plus the AI Search Score with its methodology link", async () => {
    const el = doc(await render());
    const ids = [...el.querySelectorAll('[data-testid="av-features"] [data-feature]')].map((n) => n.getAttribute("data-feature"));
    expect(ids).toEqual([...avShippedFeatures(), "score"]);
    expect(avShippedFeatures()).toEqual(AV_FEATURES.map((f) => f.id));
    const score = el.querySelector('[data-feature="score"]')!;
    expect(score.querySelector("a")!.getAttribute("href")).toBe("/en/methodology");
    expect(text(score)).toMatch(/40%.*30%.*20%.*10%/);
    // The old page's unshipped or stale claims are gone.
    const page = text(el);
    for (const s of ["AI Trust Score", "Millions of buying decisions", "25 tracked prompts", "Weekly answer refresh", "Included in every plan"]) {
      expect(page).not.toContain(s);
    }
  });

  it("the Starter line names what plan-access opens beyond the AI-only plan", async () => {
    const el = doc(await render());
    expect(starterAdds()).toEqual(["reputation", "seo_tools", "crawler", "marketing_studio"]);
    expect(text(el.querySelector('[data-testid="av-starter-adds"]'))).toBe(
      "Starter adds review management, the SEO tools, the Nosy Bat site crawler, and Marketing Studio.",
    );
  });

  it("the reviews answer follows plan-access: review management starts on Starter, not Growth", async () => {
    const el = doc(await render());
    expect(text(el.querySelector("#faq"))).toContain("Review management starts on Starter.");
    expect(text(el.querySelector("#faq"))).not.toMatch(/Growth and Agency plans/);
  });
});

describe("structured data and links", () => {
  it("the FAQPage JSON-LD is the rendered FAQ, question for question", async () => {
    for (const l of ["en", "fr", "de-CH"]) {
      const el = doc(await render(l));
      const faq = graph(el).find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
      const shown = [...el.querySelectorAll("#faq h3")].map((h) => text(h));
      const answers = [...el.querySelectorAll("#faq h3 + p")].map((p) => text(p));
      expect(faq.mainEntity.map((q) => q.name)).toEqual(shown);
      expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(answers);
      expect(shown.length).toBe(10);
    }
  });

  it("the Offer JSON-LD is the AI Visibility plan's price, from config", async () => {
    const el = doc(await render());
    const product = graph(el).find((n) => n["@type"] === "Product") as { offers: { price: string; priceCurrency: string; url: string } };
    expect(product.offers.price).toBe(String(PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice));
    expect(product.offers.priceCurrency).toBe("USD");
    expect(product.offers.url).toBe("https://echorank360.com/en/pricing?plan=ai_visibility&src=ai-visibility-hero");
  });

  it("every link has a target, no pricing link points at /#pricing, and every sub-nav anchor exists", async () => {
    const el = doc(await render());
    for (const a of el.querySelectorAll("a")) {
      const href = a.getAttribute("href");
      expect(href, text(a)).toBeTruthy();
      expect(href).not.toBe("/#pricing");
      expect(href).not.toBe("#");
    }
    const anchors = [...el.querySelectorAll('[data-testid="av-subnav"] a')].map((a) => a.getAttribute("href")!.slice(1));
    expect(anchors).toEqual(["how", "what", "audit", "pricing", "faq"]);
    for (const id of anchors) expect(el.querySelector(`#${id}`), id).not.toBeNull();
  });

  it("serves every locale, in its own language, with the AI Visibility OG image and a canonical", async () => {
    for (const l of SUPPORTED_LOCALES) {
      const html = await render(l);
      const base = l.startsWith("fr") ? "fr" : l.startsWith("de") ? "de" : "en";
      expect(html).toContain(AV_COPY[base].hero.secondary.replace(/’/g, "&#x27;").replace(/'/g, "&#x27;").slice(0, 10));
      const meta = await generateMetadata(P(l));
      expect(JSON.stringify(meta.openGraph)).toContain("/ai-visibility/og-ai-visibility.png");
      expect(meta.alternates?.canonical).toBe(`https://echorank360.com/${l}/ai-visibility`);
      expect(Object.keys(meta.alternates?.languages ?? {}).length).toBeGreaterThanOrEqual(3);
    }
    expect(JSON.stringify(AV_COPY.de)).not.toContain("ß");
  });
});
