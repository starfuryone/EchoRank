// /{locale}/enterprise — the standalone Enterprise page, from the draft
// /opt/echorank/prompts/echorank-enterprise.html (2026-11-07). Served by
// route.ts, EN body on every locale. Differences from the draft:
//   - every "Talk to us" mailto points at the sales form, ?src= per button;
//   - the closing "Let's talk" section is #contact;
//   - the crawler's name is __CRAWLER_NAME_TM__, filled from CRAWLER_BRAND by
//     route.ts (the name is spelled only in brand.ts);
//   - the ™ is the shared .er-tm span with WORDMARK_TM_CSS verbatim;
//   - the footer's company text comes from withCompanyLine(); Cookies link added;
//   - the family's day/night layer (head guard, shared day block, toggle,
//     script); the draft's colours map onto the shared tokens, so night is
//     unchanged, and gold TEXT reads --ink-accent (gold fills stay gold);
//   - the AI-drafts label is __DRAFTED_BY_AI__, filled from AI_LABELS.
// No backtick and no dollar-brace in the HTML (String.raw payload).

import { withCompanyLine } from "@/lib/brand/company";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { AI_LABELS } from "@/lib/i18n/ai-labels";
import { withThemeSchedule } from "@/lib/theme-schedule";

export const CRAWLER_NAME_TOKEN = "__CRAWLER_NAME_TM__";
export const DRAFTED_BY_AI_TOKEN = "__DRAFTED_BY_AI__";

/**
 * The page as served: the crawler's name from brand.ts, the AI label from the
 * AI-labels catalog (both spelled once, elsewhere), the theme schedule, and
 * the company line in the footer.
 */
export function enterpriseHtml(): string {
  const html = ENTERPRISE_HTML.split(CRAWLER_NAME_TOKEN)
    .join(CRAWLER_BRAND.nameTm)
    .split(DRAFTED_BY_AI_TOKEN)
    .join(AI_LABELS.en.draftedByAi);
  return withCompanyLine(withThemeSchedule(html));
}

