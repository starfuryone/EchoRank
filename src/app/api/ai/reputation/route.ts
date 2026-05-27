import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { RiskScoringPipeline } from "@/ai/pipelines/risk-scoring";
import { ReputationScoreCalculator } from "@/ai/scoring/reputation-score";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location") || undefined;
    const days = Math.min(
      365,
      Math.max(1, parseInt(searchParams.get("days") || "30", 10)),
    );

    // Calculate current reputation score
    const pipeline = new RiskScoringPipeline();
    const currentScore = await pipeline.calculateReputationScore(
      tenantId,
      location,
      days,
    );

    // Get historical scores for trend visualization
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const historical = await ReputationScoreCalculator.getHistoricalScores(
      tenantId,
      { location, limit: 30, since },
    );

    // Get location comparisons
    const locationComparisons =
      await ReputationScoreCalculator.getLocationComparison(tenantId);

    return NextResponse.json({
      current: {
        overallScore: currentScore.overallScore,
        sentimentScore: currentScore.sentimentScore,
        responseRateScore: currentScore.responseRateScore,
        recoveryScore: currentScore.recoveryScore,
        reviewVelocityScore: currentScore.reviewVelocityScore,
        volatilityIndex: currentScore.volatilityIndex,
        riskLevel: currentScore.riskLevel,
        trendDirection: currentScore.trendDirection,
        sampleSize: currentScore.sampleSize,
        confidence: currentScore.confidence,
      },
      historical: historical.map((h) => ({
        overallScore: h.overallScore,
        sentimentScore: h.sentimentScore,
        responseRateScore: h.responseRateScore,
        recoveryScore: h.recoveryScore,
        reviewVelocityScore: h.reviewVelocityScore,
        volatilityIndex: h.volatilityIndex,
        riskLevel: h.riskLevel,
        trendDirection: h.trendDirection,
        periodStart: h.periodStart,
        periodEnd: h.periodEnd,
        sampleSize: h.sampleSize,
        confidence: h.confidence,
        createdAt: h.createdAt,
      })),
      locations: locationComparisons,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching reputation scores:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
