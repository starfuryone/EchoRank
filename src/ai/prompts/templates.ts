// ---------------------------------------------------------------------------
// Prompt Templates – each returns { system, user } for the AI model.
// All templates instruct the model to output structured JSON.
// ---------------------------------------------------------------------------

export interface PromptPair {
  system: string;
  user: string;
}

// ---------------------------------------------------------------------------
// 1. Sentiment Analysis
// ---------------------------------------------------------------------------

export function sentimentAnalysis(
  content: string,
  context?: { customerName?: string; rating?: number; source?: string },
): PromptPair {
  const contextBlock = context
    ? `\nAdditional context:\n- Customer: ${context.customerName ?? "unknown"}\n- Rating: ${context.rating ?? "N/A"}\n- Source: ${context.source ?? "direct feedback"}`
    : "";

  return {
    system: `You are an expert reputation-intelligence analyst. Analyze the sentiment of customer feedback with precision.

Return ONLY a JSON object with the following structure – no markdown, no explanation:
{
  "label": "positive" | "negative" | "neutral" | "mixed",
  "score": <float between -1.0 (most negative) and 1.0 (most positive)>,
  "emotions": [<list of detected emotions, e.g. "anger", "joy", "frustration", "gratitude">],
  "topics": [<list of topics mentioned, e.g. "customer service", "product quality", "delivery">],
  "confidence": <float between 0 and 1>
}`,
    user: `Analyze the sentiment of the following customer feedback:${contextBlock}

"""
${content}
"""`,
  };
}

// ---------------------------------------------------------------------------
// 2. Escalation Prediction
// ---------------------------------------------------------------------------

export function escalationPrediction(
  content: string,
  customerHistory: {
    previousFeedbackCount?: number;
    averageRating?: number;
    hasOpenTicket?: boolean;
  },
  rating: number,
): PromptPair {
  return {
    system: `You are a customer-risk analyst specializing in escalation prediction for businesses.

Given a piece of customer feedback, predict the likelihood of escalation.

Return ONLY a JSON object – no markdown, no explanation:
{
  "escalationProbability": <float 0-1>,
  "publicPostProbability": <float 0-1>,
  "churnProbability": <float 0-1>,
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "signals": [<list of risk signal strings detected>],
  "reasoning": "<brief 1-2 sentence explanation>"
}`,
    user: `Rating: ${rating}/5

Customer history:
- Previous feedback submissions: ${customerHistory.previousFeedbackCount ?? 0}
- Average historical rating: ${customerHistory.averageRating?.toFixed(1) ?? "N/A"}
- Has open recovery ticket: ${customerHistory.hasOpenTicket ? "Yes" : "No"}

Feedback content:
"""
${content}
"""`,
  };
}

// ---------------------------------------------------------------------------
// 3. Risk Assessment
// ---------------------------------------------------------------------------

export function riskAssessment(
  feedback: { rating?: number; comment?: string },
  customerProfile: {
    name?: string;
    totalFeedback?: number;
    avgRating?: number;
    status?: string;
  },
  tenantMetrics: {
    avgRating?: number;
    totalFeedback?: number;
    openTickets?: number;
  },
): PromptPair {
  return {
    system: `You are a holistic reputation-risk assessment system. Consider all factors to produce a risk assessment.

Return ONLY a JSON object:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "overallRiskScore": <float 0-1>,
  "contributingFactors": [<list of factor strings>],
  "recommendedActions": [<list of action strings>],
  "confidence": <float 0-1>
}`,
    user: `Feedback:
- Rating: ${feedback.rating ?? "N/A"}/5
- Comment: "${feedback.comment ?? ""}"

Customer profile:
- Name: ${customerProfile.name ?? "unknown"}
- Total feedback: ${customerProfile.totalFeedback ?? 0}
- Average rating: ${customerProfile.avgRating?.toFixed(1) ?? "N/A"}
- Status: ${customerProfile.status ?? "unknown"}

Tenant metrics:
- Overall average rating: ${tenantMetrics.avgRating?.toFixed(1) ?? "N/A"}
- Total feedback items: ${tenantMetrics.totalFeedback ?? 0}
- Open recovery tickets: ${tenantMetrics.openTickets ?? 0}`,
  };
}

// ---------------------------------------------------------------------------
// 4. Review Authenticity
// ---------------------------------------------------------------------------

export function reviewAuthenticity(
  reviewContent: string,
  authorProfile?: { name?: string; reviewCount?: number; memberSince?: string },
  patterns?: { averageLength?: number; duplicateRatio?: number },
): PromptPair {
  const authorBlock = authorProfile
    ? `\nAuthor profile:\n- Name: ${authorProfile.name ?? "anonymous"}\n- Review count: ${authorProfile.reviewCount ?? "unknown"}\n- Member since: ${authorProfile.memberSince ?? "unknown"}`
    : "";

  const patternBlock = patterns
    ? `\nPattern data:\n- Average review length for this source: ${patterns.averageLength ?? "unknown"}\n- Duplicate content ratio: ${patterns.duplicateRatio ?? "unknown"}`
    : "";

  return {
    system: `You are an expert at detecting fake, fraudulent, or incentivized reviews. Analyze review authenticity signals.

Return ONLY a JSON object:
{
  "score": <float 0-1, where 1 = certainly authentic, 0 = certainly fake>,
  "flags": [<list of suspicious signal strings, empty if none>],
  "reasoning": "<brief explanation of your assessment>"
}`,
    user: `Review content:
"""
${reviewContent}
"""${authorBlock}${patternBlock}`,
  };
}

