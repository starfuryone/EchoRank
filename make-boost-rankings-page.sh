#!/usr/bin/env bash
# make-boost-rankings-page.sh — ONE script, the whole page.
# Ensures both graphics, writes solutions-detail.ts v2 (3 prose sections with
# the SERP graphic + 4 workflow cards with the rank-climb graphic, en+fr),
# and upgrades the page render block (replaces v1 if present, inserts fresh
# otherwise). Idempotent. Backups: .bak.$TS. Run from /opt/echorank/app.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
PAGE="src/app/[locale]/solutions/[category]/[slug]/page.tsx"
[ -f "$PAGE" ] || { echo "ABORT: $PAGE not found"; exit 1; }

# ── 1. Graphics ──────────────────────────────────────────────────────────
mkdir -p public/solutions
base64 -d > public/solutions/boost-search-rankings.svg <<'B64A'
PHN2ZyB2aWV3Qm94PSIwIDAgMTIwMCA2MzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZm9udC1mYW1pbHk9IkludGVyLFNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZ0dyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTgxQTIwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzFFMjMyOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZUdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIwIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRjBCOTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZDRDUzNSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYXJlYUdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRkNENTM1IiBzdG9wLW9wYWNpdHk9IjAuMjIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkNENTM1IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJnbG93IiB4PSItNDAlIiB5PSItNDAlIiB3aWR0aD0iMTgwJSIgaGVpZ2h0PSIxODAlIj4KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNiIgcmVzdWx0PSJiIi8+CiAgICAgIDxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjMwIiBmaWxsPSJ1cmwoI2JnR3JhZCkiLz4KCiAgPCEtLSBmYWludCBncmlkIC0tPgogIDxnIHN0cm9rZT0iIzJCMzEzOSIgc3Ryb2tlLXdpZHRoPSIxIj4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjE0MCIgeDI9IjExMjAiIHkyPSIxNDAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjI1MCIgeDI9IjExMjAiIHkyPSIyNTAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjM2MCIgeDI9IjExMjAiIHkyPSIzNjAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjQ3MCIgeDI9IjExMjAiIHkyPSI0NzAiLz4KICA8L2c+CgogIDwhLS0gaGVhZGxpbmUgLS0+CiAgPHRleHQgeD0iODAiIHk9Ijg2IiBmaWxsPSIjRUFFQ0VGIiBmb250LXNpemU9IjQwIiBmb250LXdlaWdodD0iNzAwIj5Cb29zdCBzZWFyY2ggcmFua2luZ3M8L3RleHQ+CiAgPHRleHQgeD0iODAiIHk9IjExOCIgZmlsbD0iIzg0OEU5QyIgZm9udC1zaXplPSIxOCI+VHJhY2sgcG9zaXRpb25zIMK3IFJlc2VhcmNoIGtleXdvcmRzIMK3IEZpeCB3aGF0IGhvbGRzIHBhZ2VzIGJhY2s8L3RleHQ+CgogIDwhLS0gcmlzaW5nIHJhbmsgbGluZTogeSA9IHJhbmsgcG9zaXRpb24gKGxvd2VyIGlzIGJldHRlciwgc28gbGluZSBjbGltYnMpIC0tPgogIDxwYXRoIGQ9Ik0xMjAsNTAwIEwyODAsNDcwIEw0NDAsNDgwIEw2MDAsMzkwIEw3NjAsMzMwIEw5MjAsMjUwIEwxMDgwLDE4MCIKICAgICAgICBmaWxsPSJub25lIiBzdHJva2U9InVybCgjbGluZUdyYWQpIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsdGVyPSJ1cmwoI2dsb3cpIi8+CiAgPHBhdGggZD0iTTEyMCw1MDAgTDI4MCw0NzAgTDQ0MCw0ODAgTDYwMCwzOTAgTDc2MCwzMzAgTDkyMCwyNTAgTDEwODAsMTgwIEwxMDgwLDU2MCBMMTIwLDU2MCBaIgogICAgICAgIGZpbGw9InVybCgjYXJlYUdyYWQpIi8+CgogIDwhLS0gcmFuayBiYWRnZXMgYWxvbmcgdGhlIGxpbmUgLS0+CiAgPGcgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+CiAgICA8Zz4KICAgICAgPHJlY3QgeD0iOTAiIHk9IjUxMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjMwIiByeD0iNiIgZmlsbD0iIzJCMzEzOSIvPgogICAgICA8dGV4dCB4PSIxMjIiIHk9IjUzMiIgZmlsbD0iIzg0OEU5QyI+IzE0PC90ZXh0PgogICAgPC9nPgogICAgPGc+CiAgICAgIDxyZWN0IHg9IjU2OCIgeT0iNDAyIiB3aWR0aD0iNjQiIGhlaWdodD0iMzAiIHJ4PSI2IiBmaWxsPSIjMkIzMTM5Ii8+CiAgICAgIDx0ZXh0IHg9IjYwMCIgeT0iNDIyIiBmaWxsPSIjRUFFQ0VGIj4jNzwvdGV4dD4KICAgIDwvZz4KICAgIDxnPgogICAgICA8cmVjdCB4PSIxMDQ0IiB5PSIxMjYiIHdpZHRoPSI3MiIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiNGQ0Q1MzUiLz4KICAgICAgPHRleHQgeD0iMTA4MCIgeT0iMTUwIiBmaWxsPSIjMTgxQTIwIiBmb250LXNpemU9IjE4Ij4jMzwvdGV4dD4KICAgIDwvZz4KICA8L2c+CgogIDwhLS0gZmxvYXRpbmcgU0VSUCBjYXJkIC0tPgogIDxnPgogICAgPHJlY3QgeD0iNzAwIiB5PSIzODAiIHdpZHRoPSI0MjAiIGhlaWdodD0iMTcwIiByeD0iMTQiIGZpbGw9IiMxRTIzMjkiIHN0cm9rZT0iIzJCMzEzOSIvPgogICAgPHJlY3QgeD0iNzAwIiB5PSIzODAiIHdpZHRoPSI0MjAiIGhlaWdodD0iNDQiIHJ4PSIxNCIgZmlsbD0iIzJCMzEzOSIvPgogICAgPHJlY3QgeD0iNzAwIiB5PSI0MTAiIHdpZHRoPSI0MjAiIGhlaWdodD0iMTQiIGZpbGw9IiMyQjMxMzkiLz4KICAgIDxjaXJjbGUgY3g9IjcyNiIgY3k9IjQwMiIgcj0iNiIgZmlsbD0iIzg0OEU5QyIvPgogICAgPHRleHQgeD0iNzQ0IiB5PSI0MDgiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMTUiIGZvbnQtd2VpZ2h0PSI2MDAiPlJhbmsgVHJhY2tlcjwvdGV4dD4KICAgIDx0ZXh0IHg9IjEwOTYiIHk9IjQwOCIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9ImVuZCI+TElWRTwvdGV4dD4KCiAgICA8IS0tIGtleXdvcmQgcm93cyAtLT4KICAgIDxnIGZvbnQtc2l6ZT0iMTQiPgogICAgICA8dGV4dCB4PSI3MjQiIHk9IjQ1NCIgZmlsbD0iI0VBRUNFRiI+YnV5IHJ1bm5pbmcgc2hvZXMgb25saW5lPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI0NTQiIGZpbGw9IiMwRUNCODEiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiA2PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI0NTQiIGZpbGw9IiNFQUVDRUYiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiMzPC90ZXh0PgoKICAgICAgPHRleHQgeD0iNzI0IiB5PSI0ODgiIGZpbGw9IiNFQUVDRUYiPmJlc3QgdHJhaWwgcnVubmVycyAyMDI2PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI0ODgiIGZpbGw9IiMwRUNCODEiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiA0PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI0ODgiIGZpbGw9IiNFQUVDRUYiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiM1PC90ZXh0PgoKICAgICAgPHRleHQgeD0iNzI0IiB5PSI1MjIiIGZpbGw9IiM4NDhFOUMiPnJ1bm5pbmcgc2hvZSBzdG9yZSBuZWFyIG1lPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI1MjIiIGZpbGw9IiNGQ0Q1MzUiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiAyPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI1MjIiIGZpbGw9IiM4NDhFOUMiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiM5PC90ZXh0PgogICAgPC9nPgogIDwvZz4KCiAgPCEtLSBzbWFsbCBzdGF0IGNoaXBzIGxlZnQgLS0+CiAgPGcgZm9udC1zaXplPSIxNCI+CiAgICA8cmVjdCB4PSI4MCIgeT0iMzAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMxRTIzMjkiIHN0cm9rZT0iIzJCMzEzOSIvPgogICAgPHRleHQgeD0iMTAwIiB5PSIzMjciIGZpbGw9IiM4NDhFOUMiPktleXdvcmRzIHRyYWNrZWQ8L3RleHQ+CiAgICA8dGV4dCB4PSIxMDAiIHk9IjM1MCIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCI+MTI4PC90ZXh0PgoKICAgIDxyZWN0IHg9IjgwIiB5PSIzODAiIHdpZHRoPSIyMDAiIGhlaWdodD0iNjQiIHJ4PSIxMiIgZmlsbD0iIzFFMjMyOSIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgICA8dGV4dCB4PSIxMDAiIHk9IjQwNyIgZmlsbD0iIzg0OEU5QyI+SXNzdWVzIGZpeGVkPC90ZXh0PgogICAgPHRleHQgeD0iMTAwIiB5PSI0MzAiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI3MDAiPjQ3PC90ZXh0PgogIDwvZz4KCiAgPCEtLSBicmFuZCAtLT4KICA8dGV4dCB4PSI4MCIgeT0iNTk2IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE0IiBsZXR0ZXItc3BhY2luZz0iMSI+ZWNob3JhbmszNjAuY29tPC90ZXh0Pgo8L3N2Zz4K
B64A
base64 -d > public/solutions/boost-search-rankings-serp.svg <<'B64B'
PHN2ZyB2aWV3Qm94PSIwIDAgMTIwMCA2MzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZm9udC1mYW1pbHk9IkludGVyLFNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZzIiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTgxQTIwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzFFMjMyOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9Imdsb3cyIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj4KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iOCIgcmVzdWx0PSJiIi8+CiAgICAgIDxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjMwIiBmaWxsPSJ1cmwoI2JnMikiLz4KCiAgPCEtLSBoZWFkbGluZSAtLT4KICA8dGV4dCB4PSI4MCIgeT0iODAiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMzQiIGZvbnQtd2VpZ2h0PSI3MDAiPk93biB0aGUgcmVzdWx0IHRoYXQgbWF0dGVyczwvdGV4dD4KICA8dGV4dCB4PSI4MCIgeT0iMTEyIiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE3Ij5SZXNlYXJjaCB0aGUgdGVybSwgZml4IHRoZSBwYWdlLCB3YXRjaCBpdCBjbGltYjwvdGV4dD4KCiAgPCEtLSBTRVJQIHBhbmVsIC0tPgogIDxyZWN0IHg9IjgwIiB5PSIxNTAiIHdpZHRoPSI3MDAiIGhlaWdodD0iNDMwIiByeD0iMTYiIGZpbGw9IiMxRTIzMjkiIHN0cm9rZT0iIzJCMzEzOSIvPgoKICA8IS0tIHNlYXJjaCBiYXIgLS0+CiAgPHJlY3QgeD0iMTEwIiB5PSIxODAiIHdpZHRoPSI1NjAiIGhlaWdodD0iNDYiIHJ4PSIyMyIgZmlsbD0iIzE4MUEyMCIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgPGNpcmNsZSBjeD0iMTM2IiBjeT0iMjAzIiByPSI4IiBmaWxsPSJub25lIiBzdHJva2U9IiM4NDhFOUMiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxsaW5lIHgxPSIxNDIiIHkxPSIyMDkiIHgyPSIxNDkiIHkyPSIyMTYiIHN0cm9rZT0iIzg0OEU5QyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8dGV4dCB4PSIxNjAiIHk9IjIwOSIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIxNiI+YmVzdCBjcm0gZm9yIHNtYWxsIGFnZW5jaWVzPC90ZXh0PgoKICA8IS0tIHJlc3VsdCAxOiBZT1UsIGhpZ2hsaWdodGVkIC0tPgogIDxyZWN0IHg9IjExMCIgeT0iMjQ4IiB3aWR0aD0iNjQwIiBoZWlnaHQ9IjEwOCIgcng9IjEyIiBmaWxsPSIjMTgxQTIwIiBzdHJva2U9IiNGQ0Q1MzUiIHN0cm9rZS13aWR0aD0iMiIgZmlsdGVyPSJ1cmwoI2dsb3cyKSIvPgogIDxyZWN0IHg9IjYzMiIgeT0iMjYyIiB3aWR0aD0iMTAyIiBoZWlnaHQ9IjI2IiByeD0iMTMiIGZpbGw9IiNGQ0Q1MzUiLz4KICA8dGV4dCB4PSI2ODMiIHk9IjI4MCIgZmlsbD0iIzE4MUEyMCIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+WU9VIMK3ICMxPC90ZXh0PgogIDx0ZXh0IHg9IjEzMiIgeT0iMjgwIiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjEzIj55b3VyYWdlbmN5LmNvbTwvdGV4dD4KICA8dGV4dCB4PSIxMzIiIHk9IjMwNiIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjYwMCI+VGhlIENSTSBidWlsdCBmb3IgNS1wZXJzb24gYWdlbmNpZXM8L3RleHQ+CiAgPHRleHQgeD0iMTMyIiB5PSIzMzIiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMTQiPlBpcGVsaW5lLCBpbnZvaWNpbmcgYW5kIGNsaWVudCBwb3J0YWwgaW4gb25lIHRvb2wuIEZyZWUgNy1kYXkgdHJpYWzigKY8L3RleHQ+CgogIDwhLS0gcmVzdWx0IDIgLS0+CiAgPHJlY3QgeD0iMTEwIiB5PSIzNzIiIHdpZHRoPSI2NDAiIGhlaWdodD0iOTAiIHJ4PSIxMiIgZmlsbD0iIzE4MUEyMCIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgPHRleHQgeD0iMTMyIiB5PSI0MDAiIGZpbGw9IiM4NDhFOUMiIGZvbnQtc2l6ZT0iMTMiPmNvbXBldGl0b3Itb25lLmNvbTwvdGV4dD4KICA8dGV4dCB4PSIxMzIiIHk9IjQyNCIgZmlsbD0iIzVFNjY3MyIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjYwMCI+Q1JNIHNvZnR3YXJlIOKAlCBwbGFucyBhbmQgcHJpY2luZzwvdGV4dD4KICA8dGV4dCB4PSIxMzIiIHk9IjQ0NiIgZmlsbD0iIzVFNjY3MyIgZm9udC1zaXplPSIxMyI+Q29tcGFyZSBvdXIgcGxhbnMgZm9yIHRlYW1zIG9mIGFueSBzaXpl4oCmPC90ZXh0PgoKICA8IS0tIHJlc3VsdCAzIC0tPgogIDxyZWN0IHg9IjExMCIgeT0iNDc4IiB3aWR0aD0iNjQwIiBoZWlnaHQ9IjgyIiByeD0iMTIiIGZpbGw9IiMxODFBMjAiIHN0cm9rZT0iIzJCMzEzOSIvPgogIDx0ZXh0IHg9IjEzMiIgeT0iNTA2IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjEzIj5iaWdkaXJlY3RvcnkuY29tPC90ZXh0PgogIDx0ZXh0IHg9IjEzMiIgeT0iNTMwIiBmaWxsPSIjNUU2NjczIiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNjAwIj4xNyBiZXN0IENSTXMgcmV2aWV3ZWQ8L3RleHQ+CgogIDwhLS0gcmlnaHQgY29sdW1uOiBob3cgaXQgaGFwcGVuZWQgLS0+CiAgPGcgZm9udC1zaXplPSIxNSI+CiAgICA8cmVjdCB4PSI4MjAiIHk9IjE1MCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNCIgZmlsbD0iIzFFMjMyOSIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgICA8dGV4dCB4PSI4NDQiIHk9IjE4NCIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPlJFU0VBUkNIRUQ8L3RleHQ+CiAgICA8dGV4dCB4PSI4NDQiIHk9IjIxMiIgZmlsbD0iI0VBRUNFRiI+MSw5MDAgc2VhcmNoZXMgLyBtb250aDwvdGV4dD4KICAgIDx0ZXh0IHg9Ijg0NCIgeT0iMjM4IiBmaWxsPSIjODQ4RTlDIj5EaWZmaWN1bHR5OiB3aW5uYWJsZTwvdGV4dD4KCiAgICA8cmVjdCB4PSI4MjAiIHk9IjI4NiIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNCIgZmlsbD0iIzFFMjMyOSIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgICA8dGV4dCB4PSI4NDQiIHk9IjMyMCIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPkZJWEVEPC90ZXh0PgogICAgPHRleHQgeD0iODQ0IiB5PSIzNDgiIGZpbGw9IiNFQUVDRUYiPjEyIGF1ZGl0IGlzc3VlcyBjbGVhcmVkPC90ZXh0PgogICAgPHRleHQgeD0iODQ0IiB5PSIzNzQiIGZpbGw9IiM4NDhFOUMiPkNvcmUgV2ViIFZpdGFsczogcGFzczwvdGV4dD4KCiAgICA8cmVjdCB4PSI4MjAiIHk9IjQyMiIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNCIgZmlsbD0iIzFFMjMyOSIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgICA8dGV4dCB4PSI4NDQiIHk9IjQ1NiIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPlRSQUNLRUQ8L3RleHQ+CiAgICA8dGV4dCB4PSI4NDQiIHk9IjQ4NCIgZmlsbD0iI0VBRUNFRiI+IzExIOKGkiAjMSBpbiA5IHdlZWtzPC90ZXh0PgogICAgPHRleHQgeD0iODQ0IiB5PSI1MTAiIGZpbGw9IiMwRUNCODEiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiAxMCBwb3NpdGlvbnM8L3RleHQ+CiAgPC9nPgoKICA8dGV4dCB4PSI4MCIgeT0iNjA4IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE0IiBsZXR0ZXItc3BhY2luZz0iMSI+ZWNob3JhbmszNjAuY29tPC90ZXh0Pgo8L3N2Zz4K
B64B
echo "graphics: 2 SVGs written to public/solutions/"

