-- Free public site crawler: tenants.source ("customer" | "free"). The free
-- crawler's system tenant is created on first use, not here.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'customer';
