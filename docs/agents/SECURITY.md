# Security Assessment — 2026-07-26 (OWASP Top 10 aligned)

Scope: /opt/echorank/app (Next.js 16), av-service sidecar, VPS runtime.
Method: code recon via grep/read, live verification, one live incident.

## HIGH

### H1 — Brevo webhook: no signature verification (A08)
`src/app/api/webhooks/brevo/route.ts` accepts unauthenticated POSTs and looks
up `emailLog` by an id taken from the payload. Anyone can forge
delivery/bounce/spam events and pollute email state.
**Fix:** verify Brevo's webhook signature/IP allowlist; treat payload ids as
untrusted (scope lookups to the tenant on the log row); reject unsigned.

### H2 — Everything runs as root (A05)
All 9 pm2 processes run as root, including services unrelated to Echorank
(agoraiq-*, scanner-worker, tg-listener) sharing the box. One RCE in any of
them = full compromise incl. .env (file perms moot when reader is root).
**Fix:** create `echorank` system user; move pm2 tree (`pm2 save`, migrate
dump, `pm2 startup -u echorank`); repeat per service or isolate services onto
separate users. Largest single risk-reducer on this box.

### H3 — auth/register over-fetch may echo passwordHash (A02/leak)
`api/auth/register/route.ts` uses the User model (which has `passwordHash`)
without `select`. If the created/found user object is returned, the bcrypt
hash reaches the client.
**Fix:** verify response shape; add `select: { id, email, name }` on every
User query in the route. Then sweep H4's list.

## MEDIUM

### M1 — Response over-fetching: 15 routes without select (leak)
customers, customers/[id], review-links (x3), templates (x2), recovery/[id],
ai/alerts, ai/visibility/prompts, imports/[id]/commit, webhooks (x2),
seo/v1/keywords/overview, auth/register (→H3). PII-bearing models
(customers, review-links) ship full rows to the browser.
**Fix:** explicit `select` per route matching what the UI renders. Mechanical,
one pass.

### M2 — Secrets embedded in connection URLs; no rotation runbook (A05/A09)
Incident 2026-07-26: Redis URL logged in plaintext by
`infrastructure/redis/connection.ts`; first rotation burnt (new password
logged); a bad env-extraction regex during rotation took workers down ~4 min
across all queues. Logger now masks (commit 39f423c); password rotated twice;
logs flushed.
**Remaining fix:** split REDIS_HOST/PORT/PASSWORD env vars, assemble URL in
code; adopt the rotation runbook below for every secret.

### M3 — Dependency posture (A06)
`npm audit` cannot run: lockfile out of sync ("Invalid package tree"). Last
known count: 42 vulns (2 critical) — stale, unverifiable. Node v20.20.0 is
past EOL (Apr 2026); Prisma deps already warn for >=22.
**Fix:** `npm install` to rebuild lockfile → `npm audit` → remediate; plan
Node 22 LTS upgrade (test build + pm2 interpreter path).

### M4 — feedback/[token] echoes raw error.message (A09/leak)
Line ~181 returns `error.message` verbatim (can include Prisma internals).
**Fix:** map to typed codes as done in newer routes (`seoErrorResponse`
pattern).

## LOW

### L1 — Revoke CREATEDB from echorank_app
Granted 2026-07-26 for `migrate dev`, which is unusable anyway (BLOCKERS §5).
`ALTER USER echorank_app NOCREATEDB;`

### L2 — av-service SSRF surface: verify audit fetch path
No outbound HTTP libs found in av_service.py — audits likely run via
subprocess. Verify the subprocess target validation (reject RFC1918/localhost
targets) when touching that service next.

### L3 — Monitoring gap
`echorank360-web` restart counter at 307 caused alarm; actual unstable
restarts: 1. No process supervision alerting exists (an all-queues worker
outage today was only visible because we were looking).
**Fix (eventual):** pm2 max_restarts alerts or an uptime check on :4400.

## Verified healthy (no action)
- Tenant scoping in signals routes (resolveTenant + owned() findFirst pattern)
- API keys stored hashed (`keyHash` unique)
- bcrypt via shared hashPassword; set-password.ts documented CLI use
- JsonLd escapes </script> injection explicitly
- Redis requirepass set (rotated 2x today), bound to 127.0.0.1
- .env 600; Postgres local-only

## Rotation runbook (any secret)
1. Fix/verify no logger prints it (grep the secret's env var usage first).
2. Generate new value; apply to the SERVICE first (e.g. CONFIG SET), persist
   to its conf file in the same paste.
3. sed the exact .env line (anchored pattern, verify with masked grep after).
4. pm2 delete + start (NOT restart) any process whose env predates the change;
   pm2 save.
5. Verify: service PING/healthcheck, app logs clean, restart counters frozen.
6. Flush logs that held the old value; rm .env backups holding it.

## Remediation sequencing
- **Security phase (before Phase 1 resumes):** H1, H3, M1, M4 — one session,
  one commit, all in-repo code.
- **Operator window (30 min, low risk):** L1 now; M3 lockfile+audit now;
  H2 and Node 22 scheduled deliberately (each can break process startup).
