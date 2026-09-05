// Developer features: API-key format/parsing (pure parts) + a full MCP
// protocol roundtrip against mocked capabilities — no DB, no HTTP.
//
// The DEEPER MCP coverage — tenant isolation, revoked keys, output-schema
// validation and the text-table snapshots — lives in tests/mcp-tools.test.ts
// under vitest, which can mock Prisma. This suite stays the DB-less protocol
// roundtrip and the three-catalog copy check, and runs under `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { __testing } from "../api-keys";
import {
  handleMcpMessage,
  MCP_TOOLS,
  MCP_TOOL_NAMES,
  MCP_WRITE_TOOLS,
  MCP_SERVER_INFO,
  type McpCapabilities,
} from "../mcp/handler";
import { missingInputSchemas } from "../mcp/schemas";
import { missingOutputSchemas, orphanOutputSchemas } from "../mcp/output-schemas";
import { API_ACCESS_COPY, MCP_SERVER_COPY } from "../i18n/dashboard";

const LOCALES = ["en", "fr", "de-CH"] as const;

// ─── API key format ──────────────────────────────────────────────────────────

test("api key wire format parses and hashes deterministically", () => {
  const { parse, sha256, KEY_PREFIX } = __testing;
  assert.equal(KEY_PREFIX, "er_api_");
  const parsed = parse("er_api_aabbccddeeff001122334455.deadbeef" + "0".repeat(40));
  assert.ok(parsed);
  assert.equal(parsed!.idPart, "aabbccddeeff001122334455");
  assert.equal(sha256("x"), sha256("x"));
  assert.notEqual(sha256("x"), sha256("y"));
});

test("malformed keys are rejected by the parser", () => {
  const { parse } = __testing;
  assert.equal(parse("er_ext_aa.bb"), null);            // wrong prefix
  assert.equal(parse("er_api_nodot"), null);            // no separator
  assert.equal(parse("er_api_UPPER.aabb"), null);       // non-hex
  assert.equal(parse("er_api_.secret"), null);          // empty id
  assert.equal(parse(""), null);
});

// ─── MCP roundtrip ───────────────────────────────────────────────────────────

// Every capability, because the interface is exhaustive by design: a tool
// added to the catalog without a capability is a compile error here, which is
// the cheapest possible place to find out.
const caps: McpCapabilities = {
  async whoami() {
    return {
      workspace: { name: "Mock Co", plan: "GROWTH" },
      seoSearches: { used: 3, limit: 50, remaining: 47, unlimited: false, resetsAt: "2026-10-01T00:00:00.000Z" },
      keywordOpportunity: { allowanceTotal: 5, allowanceUsed: 1, allowanceRemaining: 4, credits: 2 },
      trackedKeywords: { used: 12, limit: 100 },
      dataforseoSpend: { monthUsd: 1.5, capUsd: 25, remainingUsd: 23.5 },
    };
  },
  async suggestKeywords(url, depth) {
    return { url, depth, seed_keywords: [{ kw: "mock keyword" }] };
  },
  async getLatestAudit() {
    return { url: "https://mock.example", score: 88, grade: "A" };
  },
  async getVisibilitySummary() {
    return { prompts: { mentionRate: 42 } };
  },
  async getSerpCheck() {
    return { found: false, check: null, note: "nothing stored" };
  },
  async startSerpCheck(args) {
    return { id: "chk_1", keyword: String(args.keyword), status: "queued", cached: false };
  },
  async getRankTracker() {
    return { projects: [], project: null, keywords: [], note: "no projects" };
  },
  async addRankTrackingKeywords(args) {
    return {
      projectId: String(args.projectId),
      changed: args.keywords as string[],
      ignored: [],
      keywordCount: (args.keywords as string[]).length,
      trackedKeywords: 12,
      trackedKeywordLimit: 100,
    };
  },
  async removeRankTrackingKeywords(args) {
    return {
      projectId: String(args.projectId),
      changed: args.keywords as string[],
      ignored: [],
      keywordCount: 0,
      trackedKeywords: 10,
      trackedKeywordLimit: 100,
    };
  },
  async getBacklinksOverview() {
    return { found: false, analysis: null, referringDomains: [], anchors: [], pages: [], note: "none" };
  },
  async getDomainOverview() {
    return { found: false, analysis: null, keywords: [], competitors: [], note: "none" };
  },
  async listKeywordOpportunities() {
    return { found: false, analysis: null, opportunities: [], note: "none" };
  },
  async getResearchLog() {
    return { reuseWindowDays: 30, entries: [], note: "nothing yet" };
  },
  async getGscQueries() {
    return {
      connected: false,
      needsReauth: false,
      property: null,
      windowDays: 28,
      lastSyncAt: null,
      queries: [],
      note: "not connected",
    };
  },
  async getCrawlSummary() {
    return { found: false, crawl: null, topIssues: [], note: "no crawl" };
  },
};

test("mcp initialize negotiates protocol and reports server info", async () => {
  const r = await handleMcpMessage(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    caps,
  );
  assert.equal(r.status, 200);
  const body = r.body as { result: { protocolVersion: string; serverInfo: { name: string } } };
  assert.equal(body.result.protocolVersion, "2025-06-18");
  assert.equal(body.result.serverInfo.name, MCP_SERVER_INFO.name);
});

test("mcp notifications/initialized returns 202 with no body", async () => {
  const r = await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, caps);
  assert.equal(r.status, 202);
  assert.equal(r.body, undefined);
});

