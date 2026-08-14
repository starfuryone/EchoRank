-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('AI_VISIBILITY', 'STARTER', 'GROWTH', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('NEW', 'CONTACTED', 'SATISFIED', 'NEEDS_FOLLOWUP', 'RECOVERED', 'LOST');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PLAN', 'WATCHER');

-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('EMAIL_SENT', 'SMS_SENT', 'WEBHOOK_CALL', 'API_REQUEST', 'AI_TOKEN_USAGE', 'AI_INFERENCE', 'REVIEW_CONVERSION', 'ESCALATION_EVENT', 'FEEDBACK_REQUEST', 'MONITORING_CHECK');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MonitoringPlatform" AS ENUM ('GOOGLE', 'FACEBOOK', 'TRUSTPILOT', 'YELP', 'REDDIT', 'TWITTER', 'TIKTOK', 'YOUTUBE', 'APP_STORE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING_MAPPING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportSourceFormat" AS ENUM ('GENERIC_CSV', 'GOOGLE_CSV', 'FACEBOOK_CSV', 'TRUSTPILOT_CSV', 'EXCEL', 'EXTENSION');

-- CreateEnum
CREATE TYPE "VisibilityCadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "GscConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- CreateEnum
CREATE TYPE "BotLogStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "GaConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckupStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('OK', 'SKIPPED_CAP', 'FAILED');

-- CreateEnum
CREATE TYPE "PromptSource" AS ENUM ('SUGGESTED', 'CUSTOM', 'EDITED');

-- CreateEnum
CREATE TYPE "PromptFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "CitationType" AS ENUM ('EDITORIAL', 'COMPARISON', 'REVIEW', 'DOCS', 'FORUM', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PUBLISHER', 'VENDOR', 'MARKETPLACE', 'COMMUNITY', 'DOCS', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('CONTENT_GAP', 'CITATION_OPPORTUNITY', 'WEAK_ASSOCIATION', 'NEGATIVE_SENTIMENT', 'STRUCTURED_DATA', 'ENTITY_SIGNAL', 'AUTHORITY_SIGNAL', 'HIGH_VALUE_PROMPT');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED', 'STALE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'INCONCLUSIVE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "EntityClass" AS ENUM ('RIVAL', 'PLATFORM', 'GENERIC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "brandPrimaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "brandSecondaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "supportEmail" TEXT,
    "googleReviewLink" TEXT,
    "facebookReviewLink" TEXT,
    "trustpilotLink" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "planType" "PlanType" NOT NULL DEFAULT 'STARTER',
    "monthlyRequestLimit" INTEGER NOT NULL DEFAULT 300,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'TRIALING',
    "brand_voice_guide" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "whitelabel" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "welcomeSeenAt" TIMESTAMP(3),
    "onboardingDismissedAt" TIMESTAMP(3),
    "onboardingIntent" TEXT,
    "auditDomain" TEXT,
    "botAnalyticsDomain" TEXT,
    "onboarding" JSONB,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'NEW',
    "tags" TEXT[],
    "location" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "routedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "location" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "clickedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "providerMessageId" TEXT,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalResponses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "productKind" "ProductKind" NOT NULL DEFAULT 'PLAN',
    "status" "BillingStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "correlationId" TEXT,
    "causationId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_meters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "webhookCalls" INTEGER NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "aiInferences" INTEGER NOT NULL DEFAULT 0,
    "aiCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedbackRequests" INTEGER NOT NULL DEFAULT 0,
    "reviewConversions" INTEGER NOT NULL DEFAULT 0,
    "escalationEvents" INTEGER NOT NULL DEFAULT 0,
    "monitoringChecks" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_quotas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "maxEmailsPerMonth" INTEGER NOT NULL DEFAULT 300,
    "maxSmsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "maxWebhooksPerMonth" INTEGER NOT NULL DEFAULT 1000,
    "maxApiRequestsPerDay" INTEGER NOT NULL DEFAULT 10000,
    "maxAiInferencesPerMonth" INTEGER NOT NULL DEFAULT 100,
    "maxMonitoringChecks" INTEGER NOT NULL DEFAULT 0,
    "overageAllowed" BOOLEAN NOT NULL DEFAULT false,
    "overageRateEmail" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "overageRateSms" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "overageRateAi" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedbackRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "customerRetentionDays" INTEGER NOT NULL DEFAULT 1095,
    "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "eventRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "autoDeleteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gdprCompliant" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "deletedBy" TEXT,
    "reason" TEXT,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "restorable" BOOLEAN NOT NULL DEFAULT true,
    "snapshotData" JSONB,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "location" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "responseRateScore" DOUBLE PRECISION NOT NULL,
    "recoveryScore" DOUBLE PRECISION NOT NULL,
    "reviewVelocityScore" DOUBLE PRECISION NOT NULL,
    "volatilityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "trendDirection" TEXT NOT NULL DEFAULT 'stable',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedbackId" TEXT,
    "externalReviewId" TEXT,
    "analysisType" TEXT NOT NULL,
    "sentimentLabel" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "escalationProbability" DOUBLE PRECISION,
    "publicPostProbability" DOUBLE PRECISION,
    "churnProbability" DOUBLE PRECISION,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "intent" TEXT,
    "entities" JSONB,
    "emotions" JSONB,
    "topics" JSONB,
    "suggestedAction" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelId" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "feedbackId" TEXT,
    "externalReviewId" TEXT,
    "alertType" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" "MonitoringPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "credentials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "checkInterval" INTEGER NOT NULL DEFAULT 3600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "platform" "MonitoringPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "content" TEXT,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3),
    "url" TEXT,
    "replyContent" TEXT,
    "repliedAt" TIMESTAMP(3),
    "sentimentLabel" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tags" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT,
    "messageId" TEXT,
    "emailLogId" TEXT,
    "smsLogId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_api_calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_prices" (
    "id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'month',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT,
    "filename" TEXT NOT NULL,
    "format" "ImportSourceFormat" NOT NULL DEFAULT 'GENERIC_CSV',
    "platform" "MonitoringPlatform" NOT NULL DEFAULT 'CUSTOM',
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING_MAPPING',
    "rawContent" TEXT,
    "hasHeaderRow" BOOLEAN NOT NULL DEFAULT true,
    "detectedColumns" JSONB,
    "columnMapping" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_monitors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cadence" "VisibilityCadence" NOT NULL DEFAULT 'WEEKLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScore" INTEGER,
    "lastGrade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_audits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "monitorId" TEXT,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "bots" JSONB NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_prompts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandProfileId" TEXT,
    "category" TEXT,
    "intent" TEXT,
    "audience" TEXT,
    "market" TEXT,
    "language" TEXT DEFAULT 'en',
    "source" "PromptSource",
    "country" TEXT,
    "relevanceScore" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestionScore" INTEGER,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "commercialValue" INTEGER,
    "importanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "trackingFrequency" "PromptFrequency" NOT NULL DEFAULT 'WEEKLY',

    CONSTRAINT "tracked_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'claude',
    "model" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "brandRank" INTEGER,
    "competitors" JSONB NOT NULL,
    "excerpt" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkupId" TEXT,
    "repetition" INTEGER NOT NULL DEFAULT 1,
    "status" "RunStatus" NOT NULL DEFAULT 'OK',
    "rawResponse" TEXT,
    "normalizedResponse" TEXT,
    "responseHash" TEXT,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "location" TEXT,
    "persona" TEXT,

    CONSTRAINT "prompt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeHash" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "title" TEXT,
    "body" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "drivers" JSONB NOT NULL,
    "signalCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRiskConfig" (
    "tenantId" TEXT NOT NULL,
    "monthlyRevenue" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "riskElasticity" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "alertEmails" TEXT,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRiskConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "address" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'google',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "googleEmail" TEXT,
    "siteUrl" TEXT,
    "status" "GscConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastRowsSynced" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gsc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_query_stats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "gsc_query_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoApiCall" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "resultAt" TIMESTAMP(3),
    "dataforseoTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoDomainSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoDomainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordOverviewCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeywordOverviewCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "dataforseoTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "results" JSONB,
    "serpFeatures" JSONB,
    "itemCount" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SerpCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteExplorerAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "overview" JSONB,
    "rankedKeywords" JSONB,
    "competitors" JSONB,
    "backlinks" JSONB,
    "failedSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteExplorerAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_lens_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "gapPercent" DECIMAL(5,1) NOT NULL,
    "rawWordCount" INTEGER NOT NULL,
    "renderedWordCount" INTEGER NOT NULL,
    "missingBlocks" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_lens_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_access_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "robotsPresent" BOOLEAN NOT NULL DEFAULT false,
    "sitemapFound" BOOLEAN NOT NULL DEFAULT false,
    "llmsTxt" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_access_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_log_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "BotLogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "linesParsed" INTEGER NOT NULL DEFAULT 0,
    "linesSkipped" INTEGER NOT NULL DEFAULT 0,
    "botHits" INTEGER NOT NULL DEFAULT 0,
    "aggregates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bot_log_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "overCap" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankKeyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "position" INTEGER,
    "url" TEXT,
    "serpFeatures" JSONB,
    "dataforseoTaskId" TEXT,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklinksAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "summary" JSONB,
    "history" JSONB,
    "referringDomains" JSONB,
    "anchors" JSONB,
    "pages" JSONB,
    "failedSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklinksAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_searches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT 'topic',
    "params" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "summary" JSONB,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LighthouseAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "crux" JSONB,
    "lighthouseVersion" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LighthouseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL,
    "dataforseoTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "issues" JSONB,
    "pages" JSONB,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ga_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyName" TEXT,
    "status" "GaConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ga_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matrix_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "mxid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "matrix_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "status" "CrawlStatus" NOT NULL DEFAULT 'QUEUED',
    "urlCap" INTEGER NOT NULL,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "stoppedReason" TEXT,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_pages" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "redirectTarget" TEXT,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescLength" INTEGER,
    "h1Count" INTEGER,
    "canonical" TEXT,
    "metaRobots" TEXT,
    "wordCount" INTEGER,
    "contentHash" TEXT,
    "depth" INTEGER NOT NULL,
    "internalLinks" INTEGER,
    "fetchMs" INTEGER,
    "contentType" TEXT,
    "inlinkCount" INTEGER,
    "inSitemap" BOOLEAN,

    CONSTRAINT "crawl_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_issues" (
    "id" TEXT NOT NULL,
    "crawlPageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "crawl_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serp_volatility_samples" (
    "id" TEXT NOT NULL,
    "sampledOn" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "topDomains" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_volatility_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "onboardedAt" TIMESTAMP(3),
    "onboardingEvidence" JSONB,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trackingActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "status" "CheckupStatus" NOT NULL DEFAULT 'PENDING',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promptCount" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 1,
    "visibilityScore" DOUBLE PRECISION,
    "repeatabilityScore" DOUBLE PRECISION,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "stoppedReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mention_analyses" (
    "id" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "listPosition" INTEGER,
    "competitorNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citedOwnDomain" BOOLEAN NOT NULL DEFAULT false,
    "citedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contextSnippets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommended" BOOLEAN,
    "recommendationStrength" DOUBLE PRECISION,
    "sentiment" TEXT,
    "quotedDescription" TEXT,
    "factualClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "possibleInaccuracies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "visibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstPosition" INTEGER,
    "recommendationPosition" INTEGER,
    "prominenceScore" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB,
    "quarantinedAt" TIMESTAMP(3),
    "quarantineReason" TEXT,

    CONSTRAINT "mention_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_trends" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visibilityScore" DOUBLE PRECISION NOT NULL,
    "repeatabilityScore" DOUBLE PRECISION,
    "mentionRate" DOUBLE PRECISION,
    "byProvider" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkup_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_calls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checkupId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'answer',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "stripeSessionId" TEXT,
    "version" TEXT NOT NULL,
    "documents" JSONB NOT NULL,
    "plan" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_engines" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "supportsSearch" BOOLEAN NOT NULL DEFAULT false,
    "supportsCitations" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "citationPosition" INTEGER,
    "supportsBrand" BOOLEAN NOT NULL DEFAULT false,
    "supportsCompetitor" TEXT,
    "citationType" "CitationType" NOT NULL DEFAULT 'OTHER',
    "verifiedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "titleMatches" BOOLEAN,
    "brandOnPage" BOOLEAN,
    "competitorOnPage" BOOLEAN,
    "verifyError" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_mentions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "firstPosition" INTEGER,
    "recommendationPosition" INTEGER,
    "prominenceScore" INTEGER NOT NULL DEFAULT 0,
    "sentiment" TEXT,
    "context" TEXT,
    "classification" "EntityClass",
    "classifierVersion" INTEGER NOT NULL DEFAULT 0,
    "classificationTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_metrics" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visibilityScore" DOUBLE PRECISION NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "citationScore" DOUBLE PRECISION,
    "recommendationScore" DOUBLE PRECISION NOT NULL,
    "sentimentScore" DOUBLE PRECISION,
    "shareOfVoice" DOUBLE PRECISION,
    "averagePosition" DOUBLE PRECISION,
    "mentionRate" DOUBLE PRECISION NOT NULL,
    "top3Rate" DOUBLE PRECISION NOT NULL,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "partialCoverage" BOOLEAN NOT NULL DEFAULT false,
    "skippedRuns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "brandsSupported" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandCitations" INTEGER NOT NULL DEFAULT 0,
    "competitorCitations" INTEGER NOT NULL DEFAULT 0,
    "distinctEngines" INTEGER NOT NULL DEFAULT 0,
    "commercialPromptCount" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" DOUBLE PRECISION,
    "topicalCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceType" "SourceType" NOT NULL DEFAULT 'OTHER',
    "influenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "estimatedImpact" DOUBLE PRECISION NOT NULL,
    "effort" DOUBLE PRECISION NOT NULL,
    "priority" DOUBLE PRECISION NOT NULL,
    "priorityBand" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "promptId" TEXT,
    "sourceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'RUNNING',
    "hypothesis" TEXT NOT NULL,
    "baseline" JSONB NOT NULL,
    "result" JSONB,
    "pValue" DOUBLE PRECISION,
    "successful" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

-- CreateIndex
CREATE INDEX "customers_tenantId_email_idx" ON "customers"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_token_key" ON "feedback"("token");

-- CreateIndex
CREATE INDEX "feedback_tenantId_idx" ON "feedback"("tenantId");

-- CreateIndex
CREATE INDEX "feedback_token_idx" ON "feedback"("token");

-- CreateIndex
CREATE INDEX "feedback_tenantId_status_idx" ON "feedback"("tenantId", "status");

-- CreateIndex
CREATE INDEX "feedback_tenantId_rating_idx" ON "feedback"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "feedback_tenantId_createdAt_idx" ON "feedback"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_tenantId_customerId_idx" ON "feedback"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "feedback_tenantId_campaignId_idx" ON "feedback"("tenantId", "campaignId");

-- CreateIndex
CREATE INDEX "feedback_status_routedAt_idx" ON "feedback"("status", "routedAt");

-- CreateIndex
CREATE INDEX "review_links_tenantId_idx" ON "review_links"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_feedbackId_key" ON "review_requests"("feedbackId");

-- CreateIndex
CREATE INDEX "email_templates_tenantId_idx" ON "email_templates"("tenantId");

-- CreateIndex
CREATE INDEX "sms_templates_tenantId_idx" ON "sms_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_tickets_feedbackId_key" ON "recovery_tickets"("feedbackId");

-- CreateIndex
CREATE INDEX "recovery_tickets_tenantId_idx" ON "recovery_tickets"("tenantId");

-- CreateIndex
CREATE INDEX "recovery_tickets_tenantId_status_idx" ON "recovery_tickets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "recovery_tickets_tenantId_priority_idx" ON "recovery_tickets"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "recovery_tickets_tenantId_createdAt_idx" ON "recovery_tickets"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_tenantId_idx" ON "email_logs"("tenantId");

-- CreateIndex
CREATE INDEX "email_logs_tenantId_status_idx" ON "email_logs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "email_logs_tenantId_createdAt_idx" ON "email_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_customerId_tenantId_idx" ON "email_logs"("customerId", "tenantId");

-- CreateIndex
CREATE INDEX "email_logs_providerMessageId_idx" ON "email_logs"("providerMessageId");

-- CreateIndex
CREATE INDEX "sms_logs_tenantId_idx" ON "sms_logs"("tenantId");

-- CreateIndex
CREATE INDEX "sms_logs_tenantId_createdAt_idx" ON "sms_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "sms_logs_providerMessageId_idx" ON "sms_logs"("providerMessageId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns"("tenantId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_status_idx" ON "campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_createdAt_idx" ON "campaigns"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_action_idx" ON "audit_logs"("tenantId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entity_idx" ON "audit_logs"("tenantId", "entity");

-- CreateIndex
CREATE INDEX "domain_events_tenantId_idx" ON "domain_events"("tenantId");

-- CreateIndex
CREATE INDEX "domain_events_eventType_idx" ON "domain_events"("eventType");

-- CreateIndex
CREATE INDEX "domain_events_status_idx" ON "domain_events"("status");

-- CreateIndex
CREATE INDEX "domain_events_correlationId_idx" ON "domain_events"("correlationId");

-- CreateIndex
CREATE INDEX "domain_events_createdAt_idx" ON "domain_events"("createdAt");

-- CreateIndex
CREATE INDEX "domain_events_tenantId_eventType_idx" ON "domain_events"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "domain_events_tenantId_createdAt_idx" ON "domain_events"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "domain_events_tenantId_eventType_aggregateId_correlationId_key" ON "domain_events"("tenantId", "eventType", "aggregateId", "correlationId");

-- CreateIndex
CREATE INDEX "usage_meters_tenantId_idx" ON "usage_meters"("tenantId");

-- CreateIndex
CREATE INDEX "usage_meters_tenantId_meterType_idx" ON "usage_meters"("tenantId", "meterType");

-- CreateIndex
CREATE INDEX "usage_meters_tenantId_recordedAt_idx" ON "usage_meters"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "usage_snapshots_tenantId_idx" ON "usage_snapshots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_snapshots_tenantId_periodStart_periodEnd_key" ON "usage_snapshots"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quotas_tenantId_key" ON "tenant_quotas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_tenantId_key" ON "data_retention_policies"("tenantId");

-- CreateIndex
CREATE INDEX "deletion_logs_tenantId_idx" ON "deletion_logs"("tenantId");

-- CreateIndex
CREATE INDEX "deletion_logs_entityType_entityId_idx" ON "deletion_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "reputation_scores_tenantId_idx" ON "reputation_scores"("tenantId");

-- CreateIndex
CREATE INDEX "reputation_scores_tenantId_location_idx" ON "reputation_scores"("tenantId", "location");

-- CreateIndex
CREATE INDEX "reputation_scores_tenantId_createdAt_idx" ON "reputation_scores"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_analyses_tenantId_idx" ON "ai_analyses"("tenantId");

-- CreateIndex
CREATE INDEX "ai_analyses_feedbackId_idx" ON "ai_analyses"("feedbackId");

-- CreateIndex
CREATE INDEX "ai_analyses_analysisType_idx" ON "ai_analyses"("analysisType");

-- CreateIndex
CREATE INDEX "ai_analyses_riskLevel_idx" ON "ai_analyses"("riskLevel");

-- CreateIndex
CREATE INDEX "ai_analyses_tenantId_createdAt_idx" ON "ai_analyses"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "escalation_alerts_tenantId_idx" ON "escalation_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "escalation_alerts_tenantId_riskLevel_idx" ON "escalation_alerts"("tenantId", "riskLevel");

-- CreateIndex
CREATE INDEX "escalation_alerts_tenantId_acknowledged_idx" ON "escalation_alerts"("tenantId", "acknowledged");

-- CreateIndex
CREATE INDEX "monitoring_sources_tenantId_idx" ON "monitoring_sources"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_sources_tenantId_platform_externalId_key" ON "monitoring_sources"("tenantId", "platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "external_reviews_deduplicationKey_key" ON "external_reviews"("deduplicationKey");

-- CreateIndex
CREATE INDEX "external_reviews_tenantId_idx" ON "external_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "external_reviews_tenantId_platform_idx" ON "external_reviews"("tenantId", "platform");

-- CreateIndex
CREATE INDEX "external_reviews_tenantId_riskLevel_idx" ON "external_reviews"("tenantId", "riskLevel");

-- CreateIndex
CREATE INDEX "external_reviews_sourceId_idx" ON "external_reviews"("sourceId");

-- CreateIndex
CREATE INDEX "external_reviews_publishedAt_idx" ON "external_reviews"("publishedAt");

-- CreateIndex
CREATE INDEX "external_reviews_tenantId_createdAt_idx" ON "external_reviews"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "external_reviews_tenantId_sentimentLabel_idx" ON "external_reviews"("tenantId", "sentimentLabel");

-- CreateIndex
CREATE INDEX "system_metrics_metricName_recordedAt_idx" ON "system_metrics"("metricName", "recordedAt");

-- CreateIndex
CREATE INDEX "system_metrics_tenantId_metricName_idx" ON "system_metrics"("tenantId", "metricName");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_stripeEventId_key" ON "processed_webhooks"("stripeEventId");

-- CreateIndex
CREATE INDEX "processed_webhooks_eventType_idx" ON "processed_webhooks"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "message_events_dedupeKey_key" ON "message_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "message_events_tenantId_idx" ON "message_events"("tenantId");

-- CreateIndex
CREATE INDEX "message_events_emailLogId_idx" ON "message_events"("emailLogId");

-- CreateIndex
CREATE INDEX "message_events_smsLogId_idx" ON "message_events"("smsLogId");

-- CreateIndex
CREATE INDEX "message_events_event_idx" ON "message_events"("event");

-- CreateIndex
CREATE INDEX "ai_api_calls_tenant_id_created_at_idx" ON "ai_api_calls"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_prices_stripe_price_id_key" ON "stripe_prices"("stripe_price_id");

-- CreateIndex
CREATE INDEX "stripe_prices_plan_tier_currency_interval_active_idx" ON "stripe_prices"("plan_tier", "currency", "interval", "active");

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_idx" ON "import_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_status_idx" ON "import_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_createdAt_idx" ON "import_jobs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_sourceId_idx" ON "import_jobs"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_tokenHash_key" ON "extension_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "extension_tokens_tenantId_idx" ON "extension_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "extension_tokens_userId_idx" ON "extension_tokens"("userId");

-- CreateIndex
CREATE INDEX "extension_tokens_tokenHash_idx" ON "extension_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "visibility_monitors_active_nextRunAt_idx" ON "visibility_monitors"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "visibility_monitors_tenantId_url_key" ON "visibility_monitors"("tenantId", "url");

-- CreateIndex
CREATE INDEX "visibility_audits_tenantId_createdAt_idx" ON "visibility_audits"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "visibility_audits_monitorId_createdAt_idx" ON "visibility_audits"("monitorId", "createdAt");

-- CreateIndex
CREATE INDEX "tracked_prompts_active_nextRunAt_idx" ON "tracked_prompts"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "tracked_prompts_brandProfileId_selected_idx" ON "tracked_prompts"("brandProfileId", "selected");

-- CreateIndex
CREATE INDEX "tracked_prompts_active_trackingFrequency_nextRunAt_idx" ON "tracked_prompts"("active", "trackingFrequency", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_prompts_tenantId_text_key" ON "tracked_prompts"("tenantId", "text");

-- CreateIndex
CREATE INDEX "prompt_runs_tenantId_createdAt_idx" ON "prompt_runs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_runs_promptId_createdAt_idx" ON "prompt_runs"("promptId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_runs_checkupId_engine_idx" ON "prompt_runs"("checkupId", "engine");

-- CreateIndex
CREATE INDEX "prompt_runs_promptId_engine_createdAt_idx" ON "prompt_runs"("promptId", "engine", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_runs_checkupId_promptId_engine_repetition_key" ON "prompt_runs"("checkupId", "promptId", "engine", "repetition");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_dedupeHash_key" ON "Signal"("dedupeHash");

-- CreateIndex
CREATE INDEX "Signal_tenantId_occurredAt_idx" ON "Signal"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "Signal_tenantId_source_occurredAt_idx" ON "Signal"("tenantId", "source", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "RiskSnapshot_tenantId_day_idx" ON "RiskSnapshot"("tenantId", "day" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RiskSnapshot_tenantId_day_key" ON "RiskSnapshot"("tenantId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_dedupeKey_key" ON "AlertEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AlertEvent_tenantId_createdAt_idx" ON "AlertEvent"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AlertEvent_notifiedAt_createdAt_idx" ON "AlertEvent"("notifiedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Competitor_tenantId_active_idx" ON "Competitor"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_tenantId_placeId_key" ON "Competitor"("tenantId", "placeId");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_competitorId_day_idx" ON "CompetitorSnapshot"("competitorId", "day" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshot_competitorId_day_key" ON "CompetitorSnapshot"("competitorId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_connections_tenantId_key" ON "gsc_connections"("tenantId");

-- CreateIndex
CREATE INDEX "gsc_query_stats_tenantId_query_date_idx" ON "gsc_query_stats"("tenantId", "query", "date");

-- CreateIndex
CREATE INDEX "gsc_query_stats_tenantId_date_idx" ON "gsc_query_stats"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_query_stats_tenantId_date_query_page_key" ON "gsc_query_stats"("tenantId", "date", "query", "page");

-- CreateIndex
CREATE INDEX "SeoApiCall_tenantId_createdAt_idx" ON "SeoApiCall"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoApiCall_tenantId_resultAt_idx" ON "SeoApiCall"("tenantId", "resultAt");

-- CreateIndex
CREATE INDEX "SeoApiCall_dataforseoTaskId_idx" ON "SeoApiCall"("dataforseoTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoDomainSnapshot_tenantId_target_locationCode_languageCode_key" ON "SeoDomainSnapshot"("tenantId", "target", "locationCode", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordOverviewCache_tenantId_keyword_locationCode_langu_key" ON "SeoKeywordOverviewCache"("tenantId", "keyword", "locationCode", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "SerpCheck_dataforseoTaskId_key" ON "SerpCheck"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SerpCheck_tenantId_keyword_locationCode_languageCode_device_idx" ON "SerpCheck"("tenantId", "keyword", "locationCode", "languageCode", "device", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SerpCheck_tenantId_createdAt_idx" ON "SerpCheck"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SerpCheck_status_createdAt_idx" ON "SerpCheck"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SiteExplorerAnalysis_tenantId_domain_locationCode_languageC_idx" ON "SiteExplorerAnalysis"("tenantId", "domain", "locationCode", "languageCode", "createdAt");

-- CreateIndex
CREATE INDEX "SiteExplorerAnalysis_tenantId_createdAt_idx" ON "SiteExplorerAnalysis"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_lens_analyses_tenantId_url_createdAt_idx" ON "ai_lens_analyses"("tenantId", "url", "createdAt");

-- CreateIndex
CREATE INDEX "ai_lens_analyses_tenantId_createdAt_idx" ON "ai_lens_analyses"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "bot_access_checks_tenantId_checkedAt_idx" ON "bot_access_checks"("tenantId", "checkedAt");

-- CreateIndex
CREATE INDEX "bot_log_analyses_tenantId_createdAt_idx" ON "bot_log_analyses"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RankProject_tenantId_createdAt_idx" ON "RankProject"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RankProject_active_frequency_idx" ON "RankProject"("active", "frequency");

-- CreateIndex
CREATE INDEX "RankKeyword_projectId_idx" ON "RankKeyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RankKeyword_projectId_keyword_key" ON "RankKeyword"("projectId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_dataforseoTaskId_key" ON "RankSnapshot"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "RankSnapshot_keywordId_runDate_idx" ON "RankSnapshot"("keywordId", "runDate");

-- CreateIndex
CREATE INDEX "RankSnapshot_status_runDate_idx" ON "RankSnapshot"("status", "runDate");

-- CreateIndex
CREATE INDEX "BacklinksAnalysis_tenantId_target_mode_createdAt_idx" ON "BacklinksAnalysis"("tenantId", "target", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "BacklinksAnalysis_tenantId_createdAt_idx" ON "BacklinksAnalysis"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "content_searches_tenantId_query_createdAt_idx" ON "content_searches"("tenantId", "query", "createdAt");

-- CreateIndex
CREATE INDEX "content_searches_tenantId_createdAt_idx" ON "content_searches"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LighthouseAudit_tenantId_url_strategy_fetchedAt_idx" ON "LighthouseAudit"("tenantId", "url", "strategy", "fetchedAt");

-- CreateIndex
CREATE INDEX "LighthouseAudit_tenantId_fetchedAt_idx" ON "LighthouseAudit"("tenantId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAudit_dataforseoTaskId_key" ON "SiteAudit"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SiteAudit_tenantId_domain_createdAt_idx" ON "SiteAudit"("tenantId", "domain", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_tenantId_createdAt_idx" ON "SiteAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_status_createdAt_idx" ON "SiteAudit"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ga_connections_tenantId_key" ON "ga_connections"("tenantId");

-- CreateIndex
CREATE INDEX "page_snapshots_tenantId_url_capturedAt_idx" ON "page_snapshots"("tenantId", "url", "capturedAt");

-- CreateIndex
CREATE INDEX "page_snapshots_tenantId_contentHash_idx" ON "page_snapshots"("tenantId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "matrix_accounts_mxid_key" ON "matrix_accounts"("mxid");

-- CreateIndex
CREATE INDEX "matrix_accounts_tenantId_deactivatedAt_idx" ON "matrix_accounts"("tenantId", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "matrix_accounts_tenantId_appUserId_key" ON "matrix_accounts"("tenantId", "appUserId");

-- CreateIndex
CREATE INDEX "crawl_jobs_tenantId_createdAt_idx" ON "crawl_jobs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "crawl_pages_crawlJobId_idx" ON "crawl_pages"("crawlJobId");

-- CreateIndex
CREATE INDEX "crawl_pages_crawlJobId_contentHash_idx" ON "crawl_pages"("crawlJobId", "contentHash");

-- CreateIndex
CREATE INDEX "crawl_issues_crawlPageId_idx" ON "crawl_issues"("crawlPageId");

-- CreateIndex
CREATE INDEX "serp_volatility_samples_category_sampledOn_idx" ON "serp_volatility_samples"("category", "sampledOn");

-- CreateIndex
CREATE UNIQUE INDEX "serp_volatility_samples_sampledOn_keyword_locationCode_key" ON "serp_volatility_samples"("sampledOn", "keyword", "locationCode");

-- CreateIndex
CREATE INDEX "brand_profiles_tenantId_idx" ON "brand_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "checkups_brandProfileId_completedAt_idx" ON "checkups"("brandProfileId", "completedAt");

-- CreateIndex
CREATE INDEX "checkups_tenantId_createdAt_idx" ON "checkups"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mention_analyses_promptRunId_key" ON "mention_analyses"("promptRunId");

-- CreateIndex
CREATE INDEX "mention_analyses_quarantinedAt_idx" ON "mention_analyses"("quarantinedAt");

-- CreateIndex
CREATE INDEX "checkup_trends_brandProfileId_day_idx" ON "checkup_trends"("brandProfileId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_trends_brandProfileId_day_key" ON "checkup_trends"("brandProfileId", "day");

-- CreateIndex
CREATE INDEX "ai_provider_calls_tenantId_createdAt_idx" ON "ai_provider_calls"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_provider_calls_checkupId_provider_idx" ON "ai_provider_calls"("checkupId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "consent_events_stripeSessionId_key" ON "consent_events"("stripeSessionId");

-- CreateIndex
CREATE INDEX "consent_events_tenantId_createdAt_idx" ON "consent_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_events_email_idx" ON "consent_events"("email");

-- CreateIndex
CREATE INDEX "ai_engines_enabled_sortOrder_idx" ON "ai_engines"("enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ai_engines_provider_modelName_key" ON "ai_engines"("provider", "modelName");

-- CreateIndex
CREATE INDEX "citations_tenantId_domain_createdAt_idx" ON "citations"("tenantId", "domain", "createdAt");

-- CreateIndex
CREATE INDEX "citations_sourceId_createdAt_idx" ON "citations"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "citations_verifiedAt_idx" ON "citations"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "citations_promptRunId_url_key" ON "citations"("promptRunId", "url");

-- CreateIndex
CREATE INDEX "competitor_mentions_tenantId_classification_createdAt_idx" ON "competitor_mentions"("tenantId", "classification", "createdAt");

-- CreateIndex
CREATE INDEX "competitor_mentions_tenantId_name_createdAt_idx" ON "competitor_mentions"("tenantId", "name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_mentions_promptRunId_name_key" ON "competitor_mentions"("promptRunId", "name");

-- CreateIndex
CREATE INDEX "visibility_metrics_brandProfileId_day_idx" ON "visibility_metrics"("brandProfileId", "day" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visibility_metrics_brandProfileId_engine_day_key" ON "visibility_metrics"("brandProfileId", "engine", "day");

-- CreateIndex
CREATE INDEX "sources_brandProfileId_influenceScore_idx" ON "sources"("brandProfileId", "influenceScore" DESC);

-- CreateIndex
CREATE INDEX "sources_tenantId_domain_idx" ON "sources"("tenantId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "sources_brandProfileId_domain_key" ON "sources"("brandProfileId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_dedupeKey_key" ON "recommendations"("dedupeKey");

-- CreateIndex
CREATE INDEX "recommendations_brandProfileId_status_priority_idx" ON "recommendations"("brandProfileId", "status", "priority" DESC);

-- CreateIndex
CREATE INDEX "recommendations_tenantId_createdAt_idx" ON "recommendations"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "experiments_brandProfileId_status_idx" ON "experiments"("brandProfileId", "status");

-- CreateIndex
CREATE INDEX "experiments_tenantId_startedAt_idx" ON "experiments"("tenantId", "startedAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_links" ADD CONSTRAINT "review_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_tickets" ADD CONSTRAINT "recovery_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_tickets" ADD CONSTRAINT "recovery_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_tickets" ADD CONSTRAINT "recovery_tickets_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_snapshots" ADD CONSTRAINT "usage_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_quotas" ADD CONSTRAINT "tenant_quotas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_logs" ADD CONSTRAINT "deletion_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_scores" ADD CONSTRAINT "reputation_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_alerts" ADD CONSTRAINT "escalation_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_sources" ADD CONSTRAINT "monitoring_sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reviews" ADD CONSTRAINT "external_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reviews" ADD CONSTRAINT "external_reviews_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "monitoring_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "monitoring_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_monitors" ADD CONSTRAINT "visibility_monitors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_audits" ADD CONSTRAINT "visibility_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_audits" ADD CONSTRAINT "visibility_audits_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "visibility_monitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_prompts" ADD CONSTRAINT "tracked_prompts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_prompts" ADD CONSTRAINT "tracked_prompts_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_query_stats" ADD CONSTRAINT "gsc_query_stats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_lens_analyses" ADD CONSTRAINT "ai_lens_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_access_checks" ADD CONSTRAINT "bot_access_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_log_analyses" ADD CONSTRAINT "bot_log_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankKeyword" ADD CONSTRAINT "RankKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RankProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "RankKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_searches" ADD CONSTRAINT "content_searches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga_connections" ADD CONSTRAINT "ga_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mention_analyses" ADD CONSTRAINT "mention_analyses_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_trends" ADD CONSTRAINT "checkup_trends_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_mentions" ADD CONSTRAINT "competitor_mentions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_mentions" ADD CONSTRAINT "competitor_mentions_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_metrics" ADD CONSTRAINT "visibility_metrics_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

