# Deploy

Last verified: 2026-10-30 by Claude Opus 5.5.

Production is served from this working tree. There is no staging. A broken build is a
broken site, immediately.

## Preconditions

```
npx tsc --noEmit && npx eslint src tests && npm test
```

All three green before you build. `eslint src tests` carries a pre-existing error baseline
(see CLAUDE.md) — lint the files you touched and do not add to it. As `deploy`, run vitest
through the `envDir` workaround in CLAUDE.md.

Commit everything. The deploy refuses a dirty tree, because the build ships the working
tree and an uncommitted change is one this box can lose on a rebuild from git.

## The command

```
sudo echorank360-deploy            # build, swap, restart, health-check
sudo echorank360-deploy --rollback # swap .next-prev back in and restart web
```

Root only: pm2 is root's (`/root/.pm2`) and the build has to run as `echorank`, the only
user that can read `.env`. Source is `scripts/deploy.sh`; after changing it, reinstall:

```
install -o root -g root -m 0755 /opt/echorank/app/scripts/deploy.sh /usr/local/sbin/echorank360-deploy
```

What it does, in order (each abort before step 5 leaves the running site untouched):

0. **Preflight.** Root, `.env` present, a lock so only one deploy runs at a time, clean tree.
   Then, checked as `echorank` before any other work: every tracked file is readable, and
   `tsconfig.json`, `next-env.d.ts` and `.next-build` are writable. Next rewrites the first
   two when their content is not what it wants. Offending paths are listed and nothing runs.
   An edit to `tsconfig.json` made as `deploy` leaves it `deploy`-owned; fix with
   `sudo npm --prefix /opt/echorank/app run fix-perms` (root only, which is why this is not a
   git hook). The committed `tsconfig.json` already includes the `.next-build/types` globs,
   so a build normally has nothing to rewrite there.
1. **Health before.** `GET 127.0.0.1:4400/en`. Not 200 is a warning, not an abort, since a
   deploy is often the fix, but then step 7 will not roll back to a build that was already failing.
2. **`prisma generate`** as `deploy` (it owns `src/generated/prisma`). It never connects, so
   it gets a placeholder `DATABASE_URL`.
3. **`next build`** as `echorank`, with `NEXT_DIST_DIR=.next-build` (`next.config.ts`). The
   live `.next` is never written. A non-zero exit or a missing `BUILD_ID` aborts.
4. **`prisma migrate deploy`**, then `migrate status`, as `echorank`. Pending or failed aborts.
5. **Swap.** `renameat2(RENAME_EXCHANGE)` trades `.next-build` and `.next` in one syscall,
   then the old build becomes `.next-prev`. A build made under another dist dir name serves
   correctly once renamed: `next start` resets each route module's `distDir` from its own
   config on every request (verified 2026-10-30).
6. **`pm2 restart echorank360-web`**, straight after the swap, which leaves only a window of
   seconds where the old process can read the new `.next`. `echorank360-workers` restarts too
   unless every file changed since the last deploy (`.next/DEPLOYED_COMMIT`) is web-only
   (`src/app/`, `src/components/`, `public/`, `docs/`, `tests/`, top-level `*.md`). Workers run
   `src/` through tsx and import far more than `src/infrastructure/queue/`.
7. **Health after.** `/en` must answer 200 within 60 s, every stylesheet it links must answer
   200, and `ss` must show exactly one listener on 4400. On failure it swaps `.next-prev`
   back, restarts web and checks again.
8. **Cloudflare reminder.** See below.

Migrations are forward-only, so `--rollback` restores code, not schema. Write migrations
additive and nullable so the previous build still runs against the new schema.

## By hand (when the script cannot run)

```
chown -R echorank:echorank .next
sudo -u echorank bash -c 'umask 022 && NODE_OPTIONS=--max-old-space-size=4096 npm run build'
chown -R deploy:deploy .next
pm2 restart echorank360-web     # + echorank360-workers
```

This builds in place, so the old process serves over a half-rewritten `.next` for the whole
build. Restart the moment it finishes. 4096, not 1536: 1536 OOM'd on 2026-08-15.

## Cloudflare purge — ask the human

Cloudflare caches SSR HTML that names chunk hashes the new build no longer has. Until it is
purged the site looks broken (missing CSS, 404s on `/_next/static/*`) for anyone with a
cached page. Dashboard → Caching → Configuration → **Purge Everything**.

You cannot do this. Say so explicitly and wait for confirmation before declaring the deploy
done.

## One listener on 4400

```
ss -ltnp | grep 4400
```

Exactly one, owned by the pm2 process (user `echorank`). The script fails the deploy on
anything else. More than one means an orphan: kill it and restart pm2. See
[gotchas.md](gotchas.md); on this host the likeliest culprit is not a stray agent process
but the enabled `echorank-web.service` systemd unit.

## Without sudo

pm2 runs as root. A session that cannot `sudo` cannot restart it, and therefore **must not
build**: a build with no restart behind it is exactly the failure this sequence guards
against. Commit, hand the human `sudo echorank360-deploy`, and stop.