test("mcp tools/list advertises the whole catalog, and nothing else", async () => {
  const r = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, caps);
  const body = r.body as {
    result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] };
  };
  assert.deepEqual(
    body.result.tools.map((t) => t.name).sort(),
    [...MCP_TOOL_NAMES].sort(),
  );

  // get_gsc_queries was withheld until Search Console shipped. It has, so the
  // tool exists — this assertion is the inverse of the one it replaced, and is
  // kept as an assertion rather than deleted because "is it aspirational yet"
  // is still the right question to ask of this list.
  assert.ok(body.result.tools.some((t) => t.name === "get_gsc_queries"));

  // Every tool declares its read/write posture on the wire. A tool with no
  // annotation would show as read-only on the page while possibly spending.
  for (const tool of body.result.tools) {
    assert.equal(
      typeof tool.annotations?.readOnlyHint,
      "boolean",
      `${tool.name} must declare readOnlyHint`,
    );
  }

  // Exactly three tools may spend or mutate. Growing this set is a product
  // decision, so it fails here first.
  assert.deepEqual(
    [...MCP_WRITE_TOOLS].sort(),
    ["add_rank_tracking_keywords", "remove_rank_tracking_keywords", "start_serp_check"],
  );
});

test("every tool has an input schema and an output schema", () => {
  assert.deepEqual(missingInputSchemas(), []);
  assert.deepEqual(missingOutputSchemas(), []);
  assert.deepEqual(orphanOutputSchemas(), []);
});

test("whoami renders allowances as text, not just JSON", async () => {
  const r = await handleMcpMessage(
    { jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "whoami" } },
    caps,
  );
  const body = r.body as {
    result: {
      content: { text: string }[];
      structuredContent: { workspace: { name: string } };
      isError?: boolean;
    };
  };
  assert.ok(!body.result.isError);
  const text = body.result.content[0].text;
  assert.match(text, /Workspace: Mock Co/);
  assert.match(text, /47 left/);
  assert.match(text, /\$1\.50 of \$25\.00 cap/);
  // structuredContent carries the same data for clients that read it.
  assert.equal(body.result.structuredContent.workspace.name, "Mock Co");
});

test("bad tool arguments come back as a readable tool error", async () => {
  const r = await handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "start_serp_check", arguments: { keyword: "x", locationCode: 9999 } },
    },
    caps,
  );
  const body = r.body as { result: { isError?: boolean; content: { text: string }[] } };
  assert.ok(body.result.isError);
  assert.match(body.result.content[0].text, /locationCode/);
});

test("a drifted tool payload fails validation instead of shipping garbage", async () => {
  const drifted: McpCapabilities = {
    ...caps,
    async getCrawlSummary() {
      // `found` went missing in this imagined refactor.
      return { crawl: null, topIssues: [] };
    },
  };
  const r = await handleMcpMessage(
    { jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "get_crawl_summary" } },
    drifted,
  );
  const body = r.body as { result: { isError?: boolean; content: { text: string }[] } };
  assert.ok(body.result.isError);
  assert.match(body.result.content[0].text, /unexpected result shape for get_crawl_summary/);
});

test("mcp tools/call roundtrip: suggest_keywords returns text content", async () => {
  const r = await handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "suggest_keywords", arguments: { url: "example.com", depth: "site" } },
    },
    caps,
  );
  const body = r.body as { result: { content: { type: string; text: string }[]; isError?: boolean } };
  assert.equal(body.result.content[0].type, "text");
  assert.ok(body.result.content[0].text.includes("mock keyword"));
  assert.ok(body.result.content[0].text.includes('"depth": "site"'));
  assert.ok(!body.result.isError);
});

test("mcp tools/call: missing url and unknown tool are handled", async () => {
  const bad = await handleMcpMessage(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "suggest_keywords", arguments: {} } },
    caps,
  );
  const badBody = bad.body as { result: { isError?: boolean } };
  assert.ok(badBody.result.isError);

  const unknown = await handleMcpMessage(
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } },
    caps,
  );
  const unknownBody = unknown.body as { error: { code: number } };
  assert.equal(unknownBody.error.code, -32602);
});

test("mcp tool failure surfaces as tool-level error, not protocol error", async () => {
  const failing: McpCapabilities = {
    ...caps,
    async getLatestAudit() {
      throw new Error("No audit stored yet");
    },
  };
  const r = await handleMcpMessage(
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_latest_audit" } },
    failing,
  );
  const body = r.body as { result: { isError?: boolean; content: { text: string }[] } };
  assert.ok(body.result.isError);
  assert.ok(body.result.content[0].text.includes("No audit stored yet"));
});

test("mcp rejects batches and non-objects", async () => {
  assert.equal((await handleMcpMessage([], caps)).status, 400);
  assert.equal((await handleMcpMessage("x", caps)).status, 400);
});

// ─── Copy completeness ───────────────────────────────────────────────────────

test("api-access + mcp copy complete in all locales; tool descs cover MCP_TOOLS", () => {
  for (const locale of LOCALES) {
    const a = API_ACCESS_COPY[locale];
    assert.ok(a.intro.length && a.keyOnce.length && a.docsTitle.length && a.revokeConfirm.length);
    assert.ok(a.docsEndpoints.suggest.length && a.docsEndpoints.audit.length && a.docsEndpoints.summary.length);
    const m = MCP_SERVER_COPY[locale];
    assert.ok(m.intro.length && m.setupTitle.length && m.securityNote.length);
    assert.ok(m.keysActive(1).length && m.keysActive(2).length);
    for (const tool of MCP_TOOLS) {
      assert.ok(m.toolDescs[tool.name]?.length, `${locale} toolDesc ${tool.name}`);
    }
  }
  const json = JSON.stringify({ API_ACCESS_COPY, MCP_SERVER_COPY });
  assert.ok(!json.includes("EchoRank"), "CamelCase branding in devtools copy");
});
