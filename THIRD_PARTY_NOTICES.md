# Third-party notices

Echorank360 includes code adapted from the projects below. "Adapted" means the
original was read and its behaviour, invariants or edge-case handling were
reimplemented in this repo's conventions — not copied verbatim. Every adapted
file carries the header comment:

```
// Portions adapted from every-app/open-seo (MIT)
```

---

## every-app/open-seo

Upstream: https://github.com/every-app/open-seo
License: MIT

### Files in this repository with adapted portions

| File | What was adapted |
| --- | --- |
| `src/lib/dataforseo/client.ts` | DataForSEO v3 envelope parsing and per-task billing semantics; `pathToFeature` classification. |
| `src/lib/dataforseo/endpoints.ts` | SDK-method → v3-path mapping for the endpoint families in scope. |
| `src/lib/mcp/table.ts` | Compact fixed-width table rendering for MCP tool text output (`formatMcpCell`, `truncatedCell`, `formatMcpTable`, `readPath`). |
| `src/lib/mcp/output-schemas.ts` | Per-tool zod output-schema discipline for MCP `structuredContent`. |
| `src/lib/mcp/schemas.ts` | Per-tool zod input-schema discipline. |
| `src/lib/ai-citations/cited-sources.ts` | Cited-sources derivation: top_pages authoritative for rows and metrics, prompt examples attached from the mentions sample, URL-scope filter applied before the per-platform cap. |
| `src/lib/ai-citations/share-of-voice.ts` | Share-of-voice arithmetic: null-vs-zero handling, seeded rows for every requested brand, case-insensitive key matching, competitor de-duplication. |
| `src/lib/ai-citations/target.ts` | Research-scope model (domain / subdomains / subfolder / exact_url) and the URL post-filter, since the provider has no URL-level targeting. |
| `src/lib/ai-citations/url.ts` | http(s) scheme allow-listing for URLs originating in LLM answers. |
| `src/lib/backlinks/filters.ts` | DataForSEO filter-expression builders: include/exclude term semantics, ilike escaping, numeric ranges, and the 8-condition budget assertion. |
| `src/lib/backlinks/target.ts` | The URL-prefix (subfolder) scope, and the filtered `total_count` technique for a path's totals where the summary endpoint takes only a whole target. |

### MIT License

```
MIT License

Copyright (c) 2026 Ben Senescu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
