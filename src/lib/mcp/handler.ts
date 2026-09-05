// src/lib/mcp/handler.ts
//
// Minimal, dependency-free MCP server core (Streamable HTTP transport,
// stateless mode). Implemented by hand because the Next app takes no new npm
// deps and the needed protocol surface is tiny: initialize / initialized /
// ping / tools/list / tools/call, single JSON-RPC messages, plain JSON
// responses (the spec allows a server to answer POSTs with application/json
// instead of an SSE stream; stateless servers may omit session management).
//
// Pure function over an injected capability object → unit-testable without
// DB or HTTP. The route (/api/public/v1/mcp) wires capabilities to real data
// via ./capabilities.ts.
//
// ── THE FOUR-STEP SHAPE OF EVERY tools/call ────────────────────────────────
//   1. INPUT  is parsed with the tool's zod schema (./schemas.ts). A bad
//      argument becomes a readable tool error, never a silent default.
//   2. The capability RUNS, returning structured data only. Capabilities know
//      nothing about MCP.
//   3. OUTPUT is validated against the tool's zod schema (./output-schemas.ts).
//      This catches OUR drift, not the caller's — see that file.
//   4. The validated payload is RENDERED to a text table (./render.ts) and
//      returned alongside `structuredContent`.
//
// Splitting 2 from 3 and 4 is what lets the whole result pipeline be tested
// against literals, with no database in sight.
//
// ── WHAT THIS MODULE MAY IMPORT ────────────────────────────────────────────
// zod and its own siblings. NOT prisma, NOT any service. The tool CATALOG
// lives in ./tools.ts precisely because the MCP page is a Client Component
// that renders it: keeping the catalog separate is what stops zod and the
// protocol core being dragged into the browser bundle.

import {
  MCP_INPUT_SCHEMAS,
  formatInputError,
} from "./schemas";
import { MCP_OUTPUT_SCHEMAS } from "./output-schemas";
import { renderToolText } from "./render";
import { MCP_TOOLS } from "./tools";

export { MCP_TOOLS, MCP_TOOL_NAMES, MCP_WRITE_TOOLS } from "./tools";
export type { McpToolDefinition } from "./tools";

/**
 * One method per tool, taking already-validated arguments.
 *
 * `args` is typed `Record<string, unknown>` rather than a per-tool type
 * because the zod schema is the contract and duplicating it in TypeScript is
 * how the two come apart. Capabilities re-read the fields they need from the
 * parsed object, which by then is known-good.
 */
