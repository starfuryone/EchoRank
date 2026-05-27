/**
 * Redis configuration constants for the EchoRank platform.
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
    commandTimeout: 5_000,
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
  | "analytics-aggregation";

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
];
