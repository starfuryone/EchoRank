// @vitest-environment jsdom
//
// tests/assistant-pro-ui.test.tsx
//
// The app-UI surfaces: three catalogs, one theme, and no English leaking into
// a French panel.
//
// ── THE LOAD-BEARING TESTS IN THIS FILE ────────────────────────────────────
//
//   THREE CATALOGS, NOT FIVE. DashLocale is en | fr | de-CH. The marketing
//   site has five locales and the pricing page has eight; writing a fourth
//   catalog here produces unreachable code, and writing only one produces an
//   English dashboard for half the customer base.
//
//   NO HARDCODED ENGLISH. The panel is rendered in French and the output is
//   checked for the English strings a copy-paste would leave behind. This is
//   the check that catches a new label added inline instead of to the catalog.
//
//   THE SIDEBAR ROW IS GATED SERVER-SIDE. It appears only when the layout says
//   so, and a plan check that lives in the client is a suggestion.
//
//   BRANDING. Every new file is grepped for the CamelCase spelling.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ASSISTANT_COPY, dashNav, type DashLocale } from "@/lib/i18n/dashboard";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Sidebar } from "@/components/layout/sidebar";

// The sidebar highlights the active row, so it reads usePathname(). Outside a
// router that returns null and the component throws — mocked rather than
// wrapped in a router, because the active-row logic has its own test.
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const ROOT = process.cwd();
const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];

const NEW_FILES = [
  "src/lib/assistant/pro/agent.ts",
  "src/lib/assistant/pro/evidence.ts",
  "src/lib/assistant/pro/http.ts",
  "src/lib/assistant/pro/metrics.ts",
  "src/lib/assistant/pro/precompute.ts",
  "src/lib/assistant/pro/prompt.ts",
  "src/lib/assistant/pro/quota.ts",
  "src/lib/assistant/pro/store.ts",
  "src/lib/assistant/pro/tools.ts",
  "src/components/assistant/AssistantPanel.tsx",
  "src/components/assistant/AssistantWidget.tsx",
  "src/components/assistant/AssistantWidgetLoader.tsx",
  "src/app/(dashboard)/assistant/page.tsx",
  "src/app/(dashboard)/assistant/page-client.tsx",
  "src/app/api/assistant/pro/chat/route.ts",
  "src/app/api/assistant/pro/conversations/route.ts",
  "src/app/api/assistant/pro/conversations/[id]/route.ts",
  "src/infrastructure/queue/workers/assistant-precompute.worker.ts",
  "scripts/assistant-metrics.ts",
];

/** File contents with comments removed, for "this token never appears" checks. */
function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const panel = (locale: DashLocale) =>
  renderToStaticMarkup(
    createElement(AssistantPanel, { c: ASSISTANT_COPY[locale], variant: "page" }),
  );

// ─── Catalog completeness ───────────────────────────────────────────────────

