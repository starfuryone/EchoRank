// GET /api/public/attribution.js?key=er_pub_<id>.<secret>
//
// Serves the measurement snippet the customer embeds on their own site.
//
// ── Why this path needs no entry in proxy.ts ────────────────────────────────
// The proxy matcher is  /((?!_next/static|_next/image|favicon.ico|.*\..*).*)  —
// any path containing a dot is excluded from the proxy entirely. "attribution.js"
// contains one, so no auth redirect and no CSRF check ever runs here. That is
// load-bearing, not incidental: if the filename ever loses its extension this
// route silently starts 307-ing to /login for every visitor on every customer
// site. The sibling POST /api/collect has no dot and IS listed in proxy.ts.
//
// ── No database read ────────────────────────────────────────────────────────
// The key is validated for SHAPE only and never looked up. Two reasons: this is
// a cacheable static asset requested once per page view across every customer
// site, and /api/collect is the authority on whether a key is real. Serving the
// snippet to a bogus key costs us a cached 2 KB and gets the sender nothing.
//
// The shape check is also the XSS control. The key is interpolated into the
// JavaScript we return, so anything that is not /^er_pub_[0-9a-f]{24}\.[0-9a-f]{48}$/
// is rejected outright — there is no reachable path by which caller-controlled
// text reaches the response body.

import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo/constants";
import { ATTRIBUTION_KEY_PATTERN } from "@/lib/attribution/keys";
import {
  AMBIGUOUS_HOST_QUERY_FLAGS,
  MARKER_PARAMS,
  OTHER_AI_HOSTS,
  OTHER_AI_MARKERS,
  SOURCE_RULES,
  UTM_PARAMS,
} from "@/lib/attribution/sources";

/** 1 h at the browser, 24 h at the edge. The body only changes when the list does. */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * The classification list, inlined for the browser copy.
 *
 * The snippet classifies client-side ONLY so it can skip the beacon on plainly
 * non-AI traffic — which is most traffic, and sending it would be a request per
 * page view for nothing. The verdict it computes is never transmitted and never
 * trusted: /api/collect re-runs classifyReferrer() on the referrer and URL and
 * stores its own answer.
 */
function inlinedSourceData(): string {
  return JSON.stringify({
    rules: SOURCE_RULES.map((r) => ({
      s: r.source,
      h: r.hosts,
      m: r.markers,
      a: (r.ambiguousHosts ?? []).map((x) => ({ h: x.host, p: x.aiPathPrefixes })),
    })),
    flags: AMBIGUOUS_HOST_QUERY_FLAGS,
    otherHosts: OTHER_AI_HOSTS,
    otherMarkers: OTHER_AI_MARKERS,
    markerParams: MARKER_PARAMS,
    utmParams: UTM_PARAMS,
  });
}

/**
 * Vanilla ES5-ish browser code. No framework, no bundler, no dependencies, and
 * nothing that needs a polyfill in a browser new enough to run sendBeacon.
 *
 * Everything is inside one IIFE with a guard flag, so a customer who pastes the
 * tag into both their header and their tag manager gets one beacon, not two.
 */
