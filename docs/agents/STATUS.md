# Security Program Status — index (2026-07-31)

DONE: backups (D1: nightly all-DB verified; off-box + restore-test open) ·
Redis secret incident closed (rotated, logger masked, logs purged) ·
av-service git history purged + secrets gitignored, INTERNAL_API_SECRET rotated
(**ANTHROPIC_API_KEY still open — M5**) · Postgres
hardened (logging on, CREATEDB revoked; assessment: strongest layer) · role
guards verified on privileged routes · GSC OAuth encrypted+scoped · H3/M4
cleared as false positives.

SESSION QUEUE (each = one Claude Code session against its spec):
1. SECURITY.md: H1 Brevo signature + M1 select sweep + MONITOR.md MR1 alerts
2. IDENTITY.md I1: deactivation + token revocation (unlocks MFA, reviews)
3. ACCESS.md LP1+LP2: permission map sweep + audit coverage
4. SECURITY.md H4: RLS rollout (one table proven, then all)
5. MONITOR.md MR2-4: detection jobs
6. DATA.md DP4-6: retention job, pino redact, erase verification
7. IDENTITY.md I2-I4: SSO, MFA, conditional access
8. Port spec Phase 1: Domain Overview (creds live, fixture recorded)

OPERATOR (Frederic): **rotate + revoke the av-service ANTHROPIC_API_KEY — SECURITY.md
M5, the one open half of the 2026-07-30 av-service secret incident** · S3/R2 keys →
off-box backups + restore test · apt upgrade + reboot (kernel pending) · root→user pm2
migration (H2) · Node 22 · G1 recon answers (billing/Tailscale) · confirm Brevo DPA +
Cloudflare DPA.

Docs: SECURITY, IDENTITY, ACCESS, DATA, GOVERNANCE, MONITOR, BLOCKERS.
