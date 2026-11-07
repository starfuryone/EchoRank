-- Marketing email only with an explicit opt-in (src/lib/email/unsubscribe.ts).
--
-- New workspaces start opted out; the signup form has an unticked box.
-- Existing workspaces: opted out, unless an explicit opt-in is on record. The
-- only one that exists is a ticked "tips and product news from Echorank" box on
-- a free-tool lead (free AI Visibility Check or free site crawler) whose email
-- is the workspace owner's. That opt-in is kept, with its date and source.
ALTER TABLE "tenants" ALTER COLUMN "marketingConsent" SET DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "marketingConsentSource" TEXT;

UPDATE "tenants" t
SET "marketingConsentAt" = optin.at,
    "marketingConsentSource" = 'free-tool-lead'
FROM (
  SELECT m."tenantId", MIN(l."createdAt") AS at
  FROM "tenant_members" m
  JOIN "users" u ON u."id" = m."userId"
  JOIN (
    SELECT lower("email") AS email, "createdAt" FROM "visibility_snapshot_leads" WHERE "marketingConsent" = true
    UNION ALL
    SELECT lower("email") AS email, "createdAt" FROM "free_crawl_leads" WHERE "marketingConsent" = true
  ) l ON l.email = lower(u."email")
  WHERE m."role" = 'OWNER'
  GROUP BY m."tenantId"
) optin
WHERE t."id" = optin."tenantId"
  AND t."marketingConsent" = true;

UPDATE "tenants" SET "marketingConsent" = false WHERE "marketingConsentAt" IS NULL;
