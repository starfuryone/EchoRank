// src/lib/authority-checker/config.ts
//
// The Link Authority Checker's fixed numbers, in one dependency-free module
// (the landing page, the in-app tool and the API route all read it).
//
// A PAID TOOL SINCE 2026-11-09, on every paid plan (the AI-only one included,
// src/lib/plan-access.ts). The monthly allowance per plan is in plan-config.ts
// (linkAuthorityChecksPerMonth); nothing here limits a visitor, because there
// are no anonymous visitors any more.

/** The public landing page, under /[locale]/free-tools (URL kept from the free tool). */
export const AUTHORITY_SLUG = "authority-checker";

/** The ?src= the landing page's CTA carries. */
export const LINK_AUTHORITY_SRC = "link-authority";

/**
 * The ?src= of the free tool's links, still read by
 * src/lib/authority-checker/{store,pdf}.ts, which are unused and listed for
 * deletion (2026-11-09).
 */
export const AUTHORITY_SRC = "authority-checker";

/** The in-app tool and its API. */
export const LINK_AUTHORITY_TOOL_PATH = "/visibility/tools/link-authority";
export const LINK_AUTHORITY_API = "/api/seo/v1/link-authority";

/** One domain plus up to three competitors. */
export const MAX_COMPETITORS = 3;

/** Every DataForSEO answer is cached this long per domain, in the shared store. */
export const CACHE_DAYS = 7;

/**
 * How long the free tool's result link lived. Read only by store.ts, which is
 * unused and listed for deletion (2026-11-09).
 */
export const RESULT_TTL_DAYS = 7;

/** The top referring domains the report lists. */
export const TOP_REFERRING_DOMAINS = 10;
