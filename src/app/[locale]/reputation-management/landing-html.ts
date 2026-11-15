// Standalone /reputation-management landing: the hub for /reputation-tools,
// /reputation-engine, /reputation-risk, /customer-feedback and /act-on-signals.
// Embedded verbatim from the owner's file (2026-11-15, sha256 5479598816eb…6a67245;
// tests/reputation-management.test.ts re-hashes it). Served by ./route.ts,
// which fills the three plan prices (data-plan-price) from PLAN_CONFIGS.
// String.raw because the CSS carries an escape (content:"\2713"), which a
// plain template literal rejects. No backtick and no ${ in the payload.
export const REPUTATION_MANAGEMENT_HTML: string = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reputation Management Software for Reviews &amp; AI Answers | Echorank</title>
<meta name="description" content="Monitor Google, Trustpilot, Meta, Yelp and TripAdvisor reviews in one inbox, request reviews by email, SMS or QR, reply with AI in your voice and track reputation risk hourly.">
<link rel="canonical" href="https://echorank360.com/en/reputation-management">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#181A20">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Echorank">
<meta property="og:title" content="Reputation management for the age of AI answers | Echorank">
<meta property="og:description" content="One inbox for every review, campaigns by email, SMS and QR, AI replies in your voice, and an hourly Reputation Risk Score.">
<meta property="og:url" content="https://echorank360.com/en/reputation-management">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.ico">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
{"@type":"WebPage","@id":"https://echorank360.com/en/reputation-management#webpage","url":"https://echorank360.com/en/reputation-management","name":"Reputation Management Software for Reviews and AI Answers | Echorank","description":"Monitor Google, Trustpilot, Meta, Yelp and TripAdvisor reviews in one inbox, request reviews by email, SMS or QR, reply with AI in your voice and track reputation risk hourly.","inLanguage":"en","isPartOf":{"@type":"WebSite","name":"Echorank","url":"https://echorank360.com/en"},"breadcrumb":{"@id":"https://echorank360.com/en/reputation-management#breadcrumb"},"publisher":{"@type":"Organization","name":"ChatLogic Insights Ltd","url":"https://echorank360.com"}},
{"@type":"BreadcrumbList","@id":"https://echorank360.com/en/reputation-management#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://echorank360.com/en"},{"@type":"ListItem","position":2,"name":"Reputation management","item":"https://echorank360.com/en/reputation-management"}]}
]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
{"@type":"Question","name":"What is reputation management software?","acceptedAnswer":{"@type":"Answer","text":"It is software that collects, monitors and responds to what customers say about a business across review platforms. Echorank adds two things most tools do not: an hourly Reputation Risk Score with revenue at risk, and daily tracking of how AI assistants describe and recommend you."}},
{"@type":"Question","name":"Which review platforms does Echorank cover?","acceptedAnswer":{"@type":"Answer","text":"Google Reviews, Trustpilot, Meta (Facebook and Instagram), Yelp and TripAdvisor, with coverage expanding over time. You can also import your existing review history with the Echorank browser extension."}},
{"@type":"Question","name":"Do AI replies post automatically?","acceptedAnswer":{"@type":"Answer","text":"Not by default. Replies are drafted in your tone for you to approve or edit. You can turn on auto-posting per platform and per star rating."}},
{"@type":"Question","name":"Can Echorank remove fake reviews?","acceptedAnswer":{"@type":"Answer","text":"No tool can guarantee removal, because the platforms decide. Echorank flags suspicious patterns and gathers the evidence that makes a removal request stronger."}},
{"@type":"Question","name":"How do reviews affect AI visibility?","acceptedAnswer":{"@type":"Answer","text":"AI assistants draw on the same public review platforms when they recommend a business, so your rating, review volume, recency and replies all shape the answer. Echorank checks ChatGPT, Google AI Overviews, Gemini and Claude daily so you can see the effect."}},
{"@type":"Question","name":"Is there a contract or setup fee?","acceptedAnswer":{"@type":"Answer","text":"No setup fees and no long-term contract. Every plan starts with a 7-day free trial; a card is required, and if you cancel during the trial you are never charged. Cancel anytime from Billing: your plan stays active until the end of the period you paid for. Yearly billing saves 20%."}},
{"@type":"Question","name":"Does the free audit need a credit card?","acceptedAnswer":{"@type":"Answer","text":"No. The free audit takes about two minutes and needs no card."}}
]}
</script>
<style>
:root{
  --bg:#181A20;--surface:#1E2329;--surface2:#2B3139;--line:#2B3139;--line2:#3A414B;
  --text:#EAECEF;--muted:#B7BDC6;--dim:#848E9C;
  --yellow:#FCD535;--gold:#F0B90B;--green:#0ECB81;--red:#F6465D;
  --radius:14px;--max:1180px;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit}