export const ENTERPRISE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <script>try{if(localStorage.getItem("er-theme")==="day")document.documentElement.setAttribute("data-theme","day")}catch(e){}</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Echorank Enterprise</title>
<meta name="description" content="Echorank for agencies and multi-location brands: reviews, AI answers and technical SEO for every client and location in one workspace.">
<link rel="canonical" href="https://echorank360.com/en/enterprise">
<style>
  :root{
    /* The family's token names (the day block below overrides them); night
       values are the draft's own, so night looks exactly as designed. */
    --bg:#0B0E11; --surface:#181A20; --surface-2:#1E2329; --line:#2B3139;
    --text:#EAECEF; --muted:#848E9C;
    --ink-strong:#FFFFFF;--ink-muted:#B7BDC6;
    --ink-accent:#FCD535;--ink-accent-2:#FCD535;
    --ink-good:#0ECB81;--ink-bad:#F6465D;
    /* Ink on a gold fill. Theme-INVARIANT: day does not override it. */
    --ink-on-gold:#181A20;
    /* The draft's names, as aliases. Gold (--y1, --y2) is a FILL in both
       themes; anything READ in gold takes --ink-accent instead. */
    --bg0:var(--bg); --bg1:var(--surface); --bg2:var(--surface-2); --soft:var(--ink-muted);
    --y1:#FCD535; --y2:#F0B90B; --ok:var(--ink-good); --bad:var(--ink-bad); --warn:var(--ink-accent);
    --r:14px;
  }

    /* ── DAY ── the family's shared override, verbatim (tests/landing-theme.test.ts). */
    [data-theme="day"]{
      --bg:#FFFFFF;--bg-2:#F5F6F8;--surface:#F5F6F8;--surface-2:#EAECEF;
      --surface2:#EAECEF;--surface-soft:#EAECEF;--card:#F5F6F8;--card2:#EAECEF;
      --line:#EAECEF;--line-soft:rgba(0,0,0,.06);--border:#EAECEF;
      --text:#1E2329;--muted:#5A6270;
      --ink-strong:#0B0E11;--ink-muted:#5A6270;
      --ink-accent:#8A6100;--ink-accent-2:#8A6100;
      --ink-good:#0B7A4A;--ink-bad:#C11C33;
      --shadow:0 18px 60px rgba(15,23,42,.14);
      --highlight:rgba(138,97,0,.20);--accent-soft:rgba(138,97,0,.10);
    }
    /* The toggle. Icon-only, so the accessible name is the aria-label, and the
       script below rewrites it — a button that says "night theme" while it is
       the thing that LEAVES night is unusable without sight. */
    .er-theme{display:inline-flex;align-items:center;justify-content:center;
      width:32px;height:32px;flex:none;padding:0;border-radius:8px;cursor:pointer;
      border:1px solid var(--line,var(--border,#2B3139));background:transparent;
      color:var(--muted);font-size:14px;line-height:1;font-family:inherit}
    .er-theme:hover{color:var(--text)}
    .er-theme .er-day{display:none}
    [data-theme="day"] .er-theme .er-night{display:none}
    [data-theme="day"] .er-theme .er-day{display:inline}
    /* Day-only fixes for colours the draft wrote as literals. */
    [data-theme="day"] nav{background:rgba(255,255,255,.88)}
    [data-theme="day"] .hero h1 span{background:none;color:var(--ink-accent)}
    [data-theme="day"] .panel{box-shadow:var(--shadow)}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg0);color:var(--text);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1200px;margin:0 auto;padding:0 24px}
  .eyebrow{font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-accent)}
  h1,h2,h3,h4{margin:0;letter-spacing:-.02em;line-height:1.08}
  h2{font-size:clamp(32px,4.4vw,52px);font-weight:800}
  .lead{color:var(--soft);font-size:clamp(17px,1.6vw,20px);max-width:720px}
  section{padding:112px 0}
  .btn{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 22px;border-radius:10px;font-weight:700;font-size:15px;transition:transform .15s,filter .15s}
  .btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
  .btn-y{background:linear-gradient(180deg,var(--y1),var(--y2));color:#181A20}
  .btn-o{border:1px solid var(--line);color:var(--text);background:var(--bg2)}

  /* nav */
  nav{position:sticky;top:0;z-index:10;background:rgba(11,14,17,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  nav .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
  .logo{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.06em;--er-wm-ls:.06em;font-size:15px}
  .logo span{line-height:1}
  .logo i{width:18px;height:18px;border-radius:4px;transform:rotate(45deg);background:linear-gradient(135deg,#FDE38A,#F0B90B);display:block}
  @property --er-wm-em{syntax:"<length>";inherits:true;initial-value:0px}@property --er-wm-cap{syntax:"<length>";inherits:true;initial-value:0px}@property --er-wm-ls{syntax:"<length>";inherits:true;initial-value:0px}:where(:has(> .er-tm)){--er-wm-em:1em;--er-wm-cap:1cap}.er-tm{font-size:max(7px,.35em);line-height:0;letter-spacing:0;font-style:normal;color:currentColor;margin-left:calc(var(--er-wm-em)*.05 - var(--er-wm-ls));vertical-align:calc(var(--er-wm-cap) - 1cap)}
  .navlinks{display:flex;gap:28px;color:var(--soft);font-size:14px}
  .navlinks a:hover{color:var(--text)}
  nav .btn{height:38px;padding:0 16px;font-size:14px}
  .nav-r{display:flex;align-items:center;gap:12px}

  /* hero */
  .hero{padding:96px 0 72px;position:relative;overflow:hidden}
  .hero::before{content:"";position:absolute;inset:-30% -10% auto auto;width:720px;height:720px;
    background:radial-gradient(closest-side,rgba(240,185,11,.16),transparent);pointer-events:none}
  .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .hero h1{font-size:clamp(46px,6.6vw,84px);font-weight:900;margin:18px 0 22px}
  .hero h1 span{background:linear-gradient(90deg,var(--y1),var(--y2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .ctas{display:flex;flex-wrap:wrap;gap:12px;margin:32px 0 18px}
  .fine{color:var(--muted);font-size:14px}

  /* sample workspace card */
  .panel{background:var(--bg1);border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45)}
  .panel-h{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line);font-size:13px;color:var(--muted)}
  .dots{display:flex;gap:6px}.dots b{width:9px;height:9px;border-radius:50%;background:var(--line);display:block}
  table.ws{width:100%;border-collapse:collapse;font-size:14px}
  .ws th{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;padding:14px 20px 10px}
  .ws td{padding:14px 20px;border-top:1px solid var(--line);white-space:nowrap}
  .ws td.n{font-weight:600}
  .pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700}
  .p-ok{background:rgba(14,203,129,.12);color:var(--ok)}
  .p-warn{background:rgba(240,185,11,.12);color:var(--warn)}
  .p-bad{background:rgba(246,70,93,.12);color:var(--bad)}
  .spark{width:84px;height:26px;vertical-align:middle}
  .panel-f{padding:12px 20px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}

  /* strip */
  .strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--bg1)}
  .strip .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;padding-top:26px;padding-bottom:26px}
  .strip span{color:var(--soft);font-weight:700;font-size:15px;display:flex;align-items:center;gap:10px}
  .strip span::before{content:"";width:7px;height:7px;border-radius:2px;transform:rotate(45deg);background:var(--y2)}

  /* statement */
  .statement h2{max-width:900px}
  .statement p{margin-top:24px}

  /* crawler */
  .alt{background:var(--bg1);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
  .split h2{margin:14px 0 20px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-top:64px}
  .stat{background:var(--bg0);padding:28px 24px}
  .stat b{display:block;font-size:clamp(34px,4vw,48px);font-weight:900;letter-spacing:-.03em;color:var(--ink-accent);line-height:1}
  .stat span{display:block;margin-top:10px;color:var(--soft);font-size:14px}
  .finding{background:var(--bg0);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;margin-bottom:14px}
  .finding-h{display:flex;justify-content:space-between;align-items:center;gap:12px}
  .finding h4{font-size:16px;font-weight:700;letter-spacing:0}
  .kv{margin-top:14px;display:grid;grid-template-columns:96px 1fr;gap:6px 14px;font-size:13px}
  .kv dt{color:var(--muted)}
  .kv dd{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text);word-break:break-word}
  .kv dd.fix{font-family:inherit;color:var(--soft)}

  /* feature grid */
  .grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-top:56px}
  .card{background:var(--bg0);padding:28px 22px;min-height:190px}
  .card h4{font-size:17px;font-weight:700;letter-spacing:-.01em;margin-bottom:10px}
  .card p{margin:0;color:var(--muted);font-size:14px}
  .card .ix{font:600 12px ui-monospace,Menlo,monospace;color:var(--y2);display:block;margin-bottom:18px}

  /* ai row */
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:56px}
  .ai{background:var(--bg0);border:1px solid var(--line);border-radius:var(--r);padding:30px 26px}
  .ai h4{font-size:20px;font-weight:800;margin:18px 0 12px}
  .ai p{margin:0;color:var(--soft);font-size:15px}
  .ai .tag{display:inline-block;margin-top:18px;font-size:12px;color:var(--muted);border:1px dashed var(--line);border-radius:6px;padding:4px 8px}
  .icon{width:40px;height:40px;border-radius:10px;background:rgba(240,185,11,.12);display:grid;place-items:center}
  .icon svg{width:20px;height:20px;stroke:var(--ink-accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

  /* api */
  .api{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:56px}
  .api .box{background:var(--bg1);border:1px solid var(--line);border-radius:var(--r);padding:30px 26px}
  .api h3{font-size:24px;font-weight:800;margin-bottom:12px}
  .api p{color:var(--soft);margin:0 0 20px}
  pre{margin:0;background:var(--bg0);border:1px solid var(--line);border-radius:10px;padding:18px;overflow-x:auto;
    font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--soft)}
  pre .k{color:var(--ink-accent)} pre .s{color:var(--ok)} pre .c{color:var(--muted)}
  .tools{display:flex;flex-wrap:wrap;gap:8px}
  .tools code{font:12.5px ui-monospace,Menlo,monospace;background:var(--bg0);border:1px solid var(--line);border-radius:6px;padding:6px 10px;color:var(--text)}
  .mini{display:flex;gap:28px;margin-top:22px;flex-wrap:wrap}
  .mini b{font-size:28px;font-weight:900;color:var(--ink-accent);display:block;line-height:1}
  .mini span{font-size:13px;color:var(--muted)}

  /* enterprise + security */
  .list{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:14px}
  .list li{display:flex;gap:14px;align-items:flex-start;color:var(--soft)}
  .list li::before{content:"";flex:0 0 8px;height:8px;margin-top:9px;border-radius:2px;transform:rotate(45deg);background:var(--y2)}
  .list li b{color:var(--text)}
  .sec h4{font-size:19px;font-weight:800;margin:18px 0 10px}
  .sec p{color:var(--soft);margin:0;font-size:15px}

  /* proof */
  .proof{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:48px}
  .proof a{display:block;background:var(--bg1);border:1px solid var(--line);border-radius:var(--r);padding:32px 28px;transition:border-color .15s,transform .15s}
  .proof a:hover{border-color:var(--y2);transform:translateY(-2px)}
  .proof h3{font-size:24px;font-weight:800;margin:14px 0 10px}
  .proof p{color:var(--soft);margin:0}
  .proof .go{display:inline-block;margin-top:20px;color:var(--ink-accent);font-weight:700}

  /* cta */
  .cta{text-align:center;background:radial-gradient(60% 120% at 50% 0%,rgba(240,185,11,.14),transparent),var(--bg1);border-top:1px solid var(--line)}
  .cta h2{font-size:clamp(44px,6vw,76px);font-weight:900}
  .cta .lead{margin:22px auto 0}
  .cta .ctas{justify-content:center}

  footer{border-top:1px solid var(--line);padding:32px 0 48px;color:var(--muted);font-size:13px}
  footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px}

  .hero-grid>*,.split>*,.api>*,.proof>*,.grid3>*{min-width:0}
  .panel{overflow:hidden}
  @media (max-width:1000px){
    .grid5{grid-template-columns:repeat(2,1fr)}
    .stats{grid-template-columns:repeat(2,1fr)}
  }
  @media (max-width:860px){
    section{padding:80px 0}
    .hero{padding:64px 0 56px}
    .hero-grid,.split,.api,.proof,.grid3{grid-template-columns:1fr}
    .navlinks{display:none}
    .ws .hide-s{display:none}
  }
  @media (max-width:520px){
    .wrap{padding:0 16px}
    .grid5,.stats{grid-template-columns:1fr}
    .ws th,.ws td{padding-left:12px;padding-right:12px}
    .ws td{white-space:normal}
    .strip .wrap{justify-content:flex-start;gap:12px 22px}
    .spark{width:48px}
    .hero h1{font-size:44px}
    .kv{grid-template-columns:1fr}
    .kv dt{margin-top:6px}
  }
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a class="logo" href="/en" aria-label="Echorank"><i></i><span>ECHORANK<span class="er-tm" aria-hidden="true">™</span></span></a>
    <div class="navlinks">
      <a href="#crawler">Crawler</a><a href="#features">Features</a><a href="#api">API &amp; MCP</a><a href="#security">Data</a><a href="/en/pricing">Pricing</a>
    </div>
    <div class="nav-r">
      <button type="button" class="er-theme" id="er-theme" aria-label="Switch to day theme"><span class="er-night" aria-hidden="true">&#9788;</span><span class="er-day" aria-hidden="true">&#9789;</span></button>
      <a class="btn btn-y" href="/en/enterprise/contact?src=enterprise-nav">Talk to us</a>
    </div>
  </div>
