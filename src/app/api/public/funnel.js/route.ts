// GET /api/public/funnel.js?key=ef_<32hex>
//
// The loader an agency pastes onto its own marketing site. It creates one
// iframe pointing at /embed/audit and keeps it the right height. That is all
// it does — no audit logic, no lead capture, no data read.
//
// ── Why this path needs no entry in proxy.ts ────────────────────────────────
// The proxy matcher is  /((?!_next/static|_next/image|favicon.ico|.*\..*).*)  —
// any path containing a dot is excluded from the proxy entirely. "funnel.js"
// contains one, so no auth redirect and no CSRF check ever runs here. That is
// load-bearing and identical to the sibling /api/public/attribution.js: if the
// filename ever loses its extension, this route starts 307-ing to /login for
// every visitor on every agency's site. The POST endpoint it points at,
// /api/public/funnel/audit, has no dot and IS listed in proxy.ts.
//
// ── No database read ────────────────────────────────────────────────────────
// The key is validated for SHAPE only and never looked up, exactly as
// attribution.js does it: this is a cacheable static asset requested once per
// page view, and /api/public/funnel/audit is the authority on whether a key is
// real and whether the calling origin may use it. Serving a loader to a bogus
// key costs a cached 2 KB and gets the sender an iframe that refuses them.
//
// The shape check is also the XSS control. The key is interpolated into the
// JavaScript below and into the iframe URL it builds, so anything that is not
// /^ef_[0-9a-f]{32}$/ is rejected outright.
//
// ── WHITE LABEL: no Echorank string appears in this response ────────────────
// attribution.js opens with an "Echorank360 AI attribution" banner comment.
// This one deliberately does not. The whole product promise here is that the
// agency's visitor sees no trace of us, and view-source on their page is part
// of what a visitor sees. The tests assert the absence.

import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo/constants";
import { FUNNEL_KEY_PATTERN } from "@/lib/funnel/keys";

/** 1 h at the browser, 24 h at the edge. The body changes only when this file does. */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Vanilla ES5-ish browser code. No framework, no bundler, no dependencies.
 *
 * One IIFE with a guard flag keyed on the SPECIFIC key, not a global boolean:
 * an agency running two funnels on one page (a client's audit and their own)
 * is unusual but legitimate, and a plain `if (window.__erFunnel) return` would
 * silently render only the first. Pasting the SAME snippet twice still yields
 * one iframe, which is the case the guard actually exists for.
 */
function loader(key: string, embedUrl: string, endpoint: string): string {
  return `(function () {
  "use strict";

  var KEY = ${JSON.stringify(key)};
  var SRC = ${JSON.stringify(embedUrl)};
  var ENDPOINT = ${JSON.stringify(endpoint)};

  var mounted = window.__auditFunnels || (window.__auditFunnels = {});
  if (mounted[KEY]) return;
  mounted[KEY] = 1;

  /* Where to put it. An explicit container wins; otherwise the iframe lands
     exactly where the <script> tag sits, which is what someone pasting a
     snippet into a page expects. document.currentScript is read SYNCHRONOUSLY
     at top level — it is null once any async callback runs. */
  var script = document.currentScript;
  var target = document.querySelector("[data-audit-funnel=\\"" + KEY + "\\"]") ||
               document.querySelector("[data-audit-funnel]") ||
               (script && script.parentNode);
  if (!target) return;

  var frame = document.createElement("iframe");
  frame.src = SRC;
  frame.title = "Website audit";
  frame.loading = "lazy";
  /* No allow-same-origin: the embed page needs no access to its own origin's
     storage, and withholding it means a hostile response from us could not
     reach the agency's cookies even in principle. Scripts and forms only. */
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups");
  frame.setAttribute("frameborder", "0");
  frame.setAttribute("scrolling", "no");
  frame.style.cssText = "width:100%;border:0;display:block;min-height:320px;overflow:hidden";

  if (script && script.parentNode === target) {
    target.insertBefore(frame, script);
  } else {
    target.appendChild(frame);
  }

  /* The iframe is sandboxed without allow-same-origin, so its document has an
     OPAQUE origin and event.origin arrives as the literal "null" rather than
     ORIGIN. Frame identity is therefore the check that matters here, and it is
     the stronger one anyway: it names one specific window rather than a whole
     host. Replies go back with targetOrigin "*" for the same reason — an
     opaque origin cannot be named — which is safe because postMessage delivers
     to that window and no other. */
  function reply(payload) {
    if (frame.contentWindow) frame.contentWindow.postMessage(payload, "*");
  }

  /**
   * THE AUDIT REQUEST IS ISSUED HERE, ON THE AGENCY'S OWN PAGE, ON PURPOSE.
   *
   * That is what makes the Origin header this sends genuinely the agency's
   * origin — set by the browser, unwritable from script. Issued from inside
   * the iframe instead, it would carry our origin (or "null" under the
   * sandbox), and the allowlist on the server would be checking a value that
   * is identical for every site in the world. The long-form version of this is
   * at the top of src/app/api/public/funnel/audit/route.ts.
   *
   * text/plain keeps it a CORS simple request, so there is no preflight in
   * front of every submission. credentials:"omit" keeps it cookie-free.
   */
  function submit(data) {
    fetch(ENDPOINT + "?key=" + encodeURIComponent(KEY), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ email: data.email, domain: data.domain })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        reply({ t: "audit-funnel:result", k: KEY, status: res.status, data: json });
      });
    }).catch(function () {
      /* Network failure. The widget must say something rather than spin. */
      reply({ t: "audit-funnel:result", k: KEY, status: 0, data: {} });
    });
  }

  window.addEventListener("message", function (event) {
    if (!frame.contentWindow || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.k !== KEY) return;

    /* Height sync. The form is short and the result is tall, so a fixed height
       would either clip the result or leave a hole above the fold. */
    if (data.t === "audit-funnel:height") {
      var h = parseInt(data.h, 10);
      if (isFinite(h) && h > 0 && h < 4000) frame.style.height = h + "px";
      return;
    }

    if (data.t === "audit-funnel:submit") {
      submit({
        email: String(data.email == null ? "" : data.email).slice(0, 254),
        domain: String(data.domain == null ? "" : data.domain).slice(0, 253)
      });
    }
  });
})();
`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const key = new URL(request.url).searchParams.get("key") ?? "";

  if (!FUNNEL_KEY_PATTERN.test(key)) {
    // A comment, not a JSON error. This response is loaded by a <script> tag on
    // a live site; a JSON object parsed as JavaScript throws in the console on
    // every page view. A no-op comment fails silently and is obvious in
    // view-source. Wording carries no brand, per the note at the top.
    return new NextResponse("/* audit funnel: missing or malformed key. */\n", {
      status: 400,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const origin = new URL(SITE_URL).origin;
  const embedUrl = `${origin}/embed/audit?key=${key}`;
  const endpoint = `${origin}/api/public/funnel/audit`;

  return new NextResponse(loader(key, embedUrl, endpoint), {
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
