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
  rating?: number;
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

// ─── CSV Import ───────────────────────────────────────────────────────────────

export interface CsvImportJob extends BaseJob {
  importJobId: string;
}

export interface ExtensionImportJob extends BaseJob {
  importJobId: string;
}

// ─── Union Type ───────────────────────────────────────────────────────────────

// ─── Visibility Monitoring ────────────────────────────────────────────────────

export interface VisibilityMonitoringJob {
  /** Present on per-monitor runs; absent on the repeatable sweep tick. */
  tenantId?: string;
  monitorId?: string;
  sweep?: boolean;
  promptSweep?: boolean;
  promptTenantId?: string;
  /** Nightly GSC query-stat sync across all connected tenants. */
  gscSweep?: boolean;
  correlationId?: string;
}

// ─── Onboarding Email Drip ────────────────────────────────────────────────────

export type OnboardingEmailStage = "d0" | "d2" | "d5" | "d10";

export interface OnboardingEmailJob extends BaseJob {
  stage: OnboardingEmailStage;
}

// ─── Trial ending notice ──────────────────────────────────────────────────────

/**
 * Scheduled 24h before a Stripe trial converts to a charge. Stripe's own
 * trial_will_end fires 3 days out, which is why this is a delayed job of ours
 * rather than a webhook handler.
 */
export interface TrialNoticeJob {
  tenantId: string;
  stripeSubscriptionId: string;
  /** Unix seconds, as Stripe reports it. Re-checked before sending. */
  trialEnd: number;
  correlationId?: string;
}

// ─── SERP Checks (DataForSEO standard queue) ──────────────────────────────────

export interface SerpCheckJob {
  /** The repeatable 60 s tick that drains DataForSEO's ready-task list. */
  sweep?: boolean;
  correlationId?: string;
}

// ─── Rank Tracker ─────────────────────────────────────────────────────────────

export interface RankTrackerJob {
  /** The daily tick that selects due projects and posts their keywords. */
  schedule?: boolean;
  /** Present on a manual "Run now" — the project to post immediately. */
  projectId?: string;
  correlationId?: string;
}

// ─── Site Audit ───────────────────────────────────────────────────────────────

export interface SiteAuditJob {
  /** The repeatable tick that polls in-flight OnPage crawls. */
  sweep?: boolean;
  correlationId?: string;
}

/**
 * Bot Analytics log parse. Carries the analysis row id and the path of the
 * uploaded file; the worker reads the file, writes aggregates to the row, and
 * deletes the file. `path` is produced by the upload route, never by a client.
 */
export interface BotLogAnalysisJob {
  analysisId: string;
  tenantId: string;
  path: string;
  gzipped: boolean;
}

export type AllJobTypes =
  | EmailDeliveryJob
  | SmsDeliveryJob
  | WebhookDeliveryJob
  | AiProcessingJob
  | ReviewMonitoringJob
  | ReputationScoringJob
  | EscalationDetectionJob
  | AnalyticsAggregationJob
  | FeedbackRoutingJob
  | CsvImportJob
  | ExtensionImportJob
  | VisibilityMonitoringJob
  | OnboardingEmailJob
  | TrialNoticeJob
  | SerpCheckJob
  | RankTrackerJob
  | SiteAuditJob
  | BotLogAnalysisJob
  | SiteCrawlJob
  | FreeToolsVolatilityJob
  | SovAggregationJob
  | CitationAggregationJob;

/** Free tools: the hourly SERP-volatility basket tick. */
export interface FreeToolsVolatilityJob {
  tick: boolean;
}

/** Site Crawler: one full-site BFS crawl. */
export interface SiteCrawlJob {
  crawlJobId: string;
  tenantId: string;
}

/**
 * AI Share of Voice: the nightly tick, or one prompt set's rollup.
 *
 * Two shapes on one queue, the same split ai-checkup uses: a repeatable SWEEP
 * finds the prompt sets to roll up and enqueues one ROLLUP each, so a tenant
 * with a large window cannot hold up everybody else's night.
 */
export interface SovAggregationJob {
  /** The repeatable nightly tick. */
  sweep?: boolean;
  /** A single prompt set's rollup. BrandProfile.id. */
  promptSetId?: string;
  tenantId?: string;
  /** ISO day to compute as-of. Defaults to today (UTC) when absent. */
  date?: string;
}

/**
 * Citation Finder: fold newly-seen citations into the `sources` rollup.
 *
 * Same sweep/rollup split as SovAggregationJob — a repeatable tick finds the
 * brand profiles with work waiting and enqueues one job each, so a tenant with
 * a citation backlog cannot hold up everybody else's night.
 *
 * Carries NO date. The job's scope is "every citation not yet stamped with a
 * sourceId", which is a watermark rather than a window, so there is nothing for
 * a date to select. See src/lib/citations/store.ts for why.
 */
export interface CitationAggregationJob {
  /** The repeatable nightly tick. */
  sweep?: boolean;
  /** A single brand profile's rollup. BrandProfile.id. */
  brandProfileId?: string;
  tenantId?: string;
}

/**
 * Citation Opportunity Engine: turn the `sources` rollup into a get-listed
 * worklist, weekly.
 *
 * Same sweep/score split as its siblings, but the grain is the TENANT, not the
 * brand profile — a listing is one job per tenant however many brands it
 * tracks, which is also the key of the table this writes (see
 * src/lib/citation-opportunities/store.ts).
 *
 * Carries NO date and NO watermark. It reads `sources`, which the nightly
 * citation rollup has already brought up to date, and recomputes the whole
 * worklist from scratch each week — so there is no window to select and nothing
 * to stamp. In particular it never reads or writes Citation.sourceId, which is
 * the citation rollup's watermark and stays entirely that feature's business.
 */
export interface CitationOpportunityJob {
  /** The repeatable weekly tick. */
  sweep?: boolean;
  /** A single tenant's scoring pass. */
  tenantId?: string;
}

// ─── Queue → Job Type mapping ─────────────────────────────────────────────────

export interface QueueJobMap {
  "trial-notice": TrialNoticeJob;
  "email-delivery": EmailDeliveryJob;
  "sms-delivery": SmsDeliveryJob;
  "webhook-delivery": WebhookDeliveryJob;
  "ai-processing": AiProcessingJob;
  "review-monitoring": ReviewMonitoringJob;
  "reputation-scoring": ReputationScoringJob;
  "escalation-detection": EscalationDetectionJob;
  "analytics-aggregation": AnalyticsAggregationJob;
  "feedback-routing": FeedbackRoutingJob;
  "csv-import": CsvImportJob;
  "extension-import": ExtensionImportJob;
  "visibility-monitoring": VisibilityMonitoringJob;
  "onboarding-email": OnboardingEmailJob;
  "serp-checks": SerpCheckJob;
  "rank-tracker": RankTrackerJob;
  "site-audit": SiteAuditJob;
  "bot-log-analysis": BotLogAnalysisJob;
  "site-crawl": SiteCrawlJob;
  "free-tools-volatility": FreeToolsVolatilityJob;
  "sov-aggregation": SovAggregationJob;
  "citation-aggregation": CitationAggregationJob;
  "citation-opportunities": CitationOpportunityJob;
}
