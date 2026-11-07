-- The AI readiness score (av-service ai_readiness.py, SCORE_VERSION 2) replaces
-- the seven-check score. Every stored audit says which version produced it, so
-- monitoring compares like with like and charts break at the change.
--
-- Hand-written, additive. Existing rows are version 1 (the DEFAULT fills them),
-- which is what they are; nothing is rescored. Guarded, so a second apply is a
-- no-op. Applied by `prisma migrate deploy` in sudo echorank360-deploy.

ALTER TABLE "visibility_audits" ADD COLUMN IF NOT EXISTS "scoreVersion" INTEGER NOT NULL DEFAULT 1;
