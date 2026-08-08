#!/usr/bin/env bash
# install-boost-rankings-content.sh
# Adds a "/ 03 — THE WORKFLOW" section (4 copy blocks + graphic) to the
# boost-search-rankings solutions page, and installs the SVG asset.
# Idempotent. Backups: .bak.$TS. Run from /opt/echorank/app.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
[ -d src ] && [ -d public ] || { echo "ABORT: run from app root (src/ + public/ not found)"; exit 1; }

# ── 1. SVG asset ─────────────────────────────────────────────────────────
mkdir -p public/solutions
if [ -f public/solutions/boost-search-rankings.svg ]; then
  echo "svg: already present, leaving as is"
else
  base64 -d > public/solutions/boost-search-rankings.svg <<'B64EOF'
PHN2ZyB2aWV3Qm94PSIwIDAgMTIwMCA2MzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZm9udC1mYW1pbHk9IkludGVyLFNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZ0dyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTgxQTIwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzFFMjMyOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibGluZUdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIwIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRjBCOTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZDRDUzNSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYXJlYUdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRkNENTM1IiBzdG9wLW9wYWNpdHk9IjAuMjIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkNENTM1IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJnbG93IiB4PSItNDAlIiB5PSItNDAlIiB3aWR0aD0iMTgwJSIgaGVpZ2h0PSIxODAlIj4KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNiIgcmVzdWx0PSJiIi8+CiAgICAgIDxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjMwIiBmaWxsPSJ1cmwoI2JnR3JhZCkiLz4KCiAgPCEtLSBmYWludCBncmlkIC0tPgogIDxnIHN0cm9rZT0iIzJCMzEzOSIgc3Ryb2tlLXdpZHRoPSIxIj4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjE0MCIgeDI9IjExMjAiIHkyPSIxNDAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjI1MCIgeDI9IjExMjAiIHkyPSIyNTAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjM2MCIgeDI9IjExMjAiIHkyPSIzNjAiLz4KICAgIDxsaW5lIHgxPSI4MCIgeTE9IjQ3MCIgeDI9IjExMjAiIHkyPSI0NzAiLz4KICA8L2c+CgogIDwhLS0gaGVhZGxpbmUgLS0+CiAgPHRleHQgeD0iODAiIHk9Ijg2IiBmaWxsPSIjRUFFQ0VGIiBmb250LXNpemU9IjQwIiBmb250LXdlaWdodD0iNzAwIj5Cb29zdCBzZWFyY2ggcmFua2luZ3M8L3RleHQ+CiAgPHRleHQgeD0iODAiIHk9IjExOCIgZmlsbD0iIzg0OEU5QyIgZm9udC1zaXplPSIxOCI+VHJhY2sgcG9zaXRpb25zIMK3IFJlc2VhcmNoIGtleXdvcmRzIMK3IEZpeCB3aGF0IGhvbGRzIHBhZ2VzIGJhY2s8L3RleHQ+CgogIDwhLS0gcmlzaW5nIHJhbmsgbGluZTogeSA9IHJhbmsgcG9zaXRpb24gKGxvd2VyIGlzIGJldHRlciwgc28gbGluZSBjbGltYnMpIC0tPgogIDxwYXRoIGQ9Ik0xMjAsNTAwIEwyODAsNDcwIEw0NDAsNDgwIEw2MDAsMzkwIEw3NjAsMzMwIEw5MjAsMjUwIEwxMDgwLDE4MCIKICAgICAgICBmaWxsPSJub25lIiBzdHJva2U9InVybCgjbGluZUdyYWQpIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsdGVyPSJ1cmwoI2dsb3cpIi8+CiAgPHBhdGggZD0iTTEyMCw1MDAgTDI4MCw0NzAgTDQ0MCw0ODAgTDYwMCwzOTAgTDc2MCwzMzAgTDkyMCwyNTAgTDEwODAsMTgwIEwxMDgwLDU2MCBMMTIwLDU2MCBaIgogICAgICAgIGZpbGw9InVybCgjYXJlYUdyYWQpIi8+CgogIDwhLS0gcmFuayBiYWRnZXMgYWxvbmcgdGhlIGxpbmUgLS0+CiAgPGcgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+CiAgICA8Zz4KICAgICAgPHJlY3QgeD0iOTAiIHk9IjUxMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjMwIiByeD0iNiIgZmlsbD0iIzJCMzEzOSIvPgogICAgICA8dGV4dCB4PSIxMjIiIHk9IjUzMiIgZmlsbD0iIzg0OEU5QyI+IzE0PC90ZXh0PgogICAgPC9nPgogICAgPGc+CiAgICAgIDxyZWN0IHg9IjU2OCIgeT0iNDAyIiB3aWR0aD0iNjQiIGhlaWdodD0iMzAiIHJ4PSI2IiBmaWxsPSIjMkIzMTM5Ii8+CiAgICAgIDx0ZXh0IHg9IjYwMCIgeT0iNDIyIiBmaWxsPSIjRUFFQ0VGIj4jNzwvdGV4dD4KICAgIDwvZz4KICAgIDxnPgogICAgICA8cmVjdCB4PSIxMDQ0IiB5PSIxMjYiIHdpZHRoPSI3MiIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiNGQ0Q1MzUiLz4KICAgICAgPHRleHQgeD0iMTA4MCIgeT0iMTUwIiBmaWxsPSIjMTgxQTIwIiBmb250LXNpemU9IjE4Ij4jMzwvdGV4dD4KICAgIDwvZz4KICA8L2c+CgogIDwhLS0gZmxvYXRpbmcgU0VSUCBjYXJkIC0tPgogIDxnPgogICAgPHJlY3QgeD0iNzAwIiB5PSIzODAiIHdpZHRoPSI0MjAiIGhlaWdodD0iMTcwIiByeD0iMTQiIGZpbGw9IiMxRTIzMjkiIHN0cm9rZT0iIzJCMzEzOSIvPgogICAgPHJlY3QgeD0iNzAwIiB5PSIzODAiIHdpZHRoPSI0MjAiIGhlaWdodD0iNDQiIHJ4PSIxNCIgZmlsbD0iIzJCMzEzOSIvPgogICAgPHJlY3QgeD0iNzAwIiB5PSI0MTAiIHdpZHRoPSI0MjAiIGhlaWdodD0iMTQiIGZpbGw9IiMyQjMxMzkiLz4KICAgIDxjaXJjbGUgY3g9IjcyNiIgY3k9IjQwMiIgcj0iNiIgZmlsbD0iIzg0OEU5QyIvPgogICAgPHRleHQgeD0iNzQ0IiB5PSI0MDgiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMTUiIGZvbnQtd2VpZ2h0PSI2MDAiPlJhbmsgVHJhY2tlcjwvdGV4dD4KICAgIDx0ZXh0IHg9IjEwOTYiIHk9IjQwOCIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9ImVuZCI+TElWRTwvdGV4dD4KCiAgICA8IS0tIGtleXdvcmQgcm93cyAtLT4KICAgIDxnIGZvbnQtc2l6ZT0iMTQiPgogICAgICA8dGV4dCB4PSI3MjQiIHk9IjQ1NCIgZmlsbD0iI0VBRUNFRiI+YnV5IHJ1bm5pbmcgc2hvZXMgb25saW5lPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI0NTQiIGZpbGw9IiMwRUNCODEiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiA2PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI0NTQiIGZpbGw9IiNFQUVDRUYiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiMzPC90ZXh0PgoKICAgICAgPHRleHQgeD0iNzI0IiB5PSI0ODgiIGZpbGw9IiNFQUVDRUYiPmJlc3QgdHJhaWwgcnVubmVycyAyMDI2PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI0ODgiIGZpbGw9IiMwRUNCODEiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiA0PC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI0ODgiIGZpbGw9IiNFQUVDRUYiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiM1PC90ZXh0PgoKICAgICAgPHRleHQgeD0iNzI0IiB5PSI1MjIiIGZpbGw9IiM4NDhFOUMiPnJ1bm5pbmcgc2hvZSBzdG9yZSBuZWFyIG1lPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDQwIiB5PSI1MjIiIGZpbGw9IiNGQ0Q1MzUiIGZvbnQtd2VpZ2h0PSI3MDAiPuKWsiAyPC90ZXh0PgogICAgICA8dGV4dCB4PSIxMDk2IiB5PSI1MjIiIGZpbGw9IiM4NDhFOUMiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtd2VpZ2h0PSI3MDAiPiM5PC90ZXh0PgogICAgPC9nPgogIDwvZz4KCiAgPCEtLSBzbWFsbCBzdGF0IGNoaXBzIGxlZnQgLS0+CiAgPGcgZm9udC1zaXplPSIxNCI+CiAgICA8cmVjdCB4PSI4MCIgeT0iMzAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMxRTIzMjkiIHN0cm9rZT0iIzJCMzEzOSIvPgogICAgPHRleHQgeD0iMTAwIiB5PSIzMjciIGZpbGw9IiM4NDhFOUMiPktleXdvcmRzIHRyYWNrZWQ8L3RleHQ+CiAgICA8dGV4dCB4PSIxMDAiIHk9IjM1MCIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCI+MTI4PC90ZXh0PgoKICAgIDxyZWN0IHg9IjgwIiB5PSIzODAiIHdpZHRoPSIyMDAiIGhlaWdodD0iNjQiIHJ4PSIxMiIgZmlsbD0iIzFFMjMyOSIgc3Ryb2tlPSIjMkIzMTM5Ii8+CiAgICA8dGV4dCB4PSIxMDAiIHk9IjQwNyIgZmlsbD0iIzg0OEU5QyI+SXNzdWVzIGZpeGVkPC90ZXh0PgogICAgPHRleHQgeD0iMTAwIiB5PSI0MzAiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI3MDAiPjQ3PC90ZXh0PgogIDwvZz4KCiAgPCEtLSBicmFuZCAtLT4KICA8dGV4dCB4PSI4MCIgeT0iNTk2IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE0IiBsZXR0ZXItc3BhY2luZz0iMSI+ZWNob3JhbmszNjAuY29tPC90ZXh0Pgo8L3N2Zz4K
B64EOF
  echo "svg: installed public/solutions/boost-search-rankings.svg ($(wc -c < public/solutions/boost-search-rankings.svg) bytes)"