describe("the assistant copy catalog", () => {
  it("exists for exactly the three dashboard locales", () => {
    expect(Object.keys(ASSISTANT_COPY).sort()).toEqual(["de-CH", "en", "fr"]);
  });

  it("has every English key in every locale, with nothing empty", () => {
    const keys = Object.keys(ASSISTANT_COPY.en) as (keyof typeof ASSISTANT_COPY.en)[];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = ASSISTANT_COPY[locale][key];
        expect(value, `${locale}.${key}`).toBeDefined();
        if (typeof value === "string") {
          expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
        } else {
          expect(Array.isArray(value), `${locale}.${key}`).toBe(true);
          expect((value as string[]).length, `${locale}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps the product name untranslated and never CamelCase", () => {
    for (const locale of LOCALES) {
      expect(ASSISTANT_COPY[locale].heading).toBe("Echorank Intelligence");
      expect(JSON.stringify(ASSISTANT_COPY[locale])).not.toMatch(/EchoRank/);
    }
  });

  it("writes Swiss German with ss, never ß", () => {
    expect(JSON.stringify(ASSISTANT_COPY["de-CH"])).not.toMatch(/ß/);
    // And it does actually use ss where German would use ß.
    expect(ASSISTANT_COPY["de-CH"].closeLabel).toContain("schliessen");
  });

  it("keeps the usage templates' placeholders intact in every locale", () => {
    for (const locale of LOCALES) {
      expect(ASSISTANT_COPY[locale].usageTemplate, locale).toContain("{used}");
      expect(ASSISTANT_COPY[locale].usageTemplate, locale).toContain("{limit}");
      expect(ASSISTANT_COPY[locale].usageUnmetered, locale).toContain("{used}");
    }
  });
});

// ─── Rendering ──────────────────────────────────────────────────────────────

describe("the panel renders in the reader's language", () => {
  it("renders French copy, not English", () => {
    const html = panel("fr");
    expect(html).toContain("Envoyer");
    expect(html).toContain(ASSISTANT_COPY.fr.emptyTitle);
    expect(html).toContain(ASSISTANT_COPY.fr.placeholder);
  });

  it("leaves no hardcoded English in the French render", () => {
    // The regression this catches: a new label written inline in the component
    // instead of added to the catalog. It renders fine in English and is
    // invisible until a French customer opens the panel.
    const html = panel("fr");
    for (const english of [
      ASSISTANT_COPY.en.send,
      ASSISTANT_COPY.en.emptyTitle,
      ASSISTANT_COPY.en.placeholder,
      ASSISTANT_COPY.en.refresh,
      ASSISTANT_COPY.en.you,
    ]) {
      expect(html, english).not.toContain(english);
    }
  });

  it("renders Swiss German copy", () => {
    const html = panel("de-CH");
    expect(html).toContain(ASSISTANT_COPY["de-CH"].send);
    expect(html).toContain(ASSISTANT_COPY["de-CH"].emptyTitle);
    expect(html).not.toMatch(/ß/);
  });

  it("shows the heading in every locale", () => {
    for (const locale of LOCALES) {
      expect(panel(locale)).toContain("Echorank Intelligence");
    }
  });

  it("uses the light dashboard theme, never the marketing tokens", () => {
    // Comments STRIPPED before the check: this file's own header names the
    // tokens it avoids, and a grep over the prose would fail on the
    // documentation rather than on the code.
    const code = codeOf("src/components/assistant/AssistantPanel.tsx");
    // The dark marketing palette lives on src/app/[locale]/** and stays there.
    for (const token of ["#181A20", "#1E2329", "#FCD535", "home2.module.css", "--gold"]) {
      expect(code, token).not.toContain(token);
    }
    expect(panel("en")).toContain("bg-gray-50");
  });

  it("renders the model's answer as text, never as HTML", () => {
    // "We render the model's markdown" is a cross-site-scripting hole with
    // extra steps: the answer is untrusted output by construction.
    expect(codeOf("src/components/assistant/AssistantPanel.tsx")).not.toContain(
      "dangerouslySetInnerHTML",
    );
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

describe("the sidebar entry", () => {
  it("is labelled in all three catalogs", () => {
    for (const locale of LOCALES) {
      expect(dashNav[locale]["/assistant"], locale).toBeTruthy();
    }
    expect(dashNav.en["/assistant"]).toBe("AI Assistant");
    expect(dashNav.fr["/assistant"]).toBe("Assistant IA");
    expect(dashNav["de-CH"]["/assistant"]).toBe("KI-Assistent");
  });

  it("is hidden when the server says the tenant does not qualify", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, { locale: "en", paid: true, assistantVisible: false }),
    );
    expect(html).not.toContain('href="/assistant"');
    expect(html).not.toContain("AI Assistant");
  });

  it("shows no upsell teaser in its place", () => {
    // This phase ships no upsell surface: a non-qualifying tenant sees nothing,
    // not a locked row with a buy button.
    const html = renderToStaticMarkup(
      createElement(Sidebar, { locale: "en", paid: false, assistantVisible: false }),
    );
    expect(html).not.toMatch(/assistant/i);
  });

  it("appears when the server says it qualifies", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, { locale: "en", paid: true, assistantVisible: true }),
    );
    expect(html).toContain('href="/assistant"');
    expect(html).toContain("AI Assistant");
  });

  it("is gated separately from the SEO Tools hub", () => {
    // The two kill-switch envs can hide the assistant while the tenant is
    // still fully paid, so `paid` alone must not bring the row back.
    const html = renderToStaticMarkup(
      createElement(Sidebar, { locale: "fr", paid: true, assistantVisible: false }),
    );
    expect(html).not.toContain('href="/assistant"');
  });
});

// ─── Gating lives on the server ─────────────────────────────────────────────

describe("the gate is server-derived", () => {
  const layout = readFileSync(join(ROOT, "src", "app", "(dashboard)", "layout.tsx"), "utf8");

  it("computes visibility from the plan and both kill switches", () => {
    expect(layout).toContain("assistantEnabled()");
    expect(layout).toContain("assistantLinkVisible()");
    expect(layout).toMatch(/const assistantVisible = paid &&/);
  });

  it("mounts the widget once, in the layout, and only when visible", () => {
    expect(layout).toContain("AssistantWidgetLoader");
    expect(layout).toMatch(/\{assistantVisible && \(/);
  });

  it("lazy-loads the widget so the dashboard bundle does not carry it", () => {
    const loader = readFileSync(
      join(ROOT, "src", "components", "assistant", "AssistantWidgetLoader.tsx"),
      "utf8",
    );
    expect(loader).toContain("next/dynamic");
    expect(loader).toContain("ssr: false");
  });

  it("redirects rather than rendering a locked page", () => {
    const page = readFileSync(
      join(ROOT, "src", "app", "(dashboard)", "assistant", "page.tsx"),
      "utf8",
    );
    expect(page).toContain("redirect(");
    expect(page).toContain("hasPaidPlan");
  });
});

// ─── Branding ───────────────────────────────────────────────────────────────

describe("branding", () => {
  it("writes Echorank, never EchoRank, in every new file", () => {
    for (const file of NEW_FILES) {
      expect(readFileSync(join(ROOT, file), "utf8"), file).not.toMatch(/EchoRank/);
    }
  });

  it("keeps the CamelCase spelling out of the copy catalog and the prompt", () => {
    const prompt = readFileSync(join(ROOT, "src", "lib", "assistant", "pro", "prompt.ts"), "utf8");
    expect(prompt).not.toMatch(/EchoRank/);
    // And the prompt tells the model the rule, since the model writes copy too.
    expect(prompt).toMatch(/never with a capital letter\s+in the\s+middle/i);
  });
});