// ---------------------------------------------------------------------------
// 5. Intent Detection
// ---------------------------------------------------------------------------

export function intentDetection(content: string): PromptPair {
  return {
    system: `You are a customer intent classifier. Detect the primary and secondary intents in customer feedback.

Intent categories:
- complaint: general dissatisfaction
- praise: expressing satisfaction
- question: asking for information
- request_refund: asking for money back
- request_callback: asking to be contacted
- threat_legal: mentioning legal action
- threat_social: threatening to post publicly / social media
- resignation: "giving up" / "done with you"
- comparison: comparing to competitors
- suggestion: providing constructive ideas

Return ONLY a JSON object:
{
  "primary": "<intent category>",
  "secondary": [<list of additional intent categories>],
  "confidence": <float 0-1>,
  "signals": [<list of text signals that led to classification>]
}`,
    user: `Classify the intent of this feedback:

"""
${content}
"""`,
  };
}

// ---------------------------------------------------------------------------
// 6. Entity Extraction
// ---------------------------------------------------------------------------

export function entityExtraction(content: string): PromptPair {
  return {
    system: `You are a named-entity-recognition system for customer feedback analysis.

Extract entities from the text and categorize them.

Return ONLY a JSON object:
{
  "entities": [
    {
      "text": "<extracted text>",
      "type": "person" | "product" | "service" | "location" | "competitor" | "organization" | "feature",
      "context": "<brief surrounding context>"
    }
  ]
}`,
    user: `Extract entities from the following feedback:

"""
${content}
"""`,
  };
}

// ---------------------------------------------------------------------------
// 7. Emotional Escalation
// ---------------------------------------------------------------------------

export function emotionalEscalation(
  content: string,
  previousInteractions?: { date: string; sentiment: string; summary: string }[],
): PromptPair {
  const historyBlock =
    previousInteractions && previousInteractions.length > 0
      ? `\nPrevious interactions:\n${previousInteractions.map((i) => `- [${i.date}] (${i.sentiment}) ${i.summary}`).join("\n")}`
      : "";

  return {
    system: `You are an emotional-intensity analyst. Score the emotional escalation level and identify specific emotional markers.

Return ONLY a JSON object:
{
  "intensityScore": <float 0-10>,
  "emotions": {
    "anger": <float 0-1>,
    "frustration": <float 0-1>,
    "disappointment": <float 0-1>,
    "urgency": <float 0-1>,
    "sadness": <float 0-1>,
    "contempt": <float 0-1>
  },
  "markers": [<list of specific text markers or patterns detected>],
  "escalating": <boolean – true if emotional level is increasing vs previous interactions>
}`,
    user: `Analyze the emotional intensity of this feedback:

"""
${content}
"""${historyBlock}`,
  };
}

// ---------------------------------------------------------------------------
// 8. Reputation Summary
// ---------------------------------------------------------------------------

export function reputationSummary(
  scores: {
    overallScore: number;
    sentimentScore: number;
    responseRateScore: number;
    recoveryScore: number;
    reviewVelocityScore: number;
    volatilityIndex: number;
  },
  alerts: { title: string; riskLevel: string }[],
  trends: { direction: string; previousScore: number; currentScore: number },
): PromptPair {
  return {
    system: `You are an executive reputation briefing generator. Produce a concise, actionable summary for leadership.

Return ONLY a JSON object:
{
  "headline": "<one-line executive headline>",
  "summary": "<2-3 sentence overview>",
  "strengths": [<list of strength strings>],
  "concerns": [<list of concern strings>],
  "recommendations": [<list of actionable recommendation strings>]
}`,
    user: `Reputation scores (each 0-100):
- Overall: ${scores.overallScore.toFixed(1)}
- Sentiment: ${scores.sentimentScore.toFixed(1)}
- Response Rate: ${scores.responseRateScore.toFixed(1)}
- Recovery: ${scores.recoveryScore.toFixed(1)}
- Review Velocity: ${scores.reviewVelocityScore.toFixed(1)}
- Volatility Index: ${scores.volatilityIndex.toFixed(1)}

Trend: ${trends.direction} (from ${trends.previousScore.toFixed(1)} to ${trends.currentScore.toFixed(1)})

Active alerts (${alerts.length}):
${alerts.length > 0 ? alerts.map((a) => `- [${a.riskLevel}] ${a.title}`).join("\n") : "None"}`,
  };
}
