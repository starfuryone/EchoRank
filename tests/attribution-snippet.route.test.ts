// GET /api/public/attribution.js — the measurement snippet.
//
// The route interpolates a caller-supplied key into JavaScript it serves to
// third-party sites, so the key format check is a security control and not a
// nicety. That is most of what this file asserts.

import { describe, expect, it } from "vitest";

const { GET } = await import("@/app/api/public/attribution.js/route");

const VALID = `er_pub_${"a".repeat(24)}.${"1".repeat(48)}`;

function get(query: string): Request {
  return new Request(`https://echorank360.com/api/public/attribution.js${query}`);
}

describe("key format is the injection boundary", () => {
  it.each([
    ["no key at all", ""],
    ["empty key", "?key="],
    ["an er_api_ key", `?key=er_api_${"a".repeat(24)}.${"1".repeat(48)}`],
    ["wrong length", "?key=er_pub_abc.def"],
    ["non-hex segments", `?key=er_pub_${"z".repeat(24)}.${"1".repeat(48)}`],
    ["a script tag", '?key=er_pub_a";alert(1);//'],
    ["a quote-and-break", `?key=${encodeURIComponent('er_pub_x"; fetch("//evil");//')}`],
  ])("rejects %s", async (_name, query) => {
    const res = await GET(get(query));
    expect(res.status).toBe(400);
    const body = await res.text();
    // A comment, not JSON: this response is executed by a <script> tag on a
    // live site, and a JSON body parsed as JS throws on every page view.
    expect(body.startsWith("/*")).toBe(true);
    expect(body).not.toContain("alert");
    expect(body).not.toContain("evil");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves the snippet for a well-formed key", async () => {
    const res = await GET(get(`?key=${VALID}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/javascript");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toContain("max-age=");
  });
});

describe("the snippet body", () => {
  it("carries the key, the collect endpoint, and the cookie contract", async () => {
    const body = await (await GET(get(`?key=${VALID}`))).text();
    expect(body).toContain(VALID);
    expect(body).toContain("/api/collect");
    expect(body).toContain("er_vid");
    expect(body).toContain("SameSite=Lax");
    expect(body).toContain("sendBeacon");
  });

  it("inlines the source list so the browser can skip non-AI traffic", async () => {
    const body = await (await GET(get(`?key=${VALID}`))).text();
    for (const host of ["chatgpt.com", "perplexity.ai", "gemini.google.com", "claude.ai"]) {
      expect(body).toContain(host);
    }
  });

  it("never sends the client's own verdict — only the raw referrer and URL", async () => {
    // The server re-classifies. If the payload ever grows a source field this
    // assertion is the thing that says so out loud.
    const body = await (await GET(get(`?key=${VALID}`))).text();
    const payload = body.slice(body.indexOf("var payload"), body.indexOf("/* text/plain"));
    expect(payload).toContain("k: KEY");
    expect(payload).toContain("u: here");
    expect(payload).toContain("r: ref");
    expect(payload).not.toContain("source");
  });

  it("guards against being included twice", async () => {
    const body = await (await GET(get(`?key=${VALID}`))).text();
    expect(body).toContain("__erAttr");
  });
});
