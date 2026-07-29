# Gotchas

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

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

## Stripe: no checkout on purpose

Changing `planType` takes no payment because checkout does not exist. This is a known gap
with its own task, not an oversight to fix in passing. See [integrations.md](integrations.md).

## Secrets

`/opt/echorank/av-service/ecosystem.av-visibility.config.js` holds `INTERNAL_API_SECRET` and
an Anthropic API key inline. It is `chmod 600` and its header says to keep it out of git —
**it is currently tracked in the av-service repo anyway.** Do not print it, copy it into
docs, or echo it into a transcript.