img,svg{display:block;max-width:100%}
.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
.skip{position:absolute;left:-9999px;top:8px;background:var(--yellow);color:#181A20;padding:8px 14px;border-radius:8px;font-weight:700;z-index:100}
.skip:focus{left:16px}
:focus-visible{outline:2px solid var(--yellow);outline-offset:3px;border-radius:6px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}

/* header */
.top{position:sticky;top:0;z-index:50;background:rgba(24,26,32,.9);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:24px;height:64px}
.logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;letter-spacing:.16em;font-size:15px;white-space:nowrap}
.logo sup{font-size:9px;letter-spacing:0;margin-left:1px;font-weight:700;color:var(--muted);position:relative;top:-2px}
.nav{display:flex;gap:22px;margin-left:auto;align-items:center}
.nav a{text-decoration:none;color:var(--muted);font-size:14px;font-weight:500;transition:color .15s}
.nav a:hover{color:var(--text)}
.mnav{display:none;margin-left:auto;position:relative}
.mnav summary{list-style:none;cursor:pointer;width:42px;height:42px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:10px;font-size:18px;color:var(--text)}
.mnav summary::-webkit-details-marker{display:none}
.mnav div{position:absolute;right:0;top:50px;background:var(--surface);border:1px solid var(--line2);border-radius:12px;padding:10px;display:grid;min-width:220px;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.mnav div a{padding:10px 12px;text-decoration:none;border-radius:8px;color:var(--muted);font-size:15px}
.mnav div a:hover{background:var(--surface2);color:var(--text)}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;border:1px solid transparent;transition:transform .15s,background .15s,border-color .15s,color .15s;white-space:nowrap}
.btn-primary{background:var(--yellow);color:#181A20}
.btn-primary:hover{background:var(--gold);transform:translateY(-1px)}
.btn-ghost{border-color:var(--line2);color:var(--text)}
.btn-ghost:hover{border-color:var(--yellow);color:var(--yellow)}
.btn-sm{padding:8px 14px;font-size:14px}
.nav a.btn-primary,.mnav div a.btn-primary{color:#181A20}
.nav a.btn-primary:hover{color:#181A20}
.tlink{color:var(--yellow);text-decoration:none;font-weight:600;font-size:15px}
.tlink:hover{text-decoration:underline;text-underline-offset:3px}

/* type */
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--yellow);margin:0 0 16px}
.eyebrow .n{color:var(--dim)}
h1{font-size:clamp(38px,5.2vw,62px);line-height:1.05;letter-spacing:-.025em;margin:0 0 22px;font-weight:800}
h1 em,h2 em{font-style:normal;color:var(--yellow)}
h2{font-size:clamp(28px,3.4vw,42px);line-height:1.12;letter-spacing:-.02em;margin:0 0 16px;font-weight:800}
h3{font-size:19px;margin:0 0 8px;line-height:1.3;letter-spacing:-.005em}
.lead{font-size:clamp(17px,1.5vw,19px);color:var(--muted);margin:0;max-width:640px}
.sec-head{max-width:780px;margin-bottom:48px}

/* layout */
section{padding:96px 0;border-top:1px solid var(--line)}
.grid{display:grid;gap:20px}
.g2{grid-template-columns:repeat(2,1fr)}
.g3{grid-template-columns:repeat(3,1fr)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:28px}
.card p{color:var(--muted);margin:0;font-size:15px}
a.card{text-decoration:none;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
a.card:hover{border-color:var(--yellow);transform:translateY(-2px)}
a.card .go{margin-top:auto;padding-top:18px;color:var(--yellow);font-weight:600;font-size:14px}
.ico{width:40px;height:40px;border-radius:10px;background:rgba(252,213,53,.1);display:grid;place-items:center;margin-bottom:18px}
.ico svg{width:20px;height:20px}

/* breadcrumb */
.crumbs{padding:18px 0 0}
.crumbs ol{list-style:none;margin:0;padding:0;display:flex;gap:8px;font-size:13px;color:var(--dim)}
.crumbs li+li::before{content:"/";margin-right:8px;color:var(--line2)}
.crumbs a{text-decoration:none;color:var(--muted)}
.crumbs a:hover{color:var(--yellow)}

/* hero */
.hero{padding:40px 0 88px;border-top:0;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;right:-220px;top:-160px;width:760px;height:760px;background:radial-gradient(closest-side,rgba(252,213,53,.10),transparent);pointer-events:none}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;position:relative}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;margin:30px 0 16px}
.micro{font-size:13px;color:var(--dim);font-family:var(--mono);letter-spacing:.02em;margin:0}
.micro b{color:var(--green);font-weight:600}

