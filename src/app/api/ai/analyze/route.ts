import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import {
  requireFeature,
  requireQuota,
  enforcementErrorResponse,
} from "@/lib/plan-enforcement";
import { AiOrchestrator } from "@/ai/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    // Gate: AI analysis is a GROWTH+ feature and consumes a metered AI
    // inference. Enforce both before running the (cost-incurring) pipeline.
    await requireFeature("ai_analysis");
    await requireQuota("AI_INFERENCE");

    const body = await request.json();
    const { feedbackId } = body;

    if (!feedbackId || typeof feedbackId !== "string") {
      return NextResponse.json(
        { error: "feedbackId is required" },
        { status: 400 },
      );
    }

    const orchestrator = AiOrchestrator.getInstance();
    const result = await orchestrator.analyzeFeedback(tenantId, feedbackId);

    return NextResponse.json({
      analysis: {
        id: result.id,
        sentiment: result.sentiment,
        intent: result.intent,
        entities: result.entities,
        escalation: result.escalation,
        riskLevel: result.riskLevel,
        suggestedAction: result.suggestedAction,
        confidence: result.confidence,
        tokenUsage: result.tokenUsage,
        latencyMs: result.latencyMs,
        cost: result.cost,
      },
    });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;

    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Error running AI analysis:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
