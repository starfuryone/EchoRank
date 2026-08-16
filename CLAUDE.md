@AGENTS.md

# Echorank360 — agent rules

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

Rules first, depth in `docs/agents/`. When this file and the code disagree, the code
wins — fix this file in the same commit.

- [architecture.md](docs/agents/architecture.md) — what runs where
- [deploy.md](docs/agents/deploy.md) — the deploy sequence, in full
- [conventions.md](docs/agents/conventions.md) — code + copy conventions
- [integrations.md](docs/agents/integrations.md) — DataForSEO, Google, PSI, Stripe
- [gotchas.md](docs/agents/gotchas.md) — incident-derived landmines. Read before infra work.

`docs/agents/` also holds the security program's specs and queue, in UPPERCASE files
(`STATUS.md` is the index; `IDENTITY.md`, `ACCESS.md`, `SECURITY.md`, `MONITOR.md`,
`DATA.md`, `GOVERNANCE.md`, `BLOCKERS.md`). Those are work specs, one session each —
separate from the lowercase stack docs above. Start at `STATUS.md` for security work.

## Deploy

This box serves production from the working tree. A broken build is a broken site.

1. `.bak.$(date +%Y%m%d-%H%M%S)` copy of every file you modify. Gitignored (`*.bak.*`,
   `*.bak-*`) — never commit them.
2. Build and restart **in one command**:
   ```
   NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web
   ```
   Add `echorank360-workers` if anything under `src/infrastructure/queue/` changed.
   Never leave a rebuilt `.next` under a running process — the old process serves HTML
   referencing chunk hashes the new build deleted.
3. Tell the human to run **Cloudflare → Purge Everything**. Manual, mandatory, and not
   something you can do. See [gotchas.md](docs/agents/gotchas.md).
4. `ss -ltnp | grep 4400` must show **exactly one** listener, owned by the pm2 process
   (`echorank`). Kill any orphan `next-server` and restart before you call it done.

`pm2` runs under **root** (`/root/.pm2`). Without sudo you cannot restart it — do not
build. Hand the human the one-liner instead.

## Commits

- `git status` before you touch anything. In-flight work that is not yours gets its own
  commit, first.
- One feature, one commit.
- Never leave production-live changes uncommitted. This box has been rebuilt from git.

## Copy

- Brand is **Echorank360** / **Echorank** in user-facing copy. Never `EchoRank` or other
  camel-case. Tests enforce this. Do **not** rename identifiers, paths, env vars, pm2 app
  names or git refs to match — the rule is about copy only.
- Every user-facing string goes through the i18n catalogs. **Three locale models exist —
  do not assume one:**
  - Dashboard (`src/lib/i18n/dashboard.ts`): `DashLocale = "en" | "fr" | "de-CH"`.
    `dashboardLocale()` folds `fr*`→`fr`, `de*`→`de-CH`, everything else (incl. `en-CA`)
    →`en`. Writing a fourth catalog here produces unreachable code.
  - Marketing (`src/lib/i18n/config.ts`): 5 — `en, en-CA, fr, fr-CA, de-CH`.
  - Pricing (`src/lib/i18n/pricing.ts`): 8 — adds `es-419, es-ES, es-MX`.
- French is real French, not machine output. de-CH uses **ss**, never **ß**.

## Data and limits

- Counters and rate limits live in **Redis**, month-keyed `INCR` with a TTL past the
  longest month. See `src/lib/site-audit/quota.ts` for the shape to copy. In-process
  `Map`s reset on every deploy and this box restarts often.
  (Known violator, not yet fixed: `src/app/api/av/audit/route.ts`.)
- Every API route taking an `:id` is tenant-scoped — `findFirst({ where: { id, tenantId } })`,
  never `findUnique({ where: { id } })`. New routes go through `requireTenant()`
  (`src/lib/tenant.ts`) or `requirePaidPlan()`.
- Log `costUsd` on every stored run that spends money upstream.

## Tool pages

- Help modals use the shared `ToolHelpModal` + `help-illustrations/` convention. No
  bespoke modals. Illustrations are `aria-hidden`, `focusable="false"`, carry **no
  translatable text**, and share the 480×150 canvas. `tests/tool-help.test.ts` enforces it.
- Quotas and usage render from live data. Never hardcode a plan number into copy — read
  it from the plan config.
- A new tool must be added to `SEO_TOOL_GROUPS`, all three dashboard catalogs, `dashNav`,
  and the route table in `src/lib/__tests__/seo-tools.test.ts`.

## Tests

The suite ends **green**:

```
npx tsc --noEmit && npx eslint src tests && npm test
```

`eslint src tests` has a pre-existing error baseline: **173 errors, 57 warnings** as of
2026-08-15 — `react/no-unescaped-entities` (101), `no-html-link-for-pages` (45),
`react-hooks/set-state-in-effect` (19), then a long tail. Do not add to it; do not "fix"
it as a side quest. Lint **only the files you touched** — a clean run there is the bar,
and it is the check that actually works, because the repo-wide number drifts under you.

**`npm test` does not run as `deploy`.** `.env` is `600 echorank`, and vitest's config
load reads it through vite's `loadEnv` before a single test runs — so the documented
command above dies on `EACCES: /opt/echorank/app/.env` for anyone but `echorank`/root.
Point `envDir` at an empty directory to skip that read:

```
mkdir -p /tmp/noenv
printf 'import base from "/opt/echorank/app/vitest.config.ts";\nexport default { ...base, envDir: "/tmp/noenv" };\n' > /tmp/vitest.noenv.config.ts
npx vitest run --config /tmp/vitest.noenv.config.ts
```

The whole vitest suite (3070 passing, 7 skipped) passes this way — nothing in it needs the real
`.env`. The `node --test` scripts (`test:imports`, `test:seo-tools`, … ) never read it
and run as-is; only `test:vitest`, the last link in `npm test`, is affected.

The same 600 `.env` is why anything else that reads it — a build, `prisma migrate` —
must run as `echorank` or root. A build started as `deploy` does not fail; it silently
comes up env-less, which is worse.
