#!/usr/bin/env bash
# Hands the files `next build` rewrites back to the build user. Run as root:
#   sudo npm --prefix /opt/echorank/app run fix-perms
#
# The build runs as echorank (scripts/deploy.sh) and Next rewrites tsconfig.json and
# next-env.d.ts whenever their content is not what it wants. An edit made as deploy replaces
# the file through the directory, which leaves it deploy-owned, and the next build dies on
# EACCES; the deploy preflight reports it and points here. Not a git hook: a hook runs as the
# committer, and only root can give a file to another user.
set -euo pipefail
umask 022

APP=${ECHORANK_APP:-/opt/echorank/app}
BUILD_USER=echorank

[ "$(id -u)" = "0" ] || { echo "fix-perms: run as root (chown to $BUILD_USER needs it)" >&2; exit 1; }

for f in tsconfig.json next-env.d.ts; do
  # next-env.d.ts is gitignored and may not exist yet; $BUILD_USER cannot create it in a
  # directory deploy owns, so create it empty and let the next build fill it.
  [ -e "$APP/$f" ] || install -m 0644 /dev/null "$APP/$f"
  chown "$BUILD_USER:$BUILD_USER" "$APP/$f"
  chmod u+rw,a+r "$APP/$f"
  stat -c '%U:%G %a %n' "$APP/$f"
done
