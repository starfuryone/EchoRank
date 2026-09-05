// src/lib/mcp/tools.ts
//
// The Echorank360 MCP tool catalog: names, descriptions, JSON-Schema input
// shapes and behaviour annotations. One list, read by three places —
// `tools/list` on the wire, the /visibility/tools/mcp-server page, and the
// tests that assert every tool has copy in all three dashboard catalogs.
//
// ── THIS MODULE IS IMPORTED BY A CLIENT COMPONENT ──────────────────────────
// src/components/seo-tools/mcp-server-client.tsx renders this list, so nothing
// here may import a server module, zod, or the protocol handler. That split is
// why the catalog lives in its own file instead of inside handler.ts: the
// handler validates outputs with zod, and zod has no business in the browser
// bundle of a page that only lists tool names. See CLAUDE.md, "Client / server
// boundary".
//
// ── READ-ONLY IS THE DEFAULT, AND ALMOST THE RULE ──────────────────────────
// Exactly one tool in this list spends money (`start_serp_check`, $0.006 a
// keyword at depth 100) and two mutate state (`add_/remove_rank_tracking_
// keywords`, which change what is tracked, not what is bought). Everything
// else reads what the tenant has already paid for. Expensive analyses —
// backlinks (~$0.368 a lookup), domain overview, the Keyword Opportunity
// Finder, AI Citations — are deliberately READ-ONLY here: an agent must not be
// able to drain a month's allowance in a loop, so starting those stays a
// deliberate click in the app. `readOnlyHint` on each entry says so on the
// wire, where a client can act on it.

/** MCP tool behaviour annotations (2025-06-18 `ToolAnnotations`). */
export interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: McpToolAnnotations;
}

const NO_ARGS = { type: "object", properties: {} } as const;

/** Shared parameter fragments, so two tools cannot describe one field twice. */
const KEYWORD_PROP = {
  type: "string",
  description: "The search query to check, e.g. \"reputation management software\".",
} as const;

const LOCATION_PROP = {
  type: "integer",
  description:
    "DataForSEO location code. Offered markets: 2124 Canada (default), 2840 United States, 2826 United Kingdom, 2250 France, 2276 Germany, 2756 Switzerland, 2036 Australia.",
} as const;

const LANGUAGE_PROP = {
  type: "string",
  enum: ["en", "fr", "de", "es"],
  description: "Language code. Defaults to \"en\".",
} as const;

const DEVICE_PROP = {
  type: "string",
  enum: ["desktop", "mobile"],
  description: "Defaults to \"desktop\".",
} as const;

