// Generated 2026-08-08: standalone Technical GEO landing page markup.
// Served verbatim by ./route.ts — full HTML document, self-contained styling.
export const TECHNICAL_GEO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Audit and improve your AI search visibility with Echorank. Run a free audit, see why AI engines skip your brand, fix it with 22 SEO tools, and measure the change." />
  <meta name="theme-color" content="#181A20" />
  <title>Technical GEO &amp; AI Visibility | Echorank</title>

  <style>
    :root{
      --bg:#181A20;
      --bg-2:#1E2329;
      --surface:#1E2329;
      --surface-2:#2B3139;
      --line:#2B3139;
      --line-soft:rgba(255,255,255,.07);
      --text:#EAECEF;
      --muted:#848E9C;
      --yellow:#FCD535;
      --yellow-2:#F0B90B;
      --green:#0ECB81;
      --red:#F6465D;
      --radius:16px;
      --shadow:0 18px 60px rgba(0,0,0,.45);
      --max:1180px;
    }

    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto} *{transition:none!important;animation:none!important}}
    body{
      margin:0;
      color:var(--text);
      background:
        radial-gradient(circle at 18% -4%, rgba(240,185,11,.07), transparent 32%),
        radial-gradient(circle at 88% 6%, rgba(252,213,53,.05), transparent 26%),
        var(--bg);
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      line-height:1.6;
    }

    a{color:inherit;text-decoration:none}
    a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--yellow);outline-offset:3px;border-radius:6px}
    img,svg{max-width:100%}
    .container{width:min(var(--max),calc(100% - 40px));margin-inline:auto}
    .section{padding:92px 0}
    .section-tight{padding:64px 0}

    .eyebrow{
      display:inline-flex;gap:8px;align-items:center;
      padding:7px 12px;
      border:1px solid rgba(240,185,11,.35);
      background:rgba(240,185,11,.08);
      border-radius:999px;
      color:var(--yellow);
      font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    }
    .eyebrow:before{
      content:"";width:7px;height:7px;border-radius:50%;
      background:var(--yellow);box-shadow:0 0 14px rgba(252,213,53,.8);
    }

    h1,h2,h3,p{margin-top:0}
    h1{font-size:clamp(42px,6.6vw,76px);line-height:1.0;letter-spacing:-.045em;max-width:980px;margin:24px auto 24px}
    h2{font-size:clamp(32px,4.6vw,52px);line-height:1.05;letter-spacing:-.035em;margin-bottom:18px}
    h3{font-size:20px;line-height:1.3;letter-spacing:-.015em}
    .lead{font-size:clamp(17px,2vw,21px);color:#B7BDC6;max-width:820px}
    .muted{color:var(--muted)}
    .center{text-align:center}
    .center .lead{margin-left:auto;margin-right:auto}

    .nav{
      position:sticky;top:0;z-index:30;
      backdrop-filter:blur(16px);
      background:rgba(24,26,32,.85);
      border-bottom:1px solid var(--line);
    }
    .nav-inner{height:70px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{display:flex;align-items:center;gap:11px;font-weight:800;letter-spacing:.08em;font-size:18px}
    .brand-mark{
      width:22px;height:22px;flex:none;border-radius:5px;
      background:linear-gradient(135deg,var(--yellow),var(--yellow-2));
      transform:rotate(45deg);
      box-shadow:0 4px 16px rgba(240,185,11,.35);
    }
    .nav-links{display:flex;align-items:center;gap:24px;font-size:14px;color:#B7BDC6}
    .nav-links a:hover{color:#fff}
    .nav-actions{display:flex;align-items:center;gap:10px}

    .btn{
      display:inline-flex;align-items:center;justify-content:center;
      min-height:46px;padding:0 20px;border-radius:10px;
      font-weight:700;border:1px solid transparent;cursor:pointer;
      transition:transform .15s ease,background .15s ease,border-color .15s ease;
    }
    .btn:hover{transform:translateY(-1px)}
    .btn-primary{color:#181A20;background:linear-gradient(135deg,var(--yellow),var(--yellow-2));box-shadow:0 12px 32px rgba(240,185,11,.22)}
    .btn-primary:hover{background:var(--yellow)}
    .btn-secondary{color:#EAECEF;border-color:var(--surface-2);background:rgba(255,255,255,.03)}
    .btn-secondary:hover{border-color:#3a424c}
    .btn-sm{min-height:38px;padding:0 14px;border-radius:9px;font-size:14px}

    .hero{padding:92px 0 78px;text-align:center;overflow:hidden}
    .hero h1 span{
      background:linear-gradient(92deg,#fff 20%,var(--yellow) 75%,var(--yellow-2));
      -webkit-background-clip:text;background-clip:text;color:transparent;
    }
    .hero-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:32px}
    .micro{font-size:13px;color:var(--muted);margin-top:14px}

    /* ---------- dashboard mock ---------- */
    .dashboard{
      margin:60px auto 0;padding:1px;border-radius:20px;max-width:1050px;
      background:linear-gradient(135deg,rgba(252,213,53,.4),rgba(240,185,11,.08) 45%,rgba(252,213,53,.22));
      box-shadow:var(--shadow);
    }
    .dashboard-inner{
      border-radius:19px;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent 30%),var(--surface);
      padding:22px;text-align:left;
    }
    .dash-top{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
    .dash-title{font-weight:800}
    .status{display:inline-flex;align-items:center;gap:8px;color:var(--green);font-size:13px}
    .status i{width:8px;height:8px;border-radius:50%;background:var(--green);display:block}
    .dash-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
    .panel{
      border:1px solid var(--line-soft);border-radius:14px;
      background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
      padding:18px;
    }
    .panel-label{font-size:12px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;font-weight:700}
    .score-row{display:flex;gap:22px;align-items:center;margin:14px 0 6px;flex-wrap:wrap}
    .gauge{flex:none}
    .gauge text{font-family:inherit}
    .score-meta{min-width:180px;flex:1}
    .delta{color:var(--green);font-size:13px;font-weight:700}
    .engines{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px}
    .engine{
      padding:10px 12px;border-radius:10px;border:1px solid var(--line-soft);
      background:rgba(255,255,255,.02);font-size:12px;color:#B7BDC6;
    }
    .engine b{display:block;color:#fff;font-size:16px;margin-top:2px}
    .engine .mini{height:4px;border-radius:99px;background:var(--surface-2);margin-top:7px;overflow:hidden}
    .engine .mini span{display:block;height:100%;background:linear-gradient(90deg,var(--yellow-2),var(--yellow));border-radius:inherit}
    .issues{display:grid;gap:9px}
    .issue{
      padding:12px;border-radius:10px;border:1px solid var(--line-soft);
      background:rgba(255,255,255,.02);display:flex;gap:10px;align-items:flex-start;
    }
    .issue-badge{font-size:11px;font-weight:800;padding:4px 7px;border-radius:7px;white-space:nowrap}
    .issue-badge.high{background:rgba(246,70,93,.12);color:var(--red)}
    .issue-badge.med{background:rgba(240,185,11,.12);color:var(--yellow)}
    .issue strong{display:block;font-size:13px}
    .issue small{color:var(--muted)}
    .sparkline-panel{margin-top:16px}

    .logo-strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.015)}
    .logo-row{
      min-height:82px;display:flex;align-items:center;justify-content:center;gap:36px;flex-wrap:wrap;
      color:#848E9C;font-size:13px;text-transform:uppercase;letter-spacing:.16em;font-weight:800;
    }

    .intro-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}
    .bullet-list{display:grid;gap:13px;margin-top:26px}
    .bullet{display:flex;gap:12px;align-items:flex-start;color:#B7BDC6}
    .check{
      flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
      background:rgba(252,213,53,.1);color:var(--yellow);font-weight:900;font-size:12px;
      border:1px solid rgba(252,213,53,.2);margin-top:1px;
    }

    .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:42px}
    .step{
      position:relative;padding:26px;border:1px solid var(--line-soft);border-radius:var(--radius);
      background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
      min-height:290px;overflow:hidden;
    }
    .step-no{font-size:12px;font-weight:900;color:var(--yellow);letter-spacing:.14em;text-transform:uppercase;margin-bottom:38px}
    .step h3{font-size:23px}
    .step p{color:var(--muted)}
    .step:after{
      content:"";position:absolute;width:110px;height:110px;right:-24px;bottom:-24px;border-radius:50%;
      background:radial-gradient(circle,rgba(240,185,11,.12),transparent 68%);pointer-events:none;
    }

    .feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:40px}
    .feature-card{
      border-radius:var(--radius);border:1px solid var(--line-soft);
      background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
      padding:28px;overflow:hidden;min-height:270px;position:relative;
    }
    .feature-card.large{grid-column:span 2;min-height:300px}
    .icon{
      width:42px;height:42px;border-radius:11px;display:grid;place-items:center;
      background:rgba(252,213,53,.09);border:1px solid rgba(252,213,53,.18);
      font-size:19px;margin-bottom:34px;color:var(--yellow);
    }
    .feature-card p{color:var(--muted);max-width:690px}
    .pill-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
    .pill{
      padding:7px 10px;border-radius:999px;border:1px solid var(--line-soft);
      background:rgba(255,255,255,.02);font-size:12px;color:#B7BDC6;
    }
    .pill.new{border-color:rgba(14,203,129,.35);color:var(--green)}

    /* AI Lens diagram */
    .lens-diagram{margin-top:22px;border-radius:12px;border:1px solid var(--line-soft);background:rgba(0,0,0,.18);padding:10px}

    .compare{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:40px}
    .compare-card{border:1px solid var(--line-soft);border-radius:var(--radius);padding:26px;background:rgba(255,255,255,.02)}
    .bars{display:grid;gap:13px;margin-top:22px}
    .bar-row{display:grid;grid-template-columns:130px 1fr 44px;gap:12px;align-items:center;font-size:13px;color:#B7BDC6}
    .bar-row b{color:#fff;text-align:right}
    .bar-bg{height:8px;border-radius:999px;background:var(--surface-2);overflow:hidden}
    .bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--yellow-2),var(--yellow))}
    .bar-fill.alt{background:linear-gradient(90deg,#0ECB81,#66e2b0)}
    .list-card{display:grid;gap:9px;margin-top:18px}
    .fix{
      display:flex;justify-content:space-between;gap:18px;align-items:center;
      padding:13px;border-radius:10px;border:1px solid var(--line-soft);
      background:rgba(255,255,255,.02);font-size:13px;
    }
    .impact{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--yellow)}

    .tools-groups{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:40px}
    .tool-group{
      border:1px solid var(--line-soft);border-radius:14px;padding:20px;
      background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));
    }
    .tool-group h3{font-size:15px;margin-bottom:12px;color:#fff}
    .tool-group .pill-row{margin-top:0}

    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
    .stat{
      border:1px solid var(--line-soft);border-radius:16px;padding:28px;
      background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));
    }
    .stat strong{display:block;font-size:50px;line-height:1;letter-spacing:-.04em;margin-bottom:10px;color:var(--yellow)}
    .stat span{color:var(--muted)}

    .pricing-band{
      border:1px solid rgba(240,185,11,.25);border-radius:24px;padding:46px;
      background:
        radial-gradient(circle at 85% 15%,rgba(252,213,53,.08),transparent 30%),
        radial-gradient(circle at 8% 92%,rgba(240,185,11,.07),transparent 26%),
        var(--surface);
      display:grid;grid-template-columns:1.1fr .9fr;gap:38px;align-items:center;
      box-shadow:var(--shadow);
    }
    .price-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .price-card{
      padding:16px;border-radius:12px;border:1px solid var(--line-soft);
      background:rgba(255,255,255,.02);font-size:13px;color:#B7BDC6;
    }
    .price-card b{display:block;color:#fff;font-size:22px;letter-spacing:-.02em;margin-top:4px}
    .price-card small{color:var(--muted)}
    .price-card.hot{border-color:rgba(252,213,53,.4);background:rgba(252,213,53,.05)}
    .price-card .tag{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--yellow)}

    .resources{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
    .resource{
      border:1px solid var(--line-soft);border-radius:16px;padding:24px;
      background:rgba(255,255,255,.02);transition:transform .15s ease,border-color .15s ease;display:block;
    }
    .resource:hover{transform:translateY(-3px);border-color:rgba(252,213,53,.35)}
    .resource small{color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:800;font-size:11px}
    .resource h3{margin:30px 0 10px}
    .resource p{color:var(--muted);font-size:14px}
    .resource .go{color:var(--yellow);font-weight:800;font-size:14px}

    .faq{max-width:900px;margin:36px auto 0}
    details{border-bottom:1px solid var(--line)}
    summary{
      list-style:none;cursor:pointer;padding:20px 44px 20px 0;
      font-size:17px;font-weight:700;position:relative;
    }
    summary::-webkit-details-marker{display:none}
    summary:after{
      content:"+";position:absolute;right:0;top:17px;width:28px;height:28px;border-radius:50%;
      display:grid;place-items:center;border:1px solid var(--surface-2);color:#B7BDC6;
    }
    details[open] summary:after{content:"–";color:var(--yellow);border-color:rgba(252,213,53,.4)}
    details p{color:var(--muted);padding:0 44px 20px 0;margin:0}

    .final-cta{
      margin-top:28px;border-radius:24px;padding:72px 30px;text-align:center;
      background:
        radial-gradient(circle at 50% 0%,rgba(252,213,53,.12),transparent 36%),
        var(--surface);
      border:1px solid rgba(252,213,53,.2);box-shadow:var(--shadow);
    }
    .final-cta h2{max-width:860px;margin-left:auto;margin-right:auto}
    .final-cta .lead{margin-left:auto;margin-right:auto}

    .cta-inline{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:38px}
    .price-card .btn{width:100%;margin-top:14px;min-height:40px;font-size:14px;border-radius:9px}
    .dash-cta{display:flex;justify-content:flex-end;margin-top:16px}

    .sticky-cta{
      position:fixed;left:0;right:0;bottom:0;z-index:40;display:none;
      padding:10px 14px calc(10px + env(safe-area-inset-bottom));
      background:rgba(24,26,32,.94);backdrop-filter:blur(14px);
      border-top:1px solid var(--line);
    }
    .sticky-cta .btn{width:100%}

    footer{padding:42px 0 52px;color:#848E9C;font-size:13px}
    .footer-inner{
      display:flex;justify-content:space-between;gap:26px;align-items:center;flex-wrap:wrap;
      border-top:1px solid var(--line);padding-top:26px;
    }
    .footer-links{display:flex;gap:20px;flex-wrap:wrap}
    .footer-links a:hover{color:#fff}

    @media(max-width:960px){
      .nav-links{display:none}
      .dash-grid,.intro-grid,.compare,.pricing-band{grid-template-columns:1fr}
      .steps,.resources,.stats,.tools-groups{grid-template-columns:1fr}
      .feature-grid{grid-template-columns:1fr}
      .feature-card.large{grid-column:auto}
    }
    @media(max-width:640px){
      .container{width:min(100% - 24px,var(--max))}
      .section{padding:64px 0}
      .hero{padding-top:66px}
      .nav-actions .btn-secondary{display:none}
      .dashboard-inner{padding:14px}
      .engines{grid-template-columns:1fr 1fr}
      .bar-row{grid-template-columns:100px 1fr 40px}
      .pricing-band{padding:26px}
      .price-cards{grid-template-columns:1fr}
      .feature-card,.step{padding:22px}
      .sticky-cta{display:block}
      body{padding-bottom:74px}
    }
  </style>
</head>

<body>
  <header class="nav">
    <div class="container nav-inner">
      <a class="brand" href="/en/" aria-label="Echorank home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>ECHORANK</span>
      </a>

      <nav class="nav-links" aria-label="Primary">
        <a href="#workflow">How it works</a>
        <a href="#features">Features</a>
        <a href="#tools">SEO Tools</a>
        <a href="/en/pricing">Pricing</a>
        <a href="/en/learn">Learn</a>
        <a href="#faq">FAQ</a>
      </nav>

      <div class="nav-actions">
        <a class="btn btn-secondary btn-sm" href="/en/pricing">See plans</a>
        <a class="btn btn-primary btn-sm" href="/en/ai-visibility#audit">Run free audit</a>
      </div>
    </div>
  </header>

  <main id="top">
    <section class="hero">
      <div class="container">
        <div class="eyebrow">Technical GEO &amp; AI visibility</div>
        <h1><span>Fix the issues keeping your brand out of AI answers.</span></h1>
        <p class="lead">
          Echorank shows you why ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews,
          and Copilot aren&rsquo;t citing your brand&mdash;then gives you the tools to fix it and
          measure the change.
        </p>

        <div class="hero-actions" id="audit">
          <a class="btn btn-primary" href="/en/ai-visibility#audit">Run your free AI visibility audit</a>
          <a class="btn btn-secondary" href="/en/pricing">See plans</a>
        </div>
        <div class="micro">One free audit every day &middot; No account needed &middot; Downloadable PDF report</div>

        <div class="dashboard" aria-label="Echorank audit dashboard illustration">
          <div class="dashboard-inner">
            <div class="dash-top">
              <div>
                <div class="panel-label">AI Visibility Audit</div>
                <div class="dash-title">example.com</div>
              </div>
              <div class="status"><i></i> Audit complete</div>
            </div>

            <div class="dash-grid">
              <div class="panel">
                <div class="panel-label">Visibility score</div>
                <div class="score-row">
                  <!-- SVG donut gauge -->
                  <svg class="gauge" width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Visibility score 72 of 100">
                    <circle cx="75" cy="75" r="62" fill="none" stroke="#2B3139" stroke-width="13"/>
                    <circle cx="75" cy="75" r="62" fill="none" stroke="url(#gaugeGrad)" stroke-width="13"
                            stroke-linecap="round" stroke-dasharray="280.5 389.5"
                            transform="rotate(-90 75 75)"/>
                    <defs>
                      <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="#F0B90B"/>
                        <stop offset="1" stop-color="#FCD535"/>
                      </linearGradient>
                    </defs>
                    <text x="75" y="72" text-anchor="middle" fill="#EAECEF" font-size="38" font-weight="800" letter-spacing="-2">72</text>
                    <text x="75" y="94" text-anchor="middle" fill="#848E9C" font-size="12">/ 100</text>
                  </svg>
                  <div class="score-meta">
                    <div class="delta">▲ +11 this month</div>
                    <p class="muted" style="font-size:13px;margin:8px 0 0">
                      Combined signal across content depth, structure, freshness, authority,
                      and how AI crawlers actually see your pages.
                    </p>
                  </div>
                </div>

                <div class="engines" aria-label="Per-engine visibility">
                  <div class="engine">ChatGPT <b>68%</b><div class="mini"><span style="width:68%"></span></div></div>
                  <div class="engine">Perplexity <b>81%</b><div class="mini"><span style="width:81%"></span></div></div>
                  <div class="engine">Gemini <b>66%</b><div class="mini"><span style="width:66%"></span></div></div>
                  <div class="engine">Claude <b>74%</b><div class="mini"><span style="width:74%"></span></div></div>
                  <div class="engine">AI Overviews <b>70%</b><div class="mini"><span style="width:70%"></span></div></div>
                  <div class="engine">Copilot <b>73%</b><div class="mini"><span style="width:73%"></span></div></div>
                </div>

                <div class="panel sparkline-panel" style="padding:14px">
                  <div class="panel-label">Mention rate &mdash; last 30 days</div>
                  <!-- SVG sparkline -->
                  <svg width="100%" height="70" viewBox="0 0 420 70" preserveAspectRatio="none" role="img" aria-label="Mention rate trending upward">
                    <defs>
                      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="rgba(252,213,53,.25)"/>
                        <stop offset="1" stop-color="rgba(252,213,53,0)"/>
                      </linearGradient>
                    </defs>
                    <path d="M0,52 L30,50 L60,54 L90,46 L120,48 L150,40 L180,42 L210,34 L240,37 L270,28 L300,30 L330,22 L360,24 L390,16 L420,14 L420,70 L0,70 Z" fill="url(#sparkFill)"/>
                    <path d="M0,52 L30,50 L60,54 L90,46 L120,48 L150,40 L180,42 L210,34 L240,37 L270,28 L300,30 L330,22 L360,24 L390,16 L420,14" fill="none" stroke="#FCD535" stroke-width="2.5" stroke-linejoin="round"/>
                    <circle cx="420" cy="14" r="4" fill="#FCD535"/>
                  </svg>
                </div>
              </div>

              <div class="panel">
                <div class="panel-label">Highest-impact opportunities</div>
                <div class="issues" style="margin-top:14px">
                  <div class="issue">
                    <span class="issue-badge high">High</span>
                    <div><strong>Add FAQPage structured data</strong><small>Key pages ship no machine-readable Q&amp;A</small></div>
                  </div>
                  <div class="issue">
                    <span class="issue-badge high">High</span>
                    <div><strong>Close the AI Lens gap</strong><small>18% of your content is invisible to non-JS crawlers</small></div>
                  </div>
                  <div class="issue">
                    <span class="issue-badge med">Med</span>
                    <div><strong>Refresh outdated stats</strong><small>7 citations are older than 24 months</small></div>
                  </div>
                  <div class="issue">
                    <span class="issue-badge med">Med</span>
                    <div><strong>Improve answer structure</strong><small>Make high-value sections easier to extract</small></div>
                  </div>
                  <div class="issue">
                    <span class="issue-badge med">Med</span>
                    <div><strong>Thin About / FAQ pages</strong><small>Entity signals below competitor baseline</small></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="dash-cta">
              <a class="btn btn-primary btn-sm" href="/en/ai-visibility#audit">Audit your own site free →</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="logo-strip">
      <div class="container logo-row">
        <span>ChatGPT</span>
        <span>Claude</span>
        <span>Perplexity</span>
        <span>Gemini</span>
        <span>AI Overviews</span>
        <span>Copilot</span>
      </div>
    </div>

    <section class="section">
      <div class="container intro-grid">
        <div>
          <div class="eyebrow">SEO evolved</div>
          <h2>Technical SEO built for the AI search era.</h2>
        </div>
        <div>
          <p class="lead">
            Ranking on Google is no longer the whole picture. Your website can perform well in traditional search
            and still be overlooked when customers ask AI engines for recommendations.
          </p>
          <div class="bullet-list">
            <div class="bullet"><span class="check">✓</span><span>Measure how visible your brand is across the six major AI answer engines.</span></div>
            <div class="bullet"><span class="check">✓</span><span>See exactly what AI crawlers read on your pages&mdash;and what they miss&mdash;with AI Lens.</span></div>
            <div class="bullet"><span class="check">✓</span><span>Prioritize fixes by likely impact, then track mention rate and rankings over time.</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="workflow">
      <div class="container">
        <div class="center">
          <div class="eyebrow">Three-step workflow</div>
          <h2>From invisible to cited.</h2>
          <p class="lead">Build a repeatable GEO workflow around measurement, diagnosis, and improvement.</p>
        </div>

        <div class="steps">
          <article class="step">
            <div class="step-no">Step 01 &mdash; Audit</div>
            <h3>Audit your AI search visibility</h3>
            <p>
              Run a free audit on any domain&mdash;no account needed. Get a visibility score,
              a check-by-check breakdown, robots and structured-data findings, and a
              branded PDF report you can share.
            </p>
          </article>

          <article class="step">
            <div class="step-no">Step 02 &mdash; Diagnose</div>
            <h3>Find what limits your visibility</h3>
            <p>
              AI Lens compares your raw HTML against the fully rendered page to reveal content
              AI crawlers never see. Custom Prompts and Brand Radar show how engines actually
              talk about your brand today.
            </p>
          </article>

          <article class="step">
            <div class="step-no">Step 03 &mdash; Optimize</div>
            <h3>Fix, monitor, and measure impact</h3>
            <p>
              Work through prioritized fixes with the SEO Tools hub&mdash;site crawler, rank tracker,
              keywords, backlinks&mdash;while scheduled monitoring and alert digests track how your
              AI visibility changes.
            </p>
          </article>
        </div>

        <div class="cta-inline">
          <a class="btn btn-primary" href="/en/ai-visibility#audit">Start with a free audit</a>
          <a class="btn btn-secondary" href="/en/pricing">Compare plans</a>
        </div>
      </div>
    </section>

    <section class="section" id="features">
      <div class="container">
        <div class="center">
          <div class="eyebrow">Go beyond rankings</div>
          <h2>Optimize for AI answers, not just positions.</h2>
          <p class="lead">
            Traditional SEO tells you where you rank. Echorank tells you whether AI engines
            can read, trust, and mention your brand when generating an answer.
          </p>
        </div>

        <div class="feature-grid">
          <article class="feature-card">
            <div class="icon">◎</div>
            <h3>AI Visibility Audit</h3>
            <p>
              Score any site against the signals that matter in generative search: structure,
              structured data, freshness, crawlability, and answer-ready content. Re-run audits
              as you ship fixes and export polished PDF reports.
            </p>
            <div class="pill-row">
              <span class="pill">Free daily audit</span>
              <span class="pill">Check-by-check breakdown</span>
              <span class="pill">PDF reports</span>
            </div>
          </article>

          <article class="feature-card">
            <div class="icon">◉</div>
            <h3>Brand Radar &amp; Custom Prompts</h3>
            <p>
              Track how AI engines answer the prompts that matter to your business. Watch mention
              rate and trust trends over time, add your own prompts, and get alert digests when
              answers shift.
            </p>
            <div class="pill-row">
              <span class="pill">Prompt trends</span>
              <span class="pill">Scheduled monitoring</span>
              <span class="pill">Alert digests</span>
            </div>
          </article>

          <article class="feature-card large">
            <div class="icon">⌖</div>
            <h3>AI Lens: see your site the way AI crawlers do.</h3>
            <p>
              Most AI crawlers don&rsquo;t execute JavaScript. AI Lens diffs your raw HTML against the fully
              rendered page and quantifies the gap&mdash;so you know exactly which content is invisible to
              the engines you&rsquo;re trying to reach, page by page.
            </p>

            <!-- AI Lens diagram -->
            <div class="lens-diagram">
              <svg width="100%" height="190" viewBox="0 0 900 190" role="img" aria-label="AI Lens compares raw HTML with the rendered page and reports the visibility gap">
                <!-- raw column -->
                <rect x="20" y="25" width="250" height="140" rx="12" fill="#181A20" stroke="#2B3139"/>
                <text x="145" y="52" text-anchor="middle" fill="#EAECEF" font-size="14" font-weight="700">Raw HTML</text>
                <text x="145" y="70" text-anchor="middle" fill="#848E9C" font-size="11">what AI crawlers fetch</text>
                <rect x="45" y="88" width="200" height="9" rx="4" fill="#2B3139"/>
                <rect x="45" y="106" width="160" height="9" rx="4" fill="#2B3139"/>
                <rect x="45" y="124" width="185" height="9" rx="4" fill="#2B3139"/>
                <rect x="45" y="142" width="120" height="9" rx="4" fill="#2B3139"/>
                <!-- rendered column -->
                <rect x="330" y="25" width="250" height="140" rx="12" fill="#181A20" stroke="#2B3139"/>
                <text x="455" y="52" text-anchor="middle" fill="#EAECEF" font-size="14" font-weight="700">Rendered page</text>
                <text x="455" y="70" text-anchor="middle" fill="#848E9C" font-size="11">what your visitors see</text>
                <rect x="355" y="88" width="200" height="9" rx="4" fill="#2B3139"/>
                <rect x="355" y="106" width="160" height="9" rx="4" fill="#2B3139"/>
                <rect x="355" y="124" width="185" height="9" rx="4" fill="#F6465D" opacity=".65"/>
                <rect x="355" y="142" width="200" height="9" rx="4" fill="#F6465D" opacity=".65"/>
                <!-- arrows -->
                <path d="M280 95 L322 95" stroke="#FCD535" stroke-width="2.5" marker-end="url(#arr)"/>
                <path d="M590 95 L632 95" stroke="#FCD535" stroke-width="2.5" marker-end="url(#arr)"/>
                <defs>
                  <marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="#FCD535"/>
                  </marker>
                </defs>
                <!-- result -->
                <rect x="642" y="25" width="238" height="140" rx="12" fill="rgba(252,213,53,.06)" stroke="rgba(252,213,53,.35)"/>
                <text x="761" y="56" text-anchor="middle" fill="#FCD535" font-size="13" font-weight="800" letter-spacing="1">VISIBILITY GAP</text>
                <text x="761" y="105" text-anchor="middle" fill="#EAECEF" font-size="40" font-weight="800" letter-spacing="-2">18%</text>
                <text x="761" y="132" text-anchor="middle" fill="#848E9C" font-size="11">of content invisible to AI crawlers</text>
              </svg>
            </div>
          </article>

          <article class="feature-card">
            <div class="icon">▤</div>
            <h3>Reports &amp; exports</h3>
            <p>
              Audit, monitoring, and intelligence reports as branded PDFs. CSV export on every
              tool table. Built for agencies that report to clients.
            </p>
            <div class="pill-row">
              <span class="pill">PDF report builder</span>
              <span class="pill">CSV export</span>
              <span class="pill">White-label on Agency</span>
            </div>
          </article>

          <article class="feature-card">
            <div class="icon">⚙</div>
            <h3>API &amp; MCP Server</h3>
            <p>
              Pull keyword suggestions, latest audits, and visibility summaries through a public
              REST API&mdash;or connect your own AI assistant straight to your data via the built-in
              MCP server.
            </p>
            <div class="pill-row">
              <span class="pill">Tenant-scoped API keys</span>
              <span class="pill new">MCP Server</span>
              <span class="pill">60 req/min</span>
            </div>
          </article>
        </div>

        <div class="cta-inline">
          <a class="btn btn-primary" href="/en/pricing">Start your 7-day free trial</a>
        </div>
      </div>
    </section>

    <section class="section" id="tools">
      <div class="container">
        <div class="center">
          <div class="eyebrow">Classic SEO Tools</div>
          <h2>22 tools. One hub. AI visibility plus everything else.</h2>
          <p class="lead">
            GEO doesn&rsquo;t replace SEO&mdash;it builds on it. The SEO Tools hub covers the full stack,
            from crawling and rankings to content and reporting.
          </p>
        </div>

        <div class="tools-groups">
          <div class="tool-group">
            <h3>Search Marketing</h3>
            <div class="pill-row">
              <span class="pill">Site Explorer</span>
              <span class="pill">Keywords Explorer</span>
              <span class="pill">Rank Tracker</span>
              <span class="pill">SERP Checker</span>
              <span class="pill">Backlinks</span>
              <span class="pill">GSC Insights</span>
              <span class="pill">Brand Radar</span>
              <span class="pill new">AI Lens</span>
              <span class="pill">Custom Prompts</span>
            </div>
          </div>
          <div class="tool-group">
            <h3>Website Performance</h3>
            <div class="pill-row">
              <span class="pill">Site Audit &amp; Crawler</span>
              <span class="pill">Lighthouse</span>
              <span class="pill">Web Analytics</span>
              <span class="pill new">Bot Analytics</span>
            </div>
          </div>
          <div class="tool-group">
            <h3>Content Marketing</h3>
            <div class="pill-row">
              <span class="pill">Content Explorer</span>
              <span class="pill">AI Content Helper</span>
              <span class="pill">Social Media Manager</span>
            </div>
          </div>
          <div class="tool-group">
            <h3>Reporting</h3>
            <div class="pill-row">
              <span class="pill">Dashboard</span>
              <span class="pill">Portfolios</span>
              <span class="pill">Report Builder</span>
            </div>
          </div>
          <div class="tool-group">
            <h3>Local SEO</h3>
            <div class="pill-row">
              <span class="pill new">GBP Monitor</span>
              <span class="pill">Competitor snapshots</span>
            </div>
          </div>
          <div class="tool-group">
            <h3>Developers</h3>
            <div class="pill-row">
              <span class="pill">Access API</span>
              <span class="pill new">MCP Server</span>
            </div>
          </div>
        </div>

        <div class="cta-inline">
          <a class="btn btn-primary" href="/en/pricing">Unlock all 22 tools</a>
          <a class="btn btn-secondary" href="/en/free-tools">Try the free tools</a>
        </div>
      </div>
    </section>

    <section class="section-tight">
      <div class="container">
        <div class="center">
          <div class="eyebrow">Competitive intelligence</div>
          <h2>See why competitors get cited&mdash;and you don&rsquo;t.</h2>
          <p class="lead">
            Compare content signals, authority indicators, and visibility across the queries
            that matter to your market.
          </p>
        </div>

        <div class="compare">
          <article class="compare-card">
            <div class="panel-label">Competitor X-Ray</div>
            <h3 style="margin-top:8px">Signal comparison</h3>
            <div class="bars">
              <div class="bar-row">
                <span>Content depth</span>
                <div class="bar-bg"><div class="bar-fill" style="width:74%"></div></div><b>74</b>
              </div>
              <div class="bar-row">
                <span>Authority</span>
                <div class="bar-bg"><div class="bar-fill" style="width:63%"></div></div><b>63</b>
              </div>
              <div class="bar-row">
                <span>Evidence</span>
                <div class="bar-bg"><div class="bar-fill alt" style="width:82%"></div></div><b>82</b>
              </div>
              <div class="bar-row">
                <span>Freshness</span>
                <div class="bar-bg"><div class="bar-fill" style="width:58%"></div></div><b>58</b>
              </div>
              <div class="bar-row">
                <span>Crawler visibility</span>
                <div class="bar-bg"><div class="bar-fill" style="width:82%"></div></div><b>82</b>
              </div>
            </div>
          </article>

          <article class="compare-card">
            <div class="panel-label">Quick wins</div>
            <h3 style="margin-top:8px">Highest-impact fixes</h3>
            <div class="list-card">
              <div class="fix"><span>Ship FAQPage &amp; Organization structured data</span><span class="impact">High</span></div>
              <div class="fix"><span>Surface JS-only content to raw HTML</span><span class="impact">High</span></div>
              <div class="fix"><span>Refresh outdated supporting statistics</span><span class="impact">High</span></div>
              <div class="fix"><span>Expand thin About and FAQ pages</span><span class="impact">Medium</span></div>
              <div class="fix"><span>Improve heading and answer structure</span><span class="impact">Medium</span></div>
            </div>
          </article>
        </div>

        <div class="cta-inline">
          <a class="btn btn-primary" href="/en/ai-visibility#audit">See your gaps — run a free audit</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container center">
        <div class="eyebrow">Data-led GEO</div>
        <h2>Don&rsquo;t just measure AI visibility. Improve it.</h2>
        <p class="lead">
          Audit your visibility. Understand your gaps. Prioritize the right fixes. Measure what changes. Repeat.
        </p>

        <div class="stats">
          <article class="stat">
            <strong>6</strong>
            <span>Major AI answer engines monitored</span>
          </article>
          <article class="stat">
            <strong>22</strong>
            <span>SEO &amp; AI visibility tools in one hub</span>
          </article>
          <article class="stat">
            <strong>1/day</strong>
            <span>Free AI visibility audit &mdash; no account needed</span>
          </article>
        </div>
      </div>
    </section>

    <section class="section" id="pricing">
      <div class="container">
        <div class="pricing-band">
          <div>
            <div class="eyebrow">Simple pricing</div>
            <h2 style="margin-top:20px">Start at $29/mo. Scale when you&rsquo;re ready.</h2>
            <p class="lead">
              Every paid plan starts with a 7-day free trial. Cancel any time during the trial
              at no charge. Save up to 20% on annual billing.
            </p>
            <div class="hero-actions" style="justify-content:flex-start;margin-top:24px">
              <a class="btn btn-primary" href="/en/pricing">See plans &amp; start trial</a>
              <a class="btn btn-secondary" href="/en/ai-visibility#audit">Run a free audit first</a>
            </div>
          </div>

          <div class="price-cards">
            <div class="price-card hot">
              <span class="tag">AI Visibility</span>
              <b>$29<small>/mo</small></b>
              <small>$24/mo billed annually &middot; audits, AI Lens, prompts</small>
              <a class="btn btn-primary" href="/en/pricing">Start free trial</a>
            </div>
            <div class="price-card">
              <span class="tag">Starter</span>
              <b>$79<small>/mo</small></b>
              <small>$63/mo billed annually &middot; full reputation suite</small>
              <a class="btn btn-secondary" href="/en/pricing">Start free trial</a>
            </div>
            <div class="price-card">
              <span class="tag">Growth</span>
              <b>$199<small>/mo</small></b>
              <small>$159/mo billed annually &middot; intelligence + 5 seats</small>
              <a class="btn btn-secondary" href="/en/pricing">Start free trial</a>
            </div>
            <div class="price-card">
              <span class="tag">Agency</span>
              <b>$499<small>/mo</small></b>
              <small>$399/mo billed annually &middot; white-label, 20 locations</small>
              <a class="btn btn-secondary" href="/en/pricing">Start free trial</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="center">
          <div class="eyebrow">Learn GEO</div>
          <h2>Resources for improving AI visibility.</h2>
        </div>

        <div class="resources">
          <a class="resource" href="/en/learn">
            <small>Course</small>
            <h3>Learn Reputation &amp; AI Visibility</h3>
            <p>A free 10-chapter course covering how AI engines pick sources, and how to earn your place in their answers.</p>
            <span class="go">Start the course →</span>
          </a>

          <a class="resource" href="/en/learn/guides/ai-lens-content-gap">
            <small>Guide</small>
            <h3>Closing the AI Lens Content Gap</h3>
            <p>Find the content AI crawlers can&rsquo;t see, understand why, and bring it into the raw HTML they actually read.</p>
            <span class="go">Read the guide →</span>
          </a>

          <a class="resource" href="/en/free-tools">
            <small>Free tools</small>
            <h3>Free SEO &amp; AI Search Tools</h3>
            <p>SERP simulator, AI Search Grader, content optimizer, share of search, and more&mdash;free, no account needed.</p>
            <span class="go">Open the free tools →</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section" id="faq">
      <div class="container">
        <div class="center">
          <div class="eyebrow">FAQ</div>
          <h2>Frequently asked questions.</h2>
        </div>

        <div class="faq">
          <details>
            <summary>What does Echorank analyze?</summary>
            <p>
              Echorank analyzes how ready your site is for AI-powered search: content structure,
              structured data, freshness, crawlability, and&mdash;via AI Lens&mdash;the gap between what
              AI crawlers fetch and what your visitors actually see. Brand Radar and Custom Prompts
              then track how AI engines mention your brand over time.
            </p>
          </details>

          <details>
            <summary>How is Echorank different from traditional SEO tools?</summary>
            <p>
              Traditional SEO tools focus on rankings, keywords, backlinks, and traffic. Echorank includes
              those&mdash;rank tracker, SERP checker, backlinks, site crawler, GSC insights&mdash;but adds the
              generative-search layer: whether AI systems can read your content and mention your brand
              when answering relevant queries.
            </p>
          </details>

          <details>
            <summary>Which AI platforms does Echorank cover?</summary>
            <p>
              Echorank is built around visibility across leading generative search platforms, including
              ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, and Microsoft Copilot.
            </p>
          </details>

          <details>
            <summary>What is AI Lens?</summary>
            <p>
              AI Lens fetches your raw HTML and your fully rendered page, converts both to clean text,
              and diffs them. The result is a percentage gap: the share of your content that JavaScript-dependent
              rendering hides from AI crawlers that don&rsquo;t execute scripts. A 0% gap means everything you
              publish is visible to them.
            </p>
          </details>

          <details>
            <summary>Is the audit really free?</summary>
            <p>
              Yes. You get one free AI visibility audit per day&mdash;no account, no card. It includes the
              visibility score, the check-by-check breakdown, and a downloadable PDF report. Paid plans add
              re-runs, history, monitoring, and the full SEO Tools hub.
            </p>
          </details>

          <details>
            <summary>How does the trial work?</summary>
            <p>
              Every paid plan starts with a 7-day free trial. A card is required to start it, and you can
              cancel any time during the trial with no charge&mdash;cancellation is self-serve through the
              billing portal.
            </p>
          </details>

          <details>
            <summary>Does GEO replace traditional SEO?</summary>
            <p>
              No. Technical SEO, crawlability, content quality, links, and overall authority still matter&mdash;that&rsquo;s
              why the classic tools live in the same hub. GEO adds an optimization layer focused on how generative
              engines retrieve, interpret, and mention information.
            </p>
          </details>
        </div>

        <div class="final-cta">
          <div class="eyebrow">Start today</div>
          <h2 style="margin-top:22px">Don&rsquo;t just track AI search. Engineer your visibility.</h2>
          <p class="lead">
            See how AI search engines understand your brand, find the gaps, and work through
            a prioritized roadmap&mdash;starting with a free audit.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/en/ai-visibility#audit">Run my free audit</a>
            <a class="btn btn-secondary" href="/en/pricing">See plans</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container footer-inner">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>ECHORANK</span>
      </div>
      <div class="footer-links">
        <a href="/en/pricing">Pricing</a>
        <a href="/en/learn">Learn</a>
        <a href="/en/free-tools">Free tools</a>
        <a href="/en/legal/privacy">Privacy</a>
        <a href="/en/legal/terms">Terms</a>
        <a href="/en/legal/cookies">Cookies</a>
      </div>
      <div>&copy; 2026 Echorank &middot; ChatLogic Insights Ltd</div>
    </div>
  </footer>

  <div class="sticky-cta" aria-hidden="false">
    <a class="btn btn-primary" href="/en/ai-visibility#audit">Run your free AI visibility audit</a>
  </div>
</body>
</html>`;