</nav>

<header class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">For agencies &amp; multi-location brands</div>
      <h1>Echorank <span>Enterprise</span></h1>
      <p class="lead">One workspace where your team tracks reviews, AI answers and technical SEO for every client and every location, then proves the fixes worked.</p>
      <div class="ctas">
        <a class="btn btn-y" href="/en/enterprise/contact?src=enterprise-hero">Talk to us</a>
        <a class="btn btn-o" href="/en/pricing">See the Agency plan</a>
      </div>
      <p class="fine">Agency from $499/month · 7-day free trial · priced per workspace, not per seat</p>
    </div>

    <div class="panel" role="img" aria-label="Sample workspace showing four clients with AI mention rate, rating and site health">
      <div class="panel-h"><div class="dots"><b></b><b></b><b></b></div><span>Portfolio · sample data</span></div>
      <table class="ws">
        <thead><tr><th>Client</th><th>AI mentions</th><th class="hide-s">Rating</th><th>Site health</th></tr></thead>
        <tbody>
          <tr><td class="n">Northside Dental</td>
            <td><svg class="spark" viewBox="0 0 84 26"><polyline points="0,20 14,18 28,19 42,13 56,11 70,7 84,5" fill="none" stroke="#0ECB81" stroke-width="2"/></svg> 62%</td>
            <td class="hide-s">4.8 ★</td><td><span class="pill p-ok">91</span></td></tr>
          <tr><td class="n">Harbor Plumbing</td>
            <td><svg class="spark" viewBox="0 0 84 26"><polyline points="0,8 14,9 28,12 42,11 56,15 70,17 84,19" fill="none" stroke="#F6465D" stroke-width="2"/></svg> 18%</td>
            <td class="hide-s">4.2 ★</td><td><span class="pill p-warn">74</span></td></tr>
          <tr><td class="n">Cedar Law Group</td>
            <td><svg class="spark" viewBox="0 0 84 26"><polyline points="0,16 14,15 28,15 42,14 56,13 70,13 84,12" fill="none" stroke="#F0B90B" stroke-width="2"/></svg> 35%</td>
            <td class="hide-s">4.6 ★</td><td><span class="pill p-ok">88</span></td></tr>
          <tr><td class="n">Lumen Fitness</td>
            <td><svg class="spark" viewBox="0 0 84 26"><polyline points="0,22 14,21 28,17 42,18 56,12 70,10 84,9" fill="none" stroke="#0ECB81" stroke-width="2"/></svg> 47%</td>
            <td class="hide-s">4.4 ★</td><td><span class="pill p-bad">58</span></td></tr>
        </tbody>
      </table>
      <div class="panel-f">Illustration with invented clients. Your workspace shows your own.</div>
    </div>
  </div>