export interface McpCapabilities {
  whoami(): Promise<unknown>;
  suggestKeywords(url: string, depth: "single" | "site"): Promise<unknown>;
  getLatestAudit(): Promise<unknown>;
  getVisibilitySummary(): Promise<unknown>;
  getSerpCheck(args: Record<string, unknown>): Promise<unknown>;
  startSerpCheck(args: Record<string, unknown>): Promise<unknown>;
  getRankTracker(args: Record<string, unknown>): Promise<unknown>;
  addRankTrackingKeywords(args: Record<string, unknown>): Promise<unknown>;
  removeRankTrackingKeywords(args: Record<string, unknown>): Promise<unknown>;
  getBacklinksOverview(args: Record<string, unknown>): Promise<unknown>;
  getDomainOverview(args: Record<string, unknown>): Promise<unknown>;
  listKeywordOpportunities(args: Record<string, unknown>): Promise<unknown>;
  getAiCitations(args: Record<string, unknown>): Promise<unknown>;
  getResearchLog(args: Record<string, unknown>): Promise<unknown>;
  getGscQueries(args: Record<string, unknown>): Promise<unknown>;
  getCrawlSummary(args: Record<string, unknown>): Promise<unknown>;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: {
    protocolVersion?: string;
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpHandlerResult {
  /** HTTP status to return; 202 means empty body (notification accepted). */
  status: number;
  body?: unknown;
}

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const MCP_SERVER_INFO = {
  name: "echorank360-seo-tools",
  title: "Echorank360 SEO Tools",
  version: "2.0.0",
};

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: number | string | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Validate, render, package.
 *
 * A validation failure is returned as a TOOL error rather than thrown: the
 * call reached the tool and the tool answered, so the JSON-RPC layer succeeded
 * and it is the tool result that is bad. A client that sees `isError` can tell
 * the user "Echorank returned an unexpected shape for get_domain_overview"
 * instead of "the server broke".
 */
function toolResult(name: string, data: unknown) {
  const schema = MCP_OUTPUT_SCHEMAS[name];
  if (!schema) {
    // Unreachable in a tested build — missingOutputSchemas() is asserted empty
    // by the suite. Kept as a named failure rather than an unvalidated pass.
    return toolError(`No output schema registered for tool: ${name}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[mcp] output validation failed for ${name}:`, parsed.error.issues);
    return toolError(
      `Echorank returned an unexpected result shape for ${name}. This is a server-side bug; the call was not retried.`,
    );
  }
  return {
    content: [{ type: "text", text: renderToolText(name, parsed.data) }],
    structuredContent: parsed.data as Record<string, unknown>,
  };
}

/** Every tool's dispatch, keyed by name. One place to add a tool. */
function runTool(
  name: string,
  args: Record<string, unknown>,
  caps: McpCapabilities,
): Promise<unknown> {
  switch (name) {
    case "whoami":
      return caps.whoami();
    case "suggest_keywords":
      return caps.suggestKeywords(
        args.url as string,
        (args.depth as "single" | "site") ?? "single",
      );
    case "get_latest_audit":
      return caps.getLatestAudit();
    case "get_visibility_summary":
      return caps.getVisibilitySummary();
    case "get_serp_check":
      return caps.getSerpCheck(args);
    case "start_serp_check":
      return caps.startSerpCheck(args);
    case "get_rank_tracker":
      return caps.getRankTracker(args);
    case "add_rank_tracking_keywords":
      return caps.addRankTrackingKeywords(args);
    case "remove_rank_tracking_keywords":
      return caps.removeRankTrackingKeywords(args);
    case "get_backlinks_overview":
      return caps.getBacklinksOverview(args);
    case "get_domain_overview":
      return caps.getDomainOverview(args);
    case "list_keyword_opportunities":
      return caps.listKeywordOpportunities(args);
    case "get_ai_citations":
      return caps.getAiCitations(args);
    case "get_research_log":
      return caps.getResearchLog(args);
    case "get_gsc_queries":
      return caps.getGscQueries(args);
    case "get_crawl_summary":
      return caps.getCrawlSummary(args);
    default:
      return Promise.reject(new UnknownToolError(name));
  }
}

class UnknownToolError extends Error {
  constructor(readonly toolName: string) {
    super(`Unknown tool: ${toolName}`);
    this.name = "UnknownToolError";
  }
}

export async function handleMcpMessage(
  msg: unknown,
  caps: McpCapabilities,
): Promise<McpHandlerResult> {
  // 2025-06-18 removed JSON-RPC batching; reject arrays explicitly.
  if (Array.isArray(msg)) {
    return { status: 400, body: rpcError(null, -32600, "Batch requests are not supported.") };
  }
  if (typeof msg !== "object" || msg === null) {
    return { status: 400, body: rpcError(null, -32700, "Parse error: expected a JSON-RPC object.") };
  }
  const req = msg as JsonRpcRequest;
  const isNotification = req.id === undefined || req.id === null;

  switch (req.method) {
    case "initialize": {
      const requested = req.params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested ?? "")
        ? (requested as string)
        : LATEST_PROTOCOL_VERSION;
      return {
        status: 200,
        body: rpcResult(req.id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
        }),
      };
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return { status: 202 };

    case "ping":
      return { status: 200, body: rpcResult(req.id, {}) };

    case "tools/list":
      return { status: 200, body: rpcResult(req.id, { tools: MCP_TOOLS }) };

    case "tools/call": {
      const name = typeof req.params?.name === "string" ? req.params.name : "";
      const rawArgs = req.params?.arguments ?? {};

      const inputSchema = MCP_INPUT_SCHEMAS[name];
      if (!inputSchema) {
        // -32602 (invalid params) rather than a tool error: a tool that does
        // not exist never ran, so there is no tool result to report.
        return { status: 200, body: rpcError(req.id, -32602, `Unknown tool: ${name || "(none)"}`) };
      }

      const parsedArgs = inputSchema.safeParse(rawArgs);
      if (!parsedArgs.success) {
        return {
          status: 200,
          body: rpcResult(req.id, toolError(formatInputError(parsedArgs.error))),
        };
      }

      try {
        const data = await runTool(name, parsedArgs.data as Record<string, unknown>, caps);
        return { status: 200, body: rpcResult(req.id, toolResult(name, data)) };
      } catch (err) {
        if (err instanceof UnknownToolError) {
          return { status: 200, body: rpcError(req.id, -32602, err.message) };
        }
        // Tool execution failure is a tool-level error, not a protocol error.
        // Quota denials, plan locks and provider outages all land here, and
        // their messages are already written for a human — see the typed
        // errors in seo-quota.ts, backlinks/quota.ts and serp/service.ts.
        const message = err instanceof Error ? err.message : "Tool execution failed.";
        return { status: 200, body: rpcResult(req.id, toolError(message)) };
      }
    }

    default:
      if (isNotification) return { status: 202 }; // unknown notifications: accept, ignore
      return {
        status: 200,
        body: rpcError(req.id, -32601, `Method not found: ${String(req.method)}`),
      };
  }
}
