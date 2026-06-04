# CSV Import (Data Sources)

Imports reviews from CSV exports (Google, Facebook, Trustpilot, or any tool) and
feeds every row through the **same** ingestion pipeline as platform-monitored
reviews — normalize → dedup → AI analysis → reputation scoring → escalation.
There is no parallel processing path.

## Flow

```
Upload CSV (multipart)                POST /api/imports
  → parse headers + sample            (papaparse, server-side)
  → stage raw text in ImportJob       status = PENDING_MAPPING
  → suggest column mapping + platform
Confirm mapping                       POST /api/imports/[id]/commit
  → upsert synthetic MonitoringSource (platform, externalId="csv-import")
  → enqueue csv-import job            status = QUEUED
Worker (csv-import)
  → re-parse staged text w/ mapping
  → buildReviews() → ExternalReviewInput[]
  → persistAndDispatchReviews():
       batch dedup → createMany
       → addJob("ai-processing","analyze-review") per new review
       → eventBus.emit(REVIEW_PUBLISHED)  // reputation + escalation consumers
  → update counts, status = COMPLETED | PARTIAL | FAILED
Poll progress                         GET /api/imports/[id]
```

## Key design points

- **Dedup is idempotent.** `deduplicationKey = "{platform}:{externalId}"` (the
  existing `ReviewNormalizer` convention). When a CSV has a native review-id
  column, it's used as `externalId`; otherwise a stable SHA-256 of
  `tenantId|platform|author|content|publishedAt|rating` is synthesized, so
  re-importing the same file inserts nothing new.
- **Synthetic source.** All CSV reviews for a `(tenant, platform)` attach to one
  `MonitoringSource` row with `externalId = "csv-import"` (not polled —
  `checkInterval` is 1 day). This satisfies the required `ExternalReview.sourceId`
  FK and makes CSV reviews show up in the same dashboards.
- **Staging.** Raw text is held in `ImportJob.rawContent` (5 MB cap, see
  `MAX_IMPORT_BYTES`) between preview and commit, and cleared on success. For
  larger files, move staging to object storage.
- **Rating coercion** handles `4`, `4.0`, `4/5`, `4 stars`, and Facebook
  `recommends` / `doesn't recommend` → 1–5 (clamped). Unparseable ratings become
  content-only reviews.
- **Feature gate:** `requireFeature("ai_analysis")` (Growth+). To re-tier, change
  the `IMPORT_FEATURE` constant in the three `/api/imports` route files.

## Files

| Area | Path |
|---|---|
| Schema | `prisma/schema.prisma` (`ImportJob`, `ImportStatus`, `ImportSourceFormat`) |
| Shared pipeline | `src/monitoring/ingestion/persist.ts` |
| Parser / presets / validation | `src/monitoring/import/{csv-parser,source-presets,validation}.ts` |
| Worker | `src/infrastructure/queue/workers/csv-import.worker.ts` |
| Queue wiring | `redis/config.ts`, `queue/jobs/schemas.ts`, `queue/registry.ts`, `queue/start-workers.ts` |
| API | `src/app/api/imports/route.ts`, `.../[id]/route.ts`, `.../[id]/commit/route.ts` |
| UI | `src/app/(dashboard)/imports/page.tsx`, `src/components/layout/sidebar.tsx` |
| Tests | `src/monitoring/import/__tests__/csv-parser.test.ts` |

## Deploy

From `/opt/echorank/app`:

```bash
# 1. install the new dependency (papaparse + types already in package.json)
npm install

# 2. apply the schema (no migrations dir — matches the db:push workflow)
npx prisma generate
npx prisma db push          # creates import_jobs + the two enums

# 3. rebuild the app
npm run build

# 4. restart web + workers (the worker process must reload to pick up csv-import)
pm2 restart echorank-web echorank-workers   # adjust to your PM2 process names

# 5. (optional) run the parser tests
npm run test:imports
```

Then open **Data Sources** in the sidebar, upload a CSV, map columns, and import.
Imported reviews appear in Monitoring / Intelligence once the ai-processing and
reputation workers drain (a few seconds).

## Environment

No new environment variables. CSV import uses the existing Redis/BullMQ and
Postgres configuration.
