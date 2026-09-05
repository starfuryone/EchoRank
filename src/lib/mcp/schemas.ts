// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/mcp/schemas.ts
//
// One zod INPUT schema per MCP tool.
//
// The JSON Schema in tools.ts is what the client is told; this is what the
// server actually enforces. They describe the same shape from two sides and
// both are needed: a client may ignore the advertised schema entirely, and an
// agent that hallucinates an argument name must get a readable error rather
// than a silent default.
//
// EVERY SCHEMA IS `.strict()`-FREE ON PURPOSE. Unknown keys are dropped, not
// rejected: a client that helpfully attaches `_meta` or a stale argument from
// an earlier tool version should get an answer, not a validation failure. What
// is enforced is that the arguments we DO read are the type we read them as.
//
// Coercion is deliberate on the numeric fields. JSON-RPC arguments arrive from
// a model, and a model writes `"limit": "50"` often enough that failing it is
// pedantry rather than safety.

import { z } from "zod";
import { SERP_LANGUAGE_CODES, SERP_LOCATION_CODES } from "@/lib/serp/options";
import { RANK_DEVICES } from "@/lib/rank-tracker/options";
import { MCP_TOOL_NAMES } from "./tools";

// ─── Shared fragments ────────────────────────────────────────────────────────

/**
 * Location is an enum, not any positive integer.
 *
 * DataForSEO accepts thousands of codes; this product offers seven, and each
 * one has a hand-written label in three dashboard catalogs. Accepting a code
 * outside the list would post a task for a market the UI cannot render the
 * result of — money spent on a row nobody can read.
 */
export const locationCodeSchema = z.coerce
  .number()
  .int()
  .refine(
    (code): code is (typeof SERP_LOCATION_CODES)[number] =>
      (SERP_LOCATION_CODES as readonly number[]).includes(code),
    {
      message: `Unsupported location code. Offered markets: ${SERP_LOCATION_CODES.join(", ")}.`,
    },
  );

export const languageCodeSchema = z.enum(SERP_LANGUAGE_CODES);

export const deviceSchema = z.enum(RANK_DEVICES);

/** A bounded row count. `max` differs per tool; `fallback` is applied by the read. */
export const limitSchema = (max: number) => z.coerce.number().int().min(1).max(max);

/**
 * A keyword list from an agent: trimmed, blanks dropped, deduped, bounded.
 *
 * Deduping here rather than at the service is what makes
 * add_rank_tracking_keywords idempotent in the sense its annotation claims —
 * ["seo", "seo"] must add one keyword, not report two.
 */
export const keywordListSchema = z
  .array(z.string())
  .min(1, "Supply at least one keyword.")
  .max(1000)
  .transform((list) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const keyword = raw.trim().replace(/\s+/g, " ");
      if (!keyword || seen.has(keyword)) continue;
      seen.add(keyword);
      out.push(keyword);
    }
    return out;
  })
  .refine((list) => list.length > 0, "Supply at least one non-blank keyword.");

const idSchema = z.string().trim().min(1).max(200);
const targetSchema = z.string().trim().min(1).max(2000);

// ─── Per-tool input schemas ──────────────────────────────────────────────────

const noArgsSchema = z.object({});

export const suggestKeywordsInputSchema = z.object({
  url: z.string().trim().min(1, "`url` is required.").max(2000),
  depth: z.enum(["single", "site"]).default("single"),
});

export const getSerpCheckInputSchema = z.object({
  id: idSchema.optional(),
  keyword: z.string().trim().min(1).max(300).optional(),
  locationCode: locationCodeSchema.optional(),
  languageCode: languageCodeSchema.optional(),
  device: deviceSchema.optional(),
});

export const startSerpCheckInputSchema = z.object({
  keyword: z.string().trim().min(1, "`keyword` is required.").max(300),
  locationCode: locationCodeSchema.optional(),
  languageCode: languageCodeSchema.optional(),
  device: deviceSchema.optional(),
});

export const getRankTrackerInputSchema = z.object({
  projectId: idSchema.optional(),
  limit: limitSchema(500).optional(),
});

export const rankKeywordMutationInputSchema = z.object({
  projectId: idSchema,
  keywords: keywordListSchema,
});

export const backlinksOverviewInputSchema = z.object({
  target: targetSchema.optional(),
});

export const domainOverviewInputSchema = z.object({
  domain: targetSchema.optional(),
  limit: limitSchema(200).optional(),
});

export const keywordOpportunitiesInputSchema = z.object({
  limit: limitSchema(200).optional(),
});

export const gscQueriesInputSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
  limit: limitSchema(200).optional(),
});

export const crawlSummaryInputSchema = z.object({
  crawlJobId: idSchema.optional(),
  limit: limitSchema(100).optional(),
});

/** The registry the handler parses with. Keyed by tool name. */
export const MCP_INPUT_SCHEMAS: Record<string, z.ZodType> = {
  whoami: noArgsSchema,
  suggest_keywords: suggestKeywordsInputSchema,
  get_latest_audit: noArgsSchema,
  get_visibility_summary: noArgsSchema,
  get_serp_check: getSerpCheckInputSchema,
  start_serp_check: startSerpCheckInputSchema,
  get_rank_tracker: getRankTrackerInputSchema,
  add_rank_tracking_keywords: rankKeywordMutationInputSchema,
  remove_rank_tracking_keywords: rankKeywordMutationInputSchema,
  get_backlinks_overview: backlinksOverviewInputSchema,
  get_domain_overview: domainOverviewInputSchema,
  list_keyword_opportunities: keywordOpportunitiesInputSchema,
  get_gsc_queries: gscQueriesInputSchema,
  get_crawl_summary: crawlSummaryInputSchema,
};

/** Tool names in the catalog with no input schema. Empty is the only pass. */
export function missingInputSchemas(): string[] {
  return MCP_TOOL_NAMES.filter((name) => !(name in MCP_INPUT_SCHEMAS));
}

/**
 * A zod failure as one line an agent can act on.
 *
 * `path.join(".")` rather than the raw issue dump: the model needs "keywords:
 * Supply at least one keyword.", not a nested JSON object it will paste back
 * into the next call.
 */
export function formatInputError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
      return `${where}${issue.message}`;
    })
    .join("; ");
}