</header>

<div class="strip" aria-label="What one workspace covers">
  <div class="wrap">
    <span>Reputation</span><span>AI visibility</span><span>__CRAWLER_NAME_TM__ crawler</span><span>SEO data</span><span>Reports</span><span>API &amp; MCP</span>
  </div>
</div>

<section class="statement">
  <div class="wrap">
    <div class="eyebrow">Why it matters</div>
    <h2 style="margin-top:14px">You can't manage a reputation you can't see.</h2>
    <p class="lead">Customers read reviews. AI assistants read them too, along with your site, directories and forums, and then recommend a handful of businesses. Echorank shows what both are saying about each client, where the gaps are, and which fix matters first.</p>
  </div>
</section>

<section class="alt" id="crawler">
  <div class="wrap">
    <div class="split">
      <div>
        <div class="eyebrow">Hosted crawling</div>
        <h2>__CRAWLER_NAME_TM__ crawls on our servers, not your laptop.</h2>
        <p class="lead">Schedule crawls for every client, compare each run with the last, and get the results by email. Every finding shows the evidence the rule saw, so your team can check it before a developer touches the site.</p>
      </div>
      <div>
        <div class="finding">
          <div class="finding-h"><h4>Canonical points to a redirect</h4><span class="pill p-bad">Issue</span></div>
          <dl class="kv">
            <dt>Page</dt><dd>/shoes/running?color=blue</dd>
            <dt>Evidence</dt><dd>canonical → /shoes/running/ → 301 → /running-shoes/</dd>
            <dt>Fix</dt><dd class="fix">Point the canonical at the final URL.</dd>
          </dl>
        </div>
        <div class="finding">
          <div class="finding-h"><h4>Broken internal link</h4><span class="pill p-bad">Issue</span></div>
          <dl class="kv">
            <dt>Link</dt><dd>/spring-promo → 404</dd>
            <dt>Evidence</dt><dd>found on 37 pages, incl. /, /blog/</dd>
            <dt>Fix</dt><dd class="fix">Update the links or redirect the old URL.</dd>
          </dl>
        </div>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><b>340+</b><span>checks per crawl, with evidence on every finding</span></div>
      <div class="stat"><b>25,000</b><span>URLs per crawl on Agency, custom on Enterprise</span></div>
      <div class="stat"><b>∞</b><span>crawls a month on Agency, scheduled or on demand</span></div>
      <div class="stat"><b>0</b><span>installs. Your whole team works from the same results</span></div>
    </div>
  </div>
