#!/usr/bin/env bash
# Root's production deploy for Echorank360. Installed as /usr/local/sbin/echorank360-deploy:
#   install -o root -g root -m 0755 /opt/echorank/app/scripts/deploy.sh /usr/local/sbin/echorank360-deploy
#
# Mirrors /usr/local/sbin/echopilot-deploy, with one structural difference: the build never
# writes into the live .next. It goes into .next-build (next.config.ts reads NEXT_DIST_DIR) and
# is swapped in only once it is complete, so a failed build leaves the running site untouched,
# and the build it replaced stays on disk as .next-prev for `--rollback`.
#
#   0. preflight        root, .env, one deploy at a time, clean tree, installed copy == repo copy,
#                       echorank can read every tracked file and write tsconfig.json,
#                       next-env.d.ts and .next-build (offenders listed; `npm run fix-perms`)
#   1. health before    GET /en on 4400. Not 200 → warn and carry on (a deploy may be the fix),
#                       but a failed health check after the restart will not auto-roll back
#   2. prisma generate  as deploy (src/generated/prisma is deploy's; generate never connects)
#   3. next build       as echorank (.env is 600 echorank) into .next-build
#                       non-zero exit or no BUILD_ID → abort, nothing swapped, nothing restarted
#   4. migrate deploy   as echorank, then `migrate status`; pending or failed → abort, same
#   5. swap             renameat2(RENAME_EXCHANGE): .next-build and .next trade places in one
#                       syscall; the old build becomes .next-prev
#   6. pm2 restart      web, plus workers when the commits since the last deploy reach them
#   7. health after     GET /en for up to 60 s, every stylesheet 200, exactly one listener on 4400
#                       failure → swap .next-prev back, restart, recheck, exit 1
#   8. reminder         Cloudflare → Purge Everything (manual; see docs/agents/gotchas.md)
#
# The swap and the restart are back to back: between them the old process may lazily load a
# chunk from the new .next, which is the window CLAUDE.md describes, now seconds instead of a
# whole build. Migrations are forward-only, so --rollback restores the code, not the schema
# (write them additive; docs/agents/deploy.md). Workers run from source, not .next, so a
# rollback restarts only the web process.
#
# Usage: echorank360-deploy [--allow-dirty] [--rollback]
set -euo pipefail
umask 022

# Overridable only so tests/deploy-script.test.ts can run this against a scratch tree.
APP=${ECHORANK_APP:-/opt/echorank/app}
LOCK=${ECHORANK_DEPLOY_LOCK:-/run/echorank360-deploy.lock}
PORT=4400
HEALTH_URL="http://127.0.0.1:$PORT/en"
HEALTH_TIMEOUT=${ECHORANK_HEALTH_TIMEOUT:-60}
BUILD_USER=echorank
SRC_USER=deploy
WEB=echorank360-web
WORKERS=echorank360-workers
LIVE="$APP/.next"
NEXT_BUILD="$APP/.next-build"
PREV="$APP/.next-prev"

die() {
  echo >&2
  echo "############################################################" >&2
  echo "## DEPLOY FAILED: $*" >&2
  echo "############################################################" >&2
  exit 1
}
step() { echo; echo "== $*"; }
# Run a command in $APP as a given user with a clean login environment.
as_user() {
  local user=$1; shift
  sudo -u "$user" -H env NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" "${EXTRA_ENV[@]}" \
    bash -c 'cd "$0" && umask 022 && "$@"' "$APP" "$@"
}
EXTRA_ENV=()
git_app() { git -c safe.directory="$APP" -C "$APP" "$@"; }
# Atomic exchange of two existing paths (Linux renameat2, RENAME_EXCHANGE). coreutils 9.4 has
# no `mv --exchange` and util-linux 2.39 no `exch`, so this goes through libc directly.
exchange() {
  python3 -I - "$1" "$2" <<'PY'
import ctypes, os, sys
libc = ctypes.CDLL(None, use_errno=True)
if libc.renameat2(-100, sys.argv[1].encode(), -100, sys.argv[2].encode(), 2) != 0:
    e = ctypes.get_errno()
    sys.exit(f"renameat2({sys.argv[1]}, {sys.argv[2]}): {os.strerror(e)}")
PY
}
http_code() { curl -s -m 5 -o /dev/null -w '%{http_code}' "$1" || true; }

