// POST /api/public/v1/mcp — Echorank360 MCP server (Streamable HTTP,
// stateless JSON mode). Same bearer-key auth, paid gate, and rate limit as
// the rest of the public v1 API; tools wrap the same underlying data.
//
// This file is auth and transport only. The protocol lives in
// @/lib/mcp/handler, the data in @/lib/mcp/reads, and the wiring between them
// in @/lib/mcp/capabilities — which is what lets the tenant-isolation and
// protocol tests run without an HTTP server.
import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { capsFor } from "@/lib/mcp/capabilities";
import { handleMcpMessage } from "@/lib/mcp/handler";

export async function POST(req: NextRequest) {
  const auth = await authenticatePublicRequest(req);
  if (!auth.ok) return auth.response;

  let msg: unknown;
  try {
    msg = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const result = await handleMcpMessage(msg, capsFor(auth.tenantId));
  if (result.status === 202) return new NextResponse(null, { status: 202 });
  return NextResponse.json(result.body, { status: result.status });
}

// Stateless server: no SSE stream, no session to terminate.
export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
export function DELETE() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
