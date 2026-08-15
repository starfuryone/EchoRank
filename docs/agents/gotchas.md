# Gotchas

Last verified: 2026-08-11 by Claude Opus 5 (1M context).

Incident-derived. Each of these has already cost someone a day.

## Port 4400 gets stolen

The site is one listener on `127.0.0.1:4400`. Two things fight for it:

1. **Orphan `next-server`.** Agent sessions have started dev/prod servers and left them
   running. pm2 then crash-loops on `EADDRINUSE`.
2. **`echorank-web.service` and `echorank-workers.service`.** Both systemd units are
   `enabled` and currently in permanent `activating (auto-restart)` — they duplicate what
   pm2 runs, fail because pm2 holds the port, and restart forever. Harmless while pm2 is up;
   the instant pm2 releases 4400, systemd grabs it and you are debugging a process nobody
   thinks is running.

Always finish a deploy with:

```
ss -ltnp | grep 4400     # exactly one listener, owned by the pm2 process (user echorank)
```

Do not `systemctl disable` those units as a side quest — but know they are there.

## Cloudflare serves HTML pointing at deleted chunks

Every build rewrites hashed asset filenames. Cloudflare keeps serving cached SSR HTML that
names the old ones, so the site loads unstyled and `/_next/static/*` 404s. It looks like a
CSS build failure. It is a cache.

**Purge Everything after every deploy.** Manual, human-only. See [deploy.md](deploy.md).

Candidate improvement, deliberately not implemented: a Cloudflare cache rule that bypasses
cache for HTML. Do not add it without an explicit task — it changes the cache posture of
the whole marketing site.

## GSC zero query rows is correct

A connected, healthy property that syncs on schedule can store **zero** query rows. Google
withholds queries searched by too few people to stay anonymous, and data lags ~2 days.

Check `GscConnection.lastRowsSynced` before touching sync code: it records the row count of
every run, zero included, precisely so "ran and found nothing" is distinguishable from
"never ran". `NULL` means the sync predates the column, not that it failed.

## `.next` ownership

The web process runs as **`echorank`** via `setpriv` (`ecosystem.config.js` is
authoritative). It must be able to read `.next`. Builds run as `deploy`, which owns the
tree; the group/other read bits are what make this work.

`chown` incidents have taken the site down. If you must change ownership, read
`ecosystem.config.js` first and match it.

## Postgres is deliberately hardened

- `listen_addresses = '127.0.0.1, ::1'` — IP literals, not `localhost`.
- `/etc/systemd/system/postgresql@.service.d/restart.conf` sets `Restart=on-failure`,
  `RestartSec=5s`.

Both are there because a glibc unattended-upgrade once killed Postgres for 12 hours. Do not
"tidy" either away.

## sshd drop-ins: first match wins

`/etc/ssh/sshd_config.d/` is read in **alphabetical** order and the **first** setting of a
directive wins — the opposite of most config systems. `00-keys-only.conf` beats
`50-cloud-init.conf`. A new drop-in numbered above an existing one changes nothing and
looks like it should have. Current contents: `00-keys-only.conf`, `50-cloud-init.conf`,
`99-root-key-only.conf.bak`.

## Redis 6380, not 6379

`REDIS_URL` points at `127.0.0.1:6380` (`redis-echorank.service`, password-protected). A
default Redis also listens on 6379 and is **not ours** — the commented-out `REDIS_URL` in
`.env` still points there, which is an easy way to write to the wrong instance.

## REVIEW-2026-07.md is partially stale

The 2026-07-28 audit is a useful map but several findings were disproven or fixed within
days:

- "GSC connected and syncing, storing nothing" — the sync works; see above.
- Brand Radar is a real page backed by the visibility summary API, not a scaffold. Same for
  several tools it lists as shells.
- The red `seo-tools` suite it reports is green.

Read it as **leads, not facts**. Verify against the code before acting on any line of it.

## Migration filenames are hand-authored, and several land on the same day

`prisma migrate deploy` applies in **lexical filename order**, and this repo writes those
timestamps by hand — four migrations were created on 2026-08-15 alone. So a migration can
easily sort *before* the one that creates a table it alters.

That happened on 2026-08-15: `20260815130000_credit_packs` altered `scan_rows`, which
`20260815160000_agency_opportunity_scanner` creates. It applied fine here, where the scanner
had already shipped, and would have failed on any fresh rebuild — the case that only shows
up long after the change, and this box **has** been rebuilt from git before.

Before adding a migration: list `prisma/migrations`, find every table your SQL touches, and
confirm the migration that creates each one sorts earlier. Renaming the directory is the fix
and is free *until it has been applied* — after that it also needs an
`_prisma_migrations` cleanup.

**Two more traps from the same incident:**

- **Prisma table names are not the model names.** `@@map` decides, and this schema mixes both
  conventions — `ScanRow` maps to `scan_rows`, `SeoApiCall` maps to nothing and really is
  `"SeoApiCall"`. Hand-written SQL that guesses `snake_case` fails at run time. Check the
  model for `@@map`, or grep `0_init` for the `CREATE TABLE`.
