// /[locale]/seo-spider/issues — the public issue library (Site Crawler Phase 3c).
//
// One anchor per rule in the registry (packages/crawl-rules): name, kind,
// priority, what it checks and how to fix it. GENERATED, not written: the page
// is built from RULES and RULE_COPY at build time, so a new rule appears here
// with the deploy that ships it and a removed one disappears. No FAQ.
//
// A standalone landing page (CLAUDE.md, "Standalone landing pages"): a whole
// HTML document served by the route handler beside this file, Binance tokens
// and the theme toggle copied from the glossary, EN body on every locale. The
// header nav is a static clone and does not track PublicNav. Rule copy is
// English-only in the registry, so the page is too.

import { RULE_COPY, RULE_FAMILIES, RULES, type Rule, type RuleFamily } from "@/lib/crawl-rules";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { familyIsPublic, ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { LEGACY_THEME_INIT_SCRIPT } from "@/lib/theme-schedule";

export const LIBRARY_PATH = "/seo-spider/issues";
const SITE = "https://echorank360.com";

export const FAMILY_LABELS: Record<RuleFamily, string> = {
  response_codes: "Response codes",
  url: "URLs",
  page_titles: "Page titles",
  meta_description: "Meta descriptions",
  meta_keywords: "Meta keywords",
  h1: "H1",
  h2: "H2",
  content: "Content",
  images: "Images",
  canonicals: "Canonicals",
  directives: "Directives",
  links: "Links",
  sitemaps: "XML sitemaps",
  security: "Security",
  hreflang: "hreflang",
  pagination: "Pagination",
  structured_data: "Structured data",
  validation: "Validation",
  javascript: "JavaScript",
  accessibility: "Accessibility",
  mobile: "Mobile",
  spelling: "Spelling",
  performance: "Performance",
  robots: "robots.txt",
  extraction: "Custom extraction and search",
  search_console: "Search Console",
  analytics: "Google Analytics",
  backlinks: "Backlinks",
};

const KIND_LABEL = { issue: "Issue", warning: "Warning", opportunity: "Opportunity" } as const;
const PRIORITY_LABEL = { high: "High priority", medium: "Medium priority", low: "Low priority" } as const;
const NEEDS: Record<string, string> = {
  render: "Needs rendering",
  psi: "Needs a Lighthouse run",
  spell: "Spell check",
};

export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bare URLs in rule copy (Deque's rule pages) become links. */
function linkify(escaped: string): string {
  return escaped.replace(/https:\/\/[^\s<]+[^\s<.,;)]/g, (u) => `<a href="${u}" rel="noopener" target="_blank">${u}</a>`);
}

export function familiesInUse(): RuleFamily[] {
  // Phase 4d: an integration's family is listed once that integration ships.
  return RULE_FAMILIES.filter((f) => familyIsPublic(f) && RULES.some((r) => r.family === f));
}

function ruleHtml(r: Rule): string {
  const c = RULE_COPY[r.id]!;
  const needs = (r.requires ?? []).map((n) => `<span class="tag">${esc(NEEDS[n] ?? n)}</span>`).join("");
  return `<article class="rule" id="${esc(r.id)}">
<h3><a class="anchor" href="#${esc(r.id)}" aria-hidden="true" tabindex="-1">#</a>${esc(c.name)}</h3>
<p class="meta"><span class="kind kind-${r.kind}">${KIND_LABEL[r.kind]}</span><span class="tag">${PRIORITY_LABEL[r.priority]}</span>${needs}<code>${esc(r.id)}</code></p>
<p>${linkify(esc(c.description))}</p>
<p class="fix"><strong>How to fix.</strong> ${linkify(esc(c.howToFix))}</p>
</article>`;
}

function familyHtml(f: RuleFamily): string {
  const rules = RULES.filter((r) => r.family === f);
  return `<section class="family" id="family-${f}">
<h2>${esc(FAMILY_LABELS[f])} <span class="count">${rules.length}</span></h2>
${rules.map(ruleHtml).join("\n")}
</section>`;
}

const CSS = `
:root{--bg:#181A20;--surface:#1E2329;--surface2:#2B3139;--text:#EAECEF;--muted:#848E9C;--border:#2B3139;--accent:#FCD535;--accent2:#F0B90B;--radius:14px;--width:1100px;
--ink-strong:#FFFFFF;--ink-muted:#B7BDC6;--ink-accent:#FCD535;--ink-good:#0ECB81;--ink-bad:#F6465D;--ink-warn:#F0B90B;--ink-on-gold:#181A20}
[data-theme="day"]{--bg:#FFFFFF;--surface:#F5F6F8;--surface2:#EAECEF;--border:#EAECEF;--text:#1E2329;--muted:#5A6270;
--ink-strong:#0B0E11;--ink-muted:#5A6270;--ink-accent:#8A6100;--ink-good:#0B7A4A;--ink-bad:#C11C33;--ink-warn:#8A6100}
.er-theme{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;padding:0;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:14px;line-height:1;font-family:inherit}
.er-theme:hover{color:var(--text)}
.er-theme .er-day{display:none}
[data-theme="day"] .er-theme .er-night{display:none}
[data-theme="day"] .er-theme .er-day{display:inline}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
a{color:inherit}
.container{width:min(calc(100% - 32px),var(--width));margin-inline:auto}
.header{border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:100}
.header-inner{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:1.25rem}
.nav{display:flex;align-items:center;gap:20px;font-size:.95rem}
.nav a{color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--text)}
.cta{padding:9px 16px;border-radius:10px;background:var(--accent);color:var(--ink-on-gold) !important;font-weight:700}
.cta:hover{background:var(--accent2)}
.hero{padding:72px 0 40px;text-align:center}
.hero img{height:44px;width:auto;margin-bottom:18px}
.eyebrow{margin:0 0 12px;color:var(--ink-accent);font-size:.85rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.hero h1{margin:0;font-size:clamp(2.2rem,5.5vw,4.4rem);line-height:1.05;letter-spacing:-.04em}
.hero p{max-width:720px;margin:20px auto 0;color:var(--ink-muted);font-size:1.08rem}
.index{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:12px;margin:0 0 48px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface)}
.index a{padding:6px 10px;border-radius:8px;color:var(--ink-muted);text-decoration:none;font-size:.88rem;font-weight:600}
.index a:hover{background:var(--accent);color:var(--ink-on-gold)}
.family{scroll-margin-top:90px;margin-bottom:56px}
.family>h2{margin:0 0 8px;padding-bottom:10px;border-bottom:2px solid var(--accent);font-size:1.9rem}
.count{font-size:1rem;color:var(--muted);font-weight:600}
.rule{scroll-margin-top:90px;padding:22px 0;border-bottom:1px solid var(--border)}
.rule:target{background:var(--surface);border-radius:10px;padding-inline:14px}
.rule h3{margin:0 0 6px;font-size:1.18rem;position:relative}
.anchor{position:absolute;left:-1.1em;color:var(--muted);text-decoration:none;opacity:0}
.rule:hover .anchor{opacity:1}
.rule p{margin:8px 0 0;max-width:900px;color:var(--ink-muted);overflow-wrap:anywhere}
.rule a{color:var(--ink-accent)}
.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8rem}
.kind,.tag{padding:2px 8px;border-radius:999px;border:1px solid var(--border);font-weight:700}
.kind-issue{color:var(--ink-bad)}
.kind-warning{color:var(--ink-warn)}
.kind-opportunity{color:var(--ink-good)}
.meta code{color:var(--muted);font-size:.78rem;overflow-wrap:anywhere}
.fix strong{color:var(--text)}
.footer{padding:40px 0;border-top:1px solid var(--border);color:var(--muted);text-align:center;font-size:.9rem}
.footer a{color:var(--muted);margin:0 8px}
@media (max-width:700px){.nav{display:none}.hero{padding-top:48px}.anchor{display:none}}
`;

const TOGGLE = `(function(){
var KEY="er-theme",root=document.documentElement,btn=document.getElementById("er-theme");
if(!btn){return}
var TO_DAY="Switch to day theme",TO_NIGHT="Switch to night theme";
function label(){btn.setAttribute("aria-label",root.getAttribute("data-theme")==="day"?TO_NIGHT:TO_DAY)}
function apply(day){if(day){root.setAttribute("data-theme","day")}else{root.removeAttribute("data-theme")}label()}
label();
btn.addEventListener("click",function(){var day=root.getAttribute("data-theme")!=="day";apply(day);try{localStorage.setItem(KEY,day?"day":"night")}catch(e){}});
window.addEventListener("storage",function(e){if(e.key!==KEY){return}apply(e.newValue==="day")});
})();`;

export function issueLibraryHtml(): string {
  const families = familiesInUse();
  const count = ruleCountLabel();
  const title = `${CRAWLER_BRAND.name} issue library: every check the Echorank site crawler runs`;
  const description = `${count} named checks across ${families.length} families, from response codes to accessibility, each with what it means and how to fix it.`;
  const canonical = `${SITE}/en${LIBRARY_PATH}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Echorank", url: SITE },
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script>${LEGACY_THEME_INIT_SCRIPT}</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/nosy-bat/og.png">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
<style>${CSS}</style>
</head>
<body>
<header class="header">
<div class="container header-inner">
<a href="/en" class="brand" aria-label="Echorank home"><span style="letter-spacing:.06em">ECHORANK</span></a>
<nav class="nav" aria-label="Main navigation">
<a href="/en/site-crawler">${esc(CRAWLER_BRAND.name)}</a>
<a href="/en/learn/guides/what-nosy-bat-checks">Guide</a>
<a href="/en/learn">Learn</a>
<a href="/en/pricing" class="cta">See pricing</a>
</nav>
<button type="button" class="er-theme" id="er-theme" aria-label="Switch to day theme"><span class="er-night" aria-hidden="true">&#9788;</span><span class="er-day" aria-hidden="true">&#9789;</span></button>
</div>
</header>
<main>
<section class="hero">
<div class="container">
<img src="${CRAWLER_BRAND.markOnDark}" alt="" width="44" height="44">
<p class="eyebrow">${esc(CRAWLER_BRAND.name)} issue library</p>
<h1>Every check the crawler runs</h1>
<p>${esc(description)} Issues are problems to fix, warnings need a look, opportunities are improvements. Checks marked “Needs rendering” run on pages crawled with JavaScript rendering on; “Needs a Lighthouse run” checks use the page’s PageSpeed Insights results.</p>
</div>
</section>
<div class="container">
<nav class="index" aria-label="Rule families">
${families.map((f) => `<a href="#family-${f}">${esc(FAMILY_LABELS[f])}</a>`).join("")}
</nav>
${families.map(familyHtml).join("\n")}
</div>
</main>
<footer class="footer">
<div class="container">
<p><a href="/en/site-crawler">${esc(CRAWLER_BRAND.name)}</a><a href="/en/pricing">Pricing</a><a href="/en/legal/privacy">Privacy</a><a href="/en/legal/terms">Terms</a><a href="/en/legal/cookies">Cookies</a></p>
<p>© Echorank</p>
</div>
</footer>
<script>${TOGGLE}</script>
</body>
</html>`;
}