# ── 2. solutions-detail.ts v2 (full overwrite; this file is owned by these installers) ──
[ -f src/lib/solutions-detail.ts ] && cp src/lib/solutions-detail.ts "src/lib/solutions-detail.ts.bak.$TS"
cat > src/lib/solutions-detail.ts <<'TSEOF'
// src/lib/solutions-detail.ts  (v2)
//
// Optional per-item deep-dive for Solutions pages: prose sections (each an
// /0N section, optional graphic) followed by a card grid with an optional
// graphic. Rendered by [slug]/page.tsx after any longform sections, numbering
// continues automatically. Adding content for another slug is a config edit —
// no page files touched. Items without an entry render exactly as before.
//
// PURE — no Prisma, no React.

import type { SolutionBase } from "./solutions-taxonomy";

export interface SolutionDetailImage {
  /** Served from public/solutions/. */
  src: string;
  alt: string;
}

export interface SolutionProseSection {
  h2: string;
  paras: string[];
  image?: SolutionDetailImage;
}

export interface SolutionDetailCard {
  title: string;
  body: string;
}

export interface SolutionDetail {
  /** Long-read sections rendered first, one /0N section each. */
  prose?: SolutionProseSection[];
  /** Uppercase eyebrow after the /0N label on the cards section. */
  eyebrow: string;
  h2: string;
  cards: SolutionDetailCard[];
  image?: SolutionDetailImage;
}

