// src/lib/attribution/classify.ts
//
// The matching engine for AI referral detection. Knows the SHAPE of a rule and
// nothing about any individual assistant — every assistant-specific fact lives
// in sources.ts. This module is the authority: the browser snippet classifies
// too, but only so it can skip the beacon on obvious non-AI traffic, and the
// server never reads the client's verdict.
//
// ── Precedence, and why ─────────────────────────────────────────────────────
//
// 1. A usable referrer WINS OUTRIGHT. If the browser tells us the visitor came
//    from example.com, they came from example.com, and no query parameter gets
//    to overrule that. This is what stops a mis-tagged campaign
//    (?utm_source=chatgpt on a Facebook ad) from inventing AI traffic, and it
//    is the whole reason ambiguous hosts return a definitive "not AI" instead
//    of falling through.
//
// 2. Only when there is no usable referrer — stripped by the assistant, an app
//    webview, a privacy policy, or a same-origin internal navigation — do the
//    query markers get a say. That is exactly the case they exist for: the
//    ChatGPT desktop app sends no referrer and decorates the link instead.
//
// 3. Nothing else is a signal. No referrer and no marker is direct traffic, and
//    direct traffic is not evidence of anything. We return null rather than
//    guess, because a fabricated attribution is worse than a missing one.

import {
  AMBIGUOUS_HOST_QUERY_FLAGS,
  MARKER_PARAMS,
  OTHER_AI_HOSTS,
  OTHER_AI_MARKERS,
  SOURCE_RULES,
  UTM_PARAMS,
  type AiVisitSource,
  type UtmParam,
} from "./sources";

export type ClassificationVia =
  | "referrer_host"
  | "referrer_path"
  | "referrer_query"
  | "marker"
  | null;

export interface Classification {
  /** null = not AI traffic. Never guessed. */
  source: AiVisitSource | null;
  /** Which signal decided it. Useful in tests and in support conversations. */
  via: ClassificationVia;
}

const NOT_AI: Classification = { source: null, via: null };

/** Lowercase, drop a leading "www.". Returns "" for anything unparseable. */
function normalizeHost(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

/** Host itself, or any subdomain of it. "openai.com" ⊃ "chat.openai.com". */
function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

function safeUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export interface ClassifyInput {
  /** document.referrer, as sent by the browser. May be "" or absent. */
  referrer?: string | null;
  /** The landing URL, absolute. Query string is read for utm/ref markers. */
  landingUrl?: string | null;
}

/**
 * Classify one visit. Pure — no I/O, no clock, no environment.
 */
export function classifyReferrer(input: ClassifyInput): Classification {
  const landing = safeUrl(input.landingUrl);
  const referrer = safeUrl(input.referrer);
  const referrerHost = normalizeHost(input.referrer);
  const landingHost = normalizeHost(input.landingUrl);

  // A same-origin referrer is an internal navigation, not an arrival. Treat it
  // as no referrer so the markers still in the URL can speak.
  const hasUsableReferrer =
    referrerHost.length > 0 && (landingHost.length === 0 || referrerHost !== landingHost);

  if (hasUsableReferrer) {
    // ── Unambiguous hosts first ─────────────────────────────────────────
    // This pass MUST precede the ambiguous one. A rule host can be a subdomain
    // of an ambiguous host — edgeservices.bing.com is definitely Copilot and is
    // also a subdomain of the ambiguous bing.com — and running ambiguity first
    // lets the vaguer entry swallow the specific one and answer "not AI".
    // Safe in the other direction because ambiguous hosts are, by construction,
    // absent from every `hosts` list: a host that appears there is one where the
    // hostname alone settles it.
    for (const rule of SOURCE_RULES) {
      if (rule.hosts.some((host) => hostMatches(referrerHost, host))) {
        return { source: rule.source, via: "referrer_host" };
      }
    }

    // ── Then the ambiguous ones ─────────────────────────────────────────
    // Hosts that serve an assistant and a non-assistant from the same hostname,
    // so the host proves nothing and the path/query has to decide. A miss here
    // is FINAL: bing.com/search is ordinary search, and falling through to the
    // marker check would let a query parameter relabel it.
    for (const rule of SOURCE_RULES) {
      for (const ambiguous of rule.ambiguousHosts ?? []) {
        if (!hostMatches(referrerHost, ambiguous.host)) continue;

        const path = (referrer?.pathname ?? "").toLowerCase();
        if (ambiguous.aiPathPrefixes.some((prefix) => path.startsWith(prefix))) {
          return { source: rule.source, via: "referrer_path" };
        }

        const flags = AMBIGUOUS_HOST_QUERY_FLAGS[ambiguous.host];
        if (flags && referrer && flags.params.some((p) => referrer.searchParams.has(p))) {
          return { source: flags.source, via: "referrer_query" };
        }

        // Known host, no AI evidence on it. Ordinary traffic, full stop.
        return NOT_AI;
      }
    }

    if (OTHER_AI_HOSTS.some((host) => hostMatches(referrerHost, host))) {
      return { source: "dark_ai", via: "referrer_host" };
    }

    // A real referrer that is not an assistant. Not AI, and the markers do not
    // get to argue with the browser.
    return NOT_AI;
  }

  // ── No usable referrer: markers may speak ──────────────────────────────
  if (!landing) return NOT_AI;

  for (const param of MARKER_PARAMS) {
    const raw = landing.searchParams.get(param);
    if (!raw) continue;
    const value = raw.trim().toLowerCase();
    if (!value) continue;

    for (const rule of SOURCE_RULES) {
      if (rule.markers.includes(value)) return { source: rule.source, via: "marker" };
    }
    if (OTHER_AI_MARKERS.includes(value)) return { source: "dark_ai", via: "marker" };
  }

  return NOT_AI;
}

/**
 * The utm_* parameters present on the landing URL, verbatim. Absent keys are
 * omitted rather than stored as null, so the jsonb column stays small and a
 * missing tag is distinguishable from an empty one.
 */
export function extractUtm(landingUrl: string | null | undefined): Partial<Record<UtmParam, string>> {
  const url = safeUrl(landingUrl);
  if (!url) return {};
  const utm: Partial<Record<UtmParam, string>> = {};
  for (const key of UTM_PARAMS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) utm[key] = value.slice(0, 200);
  }
  return utm;
}

/**
 * Path of the landing URL, without query or fragment, capped. This is what the
 * landing-pages table groups by, so it has to be stable: "/pricing?utm_source=x"
 * and "/pricing" are the same page.
 */
export function landingPathOf(landingUrl: string | null | undefined): string | null {
  const url = safeUrl(landingUrl);
  if (!url) return null;
  return url.pathname.slice(0, 500) || "/";
}

/**
 * The referrer as stored: origin + path, no query, no fragment. Query strings on
 * a referrer carry the visitor's search terms and occasionally their session
 * tokens, and we have no use for either.
 */
export function storableReferrer(referrer: string | null | undefined): string | null {
  const url = safeUrl(referrer);
  if (!url) return null;
  return `${url.origin}${url.pathname}`.slice(0, 500);
}