fi

# ── 2. Locate the source holding this page's copy ────────────────────────
ANCHOR="Ranking work starts with knowing where you actually stand"
mapfile -t HITS < <(grep -rl --include='*.ts' --include='*.tsx' "$ANCHOR" src/ || true)
if [ "${#HITS[@]}" -eq 0 ]; then echo "ABORT: anchor copy not found in src/"; exit 1; fi
if [ "${#HITS[@]}" -gt 1 ]; then printf 'ABORT: anchor found in %d files:\n' "${#HITS[@]}"; printf '  %s\n' "${HITS[@]}"; exit 1; fi
FILE="${HITS[0]}"
echo "target: $FILE"

if grep -q "boost-rankings-detail" "$FILE"; then
  echo "patch: marker already present — nothing to do"; exit 0
fi

# ── 3. The JSX block (written to a snippet file either way) ──────────────
mkdir -p snippets
cat > snippets/boost-rankings-sections.tsx <<'JSXEOF'
{/* boost-rankings-detail */}
<section className={__S__.section}>
  <div className={__S__.container}>
    <p className={__S__.label}><b>/ 03</b> — THE WORKFLOW</p>
    <h2 className={__S__.h2}>From tracked to ranked</h2>
    <div className={__S__.ucGrid}>
      <div className={__S__.ucCard}>
        <span className={__S__.ucTitle}>See where you rank</span>
        <span className={__S__.ucBody}>Rank Tracker checks your keywords daily; SERP Checker pulls any live result. Position history, movement, and who displaced you — no manual searches.</span>
      </div>
      <div className={__S__.ucCard}>
        <span className={__S__.ucTitle}>Target terms that convert</span>
        <span className={__S__.ucBody}>Keywords Explorer shows volume and difficulty so you invest in queries buyers actually type. GSC Insights adds your real clicks and impressions from Google.</span>
      </div>
      <div className={__S__.ucCard}>
        <span className={__S__.ucTitle}>Fix what holds you back</span>
        <span className={__S__.ucBody}>Audit Site crawls your pages and flags broken links, duplicate titles and redirect chains. Lighthouse scores the speed signals Google ranks on.</span>
      </div>
      <div className={__S__.ucCard}>
        <span className={__S__.ucTitle}>Rank in AI answers too</span>
        <span className={__S__.ucBody}>Search is no longer ten blue links. AI Lens shows what AI crawlers actually see on your pages, so you appear in assistant answers, not just Google.</span>
      </div>
    </div>
    <img src="/solutions/boost-search-rankings.svg" alt="Rank Tracker view: positions climbing from 14 to 3" loading="lazy" style={{width:"100%",borderRadius:14,marginTop:28,border:"1px solid rgba(255,255,255,.08)"}} />
  </div>
