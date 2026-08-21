# Blog publisher — install notes

These three files are the root-side half of the blog agent. The agent (running in
`echorank360-workers` as `deploy`) writes markdown and commits it; this builds and
serves it. They are separate because the build needs `chown`, and `deploy`'s sudo
is deliberately scoped to `/usr/bin/pm2` alone — see `publish-blog.sh`'s header.

## Install (as root)

```bash
install -d -m 0755 -o root -g root /opt/echorank/bin
install -m 0755 -o root -g root \
  /opt/echorank/app/deploy/blog-publisher/publish-blog.sh /opt/echorank/bin/publish-blog.sh
install -m 0644 -o root -g root \
  /opt/echorank/app/deploy/blog-publisher/blog-publish.service /etc/systemd/system/
install -m 0644 -o root -g root \
  /opt/echorank/app/deploy/blog-publisher/blog-publish.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now blog-publish.timer
systemctl list-timers blog-publish.timer
```

## Cloudflare credentials

The script reads `/opt/echorank/bin/.env`. Create it root-only — it holds a token
that can purge the whole zone:

```bash
install -m 0600 -o root -g root /dev/null /opt/echorank/bin/.env
cat >> /opt/echorank/bin/.env <<'ENV'
CF_ZONE_ID=...
CF_PURGE_TOKEN=...
ENV
```

Without it the build still runs; the script alerts that the purge was skipped and
the site serves stale HTML until someone purges by hand.

## Dry run

```bash
/opt/echorank/bin/publish-blog.sh --dry-run
```

Checks step 1 only — whether any file containing `status: published` is newer than
`/opt/echorank/bin/.last-blog-build` — and reports what it would do. It never
builds, restarts or purges.

## What triggers a build

A `.md` under `content/blog/` containing `status: published`, newer than the
marker. A **draft** landing overnight does not trigger anything: that is the point
of review mode. Promoting a draft is editing `status: draft` to `status: published`
in the file.

## Logs

`journalctl -u blog-publish.service` for the run itself, and
`/opt/echorank/backups/blog-agent/notifications-YYYY-MM-DD.jsonl` for the same
summary the agent writes, so both halves of the night are in one file.
