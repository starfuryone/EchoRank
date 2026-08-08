#!/usr/bin/env bash
# add-get-cited-by-ai.sh — text + graphic for /solutions/goals/get-cited-by-ai.
# Pure data addition: writes the SVG and appends a DETAILS entry to
# src/lib/solutions-detail.ts (v2 schema). No page code changes needed.
# Idempotent. Backup: .bak.$TS. Run from /opt/echorank/app.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
DF=src/lib/solutions-detail.ts
[ -f "$DF" ] || { echo "ABORT: $DF not found — run make-boost-rankings-page.sh first"; exit 1; }
grep -q "prose?: SolutionProseSection" "$DF" || { echo "ABORT: $DF is not the v2 schema"; exit 1; }

mkdir -p public/solutions
base64 -d > public/solutions/get-cited-by-ai.svg <<'B64EOF'
PHN2ZyB2aWV3Qm94PSIwIDAgMTIwMCA2MzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZm9udC1mYW1pbHk9IkludGVyLFNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZzMiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTgxQTIwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzFFMjMyOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9Imdsb3czIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj4KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNyIgcmVzdWx0PSJiIi8+CiAgICAgIDxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjMwIiBmaWxsPSJ1cmwoI2JnMykiLz4KCiAgPHRleHQgeD0iODAiIHk9IjgwIiBmaWxsPSIjRUFFQ0VGIiBmb250LXNpemU9IjM0IiBmb250LXdlaWdodD0iNzAwIj5CZSB0aGUgYW5zd2VyLCBub3QgYSByZXN1bHQ8L3RleHQ+CiAgPHRleHQgeD0iODAiIHk9IjExMiIgZmlsbD0iIzg0OEU5QyIgZm9udC1zaXplPSIxNyI+V2hlbiBhc3Npc3RhbnRzIGFuc3dlciBmb3IgeW91LCBjaXRlZCBiZWF0cyByYW5rZWQ8L3RleHQ+CgogIDwhLS0gY2hhdCBwYW5lbCAtLT4KICA8cmVjdCB4PSI4MCIgeT0iMTUwIiB3aWR0aD0iNjgwIiBoZWlnaHQ9IjQzMCIgcng9IjE2IiBmaWxsPSIjMUUyMzI5IiBzdHJva2U9IiMyQjMxMzkiLz4KICA8Y2lyY2xlIGN4PSIxMTYiIGN5PSIxODYiIHI9IjEwIiBmaWxsPSIjMkIzMTM5Ii8+CiAgPHRleHQgeD0iMTM2IiB5PSIxOTIiIGZpbGw9IiM4NDhFOUMiIGZvbnQtc2l6ZT0iMTQiPkFJIGFzc2lzdGFudDwvdGV4dD4KCiAgPCEtLSB1c2VyIGJ1YmJsZSAtLT4KICA8cmVjdCB4PSIzMzAiIHk9IjIxNCIgd2lkdGg9IjQwNCIgaGVpZ2h0PSI0NiIgcng9IjE0IiBmaWxsPSIjMkIzMTM5Ii8+CiAgPHRleHQgeD0iMzUyIiB5PSIyNDMiIGZpbGw9IiNFQUVDRUYiIGZvbnQtc2l6ZT0iMTYiPldoYXQncyB0aGUgYmVzdCBDUk0gZm9yIGEgc21hbGwgYWdlbmN5PzwvdGV4dD4KCiAgPCEtLSBhc3Npc3RhbnQgYnViYmxlIC0tPgogIDxyZWN0IHg9IjEwNiIgeT0iMjg2IiB3aWR0aD0iNTYwIiBoZWlnaHQ9IjIwMCIgcng9IjE0IiBmaWxsPSIjMTgxQTIwIiBzdHJva2U9IiMyQjMxMzkiLz4KICA8dGV4dCB4PSIxMzAiIHk9IjMyMiIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIxNiI+Rm9yIGEgNS1wZXJzb24gYWdlbmN5LCB0aGUgdG9vbCB0aGF0IGNvbWVzPC90ZXh0PgogIDx0ZXh0IHg9IjEzMCIgeT0iMzQ4IiBmaWxsPSIjRUFFQ0VGIiBmb250LXNpemU9IjE2Ij51cCBtb3N0IG9mdGVuIGlzPC90ZXh0PgogIDxyZWN0IHg9IjI1NiIgeT0iMzMwIiB3aWR0aD0iMTUwIiBoZWlnaHQ9IjI2IiByeD0iNyIgZmlsbD0iI0ZDRDUzNSIgZmlsdGVyPSJ1cmwoI2dsb3czKSIvPgogIDx0ZXh0IHg9IjMzMSIgeT0iMzQ5IiBmaWxsPSIjMTgxQTIwIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj55b3VyYWdlbmN5LmNvbTwvdGV4dD4KICA8dGV4dCB4PSI0MTQiIHk9IjM0OCIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIxNiI+4oCUIHJldmlld2VyczwvdGV4dD4KICA8dGV4dCB4PSIxMzAiIHk9IjM3NCIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIxNiI+Y2l0ZSBpdHMgYnVpbHQtaW4gaW52b2ljaW5nIGFuZCBjbGllbnQgcG9ydGFsLjwvdGV4dD4KICA8dGV4dCB4PSIxMzAiIHk9IjQwMCIgZmlsbD0iIzg0OEU5QyIgZm9udC1zaXplPSIxNSI+SXQga2VlcHMgcGlwZWxpbmUsIGJpbGxpbmcgYW5kIHJldmlld3MgaW4gb25lIHBsYWNlLDwvdGV4dD4KICA8dGV4dCB4PSIxMzAiIHk9IjQyNCIgZmlsbD0iIzg0OEU5QyIgZm9udC1zaXplPSIxNSI+d2hpY2ggc21hbGxlciB0ZWFtcyBjb25zaXN0ZW50bHkgcmF0ZSBoaWdoZXN0LjwvdGV4dD4KICA8cmVjdCB4PSIxMzAiIHk9IjQ0NCIgd2lkdGg9Ijg2IiBoZWlnaHQ9IjI0IiByeD0iMTIiIGZpbGw9IiMyQjMxMzkiLz4KICA8dGV4dCB4PSIxNzMiIHk9IjQ2MSIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U09VUkNFIFsxXTwvdGV4dD4KICA8cmVjdCB4PSIyMjYiIHk9IjQ0NCIgd2lkdGg9IjExMCIgaGVpZ2h0PSIyNCIgcng9IjEyIiBmaWxsPSIjMkIzMTM5Ii8+CiAgPHRleHQgeD0iMjgxIiB5PSI0NjEiIGZpbGw9IiM4NDhFOUMiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnJldmlld3MgwrcgNC444piFPC90ZXh0PgoKICA8IS0tIHR5cGluZyBkb3RzIC0tPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjUzMCIgcj0iNSIgZmlsbD0iIzVFNjY3MyIvPgogIDxjaXJjbGUgY3g9IjE1MCIgY3k9IjUzMCIgcj0iNSIgZmlsbD0iIzg0OEU5QyIvPgogIDxjaXJjbGUgY3g9IjE3MCIgY3k9IjUzMCIgcj0iNSIgZmlsbD0iI0VBRUNFRiIvPgoKICA8IS0tIHJpZ2h0IGNvbHVtbjogZW5naW5lIGNvdmVyYWdlIC0tPgogIDxyZWN0IHg9IjgwMCIgeT0iMTUwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjMxMCIgcng9IjE2IiBmaWxsPSIjMUUyMzI5IiBzdHJva2U9IiMyQjMxMzkiLz4KICA8dGV4dCB4PSI4MjQiIHk9IjE4NiIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPkFOU1dFUiBUUkFDS0lORzwvdGV4dD4KICA8ZyBmb250LXNpemU9IjE2Ij4KICAgIDx0ZXh0IHg9IjgyNCIgeT0iMjI4IiBmaWxsPSIjRUFFQ0VGIj5DaGF0R1BUPC90ZXh0PgogICAgPHRleHQgeD0iMTA5NiIgeT0iMjI4IiBmaWxsPSIjMEVDQjgxIiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0iZW5kIj7inJMgY2l0ZWQ8L3RleHQ+CiAgICA8dGV4dCB4PSI4MjQiIHk9IjI2OCIgZmlsbD0iI0VBRUNFRiI+Q2xhdWRlPC90ZXh0PgogICAgPHRleHQgeD0iMTA5NiIgeT0iMjY4IiBmaWxsPSIjMEVDQjgxIiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0iZW5kIj7inJMgY2l0ZWQ8L3RleHQ+CiAgICA8dGV4dCB4PSI4MjQiIHk9IjMwOCIgZmlsbD0iI0VBRUNFRiI+UGVycGxleGl0eTwvdGV4dD4KICAgIDx0ZXh0IHg9IjEwOTYiIHk9IjMwOCIgZmlsbD0iIzBFQ0I4MSIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9ImVuZCI+4pyTIGNpdGVkPC90ZXh0PgogICAgPHRleHQgeD0iODI0IiB5PSIzNDgiIGZpbGw9IiNFQUVDRUYiPkdlbWluaTwvdGV4dD4KICAgIDx0ZXh0IHg9IjEwOTYiIHk9IjM0OCIgZmlsbD0iIzg0OEU5QyIgdGV4dC1hbmNob3I9ImVuZCI+bm90IHlldDwvdGV4dD4KICA8L2c+CiAgPGxpbmUgeDE9IjgyNCIgeTE9IjM3NiIgeDI9IjEwOTYiIHkyPSIzNzYiIHN0cm9rZT0iIzJCMzEzOSIvPgogIDx0ZXh0IHg9IjgyNCIgeT0iNDE0IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE0Ij5NZW50aW9uIHJhdGU8L3RleHQ+CiAgPHRleHQgeD0iMTA5NiIgeT0iNDE4IiBmaWxsPSIjRkNENTM1IiBmb250LXNpemU9IjI2IiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0iZW5kIj43NSU8L3RleHQ+CgogIDxyZWN0IHg9IjgwMCIgeT0iNDgwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjEwMCIgcng9IjE2IiBmaWxsPSIjMUUyMzI5IiBzdHJva2U9IiMyQjMxMzkiLz4KICA8dGV4dCB4PSI4MjQiIHk9IjUxNiIgZmlsbD0iI0ZDRDUzNSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjEiPlRISVMgV0VFSzwvdGV4dD4KICA8dGV4dCB4PSI4MjQiIHk9IjU0OCIgZmlsbD0iI0VBRUNFRiIgZm9udC1zaXplPSIxNiI+QXBwZWFyZWQgaW4gMTIgb2YgMTYgcHJvbXB0czwvdGV4dD4KICA8dGV4dCB4PSI4MjQiIHk9IjU3MiIgZmlsbD0iIzBFQ0I4MSIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjcwMCI+4payIDMgdnMgbGFzdCB3ZWVrPC90ZXh0PgoKICA8dGV4dCB4PSI4MCIgeT0iNjA4IiBmaWxsPSIjODQ4RTlDIiBmb250LXNpemU9IjE0IiBsZXR0ZXItc3BhY2luZz0iMSI+ZWNob3JhbmszNjAuY29tPC90ZXh0Pgo8L3N2Zz4K
B64EOF
echo "graphic: public/solutions/get-cited-by-ai.svg written"

