#!/usr/bin/env python3
"""Shorten the platform 'risk' cell in all 5 locales, add its "More details"
link to /reputation-risk, and make /{locale}/reputation-risk public in the
proxy. The cell link contract and homepage renderer already exist from the
visibility round. Anchored, backed up, idempotent.
Run from /opt/echorank/app:  python3 apply_risk_link.py
"""
import re, shutil, sys, time

TS = time.strftime("%Y%m%d-%H%M%S")

SHORT = {
    "en": (
        "Reputation problems grow quietly — one unhappy customer, one unanswered review, one competitor gaining momentum. EchoRank connects every signal into one explainable Reputation Risk Score: what's costing you customers, and how much revenue is at risk each month. Prevent instead of react; know where to act first.",
        "More details →",
    ),
    "fr": (
        "Les problèmes de réputation grandissent en silence — un client mécontent, un avis sans réponse, un concurrent qui prend de l'élan. EchoRank relie chaque signal en un Score de risque explicable : ce qui vous coûte des clients et combien de chiffre d'affaires est menacé chaque mois. Prévenez au lieu de réagir ; sachez où agir en premier.",
        "Plus de détails →",
    ),
    "fr-CA": (
        "Les problèmes de réputation grandissent en silence — un client insatisfait, un avis sans réponse, un concurrent qui prend de l'élan. EchoRank relie chaque signal en un Score de risque facile à comprendre : ce qui vous coûte des clients et combien de revenus sont à risque chaque mois. Prévenez au lieu de réagir; sachez où agir en premier.",
        "Plus de détails →",
    ),
    "de-CH": (
        "Reputationsprobleme wachsen leise — ein unzufriedener Kunde, eine unbeantwortete Bewertung, ein Konkurrent im Aufwind. EchoRank verbindet jedes Signal zu einem erklärbaren Risiko-Score: was Sie Kunden kostet und wie viel Umsatz jeden Monat auf dem Spiel steht. Vorbeugen statt reagieren; wissen, wo zuerst zu handeln ist.",
        "Mehr erfahren →",
    ),
}
SHORT["en-CA"] = SHORT["en"]

def backup(p):
    shutil.copyfile(p, f"{p}.bak.{TS}")

# ── 1. content.ts: risk cells ────────────────────────────────────────────────
CONTENT = "src/lib/i18n/content.ts"
s = open(CONTENT, encoding="utf-8").read()
backup(CONTENT)

locs = sorted(
    [(m.start(), m.group(1)) for m in re.finditer(r"\u2500 (en-CA|fr-CA|de-CH|en|fr) \(", s)]
)
if len(locs) != 5:
    sys.exit(f"FAIL: expected 5 locale headers, found {len(locs)}")

for i in range(len(locs) - 1, -1, -1):
    start, loc = locs[i]
    end = locs[i + 1][0] if i + 1 < len(locs) else len(s)
    block = s[start:end]
    pat = re.compile(
        r'(key:\s*"risk",\s*\n\s*title:\s*"(?:[^"\\]|\\.)*",\s*\n\s*body:\s*\n?\s*")((?:[^"\\]|\\.)*)(",)',
        re.S,
    )
    m = pat.search(block)
    if not m:
        sys.exit(f"FAIL: risk cell not found in locale block {loc}")
    body, label = SHORT[loc]
    tail = block[m.end(): m.end() + 200]
    already = 'href: "/reputation-risk"' in tail
    repl = m.group(1) + body + m.group(3)
    if not already:
        repl += f'\n        link: {{ href: "/reputation-risk", label: "{label}" }},'
    block = block[: m.start()] + repl + block[m.end():]
    s = s[:start] + block + s[end:]

open(CONTENT, "w", encoding="utf-8").write(s)
print("content.ts: risk cells shortened + link added (5 locales)")

# ── 2. proxy.ts: extend the public LP regex ────────────────────────────────
PROXY = "src/proxy.ts"
s = open(PROXY, encoding="utf-8").read()
if "reputation-risk" in s:
    print("proxy.ts: already covers reputation-risk")
else:
    old = "/^\\/(en|en-CA|fr|fr-CA|de-CH)\\/ai-visibility\\/?$/"
    if old not in s:
        sys.exit("FAIL: ai-visibility public regex not found in proxy.ts")
    backup(PROXY)
    s = s.replace(old, "/^\\/(en|en-CA|fr|fr-CA|de-CH)\\/(ai-visibility|reputation-risk)\\/?$/", 1)
    open(PROXY, "w", encoding="utf-8").write(s)
    print("proxy.ts: /{locale}/reputation-risk made public")

print("\ndone — copy the reputation-risk page files, then build:")
print("NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web")
