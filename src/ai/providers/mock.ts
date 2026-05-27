// ---------------------------------------------------------------------------
// Mock AI Provider – heuristic-based inference for development/testing
// ---------------------------------------------------------------------------

import { AiProvider, type InferenceRequest, type InferenceResult } from "./base";

export class MockProvider extends AiProvider {
  readonly name = "mock";
  readonly isMock = true;

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    const content = this.generateHeuristicResponse(request);
    // Estimate token counts from content length (roughly 4 chars per token)
    const promptTokens = Math.round(
      (request.systemPrompt.length + request.userPrompt.length) / 4,
    );
    const completionTokens = Math.round(content.length / 4);

    return {
      content,
      promptTokens,
      completionTokens,
      modelId: "mock-heuristic-v1",
      provider: "mock",
      isMock: true,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private generateHeuristicResponse(request: InferenceRequest): string {
    const input = request.userPrompt.toLowerCase();

    // Detect if the prompt is asking for sentiment analysis
    if (
      request.systemPrompt.includes("sentiment") ||
      request.systemPrompt.includes("Sentiment")
    ) {
      return this.generateSentimentResponse(input);
    }

    // Detect escalation prediction
    if (
      request.systemPrompt.includes("escalation") ||
      request.systemPrompt.includes("risk")
    ) {
      return this.generateEscalationResponse(input);
    }

    // Detect intent detection
    if (
      request.systemPrompt.includes("intent") ||
      request.systemPrompt.includes("Intent")
    ) {
      return this.generateIntentResponse(input);
    }

    // Default: return a generic JSON response
    return JSON.stringify({
      result: "mock response",
      confidence: 0.5,
    });
  }

  private generateSentimentResponse(input: string): string {
    const positiveWords = [
      "great", "excellent", "amazing", "love", "fantastic", "perfect",
      "awesome", "recommend", "happy", "satisfied",
    ];
    const negativeWords = [
      "terrible", "awful", "horrible", "hate", "worst", "rude",
      "disappointed", "angry", "waste", "poor",
    ];

    let posCount = 0;
    let negCount = 0;
    for (const w of positiveWords) {
      if (input.includes(w)) posCount++;
    }
    for (const w of negativeWords) {
      if (input.includes(w)) negCount++;
    }

    let label: string;
    let score: number;
    if (posCount > negCount) {
      label = "positive";
      score = Math.min(1, 0.3 + posCount * 0.15);
    } else if (negCount > posCount) {
      label = "negative";
      score = Math.max(-1, -0.3 - negCount * 0.15);
    } else if (posCount > 0 && negCount > 0) {
      label = "mixed";
      score = 0;
    } else {
      label = "neutral";
      score = 0;
    }

    return JSON.stringify({
      label,
      score,
      emotions: [],
      topics: [],
      confidence: 0.6,
    });
  }

  private generateEscalationResponse(input: string): string {
    const riskSignals = [
      "lawyer", "sue", "legal", "attorney", "court",
      "social media", "twitter", "facebook", "review", "public",
      "never again", "last time", "done with",
    ];
    let signalCount = 0;
    const signals: string[] = [];
    for (const s of riskSignals) {
      if (input.includes(s)) {
        signalCount++;
        signals.push(s);
      }
    }
    const probability = Math.min(1, signalCount * 0.25);
    const riskLevel =
      probability >= 0.8 ? "CRITICAL"
      : probability >= 0.6 ? "HIGH"
      : probability >= 0.35 ? "MODERATE"
      : "LOW";

    return JSON.stringify({
      escalationProbability: probability,
      publicPostProbability: probability * 0.8,
      churnProbability: probability * 0.6,
      riskLevel,
      signals,
      reasoning: "Mock heuristic-based risk assessment",
    });
  }

  private generateIntentResponse(input: string): string {
    let primary = "complaint";
    if (input.includes("refund") || input.includes("money back")) {
      primary = "request_refund";
    } else if (input.includes("call") || input.includes("contact")) {
      primary = "request_callback";
    } else if (input.includes("great") || input.includes("thank")) {
      primary = "praise";
    } else if (input.includes("?")) {
      primary = "question";
    }

    return JSON.stringify({
      primary,
      secondary: [],
      confidence: 0.6,
      signals: [],
    });
  }
}
