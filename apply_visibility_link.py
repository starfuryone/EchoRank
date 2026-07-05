#!/usr/bin/env python3
"""Wire the shortened visibility cell + "More details" link (5 locales),
extend the cell contract with an optional link, render it on the homepage,
and make /{locale}/ai-visibility public in the proxy.
Run from /opt/echorank/app:  python3 apply_visibility_link.py
All edits are anchored; the script aborts before writing anything if an
anchor is missing. Backups are taken per file. Idempotent.
"""
import re, shutil, sys, time

TS = time.strftime("%Y%m%d-%H%M%S")

def backup(p):
    shutil.copyfile(p, f"{p}.bak.{TS}")

def load(p):
    return open(p, encoding="utf-8").read()

def save(p, s):
    open(p, "w", encoding="utf-8").write(s)

# ── 1. content.ts: interface + shortened visibility cells with link ────────
CONTENT = "src/lib/i18n/content.ts"
s = load(CONTENT)

IF_ANCHOR = "cells: { key: string; title: string; body: string }[];"
IF_NEW = "cells: { key: string; title: string; body: string; link?: { href: string; label: string } }[];"

SHORT = {
    "en": (
        "Every day AI decides which businesses get mentioned — most owners have no idea if they're recommended or overlooked. EchoRank360 audits every factor behind AI visibility and hands you a step-by-step roadmap into AI answers. Know the day AI starts recommending you — and the moment you disappear.",
        "More details →",
    ),
    "fr": (
        "Chaque jour, l'IA décide quelles entreprises méritent d'être citées — la plupart des dirigeants n'en savent rien. EchoRank360 audite chaque facteur de votre visibilité IA et vous remet une feuille de route pas à pas vers les réponses générées. Sachez quand l'IA commence à vous recommander — et à l'instant où vous disparaissez.",
        "Plus de détails →",
    ),
    "fr-CA": (
        "Chaque jour, l'IA décide quelles entreprises méritent d'être mentionnées — la plupart des propriétaires n'en ont aucune idée. EchoRank360 audite chaque facteur de votre visibilité IA et vous remet une feuille de route étape par étape vers les réponses générées. Sachez quand l'IA commence à vous recommander — et à l'instant où vous disparaissez.",
        "Plus de détails →",
    ),
    "de-CH": (
        "Jeden Tag entscheidet die KI, welche Unternehmen erwähnt werden — die meisten Inhaber wissen nicht, ob sie empfohlen oder übersehen werden. EchoRank360 prüft jeden Faktor Ihrer KI-Sichtbarkeit und liefert einen Schritt-für-Schritt-Fahrplan in die KI-Antworten. Sie wissen, wann die KI Sie zu empfehlen beginnt — und sofort, wenn Sie verschwinden.",
        "Mehr erfahren →",
    ),
}
SHORT["en-CA"] = SHORT["en"]

backup(CONTENT)
if IF_ANCHOR in s:
    s = s.replace(IF_ANCHOR, IF_NEW, 1)
elif IF_NEW in s:
    print("interface already extended")
else:
    sys.exit("FAIL: cells interface anchor not found in content.ts")

def replace_visibility_cells(src: str) -> str:
    # Determine locale order by scanning header comments
    locs = []
    for lm in re.finditer(r"\u2500 (en-CA|fr-CA|de-CH|en|fr) \(", src):
        locs.append((lm.start(), lm.group(1)))
    locs.sort()
    if len(locs) != 5:
        sys.exit(f"FAIL: expected 5 locale headers, found {len(locs)}")

    out = src
    # process from last to first so offsets stay valid
    for i in range(len(locs) - 1, -1, -1):
        start, loc = locs[i]
        end = locs[i + 1][0] if i + 1 < len(locs) else len(out)
        block = out[start:end]
        pat = re.compile(
            r'(key:\s*"visibility",\s*\n\s*title:\s*"(?:[^"\\]|\\.)*",\s*\n\s*body:\s*\n?\s*")((?:[^"\\]|\\.)*)(",)',
            re.S,
        )
        m = pat.search(block)
        if not m:
            sys.exit(f"FAIL: visibility cell not found in locale block {loc}")
        body, label = SHORT[loc]
        already = 'link: { href: "/ai-visibility"' in block[m.start(): m.end() + 200]
        repl = m.group(1) + body + m.group(3)
        if not already:
            repl += f'\n        link: {{ href: "/ai-visibility", label: "{label}" }},'
        block = block[: m.start()] + repl + block[m.end():]
        out = out[:start] + block + out[end:]
    return out

s = replace_visibility_cells(s)
save(CONTENT, s)
print("content.ts: visibility cells shortened + link added (5 locales)")

# ── 2. page.tsx: render cell.link when present ──────────────────────────────
PAGE = "src/app/[locale]/page.tsx"
s = load(PAGE)
if "cell.link" in s or ".link &&" in s:
    print("page.tsx: link render already present")
else:
    i = s.find("c.platform.cells.map")
    if i < 0:
        sys.exit("FAIL: platform cells map not found in page.tsx")
    zone = s[i : i + 1200]
    m = re.search(r"\{(\w+)\.body\}\s*</(\w+)>", zone)
    if not m:
        sys.exit("FAIL: cell body element not found; zone head:\n" + zone[:400])
    var, tag = m.group(1), m.group(2)
    insert_at = i + m.end()
    snippet = (
        f"\n              {{{var}.link && (\n"
        f"                <Link href={{`/${{locale}}${{{var}.link.href}}`}} className={{styles.label}}>\n"
        f"                  {{{var}.link.label}}\n"
        f"                </Link>\n"
        f"              )}}"
    )
    backup(PAGE)
    s = s[:insert_at] + snippet + s[insert_at:]
    save(PAGE, s)
    print(f"page.tsx: link rendered after </{tag}> (var {var!r})")

# ── 3. proxy.ts: public pass for /{locale}/ai-visibility ───────────────────
PROXY = "src/proxy.ts"
s = load(PROXY)
if "ai-visibility" in s:
    print("proxy.ts: already patched")
else:
    anchor = (
        "  if (\n"
        "    pathname.startsWith(\"/api/\") &&\n"
        "    process.env.INTERNAL_API_SECRET &&\n"
        "    req.headers.get(\"x-internal-secret\") === process.env.INTERNAL_API_SECRET\n"
        "  ) {\n"
        "    return NextResponse.next();\n"
        "  }\n"
    )
    if anchor not in s:
        sys.exit("FAIL: internal-secret block anchor not found in proxy.ts")
    patch = anchor + (
        "\n  // Public marketing page: AI visibility landing (all locales)\n"
        "  if (/^\\/(en|en-CA|fr|fr-CA|de-CH)\\/ai-visibility\\/?$/.test(pathname)) {\n"
        "    return NextResponse.next();\n"
        "  }\n"
    )
    backup(PROXY)
    s = s.replace(anchor, patch, 1)
    save(PROXY, s)
    print("proxy.ts: /{locale}/ai-visibility made public")

print("\ndone — copy the landing page files, then build:")
print("NODE_OPTIONS=--max-old-space-size=1536 npm run build && pm2 restart echorank360-web")
