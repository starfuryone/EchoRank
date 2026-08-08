#!/usr/bin/env bash
# install-solutions-detail.sh  (stage 2)
# Config-driven deep-dive for Solutions pages, matching the taxonomy philosophy:
#  - new pure data file src/lib/solutions-detail.ts (cards + optional image,
#    en/fr, keyed by slug; only boost-search-rankings populated)
#  - patches [slug]/page.tsx to render it as the next /0N section (numbering
#    continues after longform), before the closing CTA. Other 24 pages unchanged.
# Idempotent. Backups: .bak.$TS. Run from /opt/echorank/app.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
PAGE="src/app/[locale]/solutions/[category]/[slug]/page.tsx"
[ -f "$PAGE" ] || { echo "ABORT: $PAGE not found"; exit 1; }
[ -f public/solutions/boost-search-rankings.svg ] || echo "WARN: graphic missing — run install-boost-rankings-content.sh first (or rerun it; it is idempotent)"

# ── 1. Data file ─────────────────────────────────────────────────────────
if [ -f src/lib/solutions-detail.ts ]; then
  echo "data: solutions-detail.ts already present, leaving as is"
else
cat > src/lib/solutions-detail.ts <<'TSEOF'
// src/lib/solutions-detail.ts
//
// Optional per-item deep-dive for Solutions pages: a card grid plus an
// optional graphic, rendered by [slug]/page.tsx as the section AFTER any
// longform sections (numbering continues). Same rule as the taxonomy: adding
// content here is a config edit, no page files touched. Items without an
// entry render exactly as before.
//
// PURE — no Prisma, no React.

import type { SolutionBase } from "./solutions-taxonomy";

export interface SolutionDetailCard {
  title: string;
  body: string;
}

export interface SolutionDetail {
  /** Uppercase eyebrow after the /0N label. */
  eyebrow: string;
  h2: string;
  cards: SolutionDetailCard[];
  /** Served from public/solutions/. */
  image?: { src: string; alt: string };
}

const DETAILS: Record<string, Record<SolutionBase, SolutionDetail>> = {
  "boost-search-rankings": {
    en: {
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
  echo "data: src/lib/solutions-detail.ts created (en + fr)"
fi

# ── 2. Page patch ────────────────────────────────────────────────────────
if grep -q "solutions-detail" "$PAGE"; then
  echo "patch: already wired — nothing to do"; exit 0
fi
cp "$PAGE" "$PAGE.bak.$TS"
python3 - "$PAGE" <<'PYEOF'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()

def need(sub, name):
    i = src.find(sub)
    if i < 0: sys.exit(f"PATCH ABORT: anchor not found: {name}")
    return i

# import — right after the longform import
a = 'import { longformFor } from "@/lib/solutions-longform";'
need(a, "longform import")
src = src.replace(a, a + '\nimport { detailFor } from "@/lib/solutions-detail";', 1)

# const — right after the longform const
b = "const longform = longformFor(item.slug, base);"
need(b, "longform const")
src = src.replace(b, b + "\n  const detail = detailFor(item.slug, base);", 1)

# render block — before the closing-CTA section (the one containing t.closeH2)
i = need("{t.closeH2}", "closing CTA")
j = src.rfind("<section", 0, i)
if j < 0: sys.exit("PATCH ABORT: closing CTA <section not found")
# back up to start of line for clean indentation
k = src.rfind("\n", 0, j) + 1

block = """      {/* solutions-detail: optional per-item card grid + graphic, config-driven */}
      {detail && (
        <section className={s.section}>
          <div className={s.container}>
            <p className={s.label}>
              <b>/ {String((longform?.sections.length ?? 0) + 3).padStart(2, "0")}</b> — {detail.eyebrow}
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
src = src[:k] + block + src[k:]
p.write_text(src)
print("patch: detail section wired into page.tsx")
PYEOF

echo
echo "Done. Verify: npx tsc --noEmit (or npm test), then build + pm2 restart echorank360-web + CF Purge Everything."
echo "Other goal pages: add entries to DETAILS in src/lib/solutions-detail.ts — no page edits needed."

