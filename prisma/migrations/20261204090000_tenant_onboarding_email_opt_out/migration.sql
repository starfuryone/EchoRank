-- The onboarding drip is a service email (2026-11-14): sent to every new
-- account without marketing consent, with its own unsubscribe link. That link
-- sets this column; set = no more onboarding email
-- (src/lib/onboarding-email.ts). Null for every existing tenant, which means
-- "not opted out"; nothing is backfilled. Hand-written, additive, guarded so a
-- retried deploy is a no-op. Applied by `prisma migrate deploy` (sudo
-- echorank360-deploy), never by hand.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboardingEmailsOptedOutAt" TIMESTAMP(3);
