#!/usr/bin/env bash
#
# publish-blog.sh — the nightly blog build. Runs as ROOT, from a systemd timer.
#
# WHY THIS IS NOT IN THE WORKER. The build cycle needs `chown`, and the workers
# process runs as a user whose sudo is scoped to /usr/bin/pm2 alone. Widening
# that sudoers entry so a content pipeline could chown the tree would trade a
# real security boundary for a convenience — so the build lives here, on the
# root side, and the agent only ever writes files the build later picks up.
#
# ONE BUILD PER DAY, whatever the article count. A build takes minutes and
# restarts the web process; doing it per article would restart production three
# times a night for no benefit.
#
# Canonical copy lives in the repo at deploy/blog-publisher/. Install with:
#   install -m 0755 -o root -g root deploy/blog-publisher/publish-blog.sh /opt/echorank/bin/publish-blog.sh
#
set -Eeuo pipefail

APP_DIR=/opt/echorank/app
MARKER=/opt/echorank/bin/.last-blog-build
ENV_FILE=/opt/echorank/bin/.env
LOG_TAG=publish-blog
DRY_RUN=0

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

log() { printf '[%s] %s\n' "$LOG_TAG" "$*"; }

# Alerts go to the same JSONL the agent's notifier writes, so "what happened
# last night" is one file rather than two systems. When a Matrix transport
# exists (see src/lib/blog-agent/notify.ts) this is where it also posts.
NOTIFY_DIR=/opt/echorank/backups/blog-agent
notify() {
  local level="$1" title="$2" detail="$3"
  mkdir -p "$NOTIFY_DIR"
  printf '{"at":"%s","level":"%s","title":"%s","lines":["%s"],"source":"publish-blog.sh"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$title" "${detail//\"/\\\"}" \
    >> "$NOTIFY_DIR/notifications-$(date -u +%F).jsonl"
  log "$level: $title — $detail"
}

trap 'notify alert "publish-blog.sh failed" "line $LINENO, exit $?"' ERR

# ── 1. Anything to publish? ──────────────────────────────────────────────────
#
# The test is "a file containing `status: published` is newer than the marker",
# not "any file changed". A draft landing overnight must NOT trigger a build:
# the whole point of review mode is that a draft sits until a human promotes it.
cd "$APP_DIR"

published_newer() {
  local since_args=()
  [[ -f "$MARKER" ]] && since_args=(-newer "$MARKER")
  # -l so grep stops at the first match per file; -Z/-print0 for odd filenames.
  find content/blog -name '*.md' -type f "${since_args[@]}" -print0 2>/dev/null \
    | xargs -0 -r grep -l '^status: published' 2>/dev/null \
    | head -n 1
}

CHANGED="$(published_newer)"
if [[ -z "$CHANGED" ]]; then
  log "no published articles newer than the marker; nothing to do"
  exit 0
fi
log "change detected: $CHANGED"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY RUN — would build, restart, purge and verify. Stopping here."
  exit 0
fi

# ── 2/3. Build. The ownership dance is the point ─────────────────────────────
#
# .env is 600 echorank, so the build must run AS echorank; echorank cannot
# write a .next owned by deploy. A build started as the wrong user does not
# fail — it silently comes up env-less, which is worse than failing.
log "building"
chown -R echorank:echorank .next 2>/dev/null || true
sudo -u echorank bash -c 'umask 022 && NODE_OPTIONS=--max-old-space-size=4096 npm run build'
chown -R deploy:deploy .next
chmod -R a+rX .next

# ── 4. Restart, immediately after the build ──────────────────────────────────
#
# Never leave a rebuilt .next under a running process: the old process serves
# HTML referencing chunk hashes the new build deleted. Build and restart are two
# commands, which means there is a window in which exactly that is true — this
# closes it.
log "restarting web"
pm2 restart echorank360-web

# ── 5. Cloudflare purge ──────────────────────────────────────────────────────
#
# Standing manual step, automated here because a nightly build cannot wait for
# someone to click it. Purge-everything matches what a human would do.
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
if [[ -n "${CF_ZONE_ID:-}" && -n "${CF_PURGE_TOKEN:-}" ]]; then
  log "purging Cloudflare"
  purge_status=$(curl -s -o /tmp/cf-purge.json -w '%{http_code}' -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_PURGE_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  if [[ "$purge_status" != "200" ]]; then
    notify alert "Cloudflare purge failed" "HTTP $purge_status — the site will serve stale HTML until purged by hand"
  fi
else
  notify alert "Cloudflare purge skipped" "CF_ZONE_ID or CF_PURGE_TOKEN missing from $ENV_FILE — purge by hand"
fi

# ── 6. Verify against the origin ─────────────────────────────────────────────
#
# Against 127.0.0.1:4400 deliberately, not the public hostname: this checks that
# OUR build serves, not that Cloudflare has a cached copy of the old one.
verify() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H 'Host: echorank360.com' "http://127.0.0.1:4400${path}")
  [[ "$code" == "200" ]] || { notify alert "Origin check failed" "${path} returned ${code}"; return 1; }
  log "ok ${path}"
}

sleep 5
ok=1
verify /en/blog || ok=0
NEWEST_SLUG=$(basename "$CHANGED" .md)
verify "/en/blog/${NEWEST_SLUG}" || ok=0

if [[ "$ok" != "1" ]]; then
  notify alert "publish-blog.sh finished with failed origin checks" "the build and restart completed; the site may be serving errors"
  exit 1
fi

# ── 7. Marker and summary ────────────────────────────────────────────────────
#
# Written LAST, and only on success. A marker written before verification would
# mean a failed build is never retried, because tomorrow's run would see nothing
# newer than the marker and exit at step 1.
touch "$MARKER"
notify briefing "Blog published" "built, restarted, purged and verified; newest slug ${NEWEST_SLUG}"
