/**
 * Domain event type definitions for the EchoRank event-driven architecture.
 */

// ─── Event Type Constants ─────────────────────────────────────────────────────

export const EVENT_TYPES = {
  FEEDBACK_SUBMITTED: "feedback.submitted",
  CUSTOMER_ESCALATED: "customer.escalated",
  REVIEW_REQUESTED: "review.requested",
  TICKET_OPENED: "ticket.opened",
  TICKET_RESOLVED: "ticket.resolved",
  REVIEW_PUBLISHED: "review.published",
  ESCALATION_DETECTED: "escalation.detected",
  SENTIMENT_CHANGED: "sentiment.changed",
  CAMPAIGN_COMPLETED: "campaign.completed",
  AI_RISK_DETECTED: "ai.risk_detected",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ─── Base Event Interface ─────────────────────────────────────────────────────

export interface DomainEventPayload {
  tenantId: string;
  correlationId: string;
  timestamp: string; // ISO 8601
  version: number;
}

// ─── Individual Event Payloads ────────────────────────────────────────────────

export interface FeedbackSubmittedEvent extends DomainEventPayload {
  feedbackId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
}

export interface CustomerEscalatedEvent extends DomainEventPayload {
  customerId: string;
  feedbackId: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  probability: number;
}

export interface ReviewRequestedEvent extends DomainEventPayload {
  feedbackId: string;
  customerId: string;
  platform: string;
  url: string;
}

export interface TicketOpenedEvent extends DomainEventPayload {
  ticketId: string;
  customerId: string;
  feedbackId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface TicketResolvedEvent extends DomainEventPayload {
  ticketId: string;
  customerId: string;
  resolvedBy: string;
  resolutionTime: number; // in minutes
}

export interface ReviewPublishedEvent extends DomainEventPayload {
  externalReviewId: string;
  platform: string;
  rating: number;
  sentiment: string;
}

export interface EscalationDetectedEvent extends DomainEventPayload {
  alertId: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  probability: number;
  description: string;
}

export interface SentimentChangedEvent extends DomainEventPayload {
  entityType: string;
  entityId: string;
  previousSentiment: string;
  newSentiment: string;
}

export interface CampaignCompletedEvent extends DomainEventPayload {
  campaignId: string;
  totalSent: number;
  totalResponses: number;
  avgRating: number;
}

export interface AiRiskDetectedEvent extends DomainEventPayload {
  analysisId: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  riskType: string;
  confidence: number;
}

// ─── Union Type ───────────────────────────────────────────────────────────────

export type AllDomainEvents =
  | FeedbackSubmittedEvent
  | CustomerEscalatedEvent
  | ReviewRequestedEvent
  | TicketOpenedEvent
  | TicketResolvedEvent
  | ReviewPublishedEvent
  | EscalationDetectedEvent
  | SentimentChangedEvent
  | CampaignCompletedEvent
  | AiRiskDetectedEvent;

// ─── Event → Payload mapping ──────────────────────────────────────────────────

export interface EventPayloadMap {
  "feedback.submitted": FeedbackSubmittedEvent;
  "customer.escalated": CustomerEscalatedEvent;
  "review.requested": ReviewRequestedEvent;
  "ticket.opened": TicketOpenedEvent;
  "ticket.resolved": TicketResolvedEvent;
  "review.published": ReviewPublishedEvent;
  "escalation.detected": EscalationDetectedEvent;
  "sentiment.changed": SentimentChangedEvent;
  "campaign.completed": CampaignCompletedEvent;
  "ai.risk_detected": AiRiskDetectedEvent;
}

// ─── Event Envelope (what gets stored) ────────────────────────────────────────

export interface DomainEventEnvelope<T extends DomainEventPayload = DomainEventPayload> {
  id?: string;
  tenantId: string;
  eventType: EventType;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  metadata?: Record<string, unknown>;
  correlationId: string;
  causationId?: string;
}
