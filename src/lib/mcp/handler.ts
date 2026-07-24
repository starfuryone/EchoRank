// src/lib/mcp/handler.ts
// Minimal, dependency-free MCP server core (Streamable HTTP transport,
// stateless mode). Implemented by hand because the Next app takes no new npm
// deps and the needed protocol surface is tiny: initialize / initialized /
// ping / tools/list / tools/call, single JSON-RPC messages, plain JSON
// responses (the spec allows a server to answer POSTs with application/json
// instead of an SSE stream; stateless servers may omit session management).
//
// Pure function over an injected capability object → unit-testable without
// DB or HTTP. The route (/api/public/v1/mcp) wires capabilities to real data.

export interface McpCapabilities {
  suggestKeywords(url: string, depth: "single" | "site"): Promise<unknown>;
  getLatestAudit(): Promise<unknown>;
  getVisibilitySummary(): Promise<unknown>;
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
  version: "1.0.0",
};

// get_gsc_queries is deliberately absent: no GSC connection exists in the
// product yet. Add it here + in the v1 API when GSC Insights ships.
export const MCP_TOOLS = [
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
  },
  {
    name: "get_latest_audit",
    description:
      "Latest stored AI-visibility audit for the authenticated workspace: URL, score (0-100), grade, and per-check results.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_visibility_summary",
    description:
      "Visibility summary for the authenticated workspace: latest audit score, 30-day AI mention rate, per-engine coverage, and recent visibility alerts.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: number | string | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
function toolText(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
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
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      try {
        switch (name) {
          case "suggest_keywords": {
            const url = typeof args.url === "string" ? args.url.trim() : "";
            if (!url) {
              return { status: 200, body: rpcResult(req.id, toolError("`url` is required.")) };
            }
            const depth = args.depth === "site" ? "site" : "single";
            const data = await caps.suggestKeywords(url, depth);
            return { status: 200, body: rpcResult(req.id, toolText(data)) };
          }
          case "get_latest_audit": {
            const data = await caps.getLatestAudit();
            return { status: 200, body: rpcResult(req.id, toolText(data)) };
          }
          case "get_visibility_summary": {
            const data = await caps.getVisibilitySummary();
            return { status: 200, body: rpcResult(req.id, toolText(data)) };
          }
          default:
            return {
              status: 200,
              body: rpcError(req.id, -32602, `Unknown tool: ${String(name)}`),
            };
        }
      } catch (err) {
        // Tool execution failure is a tool-level error, not a protocol error.
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
