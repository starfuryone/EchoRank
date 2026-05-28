/**
 * TypeScript interfaces for all BullMQ job payload types.
 */

// ─── Job Priority Constants ───────────────────────────────────────────────────

export const JOB_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

// ─── Base Job Interface ───────────────────────────────────────────────────────

export interface BaseJob {
  tenantId: string;
  correlationId: string;
}

// ─── Email Delivery ───────────────────────────────────────────────────────────

export interface EmailDeliveryJob extends BaseJob {
  customerId: string;
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}

// ─── SMS Delivery ─────────────────────────────────────────────────────────────

export interface SmsDeliveryJob extends BaseJob {
  customerId: string;
  to: string;
  body: string;
  templateId?: string;
}

// ─── Webhook Delivery ─────────────────────────────────────────────────────────

export interface WebhookDeliveryJob extends BaseJob {
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  retryCount: number;
}

// ─── AI Processing ────────────────────────────────────────────────────────────

export type AiAnalysisType =
  | "sentiment"
  | "escalation_risk"
  | "intent"
  | "entity_extraction"
  | "topic_classification"
  | "full_analysis";

export interface AiProcessingJob extends BaseJob {
  feedbackId?: string;
  externalReviewId?: string;
  analysisType: AiAnalysisType;
  content: string;
}

// ─── Review Monitoring ────────────────────────────────────────────────────────

export type ReviewCheckType = "new_reviews" | "reply_status" | "rating_change" | "full_sync";

export interface ReviewMonitoringJob extends BaseJob {
  sourceId: string;
  platform: string;
  externalId: string;
  checkType: ReviewCheckType;
}

// ─── Reputation Scoring ───────────────────────────────────────────────────────

export type ScoringTrigger =
  | "feedback_submitted"
  | "review_published"
  | "ticket_resolved"
  | "scheduled"
  | "manual";

export interface ReputationScoringJob extends BaseJob {
  location?: string;
  triggerEvent: ScoringTrigger;
}

// ─── Escalation Detection ─────────────────────────────────────────────────────

export interface EscalationSignal {
  type: string;
  value: number | string;
  weight: number;
}

export interface EscalationDetectionJob extends BaseJob {
  feedbackId?: string;
  customerId?: string;
  signals: EscalationSignal[];
}

// ─── Feedback Routing ─────────────────────────────────────────────────────────

export interface FeedbackRoutingJob extends BaseJob {
  feedbackId: string;
}

// ─── Analytics Aggregation ────────────────────────────────────────────────────

export type PeriodType = "hourly" | "daily" | "weekly" | "monthly";

export interface AnalyticsAggregationJob extends BaseJob {
  periodType: PeriodType;
  periodStart: string; // ISO 8601
  periodEnd: string; // ISO 8601
}

// ─── Union Type ───────────────────────────────────────────────────────────────

export type AllJobTypes =
  | EmailDeliveryJob
  | SmsDeliveryJob
  | WebhookDeliveryJob
  | AiProcessingJob
  | ReviewMonitoringJob
  | ReputationScoringJob
  | EscalationDetectionJob
  | AnalyticsAggregationJob
  | FeedbackRoutingJob;

// ─── Queue → Job Type mapping ─────────────────────────────────────────────────

export interface QueueJobMap {
  "email-delivery": EmailDeliveryJob;
  "sms-delivery": SmsDeliveryJob;
  "webhook-delivery": WebhookDeliveryJob;
  "ai-processing": AiProcessingJob;
  "review-monitoring": ReviewMonitoringJob;
  "reputation-scoring": ReputationScoringJob;
  "escalation-detection": EscalationDetectionJob;
  "analytics-aggregation": AnalyticsAggregationJob;
  "feedback-routing": FeedbackRoutingJob;
}
