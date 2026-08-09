export const KEYWORD_GUIDE_HTML: string = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Echorank's plain-English guide to keyword research: find search ideas, judge opportunities, match search intent, and build useful content." />
  <title>Echorank Keyword Research Guide</title>
  <link rel="canonical" href="https://echorank360.com/en/keyword-research" />
  <style>
    :root{
      --bg:#181A20;
      --surface:#1E2329;
      --surface-soft:#2B3139;
      --text:#EAECEF;
      --muted:#848E9C;
      --line:#2B3139;
      --accent:#FCD535;
      --accent-soft:rgba(252,213,53,.12);
      --success:#0ECB81;
      --warning:#F0B90B;
      --radius:18px;
      --shadow:0 16px 45px rgba(0,0,0,.45);
      --max:1180px;
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0;
      background:var(--bg);
      color:var(--text);
      font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height:1.65;
    }
    a{color:inherit}
    .container{width:min(calc(100% - 32px),var(--max));margin:auto}
    .topbar{
      position:sticky;top:0;z-index:100;
      background:rgba(24,26,32,.92);
      backdrop-filter:blur(12px);
      border-bottom:1px solid var(--line);
    }
    .topbar-inner{
      min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:24px
    }
    .brand{display:flex;align-items:center;gap:10px;font-weight:850;text-decoration:none}
    .mark{
      width:36px;height:36px;border-radius:11px;background:var(--accent);
      color:#181A20;display:grid;place-items:center;font-weight:900
    }
    .topnav{display:flex;gap:18px;color:var(--muted);font-size:.95rem}
    .topnav a{text-decoration:none}
    .topnav a:hover{color:var(--text)}
    .progress{
      position:absolute;left:0;bottom:-1px;height:2px;background:var(--accent);width:0
    }
    .hero{padding:86px 0 58px}
    .eyebrow{
      color:var(--accent);font-weight:800;text-transform:uppercase;
      letter-spacing:.12em;font-size:.78rem;margin:0 0 14px
    }
    h1{
      font-size:clamp(2.8rem,7vw,5.8rem);
      line-height:.98;letter-spacing:-.055em;max-width:980px;margin:0
    }
    .hero-copy{
      max-width:760px;color:var(--muted);font-size:1.16rem;margin:24px 0 0
    }
    .hero-grid{
      display:grid;grid-template-columns:1.5fr .75fr;gap:24px;align-items:end
    }
    .hero-card{
      background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
      padding:24px;box-shadow:var(--shadow)
    }
    .hero-card strong{display:block;font-size:1.05rem;margin-bottom:8px}
    .hero-card p{margin:0;color:var(--muted)}
    .layout{
      display:grid;grid-template-columns:280px minmax(0,1fr);gap:34px;align-items:start;padding-bottom:90px
    }
    .toc{
      position:sticky;top:94px;background:var(--surface);border:1px solid var(--line);
      border-radius:var(--radius);padding:18px
    }
    .toc-title{font-weight:800;margin:0 0 12px}
    .toc a{
      display:block;text-decoration:none;padding:8px 10px;border-radius:9px;
      color:var(--muted);font-size:.94rem
    }
    .toc a:hover,.toc a.active{background:var(--accent-soft);color:var(--accent)}
    .chapter{
      background:var(--surface);border:1px solid var(--line);border-radius:24px;
      padding:clamp(24px,5vw,52px);margin-bottom:28px;box-shadow:0 10px 32px rgba(0,0,0,.35)
    }
    .chapter-number{
      display:inline-flex;align-items:center;gap:8px;color:var(--accent);font-weight:800;
      font-size:.8rem;text-transform:uppercase;letter-spacing:.1em
    }
    h2{font-size:clamp(2rem,4vw,3.2rem);line-height:1.08;letter-spacing:-.035em;margin:12px 0 18px}
    h3{font-size:1.45rem;line-height:1.25;margin:34px 0 12px}
    h4{font-size:1.1rem;margin:24px 0 8px}
    p{margin:12px 0}
    .lede{font-size:1.08rem;color:#B7BDC6}
    .note,.tip,.warning{
      border-radius:14px;padding:16px 18px;margin:22px 0;border:1px solid var(--line)
    }
    .note{background:var(--surface-soft)}
    .tip{background:rgba(14,203,129,.08);border-color:rgba(14,203,129,.35)}
    .warning{background:rgba(240,185,11,.08);border-color:rgba(240,185,11,.35)}
    .label{font-weight:800;display:block;margin-bottom:4px}
    .grid-2,.grid-3{display:grid;gap:16px;margin:20px 0}
    .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
    .grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
    .card{
      border:1px solid var(--line);border-radius:15px;padding:18px;background:var(--surface)
    }
    .card h4{margin-top:0}
    .card p:last-child{margin-bottom:0;color:var(--muted)}
    .steps{counter-reset:step;display:grid;gap:14px;margin:22px 0}
    .step{
      counter-increment:step;display:grid;grid-template-columns:44px 1fr;gap:14px;
      padding:18px;border:1px solid var(--line);border-radius:15px
    }
    .step:before{
      content:counter(step);width:44px;height:44px;border-radius:12px;display:grid;place-items:center;
      background:var(--accent);color:#181A20;font-weight:850
    }
    .step strong{display:block;margin-bottom:4px}
    ul,ol{padding-left:1.35rem}
    li+li{margin-top:7px}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;margin:20px 0}
    table{width:100%;border-collapse:collapse;min-width:680px;background:var(--surface)}
    th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
    th{background:var(--surface-soft);font-size:.9rem}
    tr:last-child td{border-bottom:0}
    .intent{
      display:inline-block;padding:4px 9px;border-radius:999px;background:var(--accent-soft);
      color:var(--accent);font-size:.8rem;font-weight:800
    }
    .checklist{list-style:none;padding:0;margin:18px 0}
    .checklist li{position:relative;padding-left:30px}
    .checklist li:before{
      content:"\2713";position:absolute;left:0;top:0;color:var(--success);font-weight:900
    }
    .quiz{display:grid;gap:18px;margin-top:24px}
    .question{border:1px solid var(--line);border-radius:15px;padding:18px}
    .question strong{display:block;margin-bottom:10px}
    .question label{display:block;padding:6px 0;cursor:pointer}
    .quiz-actions{display:flex;gap:12px;flex-wrap:wrap}
    button{
      appearance:none;border:0;border-radius:11px;padding:12px 16px;font:inherit;font-weight:800;cursor:pointer
    }
    .primary{background:var(--accent);color:#181A20}
    .secondary{background:var(--surface-soft);color:var(--text)}
    #quiz-result{font-weight:800}
    .footer{
      border-top:1px solid var(--line);padding:38px 0 50px;color:var(--muted);background:var(--surface)
    }
    .small{font-size:.9rem;color:var(--muted)}
    @media (max-width:900px){
      .hero-grid,.layout{grid-template-columns:1fr}
      .toc{position:relative;top:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
      .toc-title{grid-column:1/-1}
      .grid-3{grid-template-columns:1fr}
    }
    @media (max-width:680px){
      .topnav{display:none}
      .grid-2{grid-template-columns:1fr}
      .toc{grid-template-columns:1fr}
      .hero{padding-top:58px}
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="container topbar-inner">
      <a class="brand" href="/en" aria-label="Echorank home">
        <svg width="30" height="30" viewBox="0 0 40 40" style="display:block" aria-hidden="true"><defs><linearGradient id="eg-kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE38A"/><stop offset="1" stop-color="#F0B90B"/></linearGradient></defs><rect x="9" y="9" width="22" height="22" rx="5" transform="rotate(45 20 20)" fill="url(#eg-kg)"/></svg><span style="letter-spacing:.06em">ECHORANK</span>
      </a>
      <nav class="topnav" aria-label="Page navigation">
        <a href="#basics">Basics</a>
        <a href="#find">Find keywords</a>
        <a href="#analyze">Analyze</a>
        <a href="#use">Use keywords</a>
        <a href="#quiz">Quiz</a>
        <a href="/en/pricing">Pricing</a>
      </nav>
      <div id="progress" class="progress" aria-hidden="true"></div>
    </div>
  </header>

  <main id="top">
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <p class="eyebrow">Echorank Learning Guide</p>
          <h1>Keyword research, explained in plain English</h1>
          <p class="hero-copy">
            Learn how to discover what people search for, decide which opportunities are worth your time,
            understand search intent, and turn keyword research into useful pages&mdash;not piles of repeated phrases.
          </p>
        </div>
        <aside class="hero-card">
          <strong>The simple model</strong>
          <p>Find ideas &rarr; judge the opportunity &rarr; match intent &rarr; build the right page &rarr; improve it with real performance data.</p>
        </aside>
      </div>
    </section>

    <div class="container layout">
      <aside class="toc" aria-label="Table of contents">
        <p class="toc-title">In this guide</p>
        <a href="#basics">1. Keyword research basics</a>
        <a href="#find">2. How to find keywords</a>
        <a href="#analyze">3. How to analyze keywords</a>
        <a href="#use">4. How to use keywords</a>
        <a href="#quiz">5. Quick knowledge check</a>
      </aside>

      <div>
        <section class="chapter" id="basics">
          <span class="chapter-number">Chapter 1</span>
          <h2>Keyword research basics</h2>
          <p class="lede">
            Keyword research is the process of learning how people describe their problems, questions, products,
            and goals when they search. Good research helps you choose topics and page formats that match what people actually want.
          </p>

          <h3>What is a keyword?</h3>
          <p>
            A keyword is a word or phrase used in a search. It can be broad, such as <em>running shoes</em>,
            or very specific, such as <em>best waterproof running shoes for winter</em>.
          </p>
          <p>
            The important part is not the phrase by itself. The phrase is a clue to the user's need.
            Your job is to understand that need and create the most useful response to it.
          </p>

          <h3>What is keyword research?</h3>
          <p>
            Keyword research means collecting search ideas, comparing them, and deciding which ones deserve a page,
            a section of a page, or no action at all.
          </p>

          <div class="grid-3">
            <div class="card">
              <h4>Why do it?</h4>
              <p>To make content decisions using evidence about real demand rather than guessing what people may search for.</p>
            </div>
            <div class="card">
              <h4>When do it?</h4>
              <p>Before launching a site, planning content, refreshing old pages, entering a new market, or improving pages that already get impressions.</p>
            </div>
            <div class="card">
              <h4>Who needs it?</h4>
              <p>Site owners, publishers, marketers, product teams, ecommerce teams, and anyone responsible for organic search visibility.</p>
            </div>
          </div>

          <h3>How keyword research has changed</h3>
          <p>
            Older SEO often treated keywords like labels that had to be repeated in exact places. Modern search systems are much better
            at understanding meaning, context, relationships between concepts, and the likely intent behind a query.
          </p>
          <div class="warning">
            <span class="label">What this changes</span>
            A strong page should cover the topic clearly and naturally. Repeating an exact phrase many times is not a substitute for usefulness.
          </div>

          <h3>The three-stage workflow</h3>
          <div class="steps">
            <div class="step"><div><strong>Find ideas</strong>Collect broad themes, specific questions, product searches, comparisons, and related subtopics.</div></div>
            <div class="step"><div><strong>Analyze the opportunity</strong>Look at demand, ranking difficulty, search intent, business value, and what currently appears in the results.</div></div>
            <div class="step"><div><strong>Use the keyword intelligently</strong>Choose the right page type, organize related topics, write naturally, and measure what happens after publication.</div></div>
          </div>
        </section>

        <section class="chapter" id="find">
          <span class="chapter-number">Chapter 2</span>
          <h2>How to find keywords</h2>
          <p class="lede">
            Start with your audience, not your tool. Think about the jobs people are trying to complete, the questions they ask before buying,
            the problems they encounter, and the words they naturally use.
          </p>

          <h3>Start with seed topics</h3>
          <p>
            A seed topic is a short phrase that describes a main area of interest. For a home coffee site, seeds might include
            <em>espresso machine</em>, <em>coffee grinder</em>, and <em>cold brew</em>.
          </p>
          <p>
            A seed is not usually the final target. It is the starting point for discovering narrower and more useful searches.
          </p>

          <h3>Look for specific, long-tail searches</h3>
          <p>
            Specific searches often have lower total demand than broad terms, but they can reveal a much clearer need.
            A query such as <em>how fine should coffee be for a moka pot</em> tells you exactly what the user is trying to solve.
          </p>
          <div class="note">
            <span class="label">Do not make one page for every wording variation.</span>
            Closely related searches often belong on the same well-structured page because they express the same underlying topic or intent.
          </div>

          <h3>Useful places to discover ideas</h3>
          <div class="grid-2">
            <div class="card">
              <h4>Search suggestions</h4>
              <p>Autocomplete, related searches, and question boxes can reveal common ways people expand a topic.</p>
            </div>
            <div class="card">
              <h4>Keyword tools</h4>
              <p>Use them to generate variations and compare metrics such as estimated search volume, competition, and result pages.</p>
            </div>
            <div class="card">
              <h4>Your own search data</h4>
              <p>Google Search Console can reveal queries where your pages already receive impressions, including opportunities you did not originally target.</p>
            </div>
            <div class="card">
              <h4>Competitor pages</h4>
              <p>Study which themes and queries similar sites rank for. The goal is to discover gaps&mdash;not to copy their wording or structure.</p>
            </div>
            <div class="card">
              <h4>Communities and forums</h4>
              <p>Discussion boards, Reddit communities, support groups, and specialist forums show the language people use when describing real problems.</p>
            </div>
            <div class="card">
              <h4>Marketplaces and video platforms</h4>
              <p>Product and video searches can expose practical, comparison-driven, and transaction-oriented queries that general web search may not surface as clearly.</p>
            </div>
          </div>

          <h3>Use competitor research in two ways</h3>
          <ol>
            <li><strong>Domain-level discovery:</strong> find themes another site receives visibility for that your own content has not covered.</li>
            <li><strong>Page-level discovery:</strong> inspect a strong page about a topic and identify related searches that one page satisfies.</li>
          </ol>

          <h3>Use your own data for &ldquo;almost there&rdquo; keywords</h3>
          <p>
            Queries that already generate impressions but sit outside the top results can be valuable. They show that the search engine already sees
            some relationship between your page and the topic.
          </p>
          <ul class="checklist">
            <li>Find queries with many impressions but relatively few clicks.</li>
            <li>Look for relevant terms where average position suggests you are close to stronger visibility.</li>
            <li>Decide whether the existing page should be improved or whether the query deserves a separate page.</li>
          </ul>

          <div class="tip">
            <span class="label">Echorank rule of thumb</span>
            Keyword ideas are everywhere people express demand. The research skill is not collecting the largest list; it is recognizing which ideas represent distinct, useful opportunities.
          </div>
        </section>

        <section class="chapter" id="analyze">
          <span class="chapter-number">Chapter 3</span>
          <h2>How to analyze keywords</h2>
          <p class="lede">
            A keyword is worth targeting only when the demand, competition, intent, and value make sense together.
            One attractive metric is never enough.
          </p>

          <h3>The four-part Echorank check</h3>
          <div class="grid-2">
            <div class="card">
              <h4>1. Demand</h4>
              <p>How often is the topic searched, and is interest stable, growing, declining, or seasonal?</p>
            </div>
            <div class="card">
              <h4>2. Difficulty</h4>
              <p>How strong are the pages already ranking, and can your site realistically compete with a better answer?</p>
            </div>
            <div class="card">
              <h4>3. Intent</h4>
              <p>What kind of result does the searcher expect: a brand, explanation, comparison, product page, tool, video, or something else?</p>
            </div>
            <div class="card">
              <h4>4. Value</h4>
              <p>If you win visibility, does the query support your audience, product, revenue, leads, authority, or another meaningful goal?</p>
            </div>
          </div>

          <h3>Demand is more than search volume</h3>
          <p>
            Search volume is an estimate, not a promise. Different tools can report different numbers because they use different datasets and models.
            Treat volume as directional.
          </p>
          <ul>
            <li>Check whether interest changes over time.</li>
            <li>Watch for seasonal demand.</li>
            <li>Consider the full topic, because one strong page can attract traffic from many related searches.</li>
            <li>Look at the actual result page: ads, answer boxes, maps, shopping modules, and other features can reduce organic clicks.</li>
          </ul>

          <h3>Difficulty is a comparison, not a verdict</h3>
          <p>
            Keyword difficulty scores usually estimate the strength of pages already ranking. They can be useful for comparing opportunities inside one tool,
            but they cannot tell you exactly how hard a keyword will be for your particular site.
          </p>
          <div class="warning">
            <span class="label">Do not outsource the decision to one score.</span>
            Review the actual result page. Sometimes a search is dominated by powerful domains but the results do a poor job of answering the exact need.
            A focused, high-quality page may still have an opening.
          </div>

          <h3>Search intent decides the page type</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Intent</th><th>What the person wants</th><th>Typical page type</th><th>Fresh example</th></tr>
              </thead>
              <tbody>
                <tr><td><span class="intent">Navigational</span></td><td>Reach a known site, brand, or product.</td><td>Homepage, login page, brand page.</td><td>&ldquo;notion login&rdquo;</td></tr>
                <tr><td><span class="intent">Informational</span></td><td>Learn or solve a problem.</td><td>Guide, tutorial, explainer, reference page.</td><td>&ldquo;how to descale an espresso machine&rdquo;</td></tr>
                <tr><td><span class="intent">Commercial</span></td><td>Compare options before choosing.</td><td>Comparison, review, &ldquo;best&rdquo; list, buying guide.</td><td>&ldquo;best grinder for espresso under 300&rdquo;</td></tr>
                <tr><td><span class="intent">Transactional</span></td><td>Take an action such as buying or signing up.</td><td>Product, category, pricing, booking, signup page.</td><td>&ldquo;buy burr coffee grinder&rdquo;</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The easiest way to infer intent is to inspect what kinds of pages dominate the current search results.
            If comparison articles dominate, a single product page may be the wrong format even when the words look relevant.
          </p>

          <h3>A practical prioritization question</h3>
          <p>
            Ask: <strong>&ldquo;If we ranked well for this search, would the right person arrive on the right page at the right stage of their journey?&rdquo;</strong>
            If the answer is no, the keyword may not be worth pursuing.
          </p>
        </section>

        <section class="chapter" id="use">
          <span class="chapter-number">Chapter 4</span>
          <h2>How to use keywords</h2>
          <p class="lede">
            Keyword research should shape site structure and content decisions. It should not turn writing into a mechanical exercise.
          </p>

          <h3>Think in topics and clusters</h3>
          <p>
            Organize related searches around a main topic. A broad guide can introduce the subject, while supporting pages answer narrower questions in depth.
            Link them together so users&mdash;and search systems&mdash;can understand the relationship.
          </p>

          <div class="grid-2">
            <div class="card">
              <h4>Pillar page</h4>
              <p>A broad resource that explains the main topic and links to deeper supporting material.</p>
            </div>
            <div class="card">
              <h4>Supporting pages</h4>
              <p>Focused pages that answer specific questions, comparisons, use cases, or subtopics.</p>
            </div>
          </div>

          <h4>Example: home bread baking</h4>
          <ul>
            <li><strong>Pillar:</strong> Beginner&rsquo;s guide to baking bread at home</li>
            <li><strong>Support:</strong> How to tell when dough is fully proofed</li>
            <li><strong>Support:</strong> Sourdough starter feeding schedule</li>
            <li><strong>Support:</strong> Bread flour vs all-purpose flour</li>
            <li><strong>Support:</strong> Best Dutch oven size for bread</li>
          </ul>

          <h3>Choose one primary topic for each page</h3>
          <p>
            A page should have a clear main purpose. You can use one representative keyword to keep the page focused,
            but the page should naturally answer related searches that share the same intent.
          </p>

          <h3>Place keywords where they help clarity</h3>
          <ul class="checklist">
            <li>Use clear wording in the page title.</li>
            <li>Make the main heading describe the topic plainly.</li>
            <li>Introduce the subject early enough that readers know they are in the right place.</li>
            <li>Use descriptive subheadings that reflect important subtopics.</li>
            <li>Use useful internal-link anchor text when pointing to the page.</li>
          </ul>

          <h3>Do not chase keyword density</h3>
          <p>
            There is no magic percentage that makes a page rank. Repeating a phrase until it sounds unnatural usually makes the content worse.
            Use normal language, synonyms where they are genuinely appropriate, and terminology that belongs to the topic.
          </p>

          <h3>Do not build your strategy around &ldquo;LSI keywords&rdquo;</h3>
          <p>
            You may see tools or advice claiming that a page needs a special list of semantically related &ldquo;LSI keywords.&rdquo;
            Treat that idea with skepticism. The better approach is to understand the subject deeply enough to cover the concepts a useful answer naturally requires.
          </p>

          <div class="tip">
            <span class="label">A better test</span>
            If an informed reader finishes the page with their main question answered and their likely follow-up questions anticipated,
            the content is probably covering the topic more effectively than a page built around a keyword checklist.
          </div>

          <h3>After publishing, use performance data</h3>
          <p>
            Keyword research continues after the page goes live. Review queries, impressions, clicks, rankings, and engagement.
            New data can reveal subtopics to add, titles to improve, sections to clarify, or separate pages that deserve to exist.
          </p>

          <div class="note">
            <span class="label">In one sentence</span>
            Research tells you what people need; content earns visibility by satisfying that need better than the alternatives.
          </div>
        </section>

        <section class="chapter" id="quiz">
          <span class="chapter-number">Chapter 5</span>
          <h2>Quick knowledge check</h2>
          <p class="lede">Five original questions to check the core ideas from this Echorank guide.</p>

          <form id="quiz-form" class="quiz">
            <div class="question">
              <strong>1. Which keyword is usually the clearest signal of a specific need?</strong>
              <label><input type="radio" name="q1" value="a"> coffee</label>
              <label><input type="radio" name="q1" value="b"> coffee grinder</label>
              <label><input type="radio" name="q1" value="c"> best quiet coffee grinder for apartment</label>
            </div>

            <div class="question">
              <strong>2. A results page is dominated by comparison articles. What does that most strongly suggest?</strong>
              <label><input type="radio" name="q2" value="a"> The query probably has commercial research intent.</label>
              <label><input type="radio" name="q2" value="b"> Search volume must be low.</label>
              <label><input type="radio" name="q2" value="c"> The keyword cannot rank organically.</label>
            </div>

            <div class="question">
              <strong>3. What is the best way to use a keyword difficulty score?</strong>
              <label><input type="radio" name="q3" value="a"> Treat it as an absolute rule.</label>
              <label><input type="radio" name="q3" value="b"> Use it as a comparison signal and inspect the actual results.</label>
              <label><input type="radio" name="q3" value="c"> Ignore the search results if the score is low.</label>
            </div>

            <div class="question">
              <strong>4. What should you do with many close variations of the same search intent?</strong>
              <label><input type="radio" name="q4" value="a"> Create a separate page for every wording.</label>
              <label><input type="radio" name="q4" value="b"> Usually cover them naturally on one strong page.</label>
              <label><input type="radio" name="q4" value="c"> Repeat every variation in the footer.</label>
            </div>

            <div class="question">
              <strong>5. Which is the strongest content principle?</strong>
              <label><input type="radio" name="q5" value="a"> Hit an exact keyword-density target.</label>
              <label><input type="radio" name="q5" value="b"> Add every related term a tool recommends.</label>
              <label><input type="radio" name="q5" value="c"> Match intent and cover the topic clearly and naturally.</label>
            </div>

            <div class="quiz-actions">
              <button class="primary" type="submit">Check my score</button>
              <button class="secondary" type="reset">Reset</button>
            </div>
            <div id="quiz-result" role="status" aria-live="polite"></div>
          </form>
        </section>
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <strong>Echorank</strong>
      <p class="small">&copy; 2026 ECHORANK &middot; ChatLogic Insights Ltd &middot; Registered in England &amp; Wales No. 15593166<br><a href="/en/pricing">Pricing</a> &middot; <a href="/en/lexicon">Lexicon</a></p>
    </div>
  </footer>

  <script>
    var progress = document.getElementById('progress');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    var sections = tocLinks.map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    }).filter(Boolean);

    function updateProgress() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';

      var current = sections.length ? sections[0].id : null;
      for (var i = 0; i < sections.length; i++) {
        if (window.scrollY >= sections[i].offsetTop - 150) current = sections[i].id;
      }
      tocLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
      });
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    var answers = { q1: 'c', q2: 'a', q3: 'b', q4: 'b', q5: 'c' };
    var form = document.getElementById('quiz-form');
    var result = document.getElementById('quiz-result');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var score = 0;
      var answered = 0;
      Object.keys(answers).forEach(function (name) {
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        if (checked) {
          answered++;
          if (checked.value === answers[name]) score++;
        }
      });
      if (answered < 5) {
        result.textContent = 'Answer all five questions to see your score.';
        return;
      }
      var messages = [
        'Review the guide and try again.',
        'You have the basics. Revisit intent and prioritization.',
        'Good foundation.',
        'Strong understanding.',
        'Excellent. You understand the Echorank keyword research workflow.'
      ];
      result.textContent = score + '/5 \u2014 ' + (messages[Math.max(0, score - 1)] || messages[0]);
    });

    form.addEventListener('reset', function () {
      setTimeout(function () { result.textContent = ''; }, 0);
    });
  </script>
</body>
</html>`;
