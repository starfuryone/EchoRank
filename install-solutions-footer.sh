#!/usr/bin/env bash
# install-solutions-footer.sh
# Shared PublicFooter component that reproduces the homepage footer exactly
# (same home2 classes: s.footer/s.container/s.footin/s.footlinks, same © line),
# wired into the Solutions [slug] and [category] pages. The 17 existing inline
# footers are left untouched — migrate them to this component later, page by page.
# Idempotent. Backups: .bak.$TS. Run from /opt/echorank/app.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
SLUG_PAGE="src/app/[locale]/solutions/[category]/[slug]/page.tsx"
CAT_PAGE="src/app/[locale]/solutions/[category]/page.tsx"
[ -f "$SLUG_PAGE" ] || { echo "ABORT: $SLUG_PAGE not found"; exit 1; }

# ── 1. Component (home2 classes, no new CSS) ─────────────────────────────
mkdir -p src/components
if [ -f src/components/PublicFooter.tsx ]; then
  echo "component: PublicFooter.tsx already present, leaving as is"
else
cat > src/components/PublicFooter.tsx <<'TSXEOF'
// Shared marketing footer — identical markup and classes to the homepage
// footer in HomeClient.tsx (s.footer / s.footin / s.footlinks), so it can
// replace the 17 inline per-page footers one page at a time without any
// visual change. Links are en/fr; other locales fold to en, same as the
// solutions copy model.

import Link from "next/link";
import s from "@/app/[locale]/home2.module.css";

const LINKS: Record<"en" | "fr", ReadonlyArray<readonly [string, string]>> = {
  en: [
    ["/pricing", "Pricing"],
    ["/free-tools", "Free tools"],
    ["/learn", "Learn"],
    ["/about", "About"],
    ["/legal/terms", "Terms"],
    ["/legal/privacy", "Privacy"],
  ],
  fr: [
    ["/pricing", "Tarifs"],
    ["/free-tools", "Outils gratuits"],
    ["/learn", "Apprendre"],
    ["/about", "À propos"],
    ["/legal/terms", "Conditions"],
    ["/legal/privacy", "Confidentialité"],
  ],
};

export function PublicFooter({ locale }: { locale: string }) {
  const base = locale.startsWith("fr") ? "fr" : "en";
  const L = (href: string) => `/${locale}${href}`;
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footin}`}>
        <span>© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD</span>
        <span className={s.footlinks}>
          {LINKS[base].map(([href, lbl]) => (
            <Link key={href} href={L(href)}>{lbl}</Link>
          ))}
        </span>
      </div>
    </footer>
  );
}
TSXEOF
  echo "component: src/components/PublicFooter.tsx created (home2 classes, en+fr links)"
fi

# ── 2. Wire into pages ───────────────────────────────────────────────────
wire () {
  local FILE="$1"
  [ -f "$FILE" ] || { echo "skip: $FILE not found"; return 0; }
  if grep -q "PublicFooter" "$FILE"; then echo "patch: $FILE already wired"; return 0; fi
  grep -q "<PublicNav" "$FILE" || { echo "skip: $FILE has no PublicNav (cannot detect locale)"; return 0; }
  cp "$FILE" "$FILE.bak.$TS"
  python3 - "$FILE" <<'PYEOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()

m = re.search(r'<PublicNav\s+locale=\{([^}]+)\}', src)
if not m: sys.exit(f"PATCH ABORT ({p}): locale expression not found")
loc = m.group(1).strip()

nav = re.search(r'^import \{ PublicNav \}.*$', src, re.M)
if not nav: sys.exit(f"PATCH ABORT ({p}): PublicNav import not found")
src = src[:nav.end()] + '\nimport { PublicFooter } from "@/components/PublicFooter";' + src[nav.end():]

k = src.rfind("</section>")
if k < 0: sys.exit(f"PATCH ABORT ({p}): no </section>")
k += len("</section>")
src = src[:k] + f'\n\n      <PublicFooter locale={{{loc}}} />' + src[k:]

p.write_text(src)
print(f"patch: PublicFooter wired into {p} (locale: {loc})")
PYEOF
}
wire "$SLUG_PAGE"
wire "$CAT_PAGE"

echo
echo "Done. Verify: npx tsc --noEmit, then build + pm2 restart echorank360-web + CF Purge Everything."
echo "Later: migrate the 17 inline footers (lp.footer / s.footer pages) to <PublicFooter> via Claude Code, one commit."