- **A failed migration leaves rows behind.** A partial run can record several
  `_prisma_migrations` rows for one name, some `finished_at IS NULL`. `migrate deploy`
  refuses to move until they are resolved (`prisma migrate resolve`, or a `DELETE` for a
  renamed folder's orphans). Writing every statement guarded — `IF NOT EXISTS`, and a `DO`
  block for `CREATE TYPE`, which has no `IF NOT EXISTS` — makes the re-apply a no-op instead
  of a manual cleanup of whatever survived.

## Stripe: the live account is shared with 7+ other products

Checkout exists now (this section used to say it did not — see
[integrations.md](integrations.md) for what shipped). The live-mode gotcha that replaced it
is bigger:

**The live Stripe account is shared by seven or more products.** On 2026-08-01 an unscoped
`lookup_key` sweep archived AgoraIQ and AI Membership Hub prices — someone else's revenue,
taken down by a query that was only ever meant to touch ours. The rules that came out of it:

- Every Echorank product and price carries `metadata[app]=echorank`.
- **Every sweep, list or query is scoped by that metadata.** A `lookup_key` filter alone is
  not scoping — that is exactly what caused the incident.
- Seeders guard on `test` appearing in the key, so a live key stops them.
- **Seeders have no idempotency. Never re-run one against live.**
- Sandbox first (the "Echorank Dome" account), then print the live create plan and get
  explicit human approval before touching live.

Sandbox credentials live at `/opt/echorank/.stripe-sandbox` (`STRIPE_API_KEY`, `sk_test`,
owned by `deploy`). The app itself reads `STRIPE_SECRET_KEY`; the env split is `.env` live
and `.env.sandbox` sandbox, and `.env.sandbox` is root-only.

## Secrets

`/opt/echorank/av-service/ecosystem.av-visibility.config.js` holds `INTERNAL_API_SECRET` and
`ANTHROPIC_API_KEY` inline. It is `chmod 600`. Do not print it, copy it into docs, or echo
it into a transcript — that last one has already happened, see below.

**No longer tracked in git** (fixed 2026-07-30): the av-service history was destroyed and
re-initialised, and `ecosystem*.config.js` / `.env*` are now in that repo's `.gitignore`.
Pre-purge history is bundled at `/home/deploy/av-service-prepurge-20260730-154326.bundle`
(chmod 600). That repo has no remote and never did, so the exposure was always local.

Re-init is not rotation. The 2026-07-30 purge rotated `INTERNAL_API_SECRET` but left
`ANTHROPIC_API_KEY` byte-identical to the committed value; both are now rotated as of
2026-07-31 (SECURITY.md M5). **The old Anthropic key still needs revoking at
console.anthropic.com** — until then the copies below are live credentials.

Copies of the old key on this box: two `ecosystem.av-visibility.config.js.bak.*` siblings,
the root-owned `/opt/echorank/av-service/.env`, the pre-purge bundle, and — the one that is
easy to forget — several Claude Code session transcripts under
`/home/deploy/.claude/projects/-opt-echorank-app/`. Those are `600` but the enclosing
directories are world-readable (`755`), and an agent asked to grep its own history will
surface the key in plaintext. Revoking is what makes every copy inert at once; deleting
files one at a time is not a substitute.

Two traps worth keeping, both paid for once already:

- **`pm2 restart` will not pick up an env change.** The process keeps the env it booted
  with, so the rotation looks applied and changes nothing. Always `pm2 delete` then
  `pm2 start <config>`, then `pm2 save`.
- **`/health` returning 200 does not mean the Anthropic key works.** `keyword_suggest.py`
  catches AI failures into `meta.ai_error` and returns success anyway — by design, so AI
  never breaks the tool. To actually test a key, `POST /keywords {"ai":true}` and check
  `meta.ai_used`.

## There is no test database, and the only DATABASE_URL is production

Every suite in `tests/` mocks `@/lib/prisma`. That is not laziness — `.env` has exactly
one `DATABASE_URL` and it points at the `echorank` database this box serves production
from. A test that writes rows runs against production, on every `npx vitest run`, and the
suite is run many times a day.

So: **do not write a test that touches Prisma without gating it.** The pattern is
`tests/ai-search-roundtrip.db.test.ts` — `describe.skipIf(!process.env.TEST_DATABASE_URL)`,
with `process.env.DATABASE_URL` reassigned at the top of the file *before* any dynamic
import, because `@/lib/prisma` reads it at module scope and builds a pool immediately.

To actually run one you need a database that does not exist yet, and the app role cannot
create it (`echorank_app` has `rolcreatedb = f`, and there is no passwordless sudo):

```
createdb echorank_test                                   # needs a superuser
DATABASE_URL=<test url> npx prisma migrate deploy
TEST_DATABASE_URL=<test url> npx vitest run tests/ai-search-roundtrip.db.test.ts
```

The same missing privilege blocks the other half of a drift check. `prisma migrate diff
--from-config-datasource --to-schema` compares the live DB to `schema.prisma` and needs
nothing extra; replaying the migration folder from empty and comparing THAT to production
needs a shadow database, so a migration file that is wrong in a way the live DB has already
absorbed cannot be caught here today.

## prompt_runs stores three fields under names the scorer does not use

`src/lib/ai-monitor/runner/salvage.ts` exists solely to invert this, and the mapping is not
guessable from either side:

| stored | scored | why they differ |
| --- | --- | --- |
| `MentionAnalysis.recommendationPosition` | `brandPosition` | `MentionAnalysis` predates the ranking pass; `listPosition` was already taken and means something else |
| `Citation.supportsBrand` | `isMonitoredDomain` | `Citation` deliberately has no `is_monitored_domain` column — it is derivable from `domain` |
| `MentionAnalysis.sentiment`, lowercase | `Sentiment`, uppercase enum | the column predates the enum and `analysis/llm.ts` still writes lowercase |

`ports.ts` writes them; `salvage.ts` reads them back. **The two files must change together**,
and nothing but a comment enforces that. Each disagreement produces a silently wrong score
rather than a crash: a null `brandPosition` reads as "mentioned but never ranked", which is
a legitimate state worth 0 for the position component.

**Worth fixing properly** — rename the columns in one migration and delete the inverter,
rather than maintaining it forever. The place this bites is a Step 5 dashboard PR that
touches one file and not the other. It is safe to do while these tables are small; it will
not be later.
