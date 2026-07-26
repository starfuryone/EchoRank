# Data Protection — spec (2026-07-26)

Verified already-solved: GSC refresh tokens AES-256-GCM at rest
(lib/gsc/crypto.ts, env key) — reuse this helper for future secrets (MFA).
Real GDPR erase via gdprService.eraseCustomerData (OWNER-only) + export
route. Extension tokens have expiry + scopes. TLS: CF -> Caddy (security
headers present) -> localhost. No PII logging found in customer/feedback
routes. Repeatable-job infra exists (BullMQ repeat/cron in
visibility-monitoring.worker).

## DP1 — Classification (reference table, no tooling)
SECRET: .env values, GSC refresh tokens (encrypted), ApiKey inputs (hashed),
future mfaSecret. Never logged, never in responses, encrypted or hashed at
rest. PII: User.email, Customer.{name,email,phone}, feedback content,
EmailLog/SmsLog recipients, AuditLog.ipAddress. Erasable via gdprService,
never in logs, select-listed in responses (M1). BUSINESS: SEO data, metrics,
configs, snapshots. Standard handling.

## DP2 — Encryption gaps (small)
a) Auth.js Account.{refresh_token,access_token,id_token} are adapter-managed
   plaintext — before I2 (Google SSO) ships, decide: request no offline
   access (no refresh token stored) OR encrypt via lib/gsc/crypto pattern
   in an adapter wrapper. Default: no offline access; SSO login needs none.
b) Backup dumps unencrypted — encrypt before off-box upload:
   `age -r <recipient>` (or gpg -c with key in /root, mode 400) added to
   backup-all-dbs.sh S3 step. Local copies stay plain (disk is the boundary).
c) Disk not LUKS (Racknerd VPS) — accepted risk; note for future host moves.

## DP3 — Backups
Done (SECURITY.md D1). Open: off-box (new S3/R2 keys), dump encryption
(DP2b), one tested restore of echorank into a scratch db:
  createdb echorank_restore_test && gunzip -c <dump> | psql echorank_restore_test

## DP4 — Retention (the real gap: nothing expires today)
One repeatable BullMQ job (pattern "30 5 * * *", follow the
visibility-monitoring.worker repeat idiom), deleting where createdAt older
than: AuditLog 24mo; EmailLog/SmsLog 12mo (webhook correlation long dead);
WebhookEvent 3mo; SeoApiCall 24mo (billing history); expired
ExtensionToken + VerificationToken rows weekly. Config as a RETENTION map
in the job file. Log counts deleted per table (not contents).
Also: logrotate does NOT cover /root/.pm2/logs — add an /etc/logrotate.d/pm2
stanza (daily, rotate 14, compress) or pm2-logrotate module.

## DP5 — DLP, right-sized
a) pino redact config, one place: paths ["*.password","*.token","*.secret",
   "*.authorization","req.headers.cookie"] — belt for future log calls.
b) M1 select sweep (SECURITY.md) = anti-leak for responses. 
c) .gitignore: confirm *.env*, *.sql.gz, backups/ patterns (an .env backup
   reached /opt/backups once already).

## DP6 — Erasure verification (one-time)
Read infrastructure/compliance/gdpr.ts once: confirm eraseCustomerData covers
Customer -> feedback -> EmailLog/SmsLog -> audit details JSON; document the
table list in a comment; add any missed table. Export: verify it includes the
same set.

Sequencing: DP4+DP5a+DP6 = one small session. DP2b with the S3/R2 operator
task. DP2a decided inside I2.
