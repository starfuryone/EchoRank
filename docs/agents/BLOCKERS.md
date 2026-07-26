# BLOCKERS — Classic SEO Tools

Updated: 2026-07-25 (session: package build, claude.ai sandbox)

## 1. Repository not reachable from this session — GATES EXECUTION OF ALL PHASES

- **What's missing:** `/opt/echorank/app` (branch `claude/reputation-management-saas-E8Uyk`).
  This session ran in the claude.ai sandbox, not on the VPS — no repo, no `.env`,
  no Prisma DB, no pm2. The DataForSEO domain is also not on the sandbox's
  network allowlist, so even a creds smoke test was impossible here.
- **Needed:** run the next session in Claude Code on the VPS
  (`cd /opt/echorank/app`), or upload the repo tree.
- **Gates:** Step 0 slug-collision check, merging into the real
  `src/lib/seo-tools.ts` type shape, Prisma migrate + baseline, `npm run build`,
  `npm test` against repo runner, pm2 restart, gating verification, commit.
- **Delivered instead:** full Phase 0 code with 24 passing unit tests (vitest,
  verified in-sandbox) + Phase 2 scaffolds + i18n ×5 + install script.

## 2. DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD — carried over, still unverified

- **What's missing:** creds presence in `/opt/echorank/app/.env` unconfirmed
  (this stopped the Jul 23 run).
- **Exact commands:**
  ```bash
  grep -c DATAFORSEO /opt/echorank/app/.env
  curl -s -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
    https://api.dataforseo.com/v3/appendix/user_data | head -c 400
  ```
- **Gates:** live Phase 0 gate (call returns cost + row written), fixture
  recording, Phases 1–7 live data.
- **Mitigation shipped:** `AUTH_FAILED` → typed `NOT_CONFIGURED` (503) on every
  route; `DATAFORSEO_FIXTURES=1` serves recorded envelopes with zero live spend
  and fails loudly on a missing fixture rather than silently going live.

## 3. Prisma phantom-migration drift — carried over

- Baseline BEFORE any `migrate dev`:
  ```bash
  npx prisma migrate resolve --applied <extension_tokens dir name>
  npx prisma migrate resolve --applied <visibility_monitoring dir name>
  ```
  (`ls prisma/migrations` for the full timestamped names.)
- **Gates:** `SeoApiCall` / snapshot-model migration in
  `prisma/classic-seo.fragment.prisma`.

## 4. Repo-shape assumptions to verify on first VPS session

- `prisma` client instance import path (`@/lib/db` assumed) — grep `new PrismaClient`.
- `requireTenant` helper name/location (`@/lib/tenant` assumed).
- `requirePaidPlan` signature in `src/lib/paid-plan.ts`.
- Exact `SeoToolGroup` / `SeoTool` field names in `src/lib/seo-tools.ts`.
- Whether a shared card-grid component already exists at `/visibility/tools`
  (if yes, delete the fallback `SeoToolCardGrid.tsx` and reuse theirs).
- Repo test runner (`npm test`) — tests here are vitest; adapt if it's jest.

## CLOSED 2026-07-26 — Blockers #2 (DataForSEO creds) and #1 partially

DATAFORSEO_LOGIN/PASSWORD live in .env (account marketing@echorank360.com,
delivered via the new Cloudflare catch-all). Live gate met: metered
keyword_overview call → cost 0.01212 billed from response → SeoApiCall row
written (feature keyword_research) → fixture recorded at
fixtures/dataforseo/. Balance check: v3/appendix/user_data returns 20000.