function snippet(key: string, endpoint: string): string {
  return `/* Echorank360 AI attribution. Docs: ${SITE_URL}/visibility/tools/ai-attribution */
(function () {
  "use strict";
  if (window.__erAttr) return;
  window.__erAttr = 1;

  var KEY = ${JSON.stringify(key)};
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var D = ${inlinedSourceData()};
  var COOKIE = "er_vid";
  var COOKIE_DAYS = 90;

  function host(u) {
    try {
      var h = new URL(u).hostname.toLowerCase();
      return h.indexOf("www.") === 0 ? h.slice(4) : h;
    } catch (e) { return ""; }
  }
  function matches(h, c) { return h === c || h.slice(-(c.length + 1)) === "." + c; }
  function url(u) { try { return new URL(u); } catch (e) { return null; } }

  /* Mirror of classifyReferrer() in src/lib/attribution/classify.ts, INCLUDING
     its ordering: unambiguous hosts before ambiguous ones, because a rule host
     can be a subdomain of an ambiguous host (edgeservices.bing.com is Copilot
     and is also under bing.com) and the vaguer entry would otherwise swallow
     it. A referrer beats a marker; an ambiguous host that fails its path and
     query test is final, not a fall-through.

     This copy only decides whether to SEND. The server re-classifies. */
  function classify(ref, here) {
    var rh = host(ref), lh = host(here), r = url(ref), l = url(here);
    var usable = rh && (!lh || rh !== lh), i, j, k;
    if (usable) {
      for (i = 0; i < D.rules.length; i++)
        for (j = 0; j < D.rules[i].h.length; j++)
          if (matches(rh, D.rules[i].h[j])) return D.rules[i].s;
      for (i = 0; i < D.rules.length; i++) {
        for (j = 0; j < D.rules[i].a.length; j++) {
          var amb = D.rules[i].a[j];
          if (!matches(rh, amb.h)) continue;
          var p = (r ? r.pathname : "").toLowerCase();
          for (k = 0; k < amb.p.length; k++) if (p.indexOf(amb.p[k]) === 0) return D.rules[i].s;
          var f = D.flags[amb.h];
          if (f && r) for (k = 0; k < f.params.length; k++) if (r.searchParams.has(f.params[k])) return f.source;
          return null;
        }
      }
      for (i = 0; i < D.otherHosts.length; i++) if (matches(rh, D.otherHosts[i])) return "dark_ai";
      return null;
    }
    if (!l) return null;
    for (i = 0; i < D.markerParams.length; i++) {
      var v = l.searchParams.get(D.markerParams[i]);
      if (!v) continue;
      v = v.trim().toLowerCase();
      if (!v) continue;
      for (j = 0; j < D.rules.length; j++)
        if (D.rules[j].m.indexOf(v) !== -1) return D.rules[j].s;
      if (D.otherMarkers.indexOf(v) !== -1) return "dark_ai";
    }
    return null;
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + COOKIE_DAYS * 864e5);
    /* First-party on the CUSTOMER's domain. SameSite=Lax so it survives the
       top-level navigation from the assistant; Secure because every site we
       measure is https. No cross-site read is possible and none is wanted. */
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      ";expires=" + d.toUTCString() +
      ";path=/;SameSite=Lax" + (location.protocol === "https:" ? ";Secure" : "");
  }
  function visitorId() {
    var v = readCookie(COOKIE);
    /* Random and opaque. Not derived from anything about the visitor. */
    if (!v || !/^[0-9a-f]{32}$/.test(v)) {
      v = "";
      if (window.crypto && crypto.getRandomValues) {
        var b = new Uint8Array(16);
        crypto.getRandomValues(b);
        for (var i = 0; i < b.length; i++) v += (b[i] + 256).toString(16).slice(1);
      } else {
        while (v.length < 32) v += Math.floor(Math.random() * 16).toString(16);
      }
    }
    writeCookie(COOKIE, v);
    return v;
  }

  function send() {
    var here = location.href;
    var ref = document.referrer || "";
    /* Client-side verdict is a FILTER, not an answer. Nothing below sends it. */
    if (!classify(ref, here)) return;

    var payload = JSON.stringify({
      k: KEY,
      v: visitorId(),
      u: here,
      r: ref
    });

    /* text/plain keeps this a CORS "simple request": no preflight, and the
       beacon survives the page unloading. */
    try {
      if (navigator.sendBeacon &&
          navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain;charset=UTF-8" }))) {
        return;
      }
    } catch (e) { /* fall through */ }

    try {
      fetch(ENDPOINT, {
        method: "POST",
        body: payload,
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
      }).catch(function () {});
    } catch (e) { /* measurement must never break the host page */ }
  }

  try { send(); } catch (e) { /* ditto */ }
})();
`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const key = new URL(request.url).searchParams.get("key") ?? "";

  if (!ATTRIBUTION_KEY_PATTERN.test(key)) {
    // Deliberately a comment, not a 400 with a body: this response is loaded by
    // a <script> tag on someone's live site, and a JSON error object parsed as
    // JavaScript throws a console error on every page view. A no-op comment
    // fails silently on their side and is visible immediately in view-source.
    return new NextResponse("/* Echorank360: missing or malformed key. */\n", {
      status: 400,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new NextResponse(snippet(key, `${SITE_URL}/api/collect`), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      // Loaded cross-origin by design; the body is public and identical for
      // every requester with the same key.
      "Access-Control-Allow-Origin": "*",
      Vary: "Accept-Encoding",
    },
  });
}