# Poll /en, then check stylesheets and the listener. Prints the reason and returns 1 on failure.
health_after() {
  local code=000 deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    code=$(http_code "$HEALTH_URL")
    [ "$code" = "200" ] && break
    sleep 1
  done
  if [ "$code" != "200" ]; then
    echo "$HEALTH_URL answered $code (not 200) after ${HEALTH_TIMEOUT}s" >&2
    pm2 logs "$WEB" --nostream --lines 40 >&2 || true
    return 1
  fi
  # Next 16 serves CSS as /_next/static/chunks/<hash>.css. A 404 here means the process is
  # serving HTML from one build and chunks from another.
  local html sheets css c bad=0
  html=$(curl -s -m 10 "$HEALTH_URL" || true)
  sheets=$(grep -oE '/_next/static/(chunks|css)/[^"?]+\.css' <<<"$html" | sort -u || true)
  if [ -z "$sheets" ]; then echo "no stylesheet in the /en HTML" >&2; return 1; fi
  for css in $sheets; do
    c=$(http_code "http://127.0.0.1:$PORT$css")
    [ "$c" = "200" ] || { echo "stylesheet $css answered $c" >&2; bad=1; }
  done
  [ "$bad" = "0" ] || return 1
  # Exactly one listener, or an orphan next-server is answering some of the requests
  # (docs/agents/gotchas.md: the enabled echorank-web.service unit is the usual one).
  local listeners
  listeners=$(ss -Hltnp "sport = :$PORT" || true)
  if [ "$(grep -c . <<<"$listeners")" != "1" ]; then
    echo "expected exactly one listener on $PORT, found:" >&2
    echo "${listeners:-(none)}" >&2
    return 1
  fi
  echo "health 200 · stylesheets $(wc -l <<<"$sheets" | tr -d ' ') 200 · one listener on $PORT"
}

purge_reminder() {
  echo
  echo "!! Cloudflare → Caching → Configuration → Purge Everything. Manual, and the deploy is not"
  echo "!! done until it has happened: cached HTML names chunk hashes this build does not have."
}

ALLOW_DIRTY=0
ROLLBACK=0
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --rollback) ROLLBACK=1 ;;
    *) echo "echorank360-deploy: unknown option $arg (known: --allow-dirty, --rollback)" >&2; exit 2 ;;
  esac
done

# ---- 0. preflight
[ "$(id -u)" = "0" ] || die "run as root: sudo echorank360-deploy (pm2 is root's; the build runs as $BUILD_USER)"
[ -f "$APP/.env" ] || die "no $APP/.env; refusing to build against defaults"
exec 9>"$LOCK"
flock -n 9 || die "another echorank360-deploy is running"

self=$(readlink -f "$0")
if [ "$self" != "$(readlink -f "$APP/scripts/deploy.sh")" ] && ! cmp -s "$self" "$APP/scripts/deploy.sh"; then
  echo "WARNING: $self differs from $APP/scripts/deploy.sh (the reviewed copy). Reinstall:" >&2
  echo "         install -o root -g root -m 0755 $APP/scripts/deploy.sh /usr/local/sbin/echorank360-deploy" >&2
fi

if [ "$ROLLBACK" = "1" ]; then
  [ -s "$PREV/BUILD_ID" ] || die "no $PREV/BUILD_ID to roll back to"
  [ -s "$LIVE/BUILD_ID" ] || die "no live $LIVE/BUILD_ID; refusing to swap an incomplete build out"
  step "rollback: $(cat "$LIVE/BUILD_ID") → $(cat "$PREV/BUILD_ID")"
  exchange "$PREV" "$LIVE"
  pm2 restart "$WEB"
  health_after || die "rolled back to $(cat "$LIVE/BUILD_ID") but it is not healthy; run --rollback again to return to $(cat "$PREV/BUILD_ID")"
  echo "rolled back; --rollback again returns to $(cat "$PREV/BUILD_ID")"
  purge_reminder
  exit 0
fi

dirty=$(git_app status --porcelain --untracked-files=all) || die "git status failed"
if [ -n "$dirty" ] && [ "$ALLOW_DIRTY" != "1" ]; then
  echo "$dirty" >&2
  die "working tree not clean (files above would ship); commit them or pass --allow-dirty"
fi
HEAD_SHA=$(git_app rev-parse HEAD)
echo "deploying $(git_app log -1 --format='%h %s')"