cat > /tmp/.gcba-entry.ts <<'ENTRYEOF'
  "get-cited-by-ai": {
    en: {
      prose: [
        {
          h2: "Being cited is the new ranking",
          paras: [
            "A growing share of buyers never see a results page. They ask an assistant, get one synthesized answer, and act on it. If your business is in that answer, you win the customer before a click happens; if it isn't, you were never in the running — and no rank tracker will tell you.",
            "Citations don't come from wanting them. Assistants assemble answers from what they can crawl and what the web agrees on. The work is making your pages readable to AI crawlers, your facts consistent everywhere they appear, and your reputation corroborated by sources assistants trust.",
          ],
        },
        {
          h2: "What makes a business quotable",
          paras: [
            "Assistants echo consensus. A business with clear factual pages, the same name and description across directories and reviews, and third parties saying the same thing gets quoted; a business whose story changes from site to site gets skipped as unreliable.",
            "The mechanics matter too. If your pages render their real content only in the browser, AI crawlers may see an empty shell — plenty of sites are invisible to assistants for that reason alone. Checking what bots actually see is step one, not an afterthought.",
          ],
          image: {
            src: "/solutions/get-cited-by-ai.svg",
            alt: "AI assistant answer citing your business, with per-engine citation tracking",
          },
        },
        {
          h2: "Measure it like a channel",
          paras: [
            "You already treat search and email as channels with numbers. AI answers deserve the same: which prompts mention you, on which engines, how that rate moves week over week, and what changed when it drops.",
            "Once it's measured, it's improvable. A dip on one engine after a content change is a signal, not a mystery — and being able to point at the trend is what turns AI visibility from a talking point into a line on the report.",
          ],
        },
      ],
      eyebrow: "THE WORKFLOW",
      h2: "From invisible to cited",
      cards: [
        {
          title: "See what assistants say today",
          body: "Run the free AI visibility audit — no account needed — then track your mention rate and how engines describe you from the dashboard.",
        },
        {
          title: "Track the prompts that matter",
          body: "Custom Prompts runs the exact questions your buyers ask and records when you appear, so a drop shows up as an alert, not a lost quarter.",
        },
        {
          title: "Show AI crawlers a full page",
          body: "AI Lens compares what a bot receives with what a browser renders. If crawlers see an empty shell, you can't be cited — the gap tells you what to fix.",
        },
        {
          title: "Keep it monitored on schedule",
          body: "Scheduled monitoring re-runs your checkups automatically and flags changes, so AI visibility becomes a metric you watch, not a one-off test.",
        },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Être cité est le nouveau classement",
          paras: [
            "Une part croissante des acheteurs ne voit jamais de page de résultats. Ils posent une question à un assistant, reçoivent une seule réponse synthétisée et agissent. Si votre entreprise figure dans cette réponse, vous gagnez le client avant tout clic ; sinon, vous n'étiez même pas en lice — et aucun suivi de positions ne vous le dira.",
            "Les citations ne s'obtiennent pas en les souhaitant. Les assistants composent leurs réponses à partir de ce qu'ils peuvent explorer et de ce sur quoi le web s'accorde. Le travail consiste à rendre vos pages lisibles par les robots IA, vos informations cohérentes partout où elles apparaissent, et votre réputation corroborée par des sources de confiance.",
          ],
        },
        {
          h2: "Ce qui rend une entreprise citable",
          paras: [
            "Les assistants reprennent le consensus. Une entreprise aux pages factuelles claires, au même nom et à la même description dans les annuaires et les avis, et dont des tiers disent la même chose, est citée ; celle dont l'histoire change d'un site à l'autre est écartée comme peu fiable.",
            "La mécanique compte aussi. Si vos pages n'affichent leur vrai contenu que dans le navigateur, les robots IA peuvent ne voir qu'une coquille vide — beaucoup de sites sont invisibles pour les assistants pour cette seule raison. Vérifier ce que voient réellement les robots est la première étape, pas un détail.",
          ],
          image: {
            src: "/solutions/get-cited-by-ai.svg",
            alt: "Réponse d'assistant IA citant votre entreprise, avec suivi des citations par moteur",
          },
        },
        {
          h2: "Mesurez-le comme un canal",
          paras: [
            "Vous traitez déjà la recherche et l'email comme des canaux chiffrés. Les réponses IA méritent la même rigueur : quels prompts vous mentionnent, sur quels moteurs, comment ce taux évolue de semaine en semaine, et ce qui a changé quand il baisse.",
            "Une fois mesuré, c'est améliorable. Une baisse sur un moteur après un changement de contenu est un signal, pas un mystère — et pouvoir montrer la tendance transforme la visibilité IA d'un argument de vente en une ligne du rapport.",
          ],
        },
      ],
      eyebrow: "LE PARCOURS",
      h2: "D'invisible à cité",
      cards: [
        {
          title: "Voyez ce que disent les assistants",
          body: "Lancez l'audit gratuit de visibilité IA — sans compte — puis suivez votre taux de mention et la façon dont les moteurs vous décrivent depuis le tableau de bord.",
        },
        {
          title: "Suivez les prompts qui comptent",
          body: "Custom Prompts exécute les questions exactes de vos acheteurs et note quand vous apparaissez : une baisse devient une alerte, pas un trimestre perdu.",
        },
        {
          title: "Montrez une page complète aux robots IA",
          body: "AI Lens compare ce que reçoit un robot et ce que rend un navigateur. Si les robots voient une coquille vide, vous ne pouvez pas être cité — l'écart indique quoi corriger.",
        },
        {
          title: "Gardez une surveillance planifiée",
          body: "La surveillance planifiée relance vos vérifications automatiquement et signale les changements : la visibilité IA devient une métrique suivie, pas un test ponctuel.",
        },
      ],
    },
  },
ENTRYEOF

if grep -q '"get-cited-by-ai"' "$DF"; then
  echo "data: entry already present — nothing to do"; exit 0
fi
cp "$DF" "$DF.bak.$TS"
python3 - "$DF" <<'PYEOF'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); src = p.read_text()
anchor = "};\n\nexport function detailFor"
i = src.find(anchor)
if i < 0: sys.exit("PATCH ABORT: DETAILS closing anchor not found")
entry = pathlib.Path("/tmp/.gcba-entry.ts").read_text()
src = src[:i] + entry + src[i:]
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    if src.count(a) != src.count(b): sys.exit(f"PATCH ABORT: unbalanced {a}{b}")
p.write_text(src)
print("data: get-cited-by-ai entry added (3 prose sections + 4 cards + graphic, en+fr)")
PYEOF
rm -f /tmp/.gcba-entry.ts

echo
echo "Next (as root):"
echo "  NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web"
echo "  THEN CF Purge Everything."
