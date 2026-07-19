-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "auditDomain" TEXT,
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboarding" JSONB,
ADD COLUMN     "onboardingIntent" TEXT;