const LIMIT_PROP = (max: number, fallback: number) =>
  ({
    type: "integer",
    minimum: 1,
    maximum: max,
    description: `Rows to return. Defaults to ${fallback}, capped at ${max}.`,
  }) as const;

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  // ─── Account ──────────────────────────────────────────────────────────────
  {
    name: "whoami",
    description:
      "The authenticated Echorank360 workspace: name, plan, and every allowance that bounds the other tools — monthly SEO searches left, Keyword Opportunity Finder domain analyses and credits left, tracked-keyword headroom, and this month's DataForSEO spend against the workspace cap. CALL THIS FIRST in any session that might spend, so you know what there is to spend.",
    inputSchema: NO_ARGS,
    annotations: { title: "Workspace and allowances", readOnlyHint: true },
  },

  // ─── AI visibility (pre-existing) ─────────────────────────────────────────
  {
    name: "suggest_keywords",
    description:
      "Run the Echorank360 SEO keyword suggester against a URL. Returns seed keywords with difficulty tiers, question keywords, content-optimization suggestions, AI-visibility prompts, and technical SEO checks.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Website URL or domain to analyze." },
        depth: {
          type: "string",
          enum: ["single", "site"],
          description: "single = homepage only (default); site = up to 5 internal pages.",
        },
      },
      required: ["url"],
    },
    annotations: { title: "Suggest keywords", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "get_latest_audit",
    description:
      "Latest stored AI-visibility audit for the authenticated workspace: URL, score (0-100), grade, and per-check results.",
    inputSchema: NO_ARGS,
    annotations: { title: "Latest AI-visibility audit", readOnlyHint: true },
  },
  {
    name: "get_visibility_summary",
    description:
      "Visibility summary for the authenticated workspace: latest audit score, 30-day AI mention rate, per-engine coverage, and recent visibility alerts.",
    inputSchema: NO_ARGS,
    annotations: { title: "Visibility summary", readOnlyHint: true },
  },

  // ─── SERP Checker ─────────────────────────────────────────────────────────
  {
    name: "get_serp_check",
    description:
      "Read a SERP check this workspace has already run: the top-100 organic results and the SERP features present. Reads stored data only and never spends. Pass `id` for one specific check, or a keyword to get the newest matching one. Returns status \"queued\" while a check started by start_serp_check is still with the provider.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "A SERP check id returned by start_serp_check. Takes precedence over `keyword`.",
        },
        keyword: KEYWORD_PROP,
        locationCode: LOCATION_PROP,
        languageCode: LANGUAGE_PROP,
        device: DEVICE_PROP,
      },
    },
    annotations: { title: "Read a SERP check", readOnlyHint: true },
  },
  {
    name: "start_serp_check",
    description:
      "SPENDS. Queue a new SERP check on Google for one keyword (depth 100, about $0.006). Draws down the workspace's pooled monthly SEO search allowance and the SERP Checker's own monthly limit, and is refused when either is exhausted. An identical check run in the last 24 hours is returned from cache for free instead. Results are not immediate — the provider's standard queue usually delivers in a few minutes; poll get_serp_check with the returned id.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: KEYWORD_PROP,
        locationCode: LOCATION_PROP,
        languageCode: LANGUAGE_PROP,
        device: DEVICE_PROP,
      },
      required: ["keyword"],
    },
    annotations: { title: "Start a SERP check", readOnlyHint: false, openWorldHint: true },
  },

  // ─── Rank Tracker ─────────────────────────────────────────────────────────
  {
    name: "get_rank_tracker",
    description:
      "Rank-tracking projects on this workspace and their latest recorded positions. With no arguments: every project with its keyword count, average position and last run. With `projectId`: that project's keywords, each one's latest position, its change since the previous run and over 30 days. A null position means \"not in the top 100\" — a real result, not missing data. Reads stored runs only; it never starts a check.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project to expand. Omit to list every project.",
        },
        limit: LIMIT_PROP(500, 100),
      },
    },
    annotations: { title: "Read rank tracking", readOnlyHint: true },
  },
  {
    name: "add_rank_tracking_keywords",
    description:
      "Add keywords to an existing rank-tracking project. Does not spend on its own — tracked keywords are checked on the project's own schedule, and each future check costs about $0.006. Refused when the workspace's tracked-keyword limit would be exceeded; keywords already in the project are ignored rather than duplicated.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project to add to (see get_rank_tracker)." },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to track. Duplicates and blanks are dropped.",
        },
      },
      required: ["projectId", "keywords"],
    },
    annotations: {
      title: "Add tracked keywords",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "remove_rank_tracking_keywords",
    description:
      "Stop tracking keywords in a project. The keyword's recorded position history is deleted with it and cannot be recovered. Keywords not in the project are ignored.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project to remove from (see get_rank_tracker)." },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to stop tracking.",
        },
      },
      required: ["projectId", "keywords"],
    },
    annotations: {
      title: "Remove tracked keywords",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  },

  // ─── Stored analyses (read-only by design — see the header) ───────────────
  {
    name: "get_backlinks_overview",
    description:
      "The newest stored backlinks analysis for this workspace: referring domains, backlink counts, domain rank, the strongest referring domains, top anchors and most-linked pages. Reads stored results only and never spends — a backlinks lookup costs around $0.37, so starting one stays a deliberate action on the Backlinks page. Pass `target` to pick a specific analysed domain or URL.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Domain or URL to look up. Omit for the most recent analysis of any target.",
        },
      },
    },
    annotations: { title: "Backlinks overview", readOnlyHint: true },
  },
  {
    name: "get_domain_overview",
    description:
      "The newest stored Site Explorer analysis for a domain: organic keyword count, estimated traffic, position distribution, the keywords it ranks for, its closest organic competitors and its backlink summary. Reads stored results only and never spends. Pass `domain` to pick one; omit for the most recent analysis.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain to look up, e.g. example.com." },
        limit: LIMIT_PROP(200, 50),
      },
    },
    annotations: { title: "Domain overview", readOnlyHint: true },
  },
  {
    name: "get_ai_citations",
    description:
      "The newest stored AI Citations lookup: which pages ChatGPT and Google's AI cite when answering about a target, per-platform mention totals, and share of voice against competitors. Reads stored results only and never spends — starting a lookup draws a search from the monthly allowance and stays a deliberate action on the AI Citations page. Complements the watcher's own prompt runs rather than replacing them: this is what the data provider observed across many people's answers, not what Echorank saw when it asked.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description:
            "Domain or URL to look up, as shown on the tool page. Omit for the most recent lookup of any target.",
        },
        limit: LIMIT_PROP(200, 50),
      },
    },
    annotations: { title: "AI citations", readOnlyHint: true },
  },
  {
    name: "list_keyword_opportunities",
    description:
      "The newest completed Keyword Opportunity Finder run for this workspace: scored keyword opportunities with search volume, difficulty, intent, trend and the reason each one scored as it did. Reads stored results only — starting a run spends a domain analysis and stays a deliberate action on the Keyword Opportunities page.",
    inputSchema: {
      type: "object",
      properties: { limit: LIMIT_PROP(200, 50) },
    },
    annotations: { title: "Keyword opportunities", readOnlyHint: true },
  },

  // ─── Owned-data reads ─────────────────────────────────────────────────────
  {
    name: "get_research_log",
    description:
      "What this workspace has already paid to research, newest first: which analysis, on what target, how long ago, and what it cost. CHECK THIS BEFORE SPENDING. A result under 30 days old is almost always worth reusing instead of re-buying — read it back with the matching get_* tool rather than starting a new run. Advisory: nothing here blocks a call.",
    inputSchema: {
      type: "object",
      properties: {
        feature: {
          type: "string",
          enum: [
            "serp_check",
            "backlinks",
            "domain_overview",
            "site_crawl",
            "keyword_opportunity",
            "ai_citations",
          ],
          description: "Narrow to one kind of research. Omit for everything.",
        },
        target: {
          type: "string",
          description:
            "Narrow to one exact target — a keyword, domain or URL, as the tool that researched it normalised it.",
        },
        limit: LIMIT_PROP(100, 20),
      },
    },
    annotations: { title: "Research log", readOnlyHint: true },
  },

  {
    name: "get_gsc_queries",
    description:
      "Top Google Search Console queries for this workspace over a recent window: clicks, impressions, average CTR and average position. Reads synced Search Console data and costs nothing. An empty result on a connected property is normal — Google withholds queries searched by too few people — and does not mean the sync is broken.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Window in days. Defaults to 28, capped at 90.",
        },
        limit: LIMIT_PROP(200, 25),
      },
    },
    annotations: { title: "Search Console queries", readOnlyHint: true },
  },
  {
    name: "get_crawl_summary",
    description:
      "The newest completed site crawl for this workspace: pages crawled, total issues found, and the most common issues grouped by type and severity. Reads stored crawl output and costs nothing.",
    inputSchema: {
      type: "object",
      properties: {
        crawlJobId: {
          type: "string",
          description: "A specific crawl to read. Omit for the newest completed one.",
        },
        limit: LIMIT_PROP(100, 20),
      },
    },
    annotations: { title: "Site crawl summary", readOnlyHint: true },
  },
] as const;

/** Every tool name, for exhaustiveness checks in tests and i18n catalogs. */
export const MCP_TOOL_NAMES: readonly string[] = MCP_TOOLS.map((tool) => tool.name);

export function findMcpTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}

/**
 * Tools that can spend money or change stored state.
 *
 * Derived from `readOnlyHint` rather than declared as a second list, so the
 * wire annotation and this cannot disagree. The skills pack and the MCP page
 * both render it; an agent reading `whoami` before one of these is the whole
 * discipline the Research Log exists to support.
 */
export const MCP_WRITE_TOOLS: readonly string[] = MCP_TOOLS.filter(
  (tool) => tool.annotations?.readOnlyHint === false,
).map((tool) => tool.name);