</section>

<section id="features">
  <div class="wrap">
    <div class="eyebrow">Built for teams</div>
    <h2 style="margin-top:14px;max-width:820px">Larger teams need more than a dashboard.</h2>
    <div class="grid5">
      <div class="card"><span class="ix">01</span><h4>White-label workspace</h4><p>Your logo and your domain on the dashboard clients log into.</p></div>
      <div class="card"><span class="ix">02</span><h4>25 locations</h4><p>Reviews, requests and tracking per location, rolled up per brand.</p></div>
      <div class="card"><span class="ix">03</span><h4>Review requests at volume</h4><p>15,000 email and SMS requests a month, with templates and campaigns.</p></div>
      <div class="card"><span class="ix">04</span><h4>Recovery tickets</h4><p>Catch unhappy customers before they post, and track each case to closed.</p></div>
      <div class="card"><span class="ix">05</span><h4>Competitor tracking</h4><p>Follow rivals' ratings and review counts over time.</p></div>
      <div class="card"><span class="ix">06</span><h4>Crawl comparison</h4><p>Daily, weekly or monthly crawls. See what broke and what got fixed.</p></div>
      <div class="card"><span class="ix">07</span><h4>Custom extraction</h4><p>Pull prices, SKUs, schema or any field with CSS, XPath or regex.</p></div>
      <div class="card"><span class="ix">08</span><h4>Search Console inside</h4><p>Clicks, impressions and index status joined to every crawled page.</p></div>
      <div class="card"><span class="ix">09</span><h4>PDF reports</h4><p>A ready-to-send report for every crawl and audit.</p></div>
      <div class="card"><span class="ix">10</span><h4>No per-seat pricing</h4><p>Invite the whole team. Plans are priced per workspace.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <div class="eyebrow">AI where it saves time</div>
    <h2 style="margin-top:14px;max-width:860px">AI does the busywork. Your team makes the calls.</h2>
    <div class="grid3">
      <div class="ai">
        <div class="icon"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></div>
        <h4>AI answer tracking</h4>
        <p>See when AI assistants name your client, who they name instead, and which sources they cite.</p>
      </div>
      <div class="ai">
        <div class="icon"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg></div>
        <h4>Review reply drafts</h4>
        <p>A drafted reply for every review, in your client's tone. Your team approves before anything is posted.</p>
        <span class="tag">__DRAFTED_BY_AI__</span>
      </div>
      <div class="ai">
        <div class="icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
        <h4>AI Lens</h4>
        <p>Compare what AI crawlers read on a page with what visitors see, and find the content that only appears with JavaScript.</p>
      </div>
    </div>
  </div>