const DETAILS: Record<string, Record<SolutionBase, SolutionDetail>> = {
  "boost-search-rankings": {
    en: {
      prose: [
        {
          h2: "Why rankings drift even when you change nothing",
          paras: [
            "A position is not a fact, it is a contest re-run every day. Competitors publish, Google reshuffles what a query deserves, and a page that sat at #4 for a year slides to #9 without anyone touching it. If you only check rankings when a client asks, you find out after the traffic is gone.",
            "Daily tracking turns that into a non-event. You see the slide the day it starts, open the SERP that changed, and read who moved above you and with what. Most recoveries are cheap when they start early: a refreshed title, a stronger internal link, a paragraph the new competitor covers and you don't.",
          ],
        },
        {
          h2: "Pick keywords by evidence, not instinct",
          paras: [
            "The expensive mistake in ranking work is spending months on a term nobody buys from. Volume alone doesn't tell you that — a keyword with 10,000 searches and zero purchase intent is worth less than one with 300 searches from people comparing vendors.",
            "Cross two sources before committing. Keyword research shows what the market types and how hard each term is to win; your own Search Console data shows where Google already trusts you — queries where you sit at position 8 to 20 with real impressions. Those near-miss terms are the fastest wins on the board: the relevance is proven, only the push is missing.",
          ],
          image: {
            src: "/solutions/boost-search-rankings-serp.svg",
            alt: "Search results with your listing at position 1: researched, fixed, tracked",
          },
        },
        {
          h2: "A first week that actually moves the needle",
          paras: [
            "Day one: run a site audit and connect Search Console. Don't fix anything yet — just get the full list of what's broken and what already ranks.",
            "Day two and three: fix the audit's top layer — broken links, duplicate titles, redirect chains, pages slow enough to fail Core Web Vitals. This is unglamorous work with the best effort-to-impact ratio in SEO, because it lifts every page at once.",
            "Rest of the week: seed your tracker with the near-miss queries from Search Console plus the terms you want to own, and strengthen the two or three pages behind them. From then on, ranking work stops being a quarterly panic and becomes a short daily read of what moved.",
          ],
        },
      ],
      eyebrow: "THE WORKFLOW",
      h2: "From tracked to ranked",
      cards: [
        {
          title: "See where you rank",
          body: "Rank Tracker checks your keywords daily; SERP Checker pulls any live result. Position history, movement, and who displaced you — no manual searches.",
        },
        {
          title: "Target terms that convert",
          body: "Keywords Explorer shows volume and difficulty so you invest in queries buyers actually type. GSC Insights adds your real clicks and impressions from Google.",
        },
        {
          title: "Fix what holds you back",
          body: "Audit Site crawls your pages and flags broken links, duplicate titles and redirect chains. Lighthouse scores the speed signals Google ranks on.",
        },
        {
          title: "Rank in AI answers too",
          body: "Search is no longer ten blue links. AI Lens shows what AI crawlers actually see on your pages, so you appear in assistant answers, not just Google.",
        },
      ],
      image: {
        src: "/solutions/boost-search-rankings.svg",
        alt: "Rank Tracker view: positions climbing from 14 to 3",
      },
    },
    fr: {
      prose: [
        {
          h2: "Pourquoi les positions glissent même sans rien changer",
          paras: [
            "Une position n'est pas un acquis : c'est un concours rejoué chaque jour. Les concurrents publient, Google réévalue ce qu'une requête mérite, et une page installée en 4e position depuis un an glisse en 9e sans que personne n'y ait touché. Si vous ne vérifiez vos positions que lorsqu'un client le demande, vous l'apprenez une fois le trafic parti.",
            "Le suivi quotidien en fait un non-événement. Vous voyez la glissade le jour où elle commence, vous ouvrez la SERP concernée et vous lisez qui est passé devant vous, et avec quoi. La plupart des rattrapages coûtent peu quand ils démarrent tôt : un titre rafraîchi, un lien interne plus solide, un paragraphe que le nouveau concurrent couvre et pas vous.",
          ],
        },
        {
          h2: "Choisir ses mots-clés sur des preuves, pas à l'instinct",
          paras: [
            "L'erreur coûteuse en référencement, c'est de passer des mois sur un terme qui ne fait rien vendre. Le volume seul ne le révèle pas : un mot-clé à 10 000 recherches sans intention d'achat vaut moins qu'un autre à 300 recherches tapé par des gens qui comparent des fournisseurs.",
            "Croisez deux sources avant de vous engager. La recherche de mots-clés montre ce que le marché tape et la difficulté de chaque terme ; vos propres données Search Console montrent où Google vous fait déjà confiance — les requêtes où vous êtes entre la 8e et la 20e position avec de vraies impressions. Ces termes « presque gagnés » sont les victoires les plus rapides : la pertinence est prouvée, il ne manque que la poussée.",
          ],
          image: {
            src: "/solutions/boost-search-rankings-serp.svg",
            alt: "Résultats de recherche avec votre fiche en position 1 : recherché, corrigé, suivi",
          },
        },
        {
          h2: "Une première semaine qui fait vraiment bouger les choses",
          paras: [
            "Jour un : lancez un audit de site et connectez Search Console. Ne corrigez rien encore — obtenez d'abord la liste complète de ce qui est cassé et de ce qui se classe déjà.",
            "Jours deux et trois : traitez la première couche de l'audit — liens brisés, titres dupliqués, chaînes de redirection, pages trop lentes pour les Core Web Vitals. C'est un travail ingrat, mais c'est le meilleur ratio effort-impact du SEO : il soulève toutes les pages à la fois.",
            "Le reste de la semaine : alimentez votre suivi avec les requêtes « presque gagnées » de Search Console et les termes que vous voulez conquérir, puis renforcez les deux ou trois pages qui les portent. Dès lors, le travail de positionnement cesse d'être une panique trimestrielle et devient une courte lecture quotidienne de ce qui a bougé.",
          ],
        },
      ],
      eyebrow: "LE PARCOURS",
      h2: "Du suivi au classement",
      cards: [
        {
          title: "Voyez où vous vous classez",
          body: "Rank Tracker vérifie vos mots-clés chaque jour ; SERP Checker interroge n'importe quel résultat en direct. Historique des positions, mouvements, et qui vous a délogé — sans recherches manuelles.",
        },
        {
          title: "Ciblez les termes qui convertissent",
          body: "Keywords Explorer affiche volume et difficulté pour investir dans les requêtes que les acheteurs tapent vraiment. GSC Insights ajoute vos clics et impressions réels tirés de Google.",
        },
        {
          title: "Corrigez ce qui vous freine",
          body: "Audit Site parcourt vos pages et signale liens brisés, titres dupliqués et chaînes de redirection. Lighthouse note les signaux de vitesse que Google prend en compte.",
        },
        {
          title: "Apparaissez aussi dans les réponses IA",
          body: "La recherche ne se limite plus à dix liens bleus. AI Lens montre ce que les robots IA voient réellement sur vos pages, pour figurer dans les réponses des assistants, pas seulement sur Google.",
        },
      ],
      image: {
        src: "/solutions/boost-search-rankings.svg",
        alt: "Vue Rank Tracker : positions passant de la 14e à la 3e place",
      },
    },
  },
};

