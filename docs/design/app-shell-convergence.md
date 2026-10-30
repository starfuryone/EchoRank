# App shell convergence: Echorank360 dashboard ↔ EchoPilot

Status: **plan only, nothing built.** Written 2026-10-30 from a read of both trees
(`/opt/echorank/app`, `/opt/echopilot`). File references are to those trees.

## 1. Why

The two products share a parent brand, the same fonts and, for the marketing site,
the same dark palette. They do not share an app shell: a customer who uses both
products moves from a light, Tailwind-gray, sidebar-and-drawer dashboard to a
dark/light, token-driven, left-nav-and-bottom-tabs app. The goal is one shell
vocabulary, with tokens, nav model and theme handled the same way in both. Each
product keeps its own sections and copy.

## 2. Inventory

| | Echorank360 dashboard | EchoPilot app |
|---|---|---|
| Stack | Next 16.2.6, React 19.2.4, Tailwind v4 (no config), lucide-react, cva + clsx | Next 16.3.4, React 19.2.8, Tailwind v4 imported but barely used; plain CSS, custom SVG icons |
| Shell files | `src/app/(dashboard)/layout.tsx` (server: auth, billing gate) → `src/components/layout/dashboard-shell.tsx` (client) + `sidebar.tsx` (243 l) + `header.tsx` (138 l) | `src/components/app-shell.tsx` (server, `section` prop) + `src/components/app/app-nav.tsx` (`AppSideNav`, `AppTabs`, `AppBreadcrumb`, `AppFooter`), `shell.tsx`, `site-header.tsx` |
| Nav model | Fixed left sidebar `w-64 bg-gray-900`; below `lg` (1024px) an off-canvas drawer with overlay and a hamburger in the sticky `h-16` white header. **No bottom tabs.** | Sticky left nav in a 188/200px grid column; at ≤768px a fixed **5-item bottom tab bar** with safe-area padding (`src/styles/app-shell.css:10-30`) |
| Nav config | Routes and icons in `sidebar.tsx:62-80`; labels in `dashNav` (`src/lib/i18n/dashboard.ts:24`, en/fr/de-CH); groups at `:4806`. 12 items in 3 groups. Active = longest matching href, computed client-side | One English-only config, `src/lib/nav.ts`: `APP_NAV` (8), `APP_MORE` (6), `APP_TABS` (first 4 + More). Active section passed by each page, so it needs no client JS |
| Tokens | Dashboard: **none**. It uses Tailwind default grays and a `blue-600` primary (`src/components/ui/button.tsx:17`). `globals.css:3-29` has `--background`, `--foreground`, `--brand-gold`. Marketing has `--er-*` (`globals.css:68-198`) | `src/app/globals.css:10-90`: unprefixed `--bg --surface --surface2 --line --text --muted --faint --gold --green --red --blue --radius(14px)`, with a light override block |
| Theme | **Light only.** `globals.css:35-37`: "THE DASHBOARD DOES NOT PARTICIPATE". Day/night exists for marketing only (`data-theme="day"`, localStorage `er-theme`) | Dark by default, light by toggle. Cookie `ep_theme` (1 year) plus localStorage; SSR sets `<html data-theme>`; `.theme-dark` islands stay dark |
| Primitives | `src/components/ui/`: 12 (button, card, badge, input, select, textarea, modal, data-table, stat-card, empty-state, back-link, initials-avatar) | None as a library. Flat components with semantic CSS classes (`.btn`, `.app-card`) |
| Fonts | Geist / Geist Mono | Geist / Geist Mono (same CSS vars) |

Findings that shape the plan:

- **The palettes already match.** EchoPilot's dark tokens use exactly the same hex
  values as Echorank's marketing `--er-*` Night tokens; its CSS header says they
  were lifted from Echorank. The Echorank dashboard is the odd one out.
- **The token names clash**: `--bg`/`--text`/`--gold` against `--er-*` and
  `--background`. The two light golds differ slightly (`#8a6400` against `#8a6100`).
- **The theme mechanisms differ**: Echorank uses an attribute (`day` or nothing)
  stored in localStorage only; EchoPilot uses an attribute (`light`/`dark`) with a
  cookie and SSR. The cookie approach is the better one because it paints
  correctly on first load.
- **The breakpoints differ**: Echorank switches to its drawer at 1024px,
  EchoPilot to its tabs at 768px.
- **Unreachable sections.** About a dozen `(dashboard)` route folders (customers,
  feedback, campaigns, recovery, analytics, intelligence, monitoring, imports,
  extension, templates, review-links) have no sidebar entry. Convergence is the
  time to decide which of them are navigation and which are deep links.

## 3. What is shared, and how

**Recommendation: copied tokens and shell components with a written contract, not
a published package.**

A package (`@echo/shell`) would need a registry, versioning and a release step
across two repos, and `deploy` cannot push from this box. That machinery is not
justified for about 10 CSS variables and 4 components that change a few times a
year.

Instead:

