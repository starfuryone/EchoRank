export const landingHtml = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reputation Management — Echorank</title>
<meta name="description" content="Monitor and manage Google Reviews, Trustpilot, Meta, Yelp and TripAdvisor from one place — the same reviews AI engines learn from. Campaigns, AI reply drafting, suspicious review detection.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0b0d10; --surface:#14171c; --surface-2:#181c22; --border:#262b33;
    --text:#eaecef; --muted:#8b95a5; --gold:#f0b90b; --gold-deep:#c99400;
    --green:#0ecb81; --red:#f6465d;
    --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
  body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:4px}
  .wrap{max-width:1160px;margin:0 auto;padding:0 24px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
  .eyebrow .n{color:var(--gold)}
  h1,h2,h3{line-height:1.15;letter-spacing:-.02em}
  h2{font-size:clamp(28px,4vw,40px);font-weight:800;margin:14px 0 12px}
  .lead{color:var(--muted);font-size:17px;max-width:640px}
  section{padding:88px 0;border-top:1px solid var(--border)}

  /* buttons */
  .btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;border:1px solid transparent;cursor:pointer;background:transparent;color:inherit;font-family:inherit;transition:transform .15s,background .15s,border-color .15s}
  .btn:active{transform:translateY(1px)}
  .btn-gold{background:var(--gold);color:#111;border-color:var(--gold)}
  .btn-gold:hover{background:#ffd23e}
  .btn-ghost{border-color:var(--border);color:var(--text)}
  .btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

  /* header */
  header{position:sticky;top:0;z-index:50;background:rgba(11,13,16,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:64px}
  .logo{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.06em;font-size:15px}
  .logo .diamond{width:18px;height:18px;background:var(--gold);transform:rotate(45deg);border-radius:4px}
  .nav-cta{display:flex;gap:12px}

  /* hero */
  .hero{padding:96px 0 80px;border-top:none;background:radial-gradient(700px 380px at 78% 14%,rgba(240,185,11,.08),transparent 65%)}
  .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .hero h1{font-size:clamp(36px,5.4vw,58px);font-weight:800;margin:16px 0 18px}
  .hero h1 em{font-style:normal;color:var(--gold)}
  .hero-ctas{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px}
  .hero-note{margin-top:16px;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}

  /* signature: sources -> AI answer */
  .machine{display:flex;flex-direction:column;gap:0}
  .sources{display:flex;flex-wrap:wrap;gap:10px}
  .chip{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--green)}
  .chip .meta{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--muted)}
  .feed{height:34px;width:2px;margin:8px 0 8px 34px;background:linear-gradient(var(--border),var(--gold))}
  .answer{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:14px;padding:22px 24px;box-shadow:0 24px 60px rgba(0,0,0,.45)}
  .answer .q{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
  .answer p{font-size:15px}
  .answer .hl{color:var(--gold);font-weight:600}
  .answer .src{margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--muted)}

  /* hero metrics graphics */
  .metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  .metric{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px}
  .metric .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .metric .val{font-size:20px;font-weight:800}
  .metric .val em{font-style:normal;color:var(--green);font-size:12px;font-weight:600}

  /* before/after trend charts */
  .ba-chart{margin-top:18px;border-top:1px dashed var(--border);padding-top:14px}
  .ba-chart .cl{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  .ba-chart svg{display:block;width:100%}

  /* pain */
  .cards-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}
  .pain-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px}
  .pain-card .k{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--red);margin-bottom:12px}
  .pain-card h3{font-size:18px;margin-bottom:8px}
  .pain-card p{color:var(--muted);font-size:14.5px}

  /* platforms */
  .plats{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
  .plat{display:inline-flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;font-weight:600;font-size:15px}
  .plat .tags{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:400}

  /* tool grid */
  .tools{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
  .tool{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;transition:border-color .15s,transform .15s}
  .tool:hover{border-color:var(--gold);transform:translateY(-2px)}
  .tool .ic{width:36px;height:36px;border-radius:9px;background:rgba(240,185,11,.12);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:14px}
  .tool h3{font-size:15.5px;margin-bottom:6px}
  .tool p{color:var(--muted);font-size:13.5px}

  /* before / after */
  .ba{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:36px}
  .ba-col{border-radius:14px;padding:28px;border:1px solid var(--border)}
  .ba-before{background:var(--surface)}
  .ba-after{background:linear-gradient(180deg,rgba(240,185,11,.08),rgba(240,185,11,.02));border-color:rgba(240,185,11,.4)}
  .ba-col .t{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:18px}
  .ba-before .t{color:var(--red)}
  .ba-after .t{color:var(--gold)}
  .ba-col ul{list-style:none;display:flex;flex-direction:column;gap:12px}
  .ba-col li{display:flex;gap:10px;font-size:14.5px;color:var(--text)}
  .ba-before li{color:var(--muted)}
  .ba-col li .m{flex:none;font-weight:700}
  .ba-before li .m{color:var(--red)}
  .ba-after li .m{color:var(--green)}

  /* extension */
  .ext-grid{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center;margin-top:36px}
  .ext-video{width:100%;border:1px solid var(--border);border-radius:14px;display:block;background:#000}
  .ext-note{margin-top:12px;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .ext-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:26px}

  /* pricing */
  .toggle{display:inline-flex;border:1px solid var(--border);border-radius:999px;padding:4px;margin-top:26px;background:var(--surface)}
  .toggle button{border:0;background:transparent;color:var(--muted);font-weight:600;font-size:13.5px;padding:8px 18px;border-radius:999px;cursor:pointer;font-family:inherit}
  .toggle button.on{background:var(--gold);color:#111}
  .toggle .save{font-family:var(--mono);font-size:10px;letter-spacing:.08em}
  .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px;align-items:stretch}
  .plan{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:30px;display:flex;flex-direction:column}
  .plan.hot{border-color:var(--gold);position:relative;background:var(--surface-2)}
  .plan .badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--gold);color:#111;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:4px 12px;border-radius:999px}
  .plan .name{font-weight:700;font-size:17px}
  .plan .for{color:var(--muted);font-size:13px;margin-top:2px}
  .plan .price{margin:20px 0 4px;font-size:42px;font-weight:800;letter-spacing:-.03em}
  .plan .price small{font-size:15px;font-weight:500;color:var(--muted);letter-spacing:0}
  .plan .cycle{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);min-height:16px}
  .plan ul{list-style:none;margin:22px 0 26px;display:flex;flex-direction:column;gap:10px;flex:1}
  .plan li{display:flex;gap:10px;font-size:14px;color:var(--text)}
  .plan li .m{color:var(--green);font-weight:700;flex:none}
  .plan .btn{justify-content:center}

  /* faq */
  .faq{max-width:760px;margin:36px auto 0}
  details{border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-bottom:12px}
  summary{cursor:pointer;list-style:none;padding:18px 22px;font-weight:600;font-size:15.5px;display:flex;justify-content:space-between;align-items:center;gap:16px}
  summary::-webkit-details-marker{display:none}
  summary .plus{color:var(--gold);font-weight:400;font-size:20px;transition:transform .15s}
  details[open] summary .plus{transform:rotate(45deg)}
  details .a{padding:0 22px 20px;color:var(--muted);font-size:14.5px}

  /* final cta */
  .final{text-align:center}
  .final .lead{margin:0 auto}
  .final .hero-ctas{justify-content:center}

  footer{border-top:1px solid var(--border);padding:32px 0;color:var(--muted);font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
  footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;width:100%}

  @media (max-width:920px){
    .hero-grid{grid-template-columns:1fr}
    .cards-3,.tools,.plans,.ext-grid{grid-template-columns:1fr}
    .ba{grid-template-columns:1fr}
    section{padding:64px 0}
    .nav-cta .btn{padding:9px 12px;font-size:13px}
  }
</style>
</head>
<body>

<header>
  <div class="wrap nav">
    <a class="logo" href="/en" aria-label="Echorank home"><span class="diamond"></span>ECHORANK</a>
    <nav class="nav-cta">
      <button type="button" class="btn btn-ghost" id="back-btn" aria-label="Go back to the previous page">&#8592; Back</button>
      <a class="btn btn-ghost" href="/en/free-audit">Run a free audit</a>
      <a class="btn btn-gold" href="/en/pricing">See pricing</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow"><span class="n">/ 01</span> — REPUTATION MANAGEMENT</div>
      <h1>Your reviews are now <em>training data</em>.</h1>
      <p class="lead">When someone asks ChatGPT, Gemini or Perplexity to recommend a business, the answer is built from Google Reviews, Trustpilot, Yelp and the rest. Echorank monitors and works those platforms directly — so the machines learn the right story about you.</p>
      <div class="hero-ctas">
        <a class="btn btn-gold" href="/en/free-audit">Run a free reputation audit</a>
        <a class="btn btn-ghost" href="/en/pricing">See pricing</a>
      </div>
      <div class="hero-note">No credit card · Results in under 2 minutes</div>
    </div>
    <div class="machine" aria-hidden="true">
      <div class="sources">
        <span class="chip"><span class="dot"></span>Google Reviews <span class="meta">4.8 ★ · 312</span></span>
        <span class="chip"><span class="dot"></span>Trustpilot <span class="meta">4.6 ★</span></span>
        <span class="chip"><span class="dot"></span>Yelp <span class="meta">4.5 ★</span></span>
        <span class="chip"><span class="dot"></span>Meta <span class="meta">MENTIONS</span></span>
      </div>
      <div class="feed"></div>
      <div class="answer">
        <div class="q">User asks an AI: "best plumber near me?"</div>
        <p>Based on recent reviews, <span class="hl">Northside Plumbing</span> stands out — customers consistently mention fast response times and fair pricing, with a <span class="hl">4.8-star average across 300+ Google reviews</span>.</p>
        <div class="src">SOURCES: GOOGLE REVIEWS · TRUSTPILOT · YELP</div>
      </div>
      <div class="metrics">
        <div class="metric">
          <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="Reputation score 87 out of 100">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#262b33" stroke-width="6"/>
            <circle cx="28" cy="28" r="24" fill="none" stroke="#f0b90b" stroke-width="6" stroke-linecap="round" stroke-dasharray="131 151" transform="rotate(-90 28 28)"/>
            <text x="28" y="33" text-anchor="middle" font-size="14" font-weight="700" fill="#eaecef" font-family="Inter,sans-serif">87</text>
          </svg>
          <div><div class="lbl">Reputation score</div><div class="val">87<em> / 100</em></div></div>
        </div>
        <div class="metric">
          <svg width="86" height="40" viewBox="0 0 86 40" role="img" aria-label="Review velocity trending up 42 percent">
            <polyline points="2,33 16,29 30,31 44,23 58,19 72,12 84,6" fill="none" stroke="#0ecb81" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="84" cy="6" r="3" fill="#0ecb81"/>
          </svg>
          <div><div class="lbl">Review velocity</div><div class="val">+42%<em> 90 days</em></div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 02</span> — THE PROBLEM</div>
    <h2>A bad review used to cost you one customer. Now it gets quoted.</h2>
    <p class="lead">AI engines summarize your review history and repeat it, verbatim, to everyone who asks. Unanswered complaints, fake reviews and stale ratings don't fade anymore — they compound.</p>
    <div class="cards-3">
      <div class="pain-card">
        <div class="k">Amplified</div>
        <h3>One complaint, thousands of answers</h3>
        <p>A single unaddressed negative review can surface in AI recommendations for months, repeated to every prospect who asks.</p>
      </div>
      <div class="pain-card">
        <div class="k">Invisible</div>
        <h3>You can't see what the machines say</h3>
        <p>You'd never know an AI is steering customers to a competitor — there's no analytics dashboard for lost conversations.</p>
      </div>
      <div class="pain-card">
        <div class="k">Manual</div>
        <h3>Five platforms, zero hours to manage them</h3>
        <p>Google, Trustpilot, Meta, Yelp, TripAdvisor — each with its own inbox, its own rules, and reviews arriving at 11pm.</p>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 03</span> — COVERAGE</div>
    <h2>Every platform the AI engines learn from.</h2>
    <p class="lead">Connected once, monitored continuously. New reviews, rating changes and mentions land in one inbox with alerts you control.</p>
    <div class="plats">
      <span class="plat"><span class="dot"></span>Google Reviews <span class="tags">Monitoring · Campaigns · AI replies</span></span>
      <span class="plat"><span class="dot"></span>Trustpilot <span class="tags">Monitoring · Alerts</span></span>
      <span class="plat"><span class="dot"></span>Meta — Facebook &amp; Instagram <span class="tags">Reviews · Mentions</span></span>
      <span class="plat"><span class="dot"></span>Yelp <span class="tags">Monitoring</span></span>
      <span class="plat"><span class="dot"></span>TripAdvisor <span class="tags">Monitoring</span></span>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 04</span> — THE EXTENSION</div>
    <h2>Bring in every existing review with the browser extension.</h2>
    <div class="ext-grid">
      <div>
        <p class="lead">The Echorank browser extension imports your review history straight from the review pages you already visit — no API keys, no exports. Watch the walkthrough, install it, and your whole track record lands in one inbox.</p>
        <div class="ext-links">
          <a class="btn btn-gold" href="/en/learn/guides/install-browser-extension">Install the extension</a>
          <a class="btn btn-ghost" href="/en/free-audit">Run a free audit</a>
        </div>
      </div>
      <div>
        <video class="ext-video" controls preload="none" playsinline poster="/extension/install-video-poster.jpg">
          <source src="/extension/echorank-extension-install.mp4" type="video/mp4">
        </video>
        <div class="ext-note">2-min walkthrough · Install &amp; first import</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 05</span> — THE TOOLKIT</div>
    <h2>Twelve tools. One reputation engine.</h2>
    <div class="tools">
      <div class="tool"><div class="ic">◎</div><h3>Unified review monitoring</h3><p>Every review from every connected platform in one stream, deduplicated and tagged.</p></div>
      <div class="tool"><div class="ic">✉</div><h3>Review campaigns</h3><p>Ask happy customers at the right moment — by email, SMS or printable QR codes.</p></div>
      <div class="tool"><div class="ic">⇄</div><h3>Private feedback routing</h3><p>Catch unhappy customers before they go public. Route complaints to your team, not to Google.</p></div>
      <div class="tool"><div class="ic">✎</div><h3>AI replies in your voice</h3><p>Response drafts trained on your tone. Approve, edit or auto-send — you stay in control.</p></div>
      <div class="tool"><div class="ic">⚠</div><h3>Suspicious review detection</h3><p>Flags likely-fake and competitor-planted reviews with evidence you can use in removal requests.</p></div>
      <div class="tool"><div class="ic">◷</div><h3>Real-time alerts</h3><p>New 1-star review at 11pm? Know at 11:01. Thresholds and quiet hours are yours to set.</p></div>
      <div class="tool"><div class="ic">◔</div><h3>Sentiment analysis</h3><p>What customers actually complain about and praise, extracted from the text — not just the stars.</p></div>
      <div class="tool"><div class="ic">⚖</div><h3>Competitor benchmarking</h3><p>Your ratings, volume and velocity against named competitors, side by side.</p></div>
      <div class="tool"><div class="ic">❝</div><h3>Review widgets</h3><p>Show your best reviews on your own site with embeds that update themselves.</p></div>
      <div class="tool"><div class="ic">▤</div><h3>Digests &amp; reporting</h3><p>Weekly summaries for you, white-label PDF reports for clients and stakeholders.</p></div>
      <div class="tool"><div class="ic">◆</div><h3>AI visibility tie-in</h3><p>See how your review profile shows up inside actual AI answers — the rest of the Echorank platform.</p></div>
      <div class="tool"><div class="ic">☂</div><h3>Recovery playbooks</h3><p>Step-by-step plans for review attacks and rating drops, with progress tracked to resolution.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 06</span> — THE DIFFERENCE</div>
    <h2>Ninety days in.</h2>
    <div class="ba">
      <div class="ba-col ba-before">
        <div class="t">Without Echorank</div>
        <ul>
          <li><span class="m">×</span>Reviews discovered days late, or never</li>
          <li><span class="m">×</span>Negative reviews sit unanswered in public</li>
          <li><span class="m">×</span>Happy customers never asked to post</li>
          <li><span class="m">×</span>No idea what AI engines tell your prospects</li>
          <li><span class="m">×</span>Fake reviews stay up for lack of evidence</li>
        </ul>
        <div class="ba-chart">
          <div class="cl">Avg rating · 90 days</div>
          <svg height="48" viewBox="0 0 300 48" preserveAspectRatio="none" role="img" aria-label="Average rating declining over 90 days">
            <polyline points="0,16 50,19 100,24 150,23 200,30 250,35 300,40" fill="none" stroke="#f6465d" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="ba-col ba-after">
        <div class="t">With Echorank</div>
        <ul>
          <li><span class="m">✓</span>Every review alerted within minutes</li>
          <li><span class="m">✓</span>On-voice replies drafted and posted same day</li>
          <li><span class="m">✓</span>Steady stream of fresh reviews from campaigns</li>
          <li><span class="m">✓</span>AI answers monitored and moving your way</li>
          <li><span class="m">✓</span>Suspicious reviews flagged with removal evidence</li>
        </ul>
        <div class="ba-chart">
          <div class="cl">Avg rating · 90 days</div>
          <svg height="48" viewBox="0 0 300 48" preserveAspectRatio="none" role="img" aria-label="Average rating rising over 90 days">
            <polyline points="0,40 50,35 100,31 150,22 200,16 250,10 300,6" fill="none" stroke="#f0b90b" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="300" cy="6" r="3.5" fill="#f0b90b"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="pricing">
  <div class="wrap" style="text-align:center">
    <div class="eyebrow"><span class="n">/ 07</span> — PRICING</div>
    <h2>Simple plans. Serious coverage.</h2>
    <div class="toggle" role="group" aria-label="Billing period">
      <button type="button" id="bill-m" class="on">Monthly</button>
      <button type="button" id="bill-y">Annual <span class="save">−20%</span></button>
    </div>
    <div class="plans">
      <div class="plan">
        <div class="name">Starter</div>
        <div class="for">One location, getting serious</div>
        <div class="price">$<span class="amt" data-m="79" data-y="63">79</span><small>/mo</small></div>
        <div class="cycle" data-m="billed monthly" data-y="billed annually">billed monthly</div>
        <ul>
          <li><span class="m">✓</span>1 business location</li>
          <li><span class="m">✓</span>Google, Trustpilot, Yelp &amp; TripAdvisor monitoring</li>
          <li><span class="m">✓</span>Real-time alerts</li>
          <li><span class="m">✓</span>Review campaigns by email &amp; QR</li>
          <li><span class="m">✓</span>AI reply drafting</li>
        </ul>
        <a class="btn btn-ghost" href="/en/pricing">Choose Starter</a>
      </div>
      <div class="plan hot">
        <div class="badge">Most popular</div>
        <div class="name">Growth</div>
        <div class="for">Multi-location or high review volume</div>
        <div class="price">$<span class="amt" data-m="199" data-y="159">199</span><small>/mo</small></div>
        <div class="cycle" data-m="billed monthly" data-y="billed annually">billed monthly</div>
        <ul>
          <li><span class="m">✓</span>Everything in Starter</li>
          <li><span class="m">✓</span>Up to 5 locations</li>
          <li><span class="m">✓</span>SMS review campaigns</li>
          <li><span class="m">✓</span>Private feedback routing</li>
          <li><span class="m">✓</span>Suspicious review detection</li>
          <li><span class="m">✓</span>Competitor benchmarking</li>
        </ul>
        <a class="btn btn-gold" href="/en/pricing">Choose Growth</a>
      </div>
      <div class="plan">
        <div class="name">Agency</div>
        <div class="for">Agencies &amp; brands managing many profiles</div>
        <div class="price">$<span class="amt" data-m="499" data-y="399">499</span><small>/mo</small></div>
        <div class="cycle" data-m="billed monthly" data-y="billed annually">billed monthly</div>
        <ul>
          <li><span class="m">✓</span>Everything in Growth</li>
          <li><span class="m">✓</span>Unlimited locations &amp; client profiles</li>
          <li><span class="m">✓</span>White-label PDF reporting</li>
          <li><span class="m">✓</span>Recovery playbooks</li>
          <li><span class="m">✓</span>Full AI visibility suite included</li>
          <li><span class="m">✓</span>Priority support</li>
        </ul>
        <a class="btn btn-ghost" href="/en/pricing">Choose Agency</a>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow" style="text-align:center"><span class="n">/ 08</span> — FAQ</div>
    <h2 style="text-align:center">Questions, answered.</h2>
    <div class="faq">
      <details>
        <summary>Which review platforms does Echorank cover?<span class="plus">+</span></summary>
        <div class="a">Google Reviews (monitoring, campaigns and AI replies), Trustpilot (monitoring and alerts), Meta — Facebook &amp; Instagram (reviews and mentions), Yelp and TripAdvisor (monitoring). Coverage expands regularly.</div>
      </details>
      <details>
        <summary>Do AI replies post automatically?<span class="plus">+</span></summary>
        <div class="a">Only if you want them to. By default Echorank drafts a reply in your voice and waits for your approval. You can enable auto-posting per platform and per star rating once you trust the output.</div>
      </details>
      <details>
        <summary>How do review campaigns work?<span class="plus">+</span></summary>
        <div class="a">You import or sync customer contacts, pick a template, and Echorank sends review requests by email or SMS — or you print QR codes for the counter. Unhappy customers can be routed to a private feedback form instead of a public review page, where the platform's rules allow it.</div>
      </details>
      <details>
        <summary>Can Echorank remove fake reviews?<span class="plus">+</span></summary>
        <div class="a">No tool can guarantee removal — only the platforms decide. What Echorank does is detect suspicious patterns and assemble the evidence that makes a removal request credible, which materially improves the odds.</div>
      </details>
      <details>
        <summary>What does this have to do with AI visibility?<span class="plus">+</span></summary>
        <div class="a">AI engines build their recommendations from the same public review platforms. A managed review profile is the foundation of AI visibility — and Echorank's wider platform shows you how you actually appear inside AI answers.</div>
      </details>
      <details>
        <summary>Is there a contract or setup fee?<span class="plus">+</span></summary>
        <div class="a">No setup fees. Monthly plans cancel anytime; annual plans save 20%. Start with the free audit — no credit card required.</div>
      </details>
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <div class="eyebrow"><span class="n">/ 09</span> — START</div>
    <h2>Find out what the machines say about you.</h2>
    <p class="lead">Run the free audit. Two minutes, no credit card — you'll see your review profile the way an AI engine does.</p>
    <div class="hero-ctas">
      <a class="btn btn-gold" href="/en/free-audit">Run my free audit</a>
      <a class="btn btn-ghost" href="/en/pricing">See pricing</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>© 2026 Echorank — ChatLogic Insights Ltd</span>
    <span><a href="/en" style="color:var(--muted)">echorank360.com</a></span>
  </div>
</footer>

<script>
(function(){
  var back=document.getElementById('back-btn');
  if(back){back.addEventListener('click',function(){
    if(window.history.length>1&&document.referrer.indexOf(window.location.host)!==-1){window.history.back();}
    else{window.location.href='/en';}
  });}
  var mBtn=document.getElementById('bill-m');
  var yBtn=document.getElementById('bill-y');
  if(!mBtn||!yBtn)return;
  function setCycle(k){
    var amts=document.querySelectorAll('.amt');
    var i;
    for(i=0;i<amts.length;i++){amts[i].textContent=amts[i].getAttribute('data-'+k);}
    var cycles=document.querySelectorAll('.cycle');
    for(i=0;i<cycles.length;i++){cycles[i].textContent=cycles[i].getAttribute('data-'+k);}
    if(k==='m'){mBtn.classList.add('on');yBtn.classList.remove('on');}
    else{yBtn.classList.add('on');mBtn.classList.remove('on');}
  }
  mBtn.addEventListener('click',function(){setCycle('m');});
  yBtn.addEventListener('click',function(){setCycle('y');});
})();
</script>

</body>
</html>`;
