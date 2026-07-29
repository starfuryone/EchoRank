# Architecture — what runs where

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

Single box. Production is served from `/opt/echorank/app`, the same working tree you edit.
See [deploy.md](deploy.md) before changing anything that ships.

## Request path

```
Cloudflare  →  Caddy (:80/:443)  →  127.0.0.1:4400   next-server (Next.js 16.2.6)
                     │
                     └─ /extension/*  →  file_server, root /opt/echorank/extension-dist
```

`/etc/caddy/Caddyfile`, block `echorank360.com, www.echorank360.com`. Caddy fronts several
unrelated apps on this host (ports 3200/4000/4100/4201) — do not assume a port is ours.

## Processes

pm2 is the supervisor, running as **root** with `PM2_HOME=/root/.pm2`. A session without
sudo can read process state via `ps` but cannot `pm2 restart`.

| pm2 app | User | What | Config |
|---|---|---|---|
| `echorank360-web` | `echorank` | `npm run start -- -H 127.0.0.1 -p 4400` via `setpriv`, loopback only | `ecosystem.config.js` (in this repo) |
| `echorank360-workers` | `root` | `npm run workers` → `tsx src/infrastructure/queue/start-workers.ts` | not in this repo |
| `av-visibility` | `root` | uvicorn `av_service:app` on 127.0.0.1:4500 | `/opt/echorank/av-service/ecosystem.av-visibility.config.js` |

`ecosystem.config.js` is authoritative for the web process's user. The `.next` tree must
be readable by it — see [gotchas.md](gotchas.md).

> Verification note: `echorank360-web` and `av-visibility` were read from their config
> files. The workers app name could not be confirmed directly (root-owned pm2, no sudo);
> `ps` shows it as root running `npm run workers`.

## Stores

| Service | Bind | Notes |
|---|---|---|
| Postgres 16.14 | `127.0.0.1:5432`, `[::1]:5432` | db `echorank`, `sslmode=disable`. `listen_addresses = '127.0.0.1, ::1'` |
| Redis (`redis-echorank.service`) | `127.0.0.1:6380` | password-protected; this is the one `REDIS_URL` points at |
| Redis (default instance) | `127.0.0.1:6379` | **not ours** — the commented-out `REDIS_URL` in `.env` still points here |
| OTEL collector | `localhost:4318` | `OTEL_EXPORTER_OTLP_ENDPOINT` |

## App

- **Next.js 16.2.6, App Router.** Turbopack is the default bundler for **both** `next dev`
  and `next build` — a plain `npm run build` prints `▲ Next.js 16.2.6 (Turbopack)`, and
  `next build --help` offers `--webpack` as the opt-*out*. Note the bundled prose in
  `node_modules/next/dist/docs/` still says Turbopack is merely "available for
  `next build`"; the CLI is authoritative and the docs lag. Read the bundled docs before
  writing Next code anyway — see `AGENTS.md` — but verify build behaviour against the CLI.
- **Prisma 7.8** with `@prisma/adapter-pg`. Client is generated to **`src/generated/prisma`**,
  not `node_modules/.prisma`. Import types from `@/generated/prisma`. Run `npx prisma generate`
  after schema edits; `npx prisma migrate deploy` to apply.
- **BullMQ** workers registered in `src/infrastructure/queue/registry.ts`, started by
  `start-workers.ts`. Redis-backed. Worker code changes need the workers app restarted too.
- **av-service** — FastAPI sidecar at `127.0.0.1:4500` (`AV_SIDECAR_URL`), separate git
  repo at `/opt/echorank/av-service`. Runs the AI-visibility audit and `/bots`. Callers
  authenticate with `INTERNAL_API_SECRET`. Its systemd unit is inactive by design; pm2 owns it.
- **Sentry** wraps the build only when `SENTRY_DSN` is set (`next.config.ts`). Currently empty.

## Layout

```
/opt/echorank/
├── app/              this repo — Next.js app, Prisma schema, workers
├── av-service/       FastAPI sidecar (separate repo)
├── extension-dist/   static pages Caddy serves at /extension/*
└── extension/        browser extension source
```
