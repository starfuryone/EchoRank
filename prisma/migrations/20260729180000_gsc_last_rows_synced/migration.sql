-- Rows stored by the most recent sync. Nullable, with no backfill: existing
-- connections have never recorded a count, and NULL ("unknown") is honest
-- where 0 ("the sync found nothing") would be a claim we cannot make.
ALTER TABLE "gsc_connections" ADD COLUMN "lastRowsSynced" INTEGER;
