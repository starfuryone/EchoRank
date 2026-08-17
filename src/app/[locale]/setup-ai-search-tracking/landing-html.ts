// Standalone "Set up AI Search tracking" landing page, served verbatim as its
// own HTML document. String.raw so the CSS and markup need no escaping: the
// payload is checked to contain no backtick and no ${ } placeholder, which are
// the only two sequences that could break out of this literal.
//
// en-only body, served on every locale — same first-pass treatment as
// /technical-geo. Links inside it are hard-coded /en/... paths.

export const SETUP_AI_SEARCH_TRACKING_HTML: string = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Set up AI Search tracking — Echorank</title>
<meta name="description" content="We ask AI assistants the questions your buyers ask, and record whether they mention you. Set up AI Search tracking on Echorank in under five minutes.">
<link rel="canonical" href="https://echorank360.com/en/setup-ai-search-tracking">
<style>
  :root{
    --bg:#181A20; --card:#1E2329; --card2:#2B3139; --border:#2B3139;
    --accent:#FCD535; --accent2:#F0B90B; --text:#EAECEF; --muted:#848E9C;
    --success:#0ECB81;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:var(--accent2);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:960px;margin:0 auto;padding:0 24px}

  /* Header */
  header{border-bottom:1px solid var(--border);background:var(--bg)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:64px}
  .brand{display:flex;align-items:center;gap:10px;color:var(--text)}
  .brand:hover{text-decoration:none}
  .brand .wordmark{font-weight:800;letter-spacing:.14em;font-size:15px}
  .nav .cta{background:var(--accent);color:#181A20;font-weight:600;font-size:14px;padding:9px 18px;border-radius:8px}
  .nav .cta:hover{background:var(--accent2);text-decoration:none}

  /* Hero */
  .hero{padding:72px 0 56px;border-bottom:1px solid var(--border)}
  .eyebrow{color:var(--accent2);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}
  h1{font-size:clamp(30px,5vw,44px);line-height:1.15;font-weight:800;letter-spacing:-.01em;max-width:720px}
  .hero p.lede{margin-top:18px;font-size:18px;color:var(--muted);max-width:640px}
  .hero .actions{margin-top:30px;display:flex;gap:12px;flex-wrap:wrap}
  .btn{display:inline-block;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px}
  .btn.primary{background:var(--accent);color:#181A20}
  .btn.primary:hover{background:var(--accent2);text-decoration:none}
  .btn.ghost{border:1px solid var(--card2);color:var(--text)}
  .btn.ghost:hover{border-color:var(--accent2);color:var(--accent2);text-decoration:none}

  /* Sections */
  section{padding:56px 0;border-bottom:1px solid var(--border)}
  h2{font-size:26px;font-weight:700;margin-bottom:10px}
  .sub{color:var(--muted);max-width:640px;margin-bottom:32px}

  /* How it works */
  .how{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .how .cell{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:22px}
  .how .cell h3{font-size:16px;margin-bottom:8px}
  .how .cell p{font-size:14px;color:var(--muted)}
  .how .k{color:var(--accent2);font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase;display:block;margin-bottom:10px}

  /* Steps */
  .steps{display:flex;flex-direction:column;gap:14px}
  .step{display:flex;gap:18px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:22px}
  .step .n{flex:0 0 36px;height:36px;border-radius:50%;background:rgba(240,185,11,.12);color:var(--accent2);display:flex;align-items:center;justify-content:center;font-weight:700}
  .step h3{font-size:16px;margin-bottom:6px}
  .step p{font-size:14px;color:var(--muted)}
  .step code{background:var(--card2);border-radius:6px;padding:2px 7px;font-size:13px;color:var(--text)}

  /* Results grid */
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
  .grid .cell{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:22px}
  .grid .cell h3{font-size:15px;margin-bottom:6px}
  .grid .cell p{font-size:14px;color:var(--muted)}

  /* Pricing strip */
  .plans{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
  .plan{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:26px;display:flex;flex-direction:column}
  .plan.featured{border-color:var(--accent2)}
  .plan .name{font-weight:700;font-size:16px}
  .plan .price{margin:12px 0 4px;font-size:30px;font-weight:800}
  .plan .price small{font-size:14px;font-weight:500;color:var(--muted)}
  .plan .per{color:var(--muted);font-size:13px;margin-bottom:16px}
  .plan ul{list-style:none;margin-bottom:22px}
  .plan li{font-size:14px;color:var(--muted);padding:5px 0 5px 24px;position:relative}
  .plan li::before{content:"✓";color:var(--success);position:absolute;left:0;font-weight:700}
  .plan .btn{margin-top:auto;text-align:center}
  .note{margin-top:18px;font-size:13px;color:var(--muted)}

  /* FAQ */
  .faq details{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin-bottom:12px}
  .faq summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:"+";float:right;color:var(--accent2);font-weight:700}
  .faq details[open] summary::after{content:"–"}
  .faq details p{margin-top:10px;font-size:14px;color:var(--muted)}

  /* Final CTA */
  .final{text-align:center;border-bottom:none;padding-bottom:72px}
  .final h2{font-size:30px}
  .final p{color:var(--muted);margin:12px 0 26px}

  /* Footer */
  footer{border-top:1px solid var(--border);padding:36px 0;background:var(--bg)}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
  .foot .legal{font-size:13px;color:var(--muted)}
  .foot .links{display:flex;gap:18px;flex-wrap:wrap}
  .foot .links a{font-size:13px;color:var(--muted)}
  .foot .links a:hover{color:var(--accent2)}

  @media (max-width:760px){
    .how{grid-template-columns:1fr}
    .grid{grid-template-columns:1fr}
    .plans{grid-template-columns:1fr}
    .hero{padding:52px 0 44px}
  }
  @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>

<header>
  <div class="wrap nav">
    <a class="brand" href="/en" aria-label="Echorank home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <defs>
          <linearGradient id="eg-ast" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#FDE38A"/><stop offset="1" stop-color="#F0B90B"/>
          </linearGradient>
        </defs>
        <rect x="5.5" y="5.5" width="15" height="15" rx="3" fill="url(#eg-ast)" transform="rotate(45 13 13)"/>
      </svg>
      <span class="wordmark">ECHORANK</span>
    </a>
    <a class="cta" href="/en/pricing">See plans</a>
  </div>
</header>

<div class="hero">
  <div class="wrap">
    <div class="eyebrow">AI Search tracking</div>
    <h1>Set up AI Search tracking</h1>
    <p class="lede">We ask AI assistants the questions your buyers ask, and record whether they mention you. Set it up once — get a fresh read on where you stand, every week.</p>
    <div class="actions">
      <a class="btn primary" href="/en/pricing">Start tracking</a>
      <a class="btn ghost" href="/en/free-tools">Try the free AI Search grader</a>
    </div>
  </div>
</div>

<section>
  <div class="wrap">
    <h2>How it works</h2>
    <p class="sub">Buyers increasingly ask AI assistants who to buy from. If the answer doesn't mention you, you lose deals you never see. AI Search tracking makes that visible — and measurable.</p>
    <div class="how">
      <div class="cell"><span class="k">Ask</span><h3>Your buyers' real questions</h3><p>You define up to ten tracked prompts — the questions a customer would actually type when choosing a provider like you.</p></div>
      <div class="cell"><span class="k">Run</span><h3>Weekly checkups</h3><p>Every week, each prompt runs multiple times against an AI assistant, because AI answers vary run to run. Repetition is what makes the numbers trustworthy.</p></div>
      <div class="cell"><span class="k">Record</span><h3>Mentions, position, citations</h3><p>For every run we record whether you're mentioned, where you sit in the recommendation, which sources are cited, and the sentiment around your name.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Set it up in four steps</h2>
    <p class="sub">The whole setup takes about five minutes. The tracking runs itself after that.</p>
    <div class="steps">
      <div class="step"><div class="n">1</div><div>
        <h3>Activate the Watcher</h3>
        <p>AI Search tracking is included in every paid Echorank plan — if you're on one, it's already yours. Not a subscriber? Get the Watcher on its own from the <a href="/en/pricing">pricing page</a>.</p>
      </div></div>
      <div class="step"><div class="n">2</div><div>
        <h3>Add your brand</h3>
        <p>Tell us the brand name to watch for. This is the name we look for in every AI answer — mentions, recommendations and citations are all matched against it.</p>
      </div></div>
      <div class="step"><div class="n">3</div><div>
        <h3>Add your tracked prompts</h3>
        <p>Enter up to ten questions your buyers ask. Not sure where to start? Use the pattern <code>best [your category] for [your audience]</code> and add variations for your services and locations.</p>
      </div></div>
      <div class="step"><div class="n">4</div><div>
        <h3>Read your first checkup</h3>
        <p>Your first weekly checkup runs automatically. From then on, your dashboard shows a fresh AI Search Score and trend line every week — no manual work required.</p>
      </div></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>What you get every week</h2>
    <p class="sub">One score you can act on, backed by the raw observations behind it.</p>
    <div class="grid">
      <div class="cell"><h3>AI Search Score</h3><p>A single score blending how often you're mentioned, how prominently you're recommended, whether your pages are cited, and the sentiment of what's said.</p></div>
      <div class="cell"><h3>Mention-rate trend</h3><p>A week-over-week trend line, so you can see whether the work you're doing is moving the needle — or whether you're fading from the answers.</p></div>
      <div class="cell"><h3>Competitor tracking</h3><p>See which competitors appear in the same answers, and how often they're recommended ahead of you.</p></div>
      <div class="cell"><h3>Citation tracking</h3><p>Know which of your pages — and which third-party sources — AI assistants cite when they talk about your market.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Two ways to start</h2>
    <div class="plans">
      <div class="plan">
        <div class="name">Free AI Search grader</div>
        <div class="price">$0</div>
        <div class="per">One-shot check · no account, no card</div>
        <ul>
          <li>Ask one buyer question about your brand</li>
          <li>Instant read: mentioned or not</li>
          <li>Great for a first look before you commit</li>
        </ul>
        <a class="btn ghost" href="/en/free-tools">Run a free check</a>
      </div>
      <div class="plan featured">
        <div class="name">AI Search Watcher</div>
        <div class="price">$9<small>/mo</small></div>
        <div class="per">or $90/yr — $7.50/mo equivalent, save 17%</div>
        <ul>
          <li>1 brand, up to 10 tracked prompts</li>
          <li>Weekly checkups, 3 runs per prompt</li>
          <li>Competitor &amp; citation tracking</li>
          <li>AI Search Score + mention-rate trend</li>
        </ul>
        <a class="btn primary" href="/en/pricing">Start tracking</a>
      </div>
    </div>
    <p class="note">Already on a paid Echorank plan? The Watcher is included — open your dashboard and set up your brand and prompts.</p>
  </div>
</section>

<section class="faq">
  <div class="wrap">
    <h2>Common questions</h2>
    <p class="sub"></p>
    <details>
      <summary>Why run each prompt more than once?</summary>
      <p>AI answers aren't deterministic — the same question can produce different recommendations run to run. Running each prompt several times per checkup turns a lucky (or unlucky) single answer into a rate you can trust.</p>
    </details>
    <details>
      <summary>What makes a good tracked prompt?</summary>
      <p>Track the questions a buyer would ask before choosing — "best X for Y", "who should I hire for…", "top alternatives to…". Avoid prompts that name your brand: asking about yourself doesn't tell you whether you show up organically.</p>
    </details>
    <details>
      <summary>How often do results update?</summary>
      <p>Checkups run weekly. Each new checkup adds a point to your trend line, so within a few weeks you can see direction, not just a snapshot.</p>
    </details>
    <details>
      <summary>Can I change my prompts later?</summary>
      <p>Yes — edit your tracked prompts anytime from the dashboard. New prompts are picked up on the next weekly checkup.</p>
    </details>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <h2>Know where you stand in AI answers</h2>
    <p>Set it up in five minutes. Get an answer every week.</p>
    <a class="btn primary" href="/en/pricing">Set up AI Search tracking</a>
  </div>
</section>

<footer>
  <div class="wrap foot">
    <div class="legal">© 2026 ECHORANK — ChatLogic Insights Ltd · Registered in England &amp; Wales No. 15593166</div>
    <nav class="links" aria-label="Legal">
      <a href="/en/legal/terms">Terms</a>
      <a href="/en/legal/privacy">Privacy</a>
      <a href="/en/legal/cookies">Cookies</a>
      <a href="/en/pricing">Pricing</a>
    </nav>
  </div>
</footer>

</body>
</html>`;
