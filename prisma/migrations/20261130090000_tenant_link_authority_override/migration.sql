-- Link Authority Checker: a per-tenant monthly check allowance set only by
-- staff in /admin/link-authority (an Enterprise contract above the plan's
-- default of 1,000). Null = the plan's value (plan-config.ts,
-- linkAuthorityChecksPerMonth). Read by src/lib/authority-checker/quota.ts.
-- Hand-written, additive, guarded so a retried deploy is a no-op. Applied by
-- `prisma migrate deploy` (sudo echorank360-deploy), never by hand.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "linkAuthorityChecksOverride" INTEGER;