export function detailFor(slug: string, base: SolutionBase): SolutionDetail | undefined {
  return DETAILS[slug]?.[base];
}
TSEOF
echo "data: src/lib/solutions-detail.ts v2 written (3 prose sections + 4 cards + 2 graphics, en+fr)"

# ── 3. Page render block v2 ──────────────────────────────────────────────
if grep -q "solutions-detail v2" "$PAGE"; then
  echo "patch: v2 block already present — nothing to do"
else
  cp "$PAGE" "$PAGE.bak.$TS"
  python3 - "$PAGE" <<'PYEOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()

BLOCK = """      {/* solutions-detail v2: optional per-item prose + cards + graphics, config-driven */}
      {detail?.prose?.map((sec, i) => (
        <section key={sec.h2} className={s.section}>
          <div className={s.container}>
            <p className={s.label}>
              <b>/ {String((longform?.sections.length ?? 0) + 3 + i).padStart(2, "0")}</b>
            </p>
            <h2 className={s.h2}>{sec.h2}</h2>
            {sec.paras.map((para, j) => (
              <p key={j} className={s.sub} style={{ maxWidth: 760, marginTop: j === 0 ? 10 : 14 }}>
                {para}
              </p>
            ))}
            {sec.image && (
              <img
                src={sec.image.src}
                alt={sec.image.alt}
                loading="lazy"
                style={{ width: "100%", borderRadius: 14, marginTop: 24, border: "1px solid rgba(255,255,255,.08)" }}
              />
            )}
          </div>
        </section>
      ))}
      {detail && (
        <section className={s.section}>
          <div className={s.container}>
            <p className={s.label}>
              <b>/ {String((longform?.sections.length ?? 0) + 3 + (detail.prose?.length ?? 0)).padStart(2, "0")}</b> — {detail.eyebrow}
            </p>
            <h2 className={s.h2}>{detail.h2}</h2>
            <div className={s.ucGrid}>
              {detail.cards.map((card) => (
                <div key={card.title} className={s.ucCard}>
                  <span className={s.ucTitle}>{card.title}</span>
                  <span className={s.ucBody}>{card.body}</span>
                </div>
              ))}
            </div>
            {detail.image && (
              <img
                src={detail.image.src}
                alt={detail.image.alt}
                loading="lazy"
                style={{ width: "100%", borderRadius: 14, marginTop: 28, border: "1px solid rgba(255,255,255,.08)" }}
              />
            )}
          </div>
        </section>
      )}

"""

