// tests/locale-app-redirect.test.ts
//
// "/en/dashboard" and "/fr/dashboard" used to 404: the app lives at bare
// paths, the [locale] tree has no such page, and nothing in between redirected.
// The proxy now 308s every /{locale}/<app-route> onto /<app-route>. Driven
// through the real exported middleware, like proxy-dotted-paths.test.ts.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { APP_ROUTE_SEGMENTS, localeAppRedirect } from "@/lib/app-routes";

const ORIGIN = "https://echorank360.com";

async function get(path: string) {
  const req = new NextRequest(new URL(path, ORIGIN), { method: "GET" });
  const res = await proxy(req, undefined as never);
  return {
    status: res?.status ?? 200,
    location: res?.headers.get("location") ?? null,
    setCookie: res?.headers.get("set-cookie") ?? "",
  };
}

const ROUTES = ["/dashboard", "/ai", "/visibility", "/reputation", "/settings", "/billing", "/team"];

describe("308s /{locale}/<app-route> onto the bare app route", () => {
  for (const locale of ["en", "fr"]) {
    it.each(ROUTES)(`/${locale}%s`, async (route) => {
      const res = await get(`/${locale}${route}`);
      expect(res.status).toBe(308);
      expect(res.location).toBe(`${ORIGIN}${route}`);
      expect(res.setCookie).toContain(`echorank_locale=${locale}`);
    });
  }

  it("keeps deeper paths, the query string, and the other locales", async () => {
    expect((await get("/fr/settings/account?tab=2")).location).toBe(
      `${ORIGIN}/settings/account?tab=2`,
    );
    expect((await get("/de-CH/visibility/tools/")).location).toMatch(
      new RegExp(`^${ORIGIN}/visibility/tools/?$`),
    );
    expect((await get("/fr-CA/billing")).status).toBe(308);
  });

  it("sends the bare in-app hub through, but never a public help article", async () => {
    expect((await get("/en/help")).location).toBe(`${ORIGIN}/help`);
    expect(localeAppRedirect("/en/help/how-billing-works")).toBeNull();
    const article = await get("/fr/help/how-billing-works");
    expect(article.location).toBeNull();
  });
});

describe("leaves marketing pages alone", () => {
  it.each(["/en", "/fr/pricing", "/en/reputation-tools", "/fr/free-audit", "/en/ai-visibility"])(
    "%s is not redirected to the app",
    async (path) => {
      expect(localeAppRedirect(path)).toBeNull();
      const res = await get(path);
      expect(res.location).toBeNull();
    },
  );
});

describe("the segment list matches the app", () => {
  it("names every top-level (dashboard) route folder", () => {
    const dir = join(process.cwd(), "src", "app", "(dashboard)");
    const onDisk = readdirSync(dir)
      .filter((f) => statSync(join(dir, f)).isDirectory())
      .sort();
    expect([...APP_ROUTE_SEGMENTS].sort()).toEqual(onDisk);
  });
});
