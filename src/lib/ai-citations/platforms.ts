// src/lib/ai-citations/platforms.ts
//
// The LLM Mentions platform vocabulary and target builder — the parts of that
// endpoint family a CLIENT COMPONENT legitimately needs.
//
// ── WHY THIS IS NOT IN dataforseo/endpoints.ts ─────────────────────────────
// It was, and that was a build error. endpoints.ts imports ./client, which
// imports "server-only", so a value import of `LLM_PLATFORMS` from the AI
// Citations client component dragged the DataForSEO client — pg, dns, net,
// tls — into the browser bundle. Turbopack rejected it by name, which is
// exactly what CLAUDE.md's client/server rule and that `import "server-only"`
// are for. (`import type` is erased and was never the problem; the platform
// chips need the ARRAY at runtime.)
//
// So the pure half lives here and endpoints.ts re-exports it. Nothing in this
// file may import anything that is not itself pure.

/** The platforms DataForSEO observes. NOT the same set as our watcher's engines. */
export const LLM_PLATFORMS = ["chat_gpt", "google"] as const;
export type LlmPlatform = (typeof LLM_PLATFORMS)[number];

/**
 * ChatGPT mention data exists for US/en ONLY.
 *
 * Not a default we chose — a restriction of the provider's dataset. A chat_gpt
 * call for any other market returns nothing HAVING BEEN BILLED, so the service
 * pins these rather than passing the user's market through.
 */
export const CHATGPT_LOCATION_CODE = 2840;
export const CHATGPT_LANGUAGE_CODE = "en";

/**
 * The `target` array entry. Domain OR keyword, never both, one per call.
 *
 * THERE IS NO URL-LEVEL TARGETING IN THIS API. A page-scoped question is
 * answered by post-filtering the URLs that come back — which is why
 * cited-sources.ts applies its scope filter BEFORE the per-platform cap.
 */
export type LlmTarget =
  | {
      domain: string;
      include_subdomains?: boolean;
      search_filter?: "include" | "exclude";
      search_scope?: string[];
    }
  | {
      keyword: string;
      search_filter?: "include" | "exclude";
      search_scope?: string[];
      match_type?: "word_match" | "partial_match";
    };

export function buildLlmTarget(input: {
  type: "domain" | "keyword";
  value: string;
  /** Domain targets only. False for a scope narrower than "subdomains". */
  includeSubdomains?: boolean;
}): LlmTarget {
  if (input.type === "domain") {
    return {
      domain: input.value,
      include_subdomains: input.includeSubdomains ?? true,
      search_filter: "include",
      search_scope: ["any"],
    };
  }
  return {
    keyword: input.value,
    search_filter: "include",
    // brand_entities matters for a brand name: it catches answers naming the
    // brand as an entity rather than quoting the string.
    search_scope: ["any", "brand_entities"],
    match_type: "word_match",
  };
}

export function isLlmPlatform(value: string): value is LlmPlatform {
  return (LLM_PLATFORMS as readonly string[]).includes(value);
}
