# SEO service

All metadata flows through here so pages can't drift apart.

**Adding a new public page**

1. `export const generateMetadata = async ({params}) => buildMetadata({ locale, path: "/my-page", title: "My Page", description: "..." })` — pass the title *without* the brand; `buildMetadata` appends `| Echorank360` exactly once and emits `title.absolute`.
2. Register the route in `registry.ts` → `LOCALIZED_ROUTES` (or `PLAIN_ROUTES` if it isn't locale-prefixed). Sitemap and hreflang follow automatically.
3. Optional structured data: `<JsonLd graph={[organization(locale), webSite(locale), ...]} />` — one `JsonLd` per page.

**Do not**

- Hand-write `<meta>`, `<title>`, `<link rel="canonical">` or `application/ld+json` tags in a page.
- Add `title` as a plain string (the root layout template would append a second brand).
- Add `google-site-verification` meta — verification is file-based at `public/google53f8cfb2ee070790.html`.
- Put `aggregateRating`, `reviewCount` or any metric in structured data that we cannot evidence.
