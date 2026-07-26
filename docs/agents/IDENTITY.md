# Identity Protection — phased spec (2026-07-26)

Stack facts (verified): Auth.js, Credentials provider, PrismaAdapter,
session strategy JWT (sessions table empty — no server-side revocation
today), no disabled flag on User, ip/xff logged on login events.

## I1 — Rapid deactivation + revocation (FIRST)
- Prisma: User gains `disabled Boolean @default(false)`, `tokenVersion Int
  @default(0)`, `lastLoginAt DateTime?` (migrate diff -> deploy, BLOCKERS §5).
- authorize(): reject disabled (same generic error as bad password); set
  lastLoginAt on success.
- jwt callback: embed tokenVersion at issue; re-check disabled+tokenVersion
  against DB each invocation — mismatch/disabled -> invalidate. One PK read
  per request.
- Admin: disable = disabled:true + tokenVersion++ (dead next request);
  "sign out everywhere" = tokenVersion++ only. Team routes reuse requireRole;
  audit both via createAuditLog.
- Tests: disabled login rejected; live token dies post-flag; version bump
  kills all sessions.

## I2 — Google SSO
- Google provider; Account table exists. Extract register's tenant-creation
  transaction into lib/signup.ts, reuse for SSO signups.
- No offline access (no refresh token stored — see DATA.md DP2a).
- allowDangerousEmailAccountLinking OFF; explicit link flow for existing
  credential users.

## I3 — MFA (TOTP)
- Schema: mfaSecret (encrypt via lib/gsc/crypto pattern), mfaEnabled,
  RecoveryCode table (hashed, single-use).
- Enroll: settings page, otplib QR, verify one code to enable.
- Login: authorize() -> mfaPending -> second step TOTP/recovery; rate-limit
  5/15min in Redis. Recovery codes shown once; regen invalidates.
- Depends on I1 (lockout uses disabled).

## I4 — Conditional access (right-sized)
- Re-auth for: billing, team roles, API-key create/reveal, MFA disable.
- New-IP login notification via Brevo (compare against last-N from logs /
  lastLoginAt).
- Explicit session maxAge (30d).
- Enterprise-later: per-tenant IP allowlist; SAML via WorkOS when paid for.

Sequencing: I1 -> I2 -> I3 -> I4, one session each.