1. **Tokens.** Add one file, `shell-tokens.css`, kept byte-identical in both repos.
   It holds semantic names under a shared prefix (`--shell-bg`, `--shell-surface`,
   `--shell-surface-2`, `--shell-line`, `--shell-text`, `--shell-muted`,
   `--shell-faint`, `--shell-accent`, `--shell-accent-ink`, `--shell-ok`,
   `--shell-danger`, `--shell-radius`, `--shell-focus`), with dark and light blocks.
   Each product maps its existing names onto these (`--er-text: var(--shell-text)`,
   `--text: var(--shell-text)`), so nothing downstream has to be renamed at once.
   A test in each repo hashes the file and fails if the copies diverge. Run
   `scripts/sync-shell-tokens` to copy it and update the hash.
2. **Theme contract.** `data-theme="light"|"dark"` on `<html>`, a cookie for
   SSR and localStorage as a mirror. This is EchoPilot's mechanism. Echorank's
   marketing `day` value and `er-theme` key would need an alias period, because
   stored choices must survive the change.
3. **Shell components**, copied and adapted rather than imported: `AppSideNav`,
   `AppTabs` (the mobile bottom bar), `AppBreadcrumb`, and the header frame. They
   are data-driven from a `NavItem[]` config shaped like EchoPilot's `lib/nav.ts`,
   with **labels resolved by the caller**, so Echorank's three-locale `dashNav`
   keeps working and EchoPilot stays English.
4. **Primitives**: Echorank's 12 `ui/` components are rewritten to read
   `--shell-*` tokens through Tailwind v4 `@theme` mappings
   (`bg-surface`, `text-muted`, `border-line`) instead of `gray-*` literals.
   EchoPilot does not have to adopt them.

## 4. What stays Echorank-specific

- Auth, billing gate, paid-plan gating and the `x-pathname` route checks in
  `(dashboard)/layout.tsx`. The shell renders what the layout allows.
- `dashNav` and every i18n catalog. Locale models stay as documented in CLAUDE.md
  (dashboard: en, fr, de-CH).
- The notification bell, the assistant entry and its kill switches, the tenant
  switcher, the paid-only items (`/visibility/tools`, Marketing Studio).
- Tool pages' internal layouts, `ToolHelpModal` and help illustrations. Those
  illustrations must stay legible on both themes; see risk 3.
- PDF and print output (the av-service reports). These are out of scope and stay
  light.

## 5. Migration order (by section)

Each step ships alone, behind `SHELL_V2` (a per-tenant flag, default off), and is
verified with `next build` because the work touches Client Components.

| # | Step | Size |
|---|---|---|
| 0 | `shell-tokens.css` in both repos, the divergence test, and Echorank marketing `--er-*` mapped onto it. No visual change. | 1 d |
| 1 | Theme contract in Echorank: cookie, SSR attribute, `day` → `light` alias, migration of stored `er-theme` values. Marketing still behaves the same. | 1.5 d |
| 2 | Tailwind `@theme` mappings and the 12 `ui/` primitives moved to tokens, **light only**, pixel-compared against today's screenshots. | 2 d |
| 3 | Shell frame: sidebar and header on tokens, the `NavItem[]` config extracted from `sidebar.tsx`, bottom tabs at ≤768px (keeping the drawer between 768 and 1024px), behind `SHELL_V2`. | 3 d |
| 4 | Sections, in order of traffic and simplicity: **Dashboard → AI (`/ai`, `/visibility`) → Reputation → SEO Tools hub → Settings / Team / Billing / Help → tool pages**. Each section is reviewed in both themes. Sweep the `gray-*`, `bg-white` and `dark:` literals. | 6–8 d |
| 5 | Dark mode turned on for the dashboard, after every section passes contrast checks (extend `tests/theme-contrast.test.ts`). | 1.5 d |
| 6 | Decide on the unreachable routes (§2) and add them to nav or remove them. | 0.5 d + product decision |
| 7 | EchoPilot adopts `--shell-*` names (aliases first) and a `NavItem` label resolver. | 1.5 d |
| 8 | `SHELL_V2` on for everyone, old shell code removed. | 0.5 d |

## 6. Estimate

**About 18–21 engineering days** (roughly 4 weeks for one person), plus about 3
days of QA across both themes and three locales. The largest uncertainty is step
4: the tool pages hard-code `gray-*`/`bg-white` throughout, and the sweep can
grow if many charts carry inline colours. Size it after step 2 by counting
literals per page.

## 7. Risks

1. **Stored theme choices.** Renaming `er-theme`/`day` without an alias period
   resets every marketing visitor's toggle. Step 1 must read both.
2. **Client/server boundary.** Shell components become Client Components where
   they hold toggle state. Keep the nav config free of dependencies (as
   `keyword-opportunity/limits.ts` is) so no server module is pulled into the
   bundle. See CLAUDE.md, *Client / server boundary*.
3. **Illustrations.** Help illustrations and tool SVGs drawn for a white
   background need a dark-theme pass. `tests/tool-help.test.ts` enforces their
   shape, not their colours, so this needs a visual check.
4. **Cache.** Marketing pages served from Cloudflare with long `s-maxage` must not
   bake a theme into cached HTML. The SSR attribute applies to authenticated pages
   and per-request marketing only. Run Purge Everything after step 1.
