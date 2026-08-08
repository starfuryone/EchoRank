#!/usr/bin/env bash
# fix-boost-page.sh — repairs the broken v1→v2 replacement.
# Restores the newest page backup (pre-v2, intact v1 block), then replaces the
# v1 block using the correct end anchor: "</section>" followed by the 6-space ")}".
# Data file + SVGs from make-boost-rankings-page.sh are fine and untouched.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
PAGE="src/app/[locale]/solutions/[category]/[slug]/page.tsx"

LATEST=$(ls -t "$PAGE".bak.* 2>/dev/null | head -1)
[ -n "$LATEST" ] || { echo "ABORT: no backup found"; exit 1; }
echo "restoring: $LATEST"
cp "$PAGE" "$PAGE.broken.$TS"
cp "$LATEST" "$PAGE"

python3 - "$PAGE" <<'PYEOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()

if "solutions-detail v2" in src:
    sys.exit("ABORT: restored file already has v2 — wrong backup restored? Inspect manually.")

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

# v1 block: from its marker comment to "</section>" + newline + exactly-6-space ")}".
v1 = re.search(
    r'[ \t]*\{/\* solutions-detail: optional per-item card grid.*?</section>\n {6}\)\}\n\n?',
    src, re.S)
if v1:
    src = src[:v1.start()] + BLOCK + src[v1.end():]
    mode = "replaced v1 block"
else:
    if 'from "@/lib/solutions-detail"' not in src:
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
    mode = "inserted fresh (no v1 found)"

# sanity: balanced JSX-ish delimiters
for a, b in [("{", "}"), ("(", ")")]:
    if src.count(a) != src.count(b):
        sys.exit(f"PATCH ABORT: unbalanced {a}{b} after edit — not writing")

p.write_text(src)
print(f"patch: v2 render block {mode}; braces balanced")
PYEOF

echo
echo "Verify before building:  npx tsc --noEmit 2>&1 | head -5"
echo "Then:  NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web"
echo "Then:  CF Purge Everything (after the build)."
