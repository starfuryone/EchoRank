# Deploy

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

Production is served from this working tree. There is no staging. A broken build is a
broken site, immediately.

## Preconditions

```
npx tsc --noEmit && npx eslint src tests && npm test
```

All three green before you build. `eslint src tests` carries a pre-existing error baseline
(~143, mostly `no-html-link-for-pages` in the marketing pages) — compare against a
`git stash`ed baseline rather than assuming a clean sheet, and do not add to it.

## Sequence

**1. Back up what you modify.**

```
cp path/to/file.ts "path/to/file.ts.bak.$(date +%Y%m%d-%H%M%S)"
```

`.gitignore` covers `*.bak.*` and `*.bak-*`. They stay out of commits. (Older `.bak` files
predating those rules are tracked — leave them; removing them is its own commit.)

**2. Build and restart in the same command.**

```
NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web
```

Add `&& pm2 restart echorank360-workers` if anything under `src/infrastructure/queue/`
changed.

`&&`, not two commands. `next build` deletes and rewrites hashed chunks under `.next`; the
running process keeps serving HTML that references the old ones. Every second between the
build finishing and the restart is a window where the site 404s its own assets.

The memory cap is a convention, not something the repo enforces — `package.json` runs plain
`next build`. Builds have OOMed on this box without it.

**3. Cloudflare purge — ask the human.**

Cloudflare caches SSR HTML that names chunk hashes the new build no longer has. Until it is
purged the site looks broken (missing CSS, 404s on `/_next/static/*`) for anyone with a
cached page. Dashboard → Caching → Configuration → **Purge Everything**.

You cannot do this. Say so explicitly and wait for confirmation before declaring the deploy
done.

**4. Verify exactly one listener on 4400.**

```
ss -ltnp | grep 4400
```

Exactly one, owned by the pm2 process (user `echorank`). More than one, or one owned by
anything else, means an orphan — kill it and restart pm2. See [gotchas.md](gotchas.md); on
this host the likeliest culprit is not a stray agent process but the enabled
`echorank-web.service` systemd unit.

## Without sudo

pm2 runs as root. A session that cannot `sudo` cannot restart it, and therefore **must not
build** — building alone leaves step 2 half-done, which is the exact failure it guards
against. Hand the human the one-liner and stop.

## Migrations

```
npx prisma generate && npx prisma migrate deploy
```

Before the build. Migrations are forward-only here; write them additive and nullable so the
running old code survives between migrate and restart.
