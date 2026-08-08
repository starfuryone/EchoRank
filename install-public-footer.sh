#!/usr/bin/env bash
# install-public-footer.sh
# Creates src/components/PublicFooter.tsx (+ module CSS) and wires it into the
# solutions page (the file rendering PublicNav with current="solutions").
# Idempotent. Backups: .bak.$TS. Run from /opt/echorank/app.
# If a footer component already exists, aborts and lists it (FORCE=1 to proceed).
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
[ -d src ] || { echo "ABORT: run from app root"; exit 1; }

# ── 0. Existing-footer guard ─────────────────────────────────────────────
if [ "${FORCE:-0}" != "1" ]; then
  mapfile -t EXISTING < <(grep -rl --include='*.tsx' -iE 'export (default )?(function|const) \w*Footer' src/components 2>/dev/null | grep -v 'components/PublicFooter.tsx$' || true)
  if [ "${#EXISTING[@]}" -gt 0 ]; then
    echo "ABORT: footer component(s) already exist — reuse instead of duplicating:"
    printf '  %s\n' "${EXISTING[@]}"
    echo "Re-run with FORCE=1 to install PublicFooter anyway."
    exit 1
  fi
fi

# ── 1. Component + CSS module ────────────────────────────────────────────
mkdir -p src/components
if [ -f src/components/PublicFooter.tsx ]; then
  echo "component: PublicFooter.tsx already present, leaving as is"
else
cat > src/components/PublicFooter.module.css <<'CSSEOF'
.footer{border-top:1px solid rgba(255,255,255,.08);margin-top:64px;padding:48px 0 32px;font-size:14px}
.inner{max-width:1120px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:2px;color:#EAECEF;text-decoration:none}
.diamond{width:10px;height:10px;background:#FCD535;transform:rotate(45deg);display:inline-block}
.tagline{color:#848E9C;margin:12px 0 0;max-width:320px;line-height:1.5}
.colTitle{color:#EAECEF;font-weight:600;margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px}
.col a{display:block;color:#848E9C;text-decoration:none;padding:4px 0;transition:color .15s}
.col a:hover{color:#FCD535}
.legal{max-width:1120px;margin:36px auto 0;padding:20px 24px 0;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;color:#848E9C}
.legal a{color:#848E9C;text-decoration:none}
.legal a:hover{color:#FCD535}
@media (max-width:760px){.inner{grid-template-columns:1fr 1fr}.legal{flex-direction:column}}
CSSEOF
cat > src/components/PublicFooter.tsx <<'TSXEOF'
import f from "./PublicFooter.module.css";

export default function PublicFooter({ locale }: { locale: string }) {
  const p = (path: string) => `/${locale}${path}`;
  const year = new Date().getFullYear();
  return (
    <footer className={f.footer}>
      <div className={f.inner}>
        <div>
          <a className={f.brand} href={p("")}>
            <span className={f.diamond} aria-hidden="true" />ECHORANK
          </a>
          <p className={f.tagline}>
            Search rankings, reviews and AI visibility for your business — in one place.
          </p>
        </div>
        <div className={f.col}>
          <p className={f.colTitle}>Product</p>
          <a href={p("/ai-visibility")}>AI Visibility</a>
          <a href={p("#tools")}>SEO tools</a>
          <a href={p("/free-tools")}>Free tools</a>
          <a href={p("/pricing")}>Pricing</a>
          <a href="/extension">Browser extension</a>
        </div>
        <div className={f.col}>
          <p className={f.colTitle}>Resources</p>
          <a href={p("/learn")}>Knowledge hub</a>
          <a href={p("/guide")}>The complete guide</a>
          <a href={p("/resources")}>Downloads</a>
          <a href={p("/use-cases")}>Use cases</a>
        </div>
        <div className={f.col}>
          <p className={f.colTitle}>Company</p>
          <a href={p("/about")}>About Echorank</a>
          <a href="mailto:support@echorank360.com">Contact</a>
          <a href={p("/legal/terms")}>Terms of service</a>
          <a href={p("/legal/privacy")}>Privacy policy</a>
        </div>
      </div>
      <div className={f.legal}>
        <span>© {year} Echorank360. All rights reserved.</span>
        <span>Operated by ChatLogic Insights Ltd, registered in England and Wales.</span>
      </div>
    </footer>
  );
}
TSXEOF
  echo "component: PublicFooter.tsx + module.css created"
fi

# ── 2. Wire into the solutions page ──────────────────────────────────────
mapfile -t HITS < <(grep -rl --include='*.tsx' 'current="solutions"' src/ || true)
if [ "${#HITS[@]}" -eq 0 ]; then echo "ABORT: no page with PublicNav current=\"solutions\" found"; exit 1; fi
if [ "${#HITS[@]}" -gt 1 ]; then printf 'ABORT: multiple candidates:\n'; printf '  %s\n' "${HITS[@]}"; exit 1; fi
FILE="${HITS[0]}"
echo "target: $FILE"

if grep -q "PublicFooter" "$FILE"; then echo "patch: already wired — nothing to do"; exit 0; fi

cp "$FILE" "$FILE.bak.$TS"
python3 - "$FILE" <<'PYEOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()

m = re.search(r'<PublicNav\s+locale=\{([^}]+)\}', src)
if not m: sys.exit("PATCH ABORT: cannot detect locale expression from <PublicNav>")
loc = m.group(1).strip()

# import after last import line
imports = list(re.finditer(r'^import .*$', src, re.M))
if not imports: sys.exit("PATCH ABORT: no import lines found")
ie = imports[-1].end()
src = src[:ie] + '\nimport PublicFooter from "@/components/PublicFooter";' + src[ie:]

# insert after the LAST </section>
k = src.rfind("</section>")
if k < 0: sys.exit("PATCH ABORT: no </section> found")
k += len("</section>")
src = src[:k] + f'\n      <PublicFooter locale={{{loc}}} />' + src[k:]

p.write_text(src)
print(f"patch: PublicFooter wired into {p} (locale expr: {loc})")
PYEOF

echo
echo "Done. Next: build + pm2 restart echorank360-web + CF Purge Everything."
echo "Note: footer is page-scoped for now; to go site-wide, render <PublicFooter> in the [locale] marketing layout instead."