</section>
JSXEOF
echo "snippet: snippets/boost-rankings-sections.tsx written"

# ── 4. Patch (only if the copy lives in a .tsx page) ─────────────────────
case "$FILE" in
  *.tsx) : ;;
  *) echo "NOTE: copy lives in a config (.ts), not a page — schema unknown, not patching."
     echo "Wire snippets/boost-rankings-sections.tsx into the [slug] page (or add a detail field) manually / via Claude Code."
     exit 0 ;;
esac

cp "$FILE" "$FILE.bak.$TS"
python3 - "$FILE" <<'PYEOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()
anchor = "Ranking work starts with knowing where you actually stand"
i = src.find(anchor)
if i < 0: sys.exit("PATCH ABORT: anchor vanished")

m = re.search(r'className=\{(\w+)\.(?:h1|section)\}', src)
if not m: sys.exit("PATCH ABORT: cannot detect CSS-module import variable")
s = m.group(1)

# insert after the 2nd </section> following the anchor (hero close, /02 close)
pos, count = i, 0
while count < 2:
    j = src.find("</section>", pos)
    if j < 0: sys.exit("PATCH ABORT: expected </section> boundaries not found")
    pos = j + len("</section>"); count += 1

block = pathlib.Path("snippets/boost-rankings-sections.tsx").read_text().replace("__S__", s)
p.write_text(src[:pos] + "\n" + block + src[pos:])
print(f"patch: inserted /03 section into {p} (styles var: {s})")
PYEOF

echo
echo "Done. Next: NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web, then CF Purge Everything."
