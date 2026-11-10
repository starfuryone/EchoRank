// @vitest-environment jsdom
//
// The llms.txt Generator links (2026-11-10): the footer's "Other services"
// group on every public footer (shared, React clones, static route-handler
// payloads) and one Resources › More item in PublicNav, desktop and mobile,
// in en / fr / de-CH, with their UTM tags, and no claim about AI citations.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/en", useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));

import { PublicNav } from "@/app/[locale]/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { OTHER_SERVICES_COPY, STATIC_FOOTER_HTML, llmsTxtGeneratorHref } from "@/lib/other-services";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const LOCALES = [
  ["en", "en"],
  ["fr", "fr"],
  ["de-CH", "de-CH"],
] as const;
const MENU = "https://llmstxt.echorank360.com/llms-txt-generator?utm_source=echorank360.com&amp;utm_medium=menu";
const FOOTER = "https://llmstxt.echorank360.com/llms-txt-generator?utm_source=echorank360.com&amp;utm_medium=footer";

describe("PublicNav: Resources › More", () => {
  it.each(LOCALES)("%s: one llms.txt link, the menu UTM, its label and description, same tab", (locale, base) => {
    const html = renderToStaticMarkup(createElement(PublicNav, { locale }));
    expect(html.split("llmstxt.echorank360.com").length - 1).toBe(1);
    expect(html).toContain(`href="${MENU}"`);
    expect(html).toContain(OTHER_SERVICES_COPY[base].menuLabel);
    expect(html).toContain(OTHER_SERVICES_COPY[base].menuDesc.replace(/'/g, "&#x27;"));
    const tag = html.slice(html.lastIndexOf("<a", html.indexOf(MENU)), html.indexOf(">", html.indexOf(MENU)));
    expect(tag).not.toContain("target=");
    // Not locale-prefixed.
    expect(html).not.toContain(`/${locale}/https://`);
  });

  it("the mobile sheet lists it under Resources too", () => {
    render(createElement(PublicNav, { locale: "en" }));
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Resources/ }));
    const link = within(sheet).getByRole("link", { name: OTHER_SERVICES_COPY.en.menuLabel });
    expect(link.getAttribute("href")).toBe(llmsTxtGeneratorHref("menu"));
  });
});

describe("the footer's Other services group", () => {
  it.each(LOCALES)("%s: heading, label, line and the footer UTM in PublicFooter", (locale, base) => {
    const html = renderToStaticMarkup(createElement(PublicFooter, { locale }));
    const c = OTHER_SERVICES_COPY[base];
    for (const s of [c.heading, c.footerLabel, c.footerLine]) expect(html).toContain(s);
    expect(html).toContain(`href="${FOOTER}"`);
  });

  it("de-CH and fr wording as briefed", () => {
    expect(OTHER_SERVICES_COPY.fr).toMatchObject({ heading: "Autres services", footerLine: "Générateur et validateur llms.txt gratuits" });
    expect(OTHER_SERVICES_COPY["de-CH"]).toMatchObject({ heading: "Weitere Dienste", footerLine: "Kostenloser llms.txt-Generator und -Validator" });
    expect(JSON.stringify(OTHER_SERVICES_COPY["de-CH"])).not.toContain("ß");
  });

  it("every React footer clone renders it", () => {
    for (const f of [
      "src/app/[locale]/HomeClient.tsx",
      "src/app/[locale]/guide/page.tsx",
      "src/app/[locale]/customer-feedback/page.tsx",
      "src/app/[locale]/how-to/page.tsx",
      "src/app/[locale]/guide-visibilite-ia/en.tsx",
      "src/app/[locale]/guide-visibilite-ia/page.tsx",
      "src/app/[locale]/live-monitoring/page.tsx",
      "src/app/[locale]/reputation-engine/page.tsx",
      "src/app/[locale]/act-on-signals/page.tsx",
      "src/app/[locale]/reputation-risk/page.tsx",
      "src/components/PublicFooter.tsx",
    ]) {
      expect(read(f), f).toMatch(/<OtherServices locale=\{locale\} \/>\s*<CompanyLine \/>/);
    }
  });

  it("every static route-handler payload carries the group, exactly once, inside its footer", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/(landing|library)-html\.ts$/.test(n)) files.push(p);
      }
    };
    walk(join(ROOT, "src/app/[locale]"));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src.split(STATIC_FOOTER_HTML).length - 1, f).toBe(1);
      expect(src.indexOf(STATIC_FOOTER_HTML), f).toBeLessThan(src.lastIndexOf("</footer>"));
      expect(src.indexOf(STATIC_FOOTER_HTML), f).toBeGreaterThan(src.lastIndexOf("<footer"));
    }
  });

  it("wraps at 320 px: a full-width block that may break long text, nothing fixed-width", () => {
    // jsdom does no layout; this pins the rules that keep it from scrolling sideways.
    const html = renderToStaticMarkup(createElement(PublicFooter, { locale: "de-CH" }));
    const group = html.slice(html.indexOf('data-testid="footer-other-services"') - 6);
    expect(group).toMatch(/flex-basis:100%;min-width:0;max-width:100%/);
    expect(group).toContain("overflow-wrap:anywhere");
    expect(group.slice(0, 400)).not.toMatch(/width:\s*\d+px|white-space:\s*nowrap/);
    expect(STATIC_FOOTER_HTML).toContain("min-width:0");
    expect(STATIC_FOOTER_HTML).toContain("overflow-wrap:anywhere");
  });
});

describe("no claims", () => {
  it("names a generator and validator, and promises nothing about citations or rankings", () => {
    const all = JSON.stringify(OTHER_SERVICES_COPY) + STATIC_FOOTER_HTML;
    expect(all).not.toMatch(/citation|cited|\brank(s|ing|ings)?\b|classement|visibility|visibilité|Sichtbarkeit|AI answers|ChatGPT/i);
  });
});
