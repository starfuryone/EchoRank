# Conventions

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

## Branding

`Echorank360` / `Echorank` in user-facing copy. Never `EchoRank` or other camel-case.
Enforced by assertions in `src/lib/__tests__/` (`seo-tools`, `gsc`, `devtools`,
`competitors-i18n`) that stringify the catalogs and assert the camel-case form is absent.

The rule is about **copy**. Do not rename identifiers, file paths, env vars, pm2 app names,
database columns or git refs to match it.

## i18n — three locale models

They are genuinely different. Picking the wrong one produces unreachable code.

| Surface | Source | Locales |
|---|---|---|
| Dashboard | `src/lib/i18n/dashboard.ts` | **3** — `en`, `fr`, `de-CH` |
| Marketing | `src/lib/i18n/config.ts` | **5** — `en`, `en-CA`, `fr`, `fr-CA`, `de-CH` |
| Pricing | `src/lib/i18n/pricing.ts` | **8** — the 5 plus `es-419`, `es-ES`, `es-MX` |

`dashboardLocale()` folds the cookie: `fr*`→`fr`, `de*`→`de-CH`, everything else including
`en-CA`→`en`. A request for "five dashboard catalogs" is a request for two dead ones.

- French is real French. `fr` and `fr-CA` share the `fr` dashboard catalog (Québec French).
- de-CH uses **ss**, never **ß** — `Schliessen`, `massgebend`.
- Server component reads the cookie and passes `locale` down; the client component indexes
  the catalog. Copy never lives in the component.

## Copy shape

Catalogs are a plain `const <name>En = {...}` whose type is derived
(`export type XCopy = typeof xEn`) and a `Record<DashLocale, XCopy>`. The derived type is
what makes a missing translation a compile error. Interpolation is a function
(`(n: number) => string`), never string concatenation at the call site.

## Tenant isolation

Every route taking an `:id` scopes by tenant:

```ts
prisma.thing.findFirst({ where: { id, tenantId } })   // yes
prisma.thing.findUnique({ where: { id } })            // no
```

19 `[id]` API routes exist and all of them do this. New routes go through `requireTenant()`
(`src/lib/tenant.ts`) or `requirePaidPlan()` (`src/lib/paid-plan.ts`). Public v1 and MCP
routes go through `authenticatePublicRequest` → `verifyApiKey`; keys are stored SHA-256
hashed.

## Counters, quotas, rate limits

Redis, month-keyed `INCR`, TTL past the longest month. Copy the shape from
`src/lib/site-audit/quota.ts`:

```
echorank:<tool>:<metric>:<tenantId>:<YYYY-MM>     TTL 40d
```

`INCR` first, roll back when over the line — read-then-write races between the web process
and the workers. Each tool keeps its own quota module; they are deliberately parallel rather
than shared.

In-process `Map`s are wrong here: they reset on every `pm2 restart` and are not shared
between web and workers. `src/lib/rate-limit.ts` falls back to in-memory when Redis is
unavailable, which is a deliberate liveness choice, not a licence to start there.

**Known violator:** `src/app/api/av/audit/route.ts` still uses a bare `new Map()` for its
1-per-24h free-audit limit. Its sibling `/api/av/keywords` does it correctly via Redis.

## Tool pages

- One help modal implementation: `src/components/seo-tools/ToolHelpModal.tsx`. A tool's
  help file binds copy + illustration onto it and nothing else. No bespoke modals — four
  were consolidated for a reason.
- Illustrations live in `src/components/seo-tools/help-illustrations/`, built from the
  primitives in `shared.tsx`: 480×150 canvas, `aria-hidden`, `focusable="false"`, gray-200
  strokes / blue-600 accents, animation disabled under `prefers-reduced-motion`, and **no
  translatable text** — digits and metric abbreviations only. `tests/tool-help.test.ts`
  enforces every one of these.
- Quota and usage strings render from live plan config. Never hardcode a plan number.
- Numbers on a page come from stored data. An empty state says so; it does not fill space
  with a plausible figure. `FeatureScaffold` exists for the not-built case.

## Adding a tool

1. `SEO_TOOL_GROUPS` in `src/lib/seo-tools.ts`
2. `SEO_TOOLS_COPY.items.<id>` in all three dashboard catalogs
3. `dashNav` entry per locale (the sidebar/header title)
4. `EXPECTED_HREFS` in `src/lib/__tests__/seo-tools.test.ts`
5. Page under `src/app/(dashboard)/visibility/tools/<slug>/page.tsx` — server component
   reading the locale cookie, rendering a client component
6. Help modal + illustration, and the entries in `tests/tool-help.test.ts`

Steps 2–4 are compile or test failures if skipped, by design.

## Tests

```
npm test        # node:test suites + vitest
```

`npx tsc --noEmit` and the suite must be green before a deploy. See [deploy.md](deploy.md)
for the lint baseline caveat.
