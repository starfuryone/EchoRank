# Monitoring & Response — spec (2026-07-26)

Exists: pino auth events (email/ip/xff/userId/reason) to pm2 logs; AuditLog
(indexed tenantId+action) — coverage expands via LP2; PG connection/DDL
logging (D2, enabled); backup log with exit codes. Missing: anything that
READS these and tells anyone. Design: signals into AuditLog/pino as today,
one detector job, one alert channel (email via Brevo — it's already wired).

## MR1 — Alert channel + heartbeat (first, tiny)
lib/alerts.ts: sendOpsAlert(subject, body) -> Brevo to OPS_ALERT_EMAIL.
Wire immediately into: backup script (exit!=0 -> alert — closes L3 for
backups), a pm2 watchdog (5-min cron: any echorank process restarts grown
by >3 since last check -> alert; state in Redis).

## MR2 — Suspicious sign-in detection
Detector job (BullMQ repeat, 15min) over recent auth events. Since pino
writes to files, FIRST persist auth outcomes to a table: in authorize(),
also createAuditLog({action:"auth.login.success|failure", details:{ip}}).
Rules: >=5 failures/same email/15min (-> alert + consider temp lock via I1
disabled); >=10 failures/same ip/15min across emails (spray); success from
never-seen ip for that user (needs lastLoginIp on User — add in I1's
migration) -> notify the USER (I4 overlap) + ops on OWNER accounts.

## MR3 — Permission & privilege changes
Already audited: role changes (team routes). Alert on top: any
"team.role_changed" where new role is OWNER/ADMIN, any member removal, any
API-key creation (once LP2 adds those logs) -> immediate ops email. Trivial:
createAuditLog wrapper checks an ALERT_ACTIONS set and fires MR1.

## MR4 — Mass export / unusual volume
Instrument the choke points, not everything: compliance/export (alert every
use — it's rare and OWNER-only, so any use is notable), customers list route
(if response count > 500 or repeated full-list pulls by one user/hour ->
audit row + alert), PDF report generation loops, api/public/v1 per-key rate
counter in Redis (>N/hour -> alert; complements LP4 scopes). SeoApiCall
spend spike: daily job compares tenant day-spend vs 7-day mean, >5x -> alert
(protects DataForSEO budget too).

## MR5 — Response runbook (docs, one page)
Per alert type: suspicious sign-in -> verify with user, I1 disable +
tokenVersion++ if hostile, review AuditLog for that userId. Privilege change
unexpected -> revert role, disable actor, rotate their sessions. Mass export
-> disable key/user, check what left (audit details), assess notification
duties. Worker/backup failure -> this engagement's own history is the
runbook (delete+recreate pm2, backup script re-run). Every incident: append
to docs/agents/INCIDENTS.md (Redis 2026-07-26 entry seeds it).

Dependencies: MR2/MR3 lean on I1 fields + LP2 audit coverage — sequence
MONITOR after those. MR1 has zero dependencies: do it in the security phase.
Explicitly out of scope: SIEM, anomaly ML, log shipping — revisit at real
team size.
