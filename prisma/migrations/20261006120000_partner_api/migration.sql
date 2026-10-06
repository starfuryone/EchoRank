-- Partner API (2026-10-06): key scopes + the partner call ledger.
--
-- ADDITIVE ONLY. Every existing api_keys row becomes scope "public", which is
-- exactly what it can call today. Every statement is guarded so a partial apply
-- re-runs as a no-op (docs/agents/gotchas.md, "A failed migration leaves rows behind").

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] DEFAULT ARRAY['public']::TEXT[];

CREATE TABLE IF NOT EXISTS "partner_calls" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "auditId" TEXT,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_calls_apiKeyId_createdAt_idx" ON "partner_calls"("apiKeyId", "createdAt");
CREATE INDEX IF NOT EXISTS "partner_calls_apiKeyId_auditId_idx" ON "partner_calls"("apiKeyId", "auditId");
CREATE INDEX IF NOT EXISTS "partner_calls_subject_createdAt_idx" ON "partner_calls"("subject", "createdAt");

DO $$ BEGIN
  ALTER TABLE "partner_calls" ADD CONSTRAINT "partner_calls_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