# Permissions, checked as $BUILD_USER before any work. A $SRC_USER commit that replaces a file
# leaves it $SRC_USER-owned, and a file written 0600 by anyone is one the build cannot read;
# both used to surface as an EACCES half-way through `next build`. Next rewrites tsconfig.json
# and next-env.d.ts when their content is not what it wants, so both must be writable.
rm -rf "$NEXT_BUILD"
# $APP belongs to $SRC_USER, so $BUILD_USER cannot create the directory itself. next build
# empties it and keeps it.
install -d -o "$BUILD_USER" -g "$BUILD_USER" -m 0755 "$NEXT_BUILD"
perm_problems=$(git_app ls-files -z | sudo -u "$BUILD_USER" -H bash -c '
  cd "$1" || { echo "unreadable  $1/"; exit 0; }
  while IFS= read -r -d "" f; do [ -r "$f" ] || printf "unreadable  %s\n" "$f"; done
  for f in tsconfig.json next-env.d.ts; do [ -w "$f" ] || printf "unwritable  %s\n" "$f"; done
  { : >.next-build/.write-probe && rm -f .next-build/.write-probe; } 2>/dev/null ||
    printf "unwritable  .next-build/\n"
' _ "$APP")
if [ -n "$perm_problems" ]; then
  echo "$perm_problems" >&2
  die "$BUILD_USER cannot read or write the paths above; nothing built, nothing restarted.
## tsconfig.json / next-env.d.ts: sudo npm --prefix $APP run fix-perms"
fi

# ---- 1. health before
step "1/8 health before ($HEALTH_URL)"
BEFORE=$(http_code "$HEALTH_URL")
if [ "$BEFORE" = "200" ]; then
  echo "200"
else
  echo "WARNING: $HEALTH_URL answers $BEFORE before the deploy. Continuing, but a failed check" >&2
  echo "         after the restart will NOT roll back to a build that was already failing." >&2
fi

# ---- 2. prisma generate
step "2/8 prisma generate (as $SRC_USER)"
# prisma.config.ts reads DATABASE_URL, which $SRC_USER cannot see; generate parses it and never
# connects, so a placeholder is enough.
EXTRA_ENV=(DATABASE_URL=postgresql://generate:only@127.0.0.1:1/none)
as_user "$SRC_USER" npx prisma generate || die "prisma generate failed; nothing restarted"
EXTRA_ENV=()

# ---- 3. build
step "3/8 next build (as $BUILD_USER, into .next-build)"
EXTRA_ENV=(NEXT_DIST_DIR=.next-build)
as_user "$BUILD_USER" npm run build || die "next build exited non-zero; .next untouched, nothing restarted"
EXTRA_ENV=()
[ -s "$NEXT_BUILD/BUILD_ID" ] || die ".next-build/BUILD_ID missing after the build; .next untouched, nothing restarted"
BUILD_ID=$(cat "$NEXT_BUILD/BUILD_ID")
echo "$HEAD_SHA" >"$NEXT_BUILD/DEPLOYED_COMMIT"
chown -R "$SRC_USER:$SRC_USER" "$NEXT_BUILD"
echo "build $BUILD_ID"

# ---- 4. migrations
step "4/8 prisma migrate deploy + status (as $BUILD_USER)"
as_user "$BUILD_USER" npx prisma migrate deploy || die "prisma migrate deploy failed; .next untouched, nothing restarted"
status_rc=0
status_out=$(as_user "$BUILD_USER" npx prisma migrate status 2>&1) || status_rc=$?
echo "$status_out"
if [ "$status_rc" != "0" ] || ! grep -q "Database schema is up to date" <<<"$status_out"; then
  die "prisma migrate status reports pending or failed migrations (exit $status_rc); .next untouched, nothing restarted"
fi

# Workers run src/ through tsx, so they need a restart when anything they can import changed.
# They import far more than src/infrastructure/queue/, so only paths that are web-only by
# construction are excluded. No record of the last deploy → restart them.
PREV_SHA=$(cat "$LIVE/DEPLOYED_COMMIT" 2>/dev/null || true)
RESTART_WORKERS=1
if [ -n "$PREV_SHA" ] && git_app cat-file -e "$PREV_SHA^{commit}" 2>/dev/null; then
  if ! git_app diff --name-only "$PREV_SHA" "$HEAD_SHA" |
    grep -qvE '^(src/app/|src/components/|public/|docs/|tests/|scripts/deploy\.sh$|[^/]*\.md$)'; then
    RESTART_WORKERS=0
  fi
fi

# ---- 5. swap
step "5/8 swap .next-build → .next"
if [ -e "$LIVE" ]; then
  exchange "$NEXT_BUILD" "$LIVE"
  rm -rf "$PREV"
  mv "$NEXT_BUILD" "$PREV"
else
  mv "$NEXT_BUILD" "$LIVE"
fi
echo ".next = $BUILD_ID$( [ -s "$PREV/BUILD_ID" ] && echo " · .next-prev = $(cat "$PREV/BUILD_ID")" )"

# ---- 6. restart (immediately: the old process is now running over the new .next)
step "6/8 pm2 restart"
pm2 restart "$WEB"
if [ "$RESTART_WORKERS" = "1" ]; then
  pm2 restart "$WORKERS"
else
  echo "$WORKERS not restarted: nothing they import changed since ${PREV_SHA:0:7}"
fi
pm2 ls | grep -E "echorank360-(web|workers)" || true

# ---- 7. health after
step "7/8 health after (up to ${HEALTH_TIMEOUT}s)"
if ! health_after; then
  if [ "$BEFORE" = "200" ] && [ -s "$PREV/BUILD_ID" ]; then
    echo "rolling back to $(cat "$PREV/BUILD_ID")" >&2
    exchange "$PREV" "$LIVE"
    pm2 restart "$WEB"
    if health_after; then
      purge_reminder
      die "build $BUILD_ID failed its health check; rolled back to $(cat "$LIVE/BUILD_ID"), which is healthy. The failed build is in .next-prev"
    fi
    die "build $BUILD_ID failed its health check, and so did the rollback to $(cat "$LIVE/BUILD_ID")"
  fi
  die "build $BUILD_ID failed its health check; not rolled back ($HEALTH_URL was $BEFORE before the deploy)"
fi

# ---- 8. reminder
step "8/8 done: build $BUILD_ID ($(git_app log -1 --format=%h))"
purge_reminder