v1 = re.search(r'[ \t]*\{/\* solutions-detail: optional per-item card grid.*?\n[ \t]*\)\}\n\n?', src, re.S)
if v1:
    src = src[:v1.start()] + BLOCK + src[v1.end():]
    mode = "replaced v1 block"
else:
    # fresh insert: imports + const + block before closing CTA
    if "solutions-detail" not in src:
        a = 'import { longformFor } from "@/lib/solutions-longform";'
        if a not in src: sys.exit("PATCH ABORT: longform import anchor missing")
        src = src.replace(a, a + '\nimport { detailFor } from "@/lib/solutions-detail";', 1)
        b = "const longform = longformFor(item.slug, base);"
        if b not in src: sys.exit("PATCH ABORT: longform const anchor missing")
        src = src.replace(b, b + "\n  const detail = detailFor(item.slug, base);", 1)
    i = src.find("{t.closeH2}")
    if i < 0: sys.exit("PATCH ABORT: closing CTA anchor missing")
    j = src.rfind("<section", 0, i)
    k = src.rfind("\n", 0, j) + 1
    src = src[:k] + BLOCK + src[k:]
    mode = "inserted fresh"

p.write_text(src)
print(f"patch: v2 render block {mode}")
PYEOF
fi

echo
echo "Next (as root):"
echo "  NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web"
echo "  THEN Cloudflare Purge Everything (after the build, not before)."