</section>

<section id="api">
  <div class="wrap">
    <div class="eyebrow">API &amp; automation</div>
    <h2 style="margin-top:14px;max-width:860px">Put Echorank data where your team already works.</h2>
    <div class="api">
      <div class="box">
        <h3>REST API</h3>
        <p>Pull visibility, audits and crawl results into your own dashboards and client reports.</p>
<pre><span class="c"># Latest AI visibility summary for a workspace</span>
<span class="k">curl</span> https://echorank360.com/api/public/v1/visibility/summary \
  -H <span class="s">"Authorization: Bearer er_api_…"</span></pre>
        <div class="mini"><div><b>10,000</b><span>requests a day on Agency</span></div><div><b>CSV</b><span>export on every table</span></div></div>
      </div>
      <div class="box">
        <h3>MCP server</h3>
        <p>Let any MCP-compatible AI assistant query your Echorank data in plain language.</p>
        <div class="tools">
          <code>get_visibility_summary</code><code>get_latest_audit</code><code>suggest_keywords</code><code>get_crawl_summary</code>
        </div>
        <ul class="list" style="margin-top:24px">
          <li>Same API key and limits as the REST API</li>
          <li>Read-only, scoped to one workspace</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="alt" id="security">
  <div class="wrap">
    <div class="split" style="align-items:start">
      <div>
        <div class="eyebrow">Enterprise</div>
        <h2 style="margin-top:14px">Need more than Agency?</h2>
        <ul class="list">
          <li><span><b>Custom limits</b> for locations, crawls, URLs per crawl and API calls.</span></li>
          <li><span><b>Annual billing</b> on one invoice for the whole workspace.</span></li>
          <li><span><b>A Data Processing Agreement</b> for your legal team.</span></li>
          <li><span><b>A call to plan your rollout</b> across clients and locations.</span></li>
        </ul>
        <div class="ctas"><a class="btn btn-y" href="/en/enterprise/contact?src=enterprise-more-than-agency">Talk to us</a></div>
      </div>
      <div class="grid3" style="grid-template-columns:1fr;margin-top:0;gap:14px">
        <div class="ai sec"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg></div>
          <h4>UK company, UK GDPR</h4><p>ChatLogic Insights Ltd, registered in England and Wales. Data export, deletion and a complaints process built in.</p></div>
        <div class="ai sec"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div>
          <h4>Your data stays yours</h4><p>Export everything at any time. We don't train AI models on your data.</p></div>
        <div class="ai sec"><div class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg></div>
          <h4>Backed up off-site, daily</h4><p>Nightly database backups to a separate cloud provider.</p></div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow">Proof you can check</div>
    <h2 style="margin-top:14px;max-width:860px">Don't take our word for it. Run it on a client's site.</h2>
    <div class="proof">
      <a href="/en/free-audit">
        <div class="eyebrow">Free · no account</div>
        <h3>AI visibility audit</h3>
        <p>A score from 0 to 100 for how ready a site is for AI search, with every check explained.</p>
        <span class="go">Run the audit →</span>
      </a>
      <a href="/en/free-tools/site-crawler">
        <div class="eyebrow">Free · 100 pages</div>
        <h3>__CRAWLER_NAME_TM__ crawl</h3>
        <p>The full rule library on 100 pages, with the five problems to fix first.</p>
        <span class="go">Crawl 100 pages →</span>
      </a>
    </div>
  </div>
