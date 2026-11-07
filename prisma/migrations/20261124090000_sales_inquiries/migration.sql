-- Sales inquiries from /{locale}/enterprise/contact (src/lib/sales/inquiries.ts).
-- Additive only. Generated with `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` against a database at the previous
-- migration; the diff's two pre-existing drift statements (credit_ledger FK,
-- keyword_opportunity_analyses default) are deliberately left out. Every
-- statement is guarded, so applying it twice (psql, then migrate deploy) is a no-op.

DO $$ BEGIN
  CREATE TYPE "SalesInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sales_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "ipCountry" TEXT,
    "size" TEXT NOT NULL,
    "needs" TEXT[],
    "message" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT,
    "referrer" TEXT,
    "status" "SalesInquiryStatus" NOT NULL DEFAULT 'NEW',
    "notifiedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sales_inquiries_status_createdAt_idx" ON "sales_inquiries"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "sales_inquiries_closedAt_idx" ON "sales_inquiries"("closedAt");
