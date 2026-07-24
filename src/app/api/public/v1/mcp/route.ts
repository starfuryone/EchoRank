// POST /api/public/v1/mcp — Echorank360 MCP server (Streamable HTTP,
// stateless JSON mode). Same bearer-key auth, paid gate, and rate limit as
// the rest of the public v1 API; tools wrap the same underlying data.
import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { handleMcpMessage, type McpCapabilities } from "@/lib/mcp/handler";
import { getVisibilitySummary } from "@/lib/visibility-summary";
import { sidecarPost } from "@/lib/av-sidecar";
import { prisma } from "@/lib/prisma";

function capsFor(tenantId: string): McpCapabilities {
  return {
    async suggestKeywords(url, depth) {
      const { status, data } = await sidecarPost<{ error?: string }>("/keywords", {
        url,
        depth,
        ai: false,
      });
      if (status !== 200 || (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error || "Keyword analysis failed.");
      }
      return data;
    },
    async getLatestAudit() {
      const audit = await prisma.visibilityAudit.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        select: { url: true, score: true, grade: true, checks: true, createdAt: true },
      });
      if (!audit) throw new Error("No audit stored yet — run one on the AI Visibility page.");
      return audit;
    },
    async getVisibilitySummary() {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, planType: true, auditDomain: true },
      });
      if (!tenant) throw new Error("Tenant not found.");
      return getVisibilitySummary(tenantId, tenant.name, tenant.planType, tenant.auditDomain);
    },
  };
}

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
