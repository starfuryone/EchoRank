-- Site Crawler Phase 3c: spell check accepted words, Lighthouse audit verdicts.
-- Generated with `prisma migrate diff --from-schema <pre-3c> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only. Lighthouse runs from before this have audits NULL; the
-- crawler reads their lab metrics instead.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "spellingAcceptedWords" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "LighthouseAudit" ADD COLUMN IF NOT EXISTS "audits" JSONB;
