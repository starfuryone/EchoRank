-- The country a workspace owner declared at signup, and Cloudflare's IP country on
-- that request (src/lib/geo/blocked-countries.ts). Both nullable: existing tenants
-- have neither, and are not changed.
ALTER TABLE "Tenant" ADD COLUMN "signupCountry" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "signupIpCountry" TEXT;
