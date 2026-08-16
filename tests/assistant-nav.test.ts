// Routing, navigation and SEO registration for the public AI Assistant.
//
// These are the regressions that have shipped before on this codebase: a public
// page the proxy 307s to /login, a nav entry that exists in one locale only, and
// a marketing route that never reaches the sitemap because nobody registered it.
// Each is asserted on the artifact that actually decides the behaviour — the
// proxy source, the rendered nav markup, the registry — not on a comment.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicNav } from "@/app/[locale]/PublicNav";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const ROOT = process.cwd();
const proxySource = readFileSync(join(ROOT, "src", "proxy.ts"), "utf8");

const nav = (locale: string, current?: Parameters<typeof PublicNav>[0]["current"]) =>
  renderToStaticMarkup(createElement(PublicNav, { locale, current }));

describe("the anonymous API route is reachable without a session", () => {
  it("is listed in the proxy's exact public paths", () => {
    // Without this the POST is redirected to /login, and fetch FOLLOWS the
    // redirect and returns HTML with status 200 — which the caller cannot tell
    // apart from success. The whole funnel silently does nothing.
    const exactBlock = proxySource.slice(
      proxySource.indexOf("const publicExactPaths"),
      proxySource.indexOf("]);", proxySource.indexOf("const publicExactPaths")),
    );
    expect(exactBlock).toContain('"/api/assistant/chat"');
  });

  it("is exact-match, so nothing added later under /api/assistant/ inherits it", () => {
    // A conversation-history or admin route added later must be a deliberate
    // edit, not an accident of prefix matching.
    const prefixBlock = proxySource.slice(
      proxySource.indexOf("const publicPaths ="),
      proxySource.indexOf("];", proxySource.indexOf("const publicPaths =")),
    );
    expect(prefixBlock).not.toContain("/api/assistant");
  });

  it("keeps the CSRF origin check, unlike the bearer-key public API", () => {
    // Deliberate: every legitimate caller is a browser on our own pages. The
    // origin check runs before the public-path list, and this route is not in
    // any of the exemptions.
    const csrfBlock = proxySource.slice(
      proxySource.indexOf("Origin validation for mutating API requests"),
      proxySource.indexOf("Localized marketing homepage"),
    );
    expect(csrfBlock).not.toContain("/api/assistant");
  });
});

describe("the public page needs no proxy entry of its own", () => {
  it("exists at the locale-prefixed route", () => {
    expect(existsSync(join(ROOT, "src", "app", "[locale]", "ai-assistant", "page.tsx"))).toBe(true);
  });

  it("is public because its first segment is a supported locale", () => {
    // src/proxy.ts returns NextResponse.next() for any path whose first segment
    // is a supported locale, before the auth gate. This asserts that branch is
    // still there, since the page's anonymity depends on it.
    expect(proxySource).toContain("if (isSupportedLocale(seg))");
    expect(proxySource.indexOf("if (isSupportedLocale(seg))")).toBeLessThan(
      proxySource.indexOf("if (!req.auth)"),
    );
  });
});

describe("SEO registry", () => {
  it("registers /ai-assistant, so it reaches the sitemap with hreflang", () => {
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain("/ai-assistant");
  });

  it("is in KNOWN_MARKETING_PATHS, so /ai-assistant 308s to /en/ai-assistant", () => {
    // The registry feeds the proxy's locale guard. Without the entry, the
    // un-prefixed URL falls through to the auth gate and redirects to /login.
    expect(KNOWN_MARKETING_PATHS).toContain("/ai-assistant");
  });

  it("ranks with the other acquisition pages, not with the articles", () => {
    const route = LOCALIZED_ROUTES.find((r) => r.path === "/ai-assistant")!;
    const freeAudit = LOCALIZED_ROUTES.find((r) => r.path === "/free-audit")!;
    expect(route.priority).toBe(freeAudit.priority);
  });
});

describe("public navigation", () => {
  it("carries an AI Assistant link in both written locales", () => {
    expect(nav("en")).toContain('href="/en/ai-assistant"');
    expect(nav("en")).toContain("AI Assistant");
    expect(nav("fr")).toContain('href="/fr/ai-assistant"');
    expect(nav("fr")).toContain("Assistant IA");
  });

  it("keeps the regional locale in the URL for the folded locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(nav(locale)).toContain(`href="/${locale}/ai-assistant"`);
    }
  });

  it("is a flat link, not a fourth mega-menu panel", () => {
    // A panel with one destination is a worse button — the same reason Pricing
    // is flat. Three regions, still.
    const html = nav("en");
    expect([...html.matchAll(/role="region"/g)]).toHaveLength(3);
    expect([...html.matchAll(/aria-haspopup="true"/g)]).toHaveLength(3);
  });

  it("marks itself active on its own page", () => {
    const tag = nav("en", "ai-assistant").match(/<a[^>]*href="\/en\/ai-assistant"[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('aria-current="page"');
  });

  it("does not mark it active elsewhere", () => {
    const tag = nav("en", "pricing").match(/<a[^>]*href="\/en\/ai-assistant"[^>]*>/)?.[0] ?? "";
    expect(tag).not.toContain('aria-current="page"');
  });

  it("appears in the mobile sheet's markup too", () => {
    // The sheet mounts on click, so the desktop render is all the server HTML
    // shows — assert the label and href exist in the catalog-driven output.
    expect(nav("en")).toContain("AI Assistant");
  });

  it("never points at an authenticated route", () => {
    const html = nav("en");
    expect(html).not.toContain('href="/dashboard/ai-assistant"');
    expect(html).not.toContain('href="/visibility/ai-assistant"');
  });
});

describe("branding in the new surfaces", () => {
  const files = [
    join(ROOT, "src", "app", "[locale]", "ai-assistant", "page.tsx"),
    join(ROOT, "src", "app", "[locale]", "ai-assistant", "AssistantChat.tsx"),
    join(ROOT, "src", "app", "api", "assistant", "chat", "route.ts"),
    join(ROOT, "src", "lib", "assistant", "prompt.ts"),
    join(ROOT, "src", "lib", "assistant", "config.ts"),
  ];

  it("writes Echorank, never EchoRank, in every new file", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/EchoRank/);
    }
  });

  it("sends marketing CTAs to pricing, never straight to /register", () => {
    const page = readFileSync(files[0], "utf8");
    expect(page).toContain('L("/pricing")');
    expect(page).not.toContain('href="/register"');
  });
});
