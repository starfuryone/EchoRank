/**
 * Redis configuration constants for the Echorank platform.
 */

export const REDIS_CONFIG = {
  /** Global namespace prefix for all Redis keys */
  namespace: "echorank:",

  /** Connection settings */
  connection: {
    /** Default Redis URL */
    defaultUrl: "redis://localhost:6379",
    /** Maximum number of reconnection attempts */
    maxRetriesPerRequest: null as null,
    /** Enable ready check on connection */
    enableReadyCheck: true,
    /** Reconnect on error */
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
    /** Retry strategy: exponential backoff capped at 30s */
    retryStrategy: (times: number) => {
      if (times > 20) return null; // stop retrying
      return Math.min(times * 500, 30_000);
    },
    /** Connection timeout in ms */
    connectTimeout: 10_000,
    /** Command timeout in ms */
    /** Keep alive interval in ms */
    keepAlive: 30_000,
    /** Lazy connect (don't connect until first command) */
    lazyConnect: true,
  },

  /** Queue namespace prefixes */
  queues: {
    prefix: "echorank:queue:",
    emailDelivery: "email-delivery",
    smsDelivery: "sms-delivery",
    webhookDelivery: "webhook-delivery",
    aiProcessing: "ai-processing",
    reviewMonitoring: "review-monitoring",
    reputationScoring: "reputation-scoring",
    escalationDetection: "escalation-detection",
    analyticsAggregation: "analytics-aggregation",
    feedbackRouting: "feedback-routing",
    csvImport: "csv-import",
  },

  /** DLQ namespace prefix */
  dlq: {
    prefix: "echorank:dlq:",
  },

  /** Event namespace prefix */
  events: {
    prefix: "echorank:events:",
  },

  /** TTL configurations (in seconds) */
  ttl: {
    /** Completed jobs removed after 24h */
    completedJobs: 86_400,
    /** Failed jobs kept for 7 days */
    failedJobs: 604_800,
    /** DLQ jobs kept for 30 days */
    dlqJobs: 2_592_000,
    /** Rate limit window: 60 seconds */
    rateLimitWindow: 60,
    /** Health check cache: 10 seconds */
    healthCheck: 10,
    /** Idempotency keys: 24h */
    idempotencyKey: 86_400,
  },

  /** Rate limiting defaults per queue (jobs per minute) */
  rateLimits: {
    "email-delivery": { max: 100, duration: 60_000 },
    "sms-delivery": { max: 50, duration: 60_000 },
    "webhook-delivery": { max: 200, duration: 60_000 },
    "ai-processing": { max: 30, duration: 60_000 },
    "review-monitoring": { max: 60, duration: 60_000 },
    "reputation-scoring": { max: 20, duration: 60_000 },
    "escalation-detection": { max: 100, duration: 60_000 },
    "analytics-aggregation": { max: 10, duration: 60_000 },
    "feedback-routing": { max: 200, duration: 60_000 },
    "csv-import": { max: 10, duration: 60_000 },
    "visibility-monitoring": { max: 6, duration: 60_000 },
    // One sweep tick a minute; the limiter is a backstop, not the schedule.
    "serp-checks": { max: 4, duration: 60_000 },
    // A daily schedule tick plus manual "Run now" jobs — never bursty.
    "rank-tracker": { max: 20, duration: 60_000 },
    // One crawl-progress sweep a minute; the limiter is a backstop.
    "site-audit": { max: 4, duration: 60_000 },
    // Site Crawler runs are long (up to an hour) and started by hand. The
    // real concurrency control is the worker's concurrency: 2, not this.
    "site-crawl": { max: 10, duration: 60_000 },
    // One hourly tick; the limiter is a backstop, not the schedule.
    "free-tools-volatility": { max: 4, duration: 60_000 },
    // One CHECKUP a job, and a checkup is many provider calls. This bounds how
    // fast jobs start; what protects a vendor's rate limit is the per-provider
    // limiter inside the worker (createProviderLimiter), because the vendors
    // count concurrent requests, not our job starts.
    "ai-checkup": { max: 10, duration: 60_000 },
    // One nightly tick plus one job per prompt set behind it. Pure database
    // work — no provider call, nothing to spend — so the limiter is a backstop
    // against a runaway sweep, not a cost control.
    "sov-aggregation": { max: 60, duration: 60_000 },
    // Same shape as sov-aggregation: one nightly tick plus one job per brand
    // profile, pure database work, nothing bought upstream. The limiter is a
    // backstop against a runaway sweep, not a cost control.
    "citation-aggregation": { max: 60, duration: 60_000 },
    // The one sweep on this list that BUYS something. At most one DataForSEO
    // referring-domains call per tenant per week (~$0.026 observed), and the
    // 7-day cache in citation-opportunities/listed.ts means most weeks buy
    // nothing at all. 10/min is deliberately tighter than its siblings: a
    // runaway loop here spends money rather than merely reading rows.
    "citation-opportunities": { max: 10, duration: 60_000 },
    // Same shape again: one nightly tick plus one job per tenant, reading
    // ai_visits and sov_snapshots and writing four rollup rows. Pure database
    // work — nothing bought upstream — so the limiter is a backstop against a
    // runaway sweep, not a cost control.
    "revenue-rollup": { max: 60, duration: 60_000 },
    // Every job here makes at least one Anthropic call against the tenant's
    // monthly output-token budget, and a review batch makes up to ten. Tighter
    // than the pure-database sweeps for the same reason citation-opportunities
    // is: a runaway loop spends money rather than merely reading rows. The real
    // cost control is the per-tenant budget in src/lib/marketing/quota.ts,
    // asserted before the enqueue AND again in the worker; this bounds how fast
    // jobs start across all tenants at once.
    "action-agent": { max: 20, duration: 60_000 },
  } as Record<string, { max: number; duration: number }>,
} as const;

/** Queue names type union */
export type QueueName =
  | "email-delivery"
  | "sms-delivery"
  | "webhook-delivery"
  | "ai-processing"
  | "review-monitoring"
  | "reputation-scoring"
  | "escalation-detection"
  | "analytics-aggregation"
  | "feedback-routing"
  | "csv-import"
  | "extension-import"
  | "visibility-monitoring"
  | "onboarding-email"
  | "trial-notice"
  | "serp-checks"
  | "rank-tracker"
  | "site-audit"
  | "bot-log-analysis"
  | "site-crawl"
  | "free-tools-volatility"
  | "ai-checkup"
  | "sov-aggregation"
  | "citation-aggregation"
  | "citation-opportunities"
  | "opportunity-scan"
  | "revenue-rollup"
  | "action-agent"
  | "assistant-precompute";

/** All valid queue names */
export const QUEUE_NAMES: QueueName[] = [
  "email-delivery",
  "sms-delivery",
  "webhook-delivery",
  "ai-processing",
  "review-monitoring",
  "reputation-scoring",
  "escalation-detection",
  "analytics-aggregation",
  "feedback-routing",
  "csv-import",
  "extension-import",

  "visibility-monitoring",
  "onboarding-email",
  "trial-notice",
  "serp-checks",
  "rank-tracker",
  "site-audit",
  "bot-log-analysis",
  "site-crawl",
  "free-tools-volatility",
  "ai-checkup",
  "sov-aggregation",
  "citation-aggregation",
  "citation-opportunities",
  "opportunity-scan",
  "revenue-rollup",
  "action-agent",
  "assistant-precompute",
];
