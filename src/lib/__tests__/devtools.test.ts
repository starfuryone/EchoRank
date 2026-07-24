// Developer features: API-key format/parsing (pure parts) + a full MCP
// protocol roundtrip against mocked capabilities — no DB, no HTTP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { __testing } from "../api-keys";
import { handleMcpMessage, MCP_TOOLS, MCP_SERVER_INFO, type McpCapabilities } from "../mcp/handler";
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

const caps: McpCapabilities = {
  async suggestKeywords(url, depth) {
    return { url, depth, seed_keywords: [{ kw: "mock keyword" }] };
  },
  async getLatestAudit() {
    return { url: "https://mock.example", score: 88, grade: "A" };
  },
  async getVisibilitySummary() {
    return { prompts: { mentionRate: 42 } };
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

test("mcp tools/list returns exactly the three read tools", async () => {
  const r = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, caps);
  const body = r.body as { result: { tools: { name: string }[] } };
  assert.deepEqual(
    body.result.tools.map((t) => t.name).sort(),
    ["get_latest_audit", "get_visibility_summary", "suggest_keywords"],
  );
  // no aspirational tools: get_gsc_queries must NOT exist until GSC ships
  assert.ok(!body.result.tools.some((t) => t.name === "get_gsc_queries"));
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