/* mock dashboard */
.mock{background:var(--surface);border:1px solid var(--line2);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden}
.mock-bar{display:flex;align-items:center;gap:6px;padding:12px 16px;border-bottom:1px solid var(--line);background:#1A1D23}
.mock-bar i{width:9px;height:9px;border-radius:50%;background:var(--surface2);display:block}
.mock-title{margin-left:10px;font-size:12px;color:var(--dim);font-family:var(--mono)}
.mock-body{padding:18px;display:grid;gap:12px}
.plats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.plat{background:var(--surface2);border-radius:10px;padding:10px 12px}
.plat b{display:block;font-size:11px;color:var(--dim);font-weight:600;letter-spacing:.03em}
.plat span{font-size:18px;font-weight:800}
.plat span em{color:var(--yellow);font-style:normal;font-size:13px;margin-left:2px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kpi{border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.kpi small{display:block;font-size:11px;color:var(--dim)}
.kpi strong{font-size:20px;letter-spacing:-.01em}
.kpi strong span{font-size:12px;font-weight:600;margin-left:4px}
.up{color:var(--green)}
.warn{color:var(--yellow)}
.bad{color:var(--red)}
.rev{border:1px solid var(--line);border-radius:12px;padding:14px}
.rev-h{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;color:var(--dim)}
.stars{color:var(--yellow);letter-spacing:1px;font-size:13px}
.stars s{color:var(--surface2);text-decoration:none}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(246,70,93,.12);color:var(--red);font-weight:600}
.rev>p{margin:8px 0 10px;font-size:14px}
.draft{background:rgba(252,213,53,.05);border:1px dashed rgba(252,213,53,.35);border-radius:10px;padding:10px 12px}
.draft small{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--yellow);text-transform:uppercase}
.draft p{font-size:13px;color:var(--muted);margin:6px 0 10px}
.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{font-size:12px;padding:4px 12px;border-radius:8px;border:1px solid var(--line2);color:var(--muted)}
.pill.y{background:var(--yellow);color:#181A20;border-color:var(--yellow);font-weight:700}
.mock-note{font-size:11px;color:var(--dim);text-align:right;padding:0 18px 12px;font-family:var(--mono);margin:0}

/* stats */
.stats-sec{padding:0 0 96px;border-top:0}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.stat{padding:24px 26px;border-left:1px solid var(--line)}
.stat:first-child{border-left:0}
.stat strong{display:block;font-size:30px;font-weight:800;color:var(--yellow);letter-spacing:-.02em;line-height:1.2}
.stat span{color:var(--muted);font-size:14px}

/* loop */
.loop{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;position:relative}
.loop::before{content:"";position:absolute;top:27px;left:28px;right:calc((100% - 72px) / 5 - 28px);height:2px;background:linear-gradient(90deg,var(--gold),rgba(240,185,11,.12))}
.step{position:relative}
.node{width:56px;height:56px;border-radius:50%;background:var(--bg);border:2px solid var(--yellow);display:grid;place-items:center;font-family:var(--mono);font-weight:700;color:var(--yellow);margin-bottom:18px;position:relative;z-index:1}
.step h3{font-size:19px}
.step p{color:var(--muted);font-size:14.5px;margin:0 0 12px}
.chips{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:11.5px;padding:3px 9px;border-radius:999px;background:var(--surface2);color:var(--muted)}

/* coverage */
.cov{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.cov-row{display:grid;grid-template-columns:260px 1fr;gap:16px;padding:18px 24px;border-top:1px solid var(--line);align-items:center;background:var(--surface)}
.cov-row:first-child{border-top:0}
.cov-name{font-weight:700;display:flex;align-items:center;gap:12px}
.pmark{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:12px;background:var(--surface2);color:var(--yellow);font-family:var(--mono)}
.cov-note{margin:16px 0 0;color:var(--dim);font-size:14px}

/* risk */
.feat{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:18px}
.feat li{display:grid;grid-template-columns:28px 1fr;gap:12px}
.feat li::before{content:"";width:22px;height:22px;margin-top:2px;border-radius:6px;background:rgba(14,203,129,.12) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230ECB81' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5L19 7'/%3E%3C/svg%3E") center/14px no-repeat}
.feat b{display:block;font-size:16px}
.feat span{color:var(--muted);font-size:15px}
.plan-note{display:inline-block;margin-top:26px;font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);border:1px solid var(--line2);border-radius:999px;padding:6px 12px}
.plan-note b{color:var(--yellow)}
.links{display:flex;flex-wrap:wrap;gap:22px;margin-top:20px}
.gauge-card{background:var(--surface);border:1px solid var(--line2);border-radius:18px;padding:28px}
.gauge-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.gauge-top small{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.gauge-wrap{position:relative;max-width:300px;margin:6px auto 8px}
.gauge-val{position:absolute;left:0;right:0;bottom:4px;text-align:center}
.gauge-val strong{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1}
.gauge-val span{display:block;font-size:13px;color:var(--dim)}
.gauge-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}
.drivers{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.drivers li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:14px;color:var(--muted)}
.drivers li b{font-weight:700;white-space:nowrap}

/* AI answer mock */
.ask{background:var(--surface);border:1px solid var(--line2);border-radius:18px;padding:22px}
.ask-q{display:flex;gap:10px;align-items:center;background:var(--surface2);border-radius:12px;padding:12px 14px;font-size:15px}
.ask-q svg{width:18px;height:18px;flex:none}
.ask-a{padding:18px 4px 4px;font-size:15px;color:var(--muted)}
.ask-a mark{background:rgba(252,213,53,.14);color:var(--text);padding:0 3px;border-radius:4px}
.srcs{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.srcs span{font-size:11.5px;padding:3px 9px;border-radius:999px;border:1px solid var(--line2);color:var(--dim)}
.engines{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.engines span{font-size:13px;padding:6px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--line);color:var(--muted)}
.engines span b{color:var(--green);font-family:var(--mono);font-size:10px;letter-spacing:.1em;margin-left:6px}

/* pricing */
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
.plan{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:30px;display:flex;flex-direction:column}
.plan.pop{border-color:var(--yellow);box-shadow:0 20px 60px rgba(252,213,53,.07)}
.badge{align-self:flex-start;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;background:var(--yellow);color:#181A20;padding:4px 10px;border-radius:999px;font-weight:700;position:absolute;top:-12px;left:30px}
.plan h3{font-size:22px;margin:0 0 4px}
.plan .for{color:var(--dim);font-size:14px;margin:0 0 18px}
.price{display:flex;align-items:baseline;gap:2px}
.price .cur{font-size:22px;font-weight:700;color:var(--muted);align-self:flex-start;margin-top:8px}
.price .amt{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1}
.price .per{color:var(--dim);margin-left:4px}
.plan ul{list-style:none;padding:0;margin:22px 0 28px;display:grid;gap:10px;flex:1;align-content:start}
.plan li{padding-left:26px;position:relative;font-size:14.5px;color:var(--muted)}
.plan li::before{content:"";position:absolute;left:2px;top:7px;width:11px;height:6px;border-left:2px solid var(--green);border-bottom:2px solid var(--green);transform:rotate(-45deg)}
.plan li.inc{padding-left:0;color:var(--text);font-weight:600}
.plan li.inc::before{display:none}
.plan .btn{width:100%}
.terms{display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:center;margin:30px 0 0;padding:0;list-style:none;color:var(--muted);font-size:14px}
.terms li::before{content:"\2713";color:var(--green);margin-right:7px;font-weight:700}
.ent{margin:22px auto 0;text-align:center;color:var(--dim);font-size:15px}
.ent a{color:var(--yellow);text-decoration:none;font-weight:600}

/* faq */
.faq{max-width:860px}
.faq details{border-top:1px solid var(--line)}
.faq details:last-child{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:20px 44px 20px 0;font-weight:700;font-size:18px;position:relative}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";position:absolute;right:6px;top:15px;font-size:26px;color:var(--yellow);font-weight:400;transition:transform .2s}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{color:var(--muted);margin:0 0 22px;max-width:760px}

/* final */
.final{text-align:center;background:radial-gradient(ellipse 60% 70% at 50% 0%,rgba(252,213,53,.10),transparent)}
.final .lead{margin:0 auto}
.final .cta-row{justify-content:center}

/* footer */
.foot{border-top:1px solid var(--line);padding:56px 0 40px;background:#14161B}
.foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:32px}
.foot h4{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 14px;font-weight:600}
.foot ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.foot a{text-decoration:none;color:var(--muted);font-size:14px}
.foot a:hover{color:var(--yellow)}
.foot-tag{color:var(--dim);font-size:14px;margin:14px 0 0;max-width:300px}
.legal{margin-top:44px;padding-top:22px;border-top:1px solid var(--line);font-size:12.5px;color:var(--dim);line-height:1.7}

/* responsive */
@media (max-width:1000px){
  .hero-grid,.split{grid-template-columns:1fr;gap:44px}
  .loop{grid-template-columns:1fr;gap:28px}
  .loop::before{display:none}
  .step:not(:last-child)::after{content:"";position:absolute;left:27px;top:56px;bottom:-28px;width:2px;background:linear-gradient(180deg,var(--gold),rgba(240,185,11,.2))}
  .step{display:grid;grid-template-columns:56px 1fr;gap:20px}
  .node{margin:0}
  .plans{grid-template-columns:1fr;max-width:520px;margin:0 auto}
  .g3{grid-template-columns:repeat(2,1fr)}
  .foot-grid{grid-template-columns:1fr 1fr}
}
@media (max-width:860px){
  .nav{display:none}
  .mnav{display:block}
}
@media (max-width:640px){
  section{padding:72px 0}
  .stats-sec{padding:0 0 72px}
  .g2,.g3{grid-template-columns:1fr}
  .stats{grid-template-columns:1fr 1fr}
  .stat:nth-child(3){border-left:0}
  .stat:nth-child(n+3){border-top:1px solid var(--line)}
  .plats{grid-template-columns:repeat(2,1fr)}
  .kpis{grid-template-columns:1fr 1fr 1fr}
  .cov-row{grid-template-columns:1fr;gap:10px}
  .cta-row .btn{width:100%}
  .foot-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="top">
  <div class="wrap">
    <a class="logo" href="/en" aria-label="Echorank home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="eg-rm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE38A"/><stop offset="1" stop-color="#F0B90B"/></linearGradient></defs><rect x="7" y="7" width="18" height="18" rx="3" transform="rotate(45 16 16)" fill="url(#eg-rm)"/><rect x="12.5" y="12.5" width="7" height="7" rx="1.2" transform="rotate(45 16 16)" fill="#181A20"/></svg>
      <span>ECHORANK<sup>&trade;</sup></span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/en">Home</a>
      <a href="#suite">Reputation suite</a>
      <a href="/en/free-audit">Free audit</a>
      <a href="/en/pricing">Pricing</a>
      <a href="/login">Login</a>
      <a class="btn btn-primary btn-sm" href="/en/pricing">Start free trial</a>
    </nav>
    <details class="mnav">
      <summary aria-label="Open menu">&#9776;</summary>
      <div>
        <a href="/en">Home</a>
        <a href="#suite">Reputation suite</a>
        <a href="/en/free-audit">Free audit</a>
        <a href="/en/pricing">Pricing</a>
        <a href="/login">Login</a>
        <a class="btn btn-primary btn-sm" href="/en/pricing">Start free trial</a>
      </div>
    </details>
  </div>
</header>

<main id="main">

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol>
      <li><a href="/en">Home</a></li>
      <li aria-current="page">Reputation management</li>
    </ol>
  </nav>
</div>

<!-- HERO -->
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">Reputation management software</p>
      <h1>Reputation management for the age of <em>AI answers.</em></h1>
      <p class="lead">Echorank pulls every review from Google, Trustpilot, Meta, Yelp and TripAdvisor into one inbox, asks customers for reviews by email, SMS or QR code, drafts replies in your voice and scores your reputation risk every hour. It matters more than ever: ChatGPT, Gemini and Google AI Overviews build their recommendations from those same reviews.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/en/free-audit">Run my free reputation audit</a>
        <a class="btn btn-ghost" href="/en/pricing">See plans &amp; pricing</a>
      </div>
      <p class="micro">Free audit: <b>no card</b>, about 2 minutes &middot; Plans: 7-day free trial &middot; <b>Cancel anytime</b></p>
    </div>

    <div class="mock" role="img" aria-label="Illustrative Echorank reputation inbox: ratings across four platforms, a Risk Score of 28 falling, and a new two-star review with an AI-drafted reply waiting for approval">
      <div class="mock-bar"><i></i><i></i><i></i><span class="mock-title">Reputation inbox &middot; Harbor Dental</span></div>
      <div class="mock-body">
        <div class="plats">
          <div class="plat"><b>GOOGLE</b><span>4.8<em>&#9733;</em></span></div>
          <div class="plat"><b>TRUSTPILOT</b><span>4.6<em>&#9733;</em></span></div>
          <div class="plat"><b>YELP</b><span>4.5<em>&#9733;</em></span></div>
          <div class="plat"><b>META</b><span>4.7<em>&#9733;</em></span></div>
        </div>
        <div class="kpis">
          <div class="kpi"><small>Risk Score</small><strong>28<span class="up">&#9660; 6</span></strong></div>
          <div class="kpi"><small>Review velocity</small><strong>+42%<span class="up">90d</span></strong></div>
          <div class="kpi"><small>Replied</small><strong>91%</strong></div>
        </div>
        <div class="rev">
          <div class="rev-h"><span class="stars">&#9733;&#9733;<s>&#9733;&#9733;&#9733;</s></span><span>Google &middot; 4 min ago</span><span class="tag">Negative &middot; wait time</span></div>
          <p>&ldquo;Waited 40 minutes past my appointment and nobody told me why.&rdquo;</p>
          <div class="draft">
            <small>AI draft &middot; your voice</small>
            <p>&ldquo;Thank you for telling us, Dana. A 40-minute wait with no explanation is not the visit we want for you. I&rsquo;ve shared this with our front desk and would love to make it right; could you call me directly?&rdquo;</p>
            <div class="pills"><span class="pill y">Approve</span><span class="pill">Edit</span><span class="pill">Route to team</span></div>
          </div>
        </div>
      </div>
      <p class="mock-note">Illustrative data</p>
    </div>
  </div>
</section>

<!-- STATS -->
<section class="stats-sec" aria-label="Coverage at a glance">
  <div class="wrap">
    <div class="stats">
      <div class="stat"><strong>5</strong><span>review platforms in one inbox</span></div>
      <div class="stat"><strong>3</strong><span>ways to ask: email, SMS, QR</span></div>
      <div class="stat"><strong>Hourly</strong><span>Reputation Risk Score refresh</span></div>
      <div class="stat"><strong>4</strong><span>AI engines checked daily</span></div>
    </div>
  </div>
</section>

<!-- 01 WHY -->
<section id="why">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/01</span> &mdash; Why it matters now</p>
      <h2>Reviews stopped being a local problem. <em>AI repeats them to everyone.</em></h2>
      <p class="lead">Prospects used to read a few reviews and decide. Now they ask an assistant, and the assistant reads all of them for you.</p>
    </div>
    <div class="grid g3">
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg></div>
        <h3>Answer engines read your reviews</h3>
        <p>ChatGPT, Gemini and Google AI Overviews summarise review platforms when someone asks who to hire. Your rating, your recent complaints and how you replied become part of the answer.</p>
      </div>
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg></div>
        <h3>Damage happens in silence</h3>
        <p>Unhappy customers rarely complain. They just don&rsquo;t come back. Unanswered reviews and long gaps without fresh feedback tell prospects nobody is minding the store.</p>
      </div>
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <h3>Five platforms, no spare hours</h3>
        <p>Logging into Google, Trustpilot, Meta, Yelp and TripAdvisor every day isn&rsquo;t a plan. Most owners find a bad review weeks after their prospects did.</p>
      </div>
    </div>
  </div>
</section>

<!-- 02 LOOP -->
<section id="how">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/02</span> &mdash; How it works</p>
      <h2>One loop: collect, monitor, respond, protect, prove.</h2>
      <p class="lead">Each step feeds the next, so a better reputation compounds instead of depending on whoever had time this week.</p>
    </div>
    <div class="loop">
      <div class="step">
        <div class="node">01</div>
        <div>
          <h3>Collect</h3>
          <p>Ask every customer at the right moment by email, SMS or a printable QR code. Bring in your existing review history with the browser extension, no API keys or exports.</p>
          <ul class="chips"><li class="chip">Review campaigns</li><li class="chip">Private feedback</li><li class="chip">History import</li></ul>
        </div>
      </div>
      <div class="step">
        <div class="node">02</div>
        <div>
          <h3>Monitor</h3>
          <p>Every review from connected platforms lands in one deduplicated, tagged stream, scored for sentiment and risk on arrival. Alerts respect your thresholds and quiet hours.</p>
          <ul class="chips"><li class="chip">Unified inbox</li><li class="chip">Sentiment</li><li class="chip">Real-time alerts</li></ul>
        </div>
      </div>
      <div class="step">
        <div class="node">03</div>
        <div>
          <h3>Respond</h3>
          <p>AI drafts replies trained on your tone. You approve, edit or route to your team. Nothing posts without you unless you turn on auto-post per platform and star rating.</p>
          <ul class="chips"><li class="chip">AI replies</li><li class="chip">Approval flow</li></ul>
        </div>
      </div>
      <div class="step">
        <div class="node">04</div>
        <div>
          <h3>Protect</h3>
          <p>Suspicious review detection flags likely fake or competitor-planted reviews and gathers evidence for removal requests. Escalation prediction catches complaints before they turn into crises.</p>
          <ul class="chips"><li class="chip">Authenticity checks</li><li class="chip">Escalation prediction</li><li class="chip">Recovery playbooks</li></ul>
        </div>
      </div>
      <div class="step">
        <div class="node">05</div>
        <div>
          <h3>Prove</h3>
          <p>The Reputation Risk Score refreshes hourly with 7- and 30-day deltas and revenue at risk in dollars. Weekly digests and PDF reports show whether the work is paying off.</p>
          <ul class="chips"><li class="chip">Risk Score</li><li class="chip">Digests</li><li class="chip">PDF reports</li></ul>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- 03 COVERAGE -->
<section id="coverage">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/03</span> &mdash; Coverage</p>
      <h2>Every platform the AI engines learn from.</h2>
      <p class="lead">Connect once. New reviews, ratings and mentions arrive in one place, with alerts in one inbox.</p>
    </div>
    <div class="cov">
      <div class="cov-row"><div class="cov-name"><span class="pmark">G</span>Google Reviews</div><ul class="chips"><li class="chip">Monitoring</li><li class="chip">Campaigns</li><li class="chip">AI replies</li></ul></div>
      <div class="cov-row"><div class="cov-name"><span class="pmark">TP</span>Trustpilot</div><ul class="chips"><li class="chip">Monitoring</li><li class="chip">Alerts</li></ul></div>
      <div class="cov-row"><div class="cov-name"><span class="pmark">M</span>Meta (Facebook &amp; Instagram)</div><ul class="chips"><li class="chip">Reviews</li><li class="chip">Mentions</li></ul></div>
      <div class="cov-row"><div class="cov-name"><span class="pmark">Y</span>Yelp</div><ul class="chips"><li class="chip">Monitoring</li></ul></div>
      <div class="cov-row"><div class="cov-name"><span class="pmark">TA</span>TripAdvisor</div><ul class="chips"><li class="chip">Monitoring</li></ul></div>
    </div>
    <p class="cov-note">Coverage expands over time. Already have years of reviews? <a class="tlink" href="/en/learn/guides/install-browser-extension">Import them with the browser extension &rarr;</a></p>
  </div>
</section>

<!-- 04 RISK SCORE -->
<section id="risk">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="n">/04</span> &mdash; Reputation Risk Score</p>
      <h2>One number for your reputation. <em>Every driver named.</em></h2>
      <p class="lead">Public reviews, private feedback, AI visibility and competitor moves roll up into one explainable 0&ndash;100 score, so you know what to fix first and whether it worked.</p>
      <ul class="feat">
        <li><div><b>Explainable by design</b><span>Five weighted components, with every review, comment and competitor move behind the score named and linked.</span></div></li>
        <li><div><b>Refreshed hourly</b><span>7- and 30-day deltas plus 90-day history show whether risk is falling or rising.</span></div></li>
        <li><div><b>Dollars attached</b><span>Revenue at risk per month ranks your fixes by what they&rsquo;re worth.</span></div></li>
        <li><div><b>Alerts that arrive with the answer</b><span>Threshold crossings, 7-day spikes and new critical signals arrive once, in one digest, with the cause and a drafted response.</span></div></li>
      </ul>
      <span class="plan-note">Included from <b>Growth</b></span>
      <div class="links">
        <a class="tlink" href="/en/reputation-risk">How the Risk Score works &rarr;</a>
        <a class="tlink" href="/en/act-on-signals">How alerts work &rarr;</a>
      </div>
    </div>
    <div class="gauge-card" role="img" aria-label="Illustrative Risk Score gauge reading 28 out of 100, low risk, down 6 points in 7 days, with three named drivers">
      <div class="gauge-top"><small>Reputation Risk Score</small><small>Updated 12 min ago</small></div>
      <div class="gauge-wrap">
        <svg viewBox="0 0 220 124" aria-hidden="true">
          <path d="M 20 112 A 90 90 0 0 1 200 112" fill="none" stroke="#2B3139" stroke-width="16" stroke-linecap="round"/>
          <path d="M 20 112 A 90 90 0 0 1 200 112" fill="none" stroke="#0ECB81" stroke-width="16" stroke-linecap="round" stroke-dasharray="79.2 400"/>
        </svg>
        <div class="gauge-val"><strong>28</strong><span>of 100 &middot; low risk</span></div>
      </div>
      <div class="gauge-meta">
        <div class="kpi"><small>7-day change</small><strong class="up">&minus;6 pts</strong></div>
        <div class="kpi"><small>Revenue at risk</small><strong>$1,240<span class="warn">/mo</span></strong></div>
      </div>
      <ul class="drivers">
        <li><span>3 unanswered 1&ndash;2&#9733; reviews on Google</span><b class="bad">+9</b></li>
        <li><span>Competitor review velocity up 18%</span><b class="warn">+5</b></li>
        <li><span>Median reply time now 4 hours</span><b class="up">&minus;7</b></li>
      </ul>
      <p class="mock-note" style="padding:12px 0 0">Illustrative data</p>
    </div>
  </div>
</section>

<!-- 05 AI -->
<section id="ai">
  <div class="wrap split">
    <div class="ask" role="img" aria-label="Illustrative AI assistant answer recommending Harbor Dental, citing its Google rating and review replies, with sources from Google Reviews, Yelp and Trustpilot">
      <div class="ask-q"><svg viewBox="0 0 24 24" fill="none" stroke="#848E9C" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>Who&rsquo;s the best family dentist in Milwaukee?</div>
      <div class="ask-a">
        <p style="margin:0">A frequently recommended option is <mark>Harbor Dental</mark>. It holds a <mark>4.8&#9733; rating across 312 Google reviews</mark>, recent patients mention gentle care and short waits, and the practice <mark>replies to nearly every review</mark>, including the critical ones.</p>
        <div class="srcs"><span>Google Reviews</span><span>Yelp</span><span>Trustpilot</span></div>
      </div>
      <p class="mock-note" style="padding:14px 0 0">Illustrative answer</p>
    </div>
    <div>
      <p class="eyebrow"><span class="n">/05</span> &mdash; Reputation &times; AI visibility</p>
      <h2>Your review profile is <em>what AI repeats.</em></h2>
      <p class="lead">When someone asks an assistant who to hire, the answer leans on public review platforms: rating, volume, recency and how you respond. Managing reviews is now how you influence that answer. Echorank shows you the effect, engine by engine.</p>
      <div class="engines">
        <span>ChatGPT<b>DAILY</b></span><span>Google AI Overviews<b>DAILY</b></span><span>Gemini<b>DAILY</b></span><span>Claude<b>DAILY</b></span>
      </div>
      <div class="links">
        <a class="tlink" href="/en/ai-visibility-check">Run the free AI visibility check &rarr;</a>
        <a class="tlink" href="/en/learn/guides/how-to-get-cited-by-chatgpt">How to get cited by ChatGPT &rarr;</a>
      </div>
    </div>
  </div>
</section>

<!-- 06 COMPLIANT -->
<section id="compliance">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/06</span> &mdash; Compliant by design</p>
      <h2>Automation that plays by the rules.</h2>
      <p class="lead">More reviews only help if they&rsquo;re real and gathered fairly. The guardrails are built in.</p>
    </div>
    <div class="grid g3">
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h3>Consent-first outreach</h3>
        <p>Your lists, your consents, opt-outs honoured. Campaigns are designed with CASL, TCPA and GDPR consent rules in mind.</p>
      </div>
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg></div>
        <h3>Platform-policy aware</h3>
        <p>Every customer gets the same ask. Private feedback is offered as an extra channel only where platform rules allow it.</p>
      </div>
      <div class="card">
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#FCD535" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div>
        <h3>Your voice, your approval</h3>
        <p>AI drafts are suggestions. Nothing publishes without you unless you choose auto-post for specific platforms and ratings.</p>
      </div>
    </div>
  </div>
</section>

<!-- 07 SUITE -->
<section id="suite">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/07</span> &mdash; The reputation suite</p>
      <h2>Go deeper into each part.</h2>
      <p class="lead">Reputation management in Echorank is one system with five working parts. Each has its own page.</p>
    </div>
    <div class="grid g3">
      <a class="card" href="/en/reputation-tools">
        <h3>Reputation Tools</h3>
        <p>Twelve tools in one engine: unified monitoring, campaigns, AI replies, review widgets, benchmarking and recovery playbooks.</p>
        <span class="go">Explore the toolkit &rarr;</span>
      </a>
      <a class="card" href="/en/reputation-engine">
        <h3>Reputation Engine</h3>
        <p>Automated feedback campaigns, private routing and white-label for agencies. A reputation that works while you sleep.</p>
        <span class="go">See the automation &rarr;</span>
      </a>
      <a class="card" href="/en/reputation-risk">
        <h3>Reputation Risk Score</h3>
        <p>Reviews, feedback, AI visibility and competitors in one explainable 0&ndash;100 score, with revenue at risk attached.</p>
        <span class="go">Understand the score &rarr;</span>
      </a>
      <a class="card" href="/en/customer-feedback">
        <h3>Customer Feedback</h3>
        <p>Sentiment on every comment, recurring complaints surfaced and escalation predicted before it goes public.</p>
        <span class="go">Read every word &rarr;</span>
      </a>
      <a class="card" href="/en/act-on-signals">
        <h3>Act on Signals</h3>
        <p>Alerts that name the cause, attach the cost and bring a drafted reply. One click to the driver.</p>
        <span class="go">See an alert &rarr;</span>
      </a>
      <a class="card" href="/en/learn/guides/install-browser-extension">
        <h3>Browser extension</h3>
        <p>Import your existing review history from pages you already visit. Two-minute install, no API keys.</p>
        <span class="go">Install guide &rarr;</span>
      </a>
    </div>
  </div>
</section>

<!-- 08 WHO -->
<section id="who">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/08</span> &mdash; Built for</p>
      <h2>Wherever the next customer reads reviews first.</h2>
    </div>
    <div class="grid g3">
      <a class="card" href="/en/solutions/industries/local-businesses"><h3>Local businesses</h3><p>Trades, clinics, salons and restaurants competing on the &ldquo;near me&rdquo; answer.</p><span class="go">Local businesses &rarr;</span></a>
      <a class="card" href="/en/solutions/industries/dentists"><h3>Dentists</h3><p>Patient reviews decide new bookings. Keep the rating fresh and every reply professional.</p><span class="go">Dentists &rarr;</span></a>
      <a class="card" href="/en/solutions/industries/healthcare"><h3>Healthcare</h3><p>Careful, consistent replies and early warning on recurring complaints.</p><span class="go">Healthcare &rarr;</span></a>
      <a class="card" href="/en/solutions/industries/professional-services"><h3>Professional services</h3><p>Firms where one public complaint outweighs a dozen quiet referrals.</p><span class="go">Professional services &rarr;</span></a>
      <a class="card" href="/en/solutions/industries/ecommerce-retail"><h3>Ecommerce &amp; retail</h3><p>Trustpilot and Google ratings that move conversion and AI shopping answers.</p><span class="go">Ecommerce &amp; retail &rarr;</span></a>
      <a class="card" href="/en/solutions/team-size/agencies"><h3>Agencies</h3><p>Run reputation for every client under your brand: white-label dashboard and custom domain on Agency.</p><span class="go">Agencies &rarr;</span></a>
    </div>
  </div>
</section>

<!-- 09 PRICING -->
<section id="pricing">
  <div class="wrap">
    <div class="sec-head" style="text-align:center;margin-left:auto;margin-right:auto">
      <p class="eyebrow"><span class="n">/09</span> &mdash; Plans</p>
      <h2>Reputation management on every plan from Starter.</h2>
      <p class="lead" style="margin:0 auto">Each plan also includes Echorank&rsquo;s AI visibility tracking and SEO tools. Prices in USD, billed monthly.</p>
    </div>
    <div class="plans">
      <div class="plan">
        <h3>Starter</h3>
        <p class="for">One location getting serious about reviews.</p>
        <div class="price"><span class="cur">$</span><span class="amt" data-plan-price="STARTER">78</span><span class="per">/mo</span></div>
        <ul>
          <li>1 location</li>
          <li>500 feedback requests / mo by email and QR</li>
          <li>Review monitoring and real-time alerts</li>
          <li>AI reply drafting in your voice</li>
          <li>Review authenticity verification</li>
          <li>AI visibility: 15 prompts across 4 engines</li>
        </ul>
        <a class="btn btn-ghost" href="/en/pricing">Choose Starter</a>
      </div>
      <div class="plan pop">
        <span class="badge">Most popular</span>
        <h3>Growth</h3>
        <p class="for">Multiple locations or high review volume.</p>
        <div class="price"><span class="cur">$</span><span class="amt" data-plan-price="GROWTH">177</span><span class="per">/mo</span></div>
        <ul>
          <li class="inc">Everything in Starter, plus:</li>
          <li>5 locations</li>
          <li>5,000 feedback requests / mo</li>
          <li>1,000 SMS / mo</li>
          <li>Reputation Risk Score, AI risk scoring and sentiment</li>
          <li>Escalation prediction and revenue-at-risk alerts</li>
          <li>Priority support, 24h weekday response</li>
        </ul>
        <a class="btn btn-primary" href="/en/pricing">Choose Growth</a>
      </div>
      <div class="plan">
        <h3>Agency</h3>
        <p class="for">Agencies and brands managing many profiles.</p>
        <div class="price"><span class="cur">$</span><span class="amt" data-plan-price="AGENCY">488</span><span class="per">/mo</span></div>
        <ul>
          <li class="inc">Everything in Growth, plus:</li>
          <li>25 locations</li>
          <li>15,000 feedback requests / mo</li>
          <li>5,000 SMS / mo</li>
          <li>White-label dashboard and custom domain</li>
          <li>Competitor momentum alerts</li>
          <li>API access</li>
        </ul>
        <a class="btn btn-ghost" href="/en/pricing">Choose Agency</a>
      </div>
    </div>
    <ul class="terms">
      <li>7-day free trial on every plan</li>
      <li>Cancel anytime from Billing</li>
      <li>Save 20% with yearly billing</li>
      <li>No setup fees, no per-seat charges</li>
    </ul>
    <p class="ent">More than 25 locations? <a href="/en/enterprise/contact">Talk to us about Enterprise &rarr;</a> &nbsp;&middot;&nbsp; <a href="/en/pricing#compare">Full plan comparison &rarr;</a></p>
  </div>
</section>

<!-- 10 FAQ -->
<section id="faq">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow"><span class="n">/10</span> &mdash; FAQ</p>
      <h2>Questions, answered.</h2>
    </div>
    <div class="faq">
      <details open>
        <summary>What is reputation management software?</summary>
        <p>It is software that collects, monitors and responds to what customers say about a business across review platforms. Echorank adds two things most tools do not: an hourly Reputation Risk Score with revenue at risk, and daily tracking of how AI assistants describe and recommend you.</p>
      </details>
      <details>
        <summary>Which review platforms does Echorank cover?</summary>
        <p>Google Reviews, Trustpilot, Meta (Facebook and Instagram), Yelp and TripAdvisor, with coverage expanding over time. You can also import your existing review history with the Echorank browser extension.</p>
      </details>
      <details>
        <summary>Do AI replies post automatically?</summary>
        <p>Not by default. Replies are drafted in your tone for you to approve or edit. You can turn on auto-posting per platform and per star rating.</p>
      </details>
      <details>
        <summary>Can Echorank remove fake reviews?</summary>
        <p>No tool can guarantee removal, because the platforms decide. Echorank flags suspicious patterns and gathers the evidence that makes a removal request stronger.</p>
      </details>
      <details>
        <summary>How do reviews affect AI visibility?</summary>
        <p>AI assistants draw on the same public review platforms when they recommend a business, so your rating, review volume, recency and replies all shape the answer. Echorank checks ChatGPT, Google AI Overviews, Gemini and Claude daily so you can see the effect.</p>
      </details>
      <details>
        <summary>Is there a contract or setup fee?</summary>
        <p>No setup fees and no long-term contract. Every plan starts with a 7-day free trial; a card is required, and if you cancel during the trial you are never charged. Cancel anytime from Billing: your plan stays active until the end of the period you paid for. Yearly billing saves 20%.</p>
      </details>
      <details>
        <summary>Does the free audit need a credit card?</summary>
        <p>No. The free audit takes about two minutes and needs no card.</p>
      </details>
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section class="final">
  <div class="wrap">
    <p class="eyebrow">Start here</p>
    <h2>See your reputation <em>the way AI sees it.</em></h2>
    <p class="lead">Run the free audit: two minutes, no card. Then try any plan free for 7 days and cancel anytime.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/en/free-audit">Run my free reputation audit</a>
      <a class="btn btn-ghost" href="/en/pricing">See plans &amp; pricing</a>
    </div>
  </div>
</section>

</main>

<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="logo" href="/en" aria-label="Echorank home">
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" rx="3" transform="rotate(45 16 16)" fill="url(#eg-rm)"/><rect x="12.5" y="12.5" width="7" height="7" rx="1.2" transform="rotate(45 16 16)" fill="#14161B"/></svg>
          <span>ECHORANK<sup>&trade;</sup></span>
        </a>
        <p class="foot-tag">Reputation and AI visibility management for businesses that want to be the one AI recommends.</p>
      </div>
      <div>
        <h4>Product</h4>
        <ul>
          <li><a href="/en">Home</a></li>
          <li><a href="/en/pricing">Pricing</a></li>
          <li><a href="/en/free-audit">Free audit</a></li>
          <li><a href="/en/ai-visibility-check">Free AI visibility check</a></li>
          <li><a href="/en/reputation-tools">Reputation tools</a></li>
        </ul>
      </div>
      <div>
        <h4>Learn</h4>
        <ul>
          <li><a href="/en/learn">Learn</a></li>
          <li><a href="/en/learn/aeo">Free AEO course</a></li>
          <li><a href="/en/resources">Resources</a></li>
          <li><a href="/en/glossary">Glossary</a></li>
          <li><a href="https://llmstxt.echorank360.com/llms-txt-generator?utm_source=echorank360.com&amp;utm_medium=footer">llms.txt Generator</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="/en/legal/terms">Terms</a></li>
          <li><a href="/en/legal/privacy">Privacy</a></li>
          <li><a href="/en/legal/cookies">Cookies</a></li>
          <li><a href="/en/legal/subscription-agreement">Subscription agreement</a></li>
          <li><a href="/en/legal/disclaimer">Disclaimer</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      &copy; 2026 Echorank &mdash; ChatLogic Insights Ltd &middot; Registered in England and Wales, no. 15593166 &middot; Registered office: 82a James Carter Road, Mildenhall, IP28 7DE, United Kingdom
    </div>
  </div>
</footer>
</body>
</html>`;
