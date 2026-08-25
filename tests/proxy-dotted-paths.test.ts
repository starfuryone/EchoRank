// The proxy's ANSWER to a dotted first segment, from the real exported
// middleware — not from its helpers.
//
// tests/proxy-static-paths.test.ts covers the classification and the matcher
// string. This suite covers the thing that actually shipped: it imports
// src/proxy.ts's default export, hands it a request, and reads the status off
// the response. It is the offline half of the curl check on :4400.
//
// WHY THIS EXISTS SEPARATELY. The helpers can be right while the middleware is
// wrong — a branch placed after the auth gate instead of before it would pass
// every classification test and still 307 "/wp-login.php" to /login. Only
// calling the exported function can tell those two apart.

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

/** Drive the real middleware. No cookie, so the session is anonymous. */
async function get(path: string) {
  const req = new NextRequest(new URL(path, "https://echorank360.com"), { method: "GET" });
  // The proxy never touches the NextFetchEvent; NextAuth only forwards it.
  const res = await proxy(req, undefined as never);
  return {
    status: res?.status ?? 200,
    location: res?.headers.get("location") ?? null,
    // How Next is told to continue: a rewrite/next carries this header.
    rewrite: res?.headers.get("x-middleware-rewrite") ?? null,
    next: res?.headers.get("x-middleware-next") ?? null,
  };
}

describe("junk with a dotted first segment", () => {
  // The exact URLs from the incident. Each of these rendered the marketing
  // homepage with the junk as its locale and 500'd on the first catalog lookup.
  it.each(["/foo.bar", "/en.php", "/wp-login.php", "/xmlrpc.php", "/index.php", "/.env"])(
    "404s %s",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(404);
      // Not a redirect to /login: the auth gate would 307 these, which is what
      // a dot-free "/wp-login" gets and is wrong for something that can never
      // be a route.
      expect(res.location).toBeNull();
      expect(res.rewrite).toBeNull();
    },
  );

  it("308s to the locale when the rest of the path IS a marketing page", async () => {
    // Identical treatment to "/xx/pricing", which is what the fix was measured
    // against — a bogus first segment does not make the page unreachable.
    const res = await get("/foo.bar/pricing");
    expect(res.status).toBe(308);
    expect(res.location).toBe("https://echorank360.com/en/pricing");
  });
});

describe("real files still reach Next", () => {
  it.each([
    "/sitemap.xml",
    "/robots.txt",
    "/llms.txt",
    "/echorank-logo.svg",
    "/hero.mp4",
    "/og-home.png",
    "/google53f8cfb2ee070790.html",
    "/.well-known/security.txt",
  ])("stands aside for %s", async (path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.next).toBe("1");
    expect(res.location).toBeNull();
    // Nothing was set on the way out. A Set-Cookie here would be the session
    // being refreshed on an asset response, which is what the wrapper in
    // proxy.ts stands in front of auth() to prevent.
    expect(res.rewrite).toBeNull();
  });
});

describe("the paths the fix must not have moved", () => {
  it("leaves a locale homepage alone", async () => {
    const res = await get("/en");
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
  });

  it("still 308s a bogus locale onto English", async () => {
    const res = await get("/xx/pricing");
    expect(res.status).toBe(308);
    expect(res.location).toBe("https://echorank360.com/en/pricing");
  });

  it("still 308s a locale-less marketing path", async () => {
    const res = await get("/about");
    expect(res.status).toBe(308);
    expect(res.location).toBe("https://echorank360.com/en/about");
  });

  it("still rewrites the root to a resolved locale", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.rewrite).toContain("/en");
  });

  it("still sends an anonymous app route to the login page", async () => {
    // The catch-all below the 404 branch is the AUTH GATE, and it must still be
    // reached. A dot-free unknown segment is an app route until the session
    // says otherwise — 404ing it would take the signed-in app down.
    const res = await get("/dashboard");
    expect(res.status).toBe(307);
    expect(res.location).toContain("/login?callbackUrl=%2Fdashboard");
  });

  it("still lets a public path through", async () => {
    expect((await get("/login")).status).toBe(200);
  });
});