</section>

<section class="cta" id="contact">
  <div class="wrap">
    <h2>Let's talk.</h2>
    <p class="lead">Tell us how many clients, locations and sites you manage. We'll tell you which plan fits, or set custom limits.</p>
    <div class="ctas">
      <a class="btn btn-y" href="/en/enterprise/contact?src=enterprise-cta">Talk to us</a>
      <a class="btn btn-o" href="/en/pricing">See plans</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>© 2026 Echorank</span>
    <span><a href="/en/legal/privacy">Privacy</a> · <a href="/en/legal/terms">Terms</a> · <a href="/en/legal/cookies">Cookies</a></span>
  </div>
</footer>

<script>
/* Night/Day toggle, the family's script verbatim: client-only, same "er-theme"
   key and data-theme attribute as the React pages. */
(function(){
  var KEY="er-theme";
  var root=document.documentElement;
  var btn=document.getElementById("er-theme");
  if(!btn){return}
  var TO_DAY="Switch to day theme";
  var TO_NIGHT="Switch to night theme";
  function label(){
    btn.setAttribute("aria-label",root.getAttribute("data-theme")==="day"?TO_NIGHT:TO_DAY)
  }
  function apply(day){
    if(day){root.setAttribute("data-theme","day")}else{root.removeAttribute("data-theme")}
    label()
  }
  label();
  btn.addEventListener("click",function(){
    var day=root.getAttribute("data-theme")!=="day";
    apply(day);
    try{localStorage.setItem(KEY,day?"day":"night")}catch(e){}
  });
  window.addEventListener("storage",function(e){
    if(e.key!==KEY){return}
    apply(e.newValue==="day")
  });
})();
</script>
</body>
</html>
`;
