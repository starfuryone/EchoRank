export const LEXICON_HTML: string = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Echorank Lexicon — search, ranking &amp; AI visibility terms</title>
<meta name="description" content="The Echorank Lexicon: definitions and concepts for search, ranking, AI visibility, and digital discovery.">
<link rel="canonical" href="https://echorank360.com/en/lexicon">
<style>
:root{--bg:#181A20;--surface:#1E2329;--surface2:#2B3139;--text:#EAECEF;--muted:#848E9C;--border:#2B3139;--accent:#FCD535;--accent2:#F0B90B;--highlight:rgba(252,213,53,.28);--radius:14px;--width:1100px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
a{color:inherit}
.container{width:min(calc(100% - 32px),var(--width));margin-inline:auto}
.header{border-bottom:1px solid var(--border);background:rgba(24,26,32,.96);backdrop-filter:blur(12px);position:sticky;top:0;z-index:100}
.header-inner{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:1.25rem}
.mark{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--accent);color:#181A20;font-weight:900}
.nav{display:flex;align-items:center;gap:20px;font-size:.95rem}
.nav a{color:var(--muted);text-decoration:none}
.nav a:hover{color:var(--text)}
.cta{padding:9px 16px;border-radius:10px;background:var(--accent);color:#181A20 !important;font-weight:700}
.cta:hover{background:var(--accent2)}
.hero{padding:80px 0 52px;text-align:center}
.eyebrow{margin:0 0 12px;color:var(--accent);font-size:.85rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.hero h1{margin:0;font-size:clamp(2.5rem,6vw,5rem);line-height:1;letter-spacing:-.05em}
.hero p{max-width:700px;margin:22px auto 0;color:var(--muted);font-size:1.1rem}
.search-wrapper{position:relative;max-width:720px;margin:0 auto 38px}
.search{width:100%;min-height:58px;padding:0 58px 0 20px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);font:inherit;font-size:1rem;outline:none}
.search:focus{border-color:var(--accent)}
.clear-search{position:absolute;top:50%;right:14px;width:34px;height:34px;transform:translateY(-50%);border:0;border-radius:50%;background:transparent;color:var(--muted);cursor:pointer;font-size:1.4rem}
.suggestions{display:none;position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:50;max-height:320px;overflow-y:auto;margin:0;padding:8px;list-style:none;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:0 16px 40px rgba(0,0,0,.4)}
.suggestions li{padding:10px 12px;border-radius:8px;cursor:pointer}
.suggestions li:hover{background:var(--surface2)}
.alphabet{position:sticky;top:70px;z-index:40;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:12px;margin-bottom:42px;border:1px solid var(--border);border-radius:var(--radius);background:rgba(30,35,41,.96);backdrop-filter:blur(12px)}
.alphabet a{min-width:32px;padding:6px 7px;text-align:center;border-radius:7px;color:var(--muted);text-decoration:none;font-size:.88rem;font-weight:700}
.alphabet a:hover,.alphabet a.active{background:var(--accent);color:#181A20}
.alphabet a.disabled{opacity:.32;pointer-events:none}
.lexicon{padding-bottom:90px}
.glossary-letter{scroll-margin-top:150px;margin-bottom:56px}
.glossary-letter > h2{margin:0 0 20px;padding-bottom:10px;border-bottom:2px solid var(--accent);font-size:2rem}
.glossary-letter ul{margin:0;padding:0;list-style:none}
.glossary-item{padding:25px 0;border-bottom:1px solid var(--border)}
.glossary-item h3{margin:0 0 8px;font-size:1.25rem}
.glossary-item p{margin:0;max-width:900px;color:#B7BDC6}
.highlight{padding:0 2px;background:var(--highlight);border-radius:3px}
.no-results{display:none;padding:50px 20px;text-align:center;border:1px dashed var(--border);border-radius:var(--radius);color:var(--muted)}
.footer{padding:40px 0;border-top:1px solid var(--border);color:var(--muted);text-align:center;font-size:.9rem}
@media (max-width:700px){.nav{display:none}.hero{padding-top:55px}.alphabet{justify-content:flex-start}}
</style>
</head>
<body>

<header class="header">
  <div class="container header-inner">
    <a href="/en" class="brand" aria-label="Echorank home"><svg width="30" height="30" viewBox="0 0 40 40" style="display:block" aria-hidden="true"><defs><linearGradient id="eg-lex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE38A"/><stop offset="1" stop-color="#F0B90B"/></linearGradient></defs><rect x="9" y="9" width="22" height="22" rx="5" transform="rotate(45 20 20)" fill="url(#eg-lex)"/></svg><span style="letter-spacing:.06em">ECHORANK</span></a>
    <nav class="nav" aria-label="Main navigation">
      <a href="#lexicon">Lexicon</a>
      <a href="/en/learn">Learn</a>
      <a href="/en/pricing" class="cta">See pricing</a>
    </nav>
  </div>
</header>

<main>

<section class="hero">
  <div class="container">
    <p class="eyebrow">Search intelligence</p>
    <h1>Echorank Lexicon</h1>
    <p>A structured dictionary of concepts used across search, ranking, AI visibility and digital discovery.</p>
  </div>
</section>

<section id="lexicon" class="container lexicon">

  <div class="search-wrapper">
    <input id="glossary-search" class="search" type="search" placeholder="Search the Echorank Lexicon" autocomplete="off" aria-label="Search the Echorank Lexicon">
    <button id="clear-search" class="clear-search" type="button" aria-label="Clear search">&times;</button>
    <ul id="search-suggestions" class="suggestions"></ul>
  </div>

  <nav id="alphabet-nav" class="alphabet" aria-label="Lexicon alphabet">
    <a href="#A">A</a><a href="#B">B</a><a href="#C">C</a><a href="#D">D</a><a href="#E">E</a><a href="#F">F</a><a href="#G">G</a><a href="#H">H</a><a href="#I">I</a><a href="#J">J</a><a href="#K">K</a><a href="#L">L</a><a href="#M">M</a><a href="#N">N</a><a href="#O">O</a><a href="#P">P</a><a href="#Q">Q</a><a href="#R">R</a><a href="#S">S</a><a href="#T">T</a><a href="#U">U</a><a href="#V">V</a><a href="#W">W</a><a href="#X">X</a><a href="#Y">Y</a><a href="#Z">Z</a>
  </nav>

  <div id="glossary-list">

    <section id="A" class="glossary-letter">
      <h2>A</h2>
      <ul>
        <li class="glossary-item"><h3>A/B testing</h3><p>A/B testing is a method used to compare two versions of a marketing campaign, webpage or application to determine which performs better.</p></li>
        <li class="glossary-item"><h3>Above the fold</h3><p>Above the fold refers to the portion of a webpage visible before the user scrolls.</p></li>
        <li class="glossary-item"><h3>Absolute link</h3><p>A link that spells out the full destination address, including protocol and domain, so it resolves the same from anywhere.</p></li>
        <li class="glossary-item"><h3>Access log</h3><p>A server file recording every incoming request with details such as time, IP address and user agent; useful for traffic and bot analysis.</p></li>
        <li class="glossary-item"><h3>Affiliate link</h3><p>A tracked URL that credits a specific partner when visitors click through and purchase, earning that partner a commission.</p></li>
        <li class="glossary-item"><h3>AI Lens</h3><p>AI Lens is an Echorank tool that compares the raw HTML of a page with its rendered output to measure how much of your content AI crawlers can actually read.</p></li>
        <li class="glossary-item"><h3>AI visibility</h3><p>AI visibility describes how often and how prominently a brand appears in the answers produced by AI assistants and answer engines.</p></li>
        <li class="glossary-item"><h3>Algorithm</h3><p>An algorithm is a set of rules or calculations used to process information and determine outputs such as search rankings.</p></li>
        <li class="glossary-item"><h3>Alt text</h3><p>A written description attached to an image in HTML; screen readers announce it and search engines use it to understand the image.</p></li>
        <li class="glossary-item"><h3>AMP</h3><p>Accelerated Mobile Pages, a Google-backed framework of stripped-down HTML intended to make mobile pages load near-instantly.</p></li>
        <li class="glossary-item"><h3>Anchor text</h3><p>The visible, clickable words of a link, signalling to readers and search engines what the destination page is about.</p></li>
        <li class="glossary-item"><h3>Answer engine</h3><p>An answer engine is a system that responds to a query with a direct answer instead of a list of links.</p></li>
        <li class="glossary-item"><h3>Artificial Intelligence (AI)</h3><p>Software that performs tasks associated with human thinking, such as language understanding; it underpins modern ranking systems and answer engines.</p></li>
        <li class="glossary-item"><h3>Authoritativeness</h3><p>How much trust a site or author has earned on a subject; one pillar of the E-E-A-T quality framework.</p></li>
        <li class="glossary-item"><h3>Auto-generated content</h3><p>Content produced by scripts or models with little human input; risky for rankings when it adds no original value.</p></li>
      </ul>
    </section>

    <section id="B" class="glossary-letter">
      <h2>B</h2>
      <ul>
        <li class="glossary-item"><h3>B2B</h3><p>Business-to-business: companies selling to other companies, with marketing built around niche queries and long buying cycles.</p></li>
        <li class="glossary-item"><h3>B2C</h3><p>Business-to-consumer: selling directly to individuals, usually with broader audiences and shorter purchase paths.</p></li>
        <li class="glossary-item"><h3>Backlink (external link)</h3><p>A link pointing to your site from another domain; a core credibility signal in ranking systems.</p></li>
        <li class="glossary-item"><h3>Barnacle SEO</h3><p>Gaining visibility by attaching to high-authority platforms such as marketplaces, directories and review sites instead of relying only on your own domain.</p></li>
        <li class="glossary-item"><h3>Bing Webmaster Tools</h3><p>Microsoft's free console for monitoring how a site is crawled, indexed and ranked in Bing.</p></li>
        <li class="glossary-item"><h3>Black hat SEO</h3><p>Tactics that break search engine rules, such as cloaking and link schemes, trading short-term gains for penalty risk.</p></li>
        <li class="glossary-item"><h3>Bounce rate</h3><p>The share of sessions that end after a single page view, with no further interaction.</p></li>
        <li class="glossary-item"><h3>Branded keyword</h3><p>A query containing a company or product name, capturing searchers already aware of the brand.</p></li>
        <li class="glossary-item"><h3>Breadcrumb</h3><p>A small navigation trail showing where the current page sits in the site hierarchy.</p></li>
        <li class="glossary-item"><h3>Broken link</h3><p>A link whose destination no longer resolves; it hurts user experience and wastes crawl attention.</p></li>
        <li class="glossary-item"><h3>Browser</h3><p>The application, such as Chrome or Safari, that requests, renders and displays web pages.</p></li>
        <li class="glossary-item"><h3>Business directory</h3><p>A listings site publishing company names, addresses and details; consistent listings support local visibility.</p></li>
      </ul>
    </section>

    <section id="C" class="glossary-letter">
      <h2>C</h2>
      <ul>
        <li class="glossary-item"><h3>Cache</h3><p>A stored copy of previously fetched content, kept so it can be served again without being regenerated.</p></li>
        <li class="glossary-item"><h3>Caching</h3><p>The practice of saving and reusing copies of pages or assets to cut load times and server work.</p></li>
        <li class="glossary-item"><h3>Caffeine</h3><p>Google's 2010 indexing infrastructure overhaul, built to index fresh content continuously rather than in batches.</p></li>
        <li class="glossary-item"><h3>Canonical URL</h3><p>The address you declare as the definitive version of a page when several URLs carry the same content.</p></li>
        <li class="glossary-item"><h3>Carousel</h3><p>A rotating or swipeable row of results or images, common both in search features and on-page galleries.</p></li>
        <li class="glossary-item"><h3>Category page</h3><p>A page grouping related products or articles; often the main entry point for mid-funnel queries in e-commerce.</p></li>
        <li class="glossary-item"><h3>ccTLD</h3><p>A country-code top-level domain, such as .fr or .ca, tying a site to a specific country.</p></li>
        <li class="glossary-item"><h3>CDN</h3><p>A content delivery network: geographically distributed servers that serve assets from a location near each visitor.</p></li>
        <li class="glossary-item"><h3>Citation</h3><p>A mention of a business's name, address and phone number on another site, with or without a link; an input to local rankings.</p></li>
        <li class="glossary-item"><h3>Citation Flow</h3><p>Majestic's 0-100 metric estimating a URL's link power from the quantity of links pointing at it.</p></li>
        <li class="glossary-item"><h3>Click depth</h3><p>How many clicks a page sits from the homepage; deeply buried pages are crawled and ranked less easily.</p></li>
        <li class="glossary-item"><h3>Click-through rate</h3><p>Clicks divided by impressions: the share of people who saw a listing and clicked it.</p></li>
        <li class="glossary-item"><h3>Clickbait</h3><p>Headlines engineered to provoke clicks through curiosity or exaggeration, often underdelivering on the page itself.</p></li>
        <li class="glossary-item"><h3>Client-side rendering</h3><p>Building the page in the browser with JavaScript after a minimal HTML shell loads; it can complicate crawling.</p></li>
        <li class="glossary-item"><h3>Cloaking</h3><p>Serving different content to crawlers than to human visitors; a direct guideline violation.</p></li>
        <li class="glossary-item"><h3>CLS</h3><p>Cumulative Layout Shift, a Core Web Vital measuring how much page elements move around while loading.</p></li>
        <li class="glossary-item"><h3>CMS</h3><p>A content management system, such as WordPress, that lets non-developers publish and manage site content.</p></li>
        <li class="glossary-item"><h3>Commercial intent</h3><p>Searches from people comparing options before buying, typically phrased with words like best, review or versus.</p></li>
        <li class="glossary-item"><h3>Content gap analysis</h3><p>Comparing your coverage against competitors to find topics they rank for that you have not yet addressed.</p></li>
        <li class="glossary-item"><h3>Content hub</h3><p>A structured cluster of interlinked pages around one theme, typically a pillar page plus supporting articles.</p></li>
        <li class="glossary-item"><h3>Content is King</h3><p>The long-running maxim that the substance and usefulness of content outweigh technical tricks over time.</p></li>
        <li class="glossary-item"><h3>Content marketing</h3><p>Earning attention by publishing genuinely useful or entertaining material rather than direct advertising.</p></li>
        <li class="glossary-item"><h3>Conversion</h3><p>A visitor completing the action a page exists for: a purchase, signup, download or enquiry.</p></li>
        <li class="glossary-item"><h3>Conversion rate</h3><p>Conversions divided by visitors; the percentage of traffic that completes the goal.</p></li>
        <li class="glossary-item"><h3>Core Web Vitals</h3><p>Google's user-experience metrics covering loading, interactivity and visual stability, used as ranking inputs.</p></li>
        <li class="glossary-item"><h3>Cornerstone content</h3><p>The handful of comprehensive pages a site treats as its most important, linked to heavily from elsewhere.</p></li>
        <li class="glossary-item"><h3>CPC</h3><p>Cost per click: what an advertiser pays for each click in paid search or display.</p></li>
        <li class="glossary-item"><h3>CPM</h3><p>Cost per mille: the price of a thousand ad impressions.</p></li>
        <li class="glossary-item"><h3>Crawl budget</h3><p>The number of URLs a search engine is willing to fetch from a site within a given period.</p></li>
        <li class="glossary-item"><h3>Crawl error</h3><p>A failure encountered when a bot tries to fetch a URL, such as a server error, timeout or missing page.</p></li>
        <li class="glossary-item"><h3>Crawler</h3><p>An automated program, also called a spider or bot, that follows links and downloads pages for indexing.</p></li>
        <li class="glossary-item"><h3>Crawler directive</h3><p>An instruction, via robots.txt, a meta robots tag or an HTTP header, telling bots what to crawl or index.</p></li>
        <li class="glossary-item"><h3>Crawling</h3><p>The discovery phase in which bots fetch pages and follow their links to find more.</p></li>
        <li class="glossary-item"><h3>CSS</h3><p>Cascading Style Sheets: the language controlling how HTML looks, including layout, color and typography.</p></li>
        <li class="glossary-item"><h3>CTA</h3><p>A call to action: the button or line that tells visitors what to do next.</p></li>
      </ul>
    </section>

    <section id="D" class="glossary-letter">
      <h2>D</h2>
      <ul>
        <li class="glossary-item"><h3>De-indexed</h3><p>Removed from a search engine's index entirely, whether through a penalty or a noindex directive.</p></li>
        <li class="glossary-item"><h3>Disavow</h3><p>Telling Google to ignore specific inbound links you cannot remove, using its disavow tool.</p></li>
        <li class="glossary-item"><h3>DNS</h3><p>The Domain Name System: the lookup layer translating human-readable domains into server IP addresses.</p></li>
        <li class="glossary-item"><h3>DoFollow</h3><p>The everyday label for a normal link carrying no nofollow attribute, meaning it passes ranking signals.</p></li>
        <li class="glossary-item"><h3>DOM</h3><p>The Document Object Model: the browser's live, scriptable representation of a rendered page.</p></li>
        <li class="glossary-item"><h3>Domain age</h3><p>How long a domain has existed; any trust correlation comes mostly from its accumulated history rather than age itself.</p></li>
        <li class="glossary-item"><h3>Domain Authority</h3><p>Moz's 1-100 prediction of how well a domain will rank, based largely on its link profile.</p></li>
        <li class="glossary-item"><h3>Domain history</h3><p>Everything a domain was used for before you owned it; past penalties or spam can linger.</p></li>
        <li class="glossary-item"><h3>Domain name registrar</h3><p>The accredited company where domain names are bought and renewed.</p></li>
        <li class="glossary-item"><h3>Domain Rating</h3><p>Ahrefs' 0-100 measure of a domain's backlink strength.</p></li>
        <li class="glossary-item"><h3>Doorway page</h3><p>A thin page built only to rank for a query and funnel visitors elsewhere; against guidelines.</p></li>
        <li class="glossary-item"><h3>Downtime</h3><p>Periods when a site is unreachable; frequent outages erode the trust of both users and crawlers.</p></li>
        <li class="glossary-item"><h3>Duplicate content</h3><p>The same or nearly identical content reachable at multiple URLs, splitting ranking signals between them.</p></li>
        <li class="glossary-item"><h3>Dwell time</h3><p>How long a searcher stays on a page before returning to the results.</p></li>
        <li class="glossary-item"><h3>Dynamic content</h3><p>Page content assembled per request or per user rather than stored as fixed HTML.</p></li>
        <li class="glossary-item"><h3>Dynamic URL</h3><p>An address generated from query parameters rather than a fixed, readable path.</p></li>
      </ul>
    </section>

    <section id="E" class="glossary-letter">
      <h2>E</h2>
      <ul>
        <li class="glossary-item"><h3>E-A-T</h3><p>Expertise, Authoritativeness and Trustworthiness: Google's original content quality framework, since extended to E-E-A-T.</p></li>
        <li class="glossary-item"><h3>E-commerce SEO</h3><p>Optimizing online stores: category structure, product pages, faceted navigation and review markup.</p></li>
        <li class="glossary-item"><h3>E-E-A-T</h3><p>Experience, Expertise, Authoritativeness and Trustworthiness: the criteria Google's quality raters use to judge content credibility.</p></li>
        <li class="glossary-item"><h3>Engagement</h3><p>How visitors interact once they arrive: scrolling, clicking, time spent and return visits.</p></li>
        <li class="glossary-item"><h3>Evergreen content</h3><p>Material that stays relevant for years and keeps earning traffic without constant rewrites.</p></li>
      </ul>
    </section>

    <section id="F" class="glossary-letter">
      <h2>F</h2>
      <ul>
        <li class="glossary-item"><h3>Faceted navigation</h3><p>Filter systems on listing pages; powerful for users but hazardous for crawl budget when every combination gets its own URL.</p></li>
        <li class="glossary-item"><h3>Favicon</h3><p>The small site icon shown in browser tabs and in some search results.</p></li>
        <li class="glossary-item"><h3>Featured snippet</h3><p>The highlighted answer box shown above the classic results, extracted from one of the ranking pages.</p></li>
        <li class="glossary-item"><h3>Fetch as Google</h3><p>The former Search Console feature for viewing a page as Googlebot sees it, since replaced by the URL Inspection tool.</p></li>
        <li class="glossary-item"><h3>First Input Delay</h3><p>A retired Core Web Vital measuring the delay before a page reacted to the first interaction, replaced by INP.</p></li>
        <li class="glossary-item"><h3>Focus keyword</h3><p>The single query a page is deliberately built to answer.</p></li>
        <li class="glossary-item"><h3>Footer</h3><p>The bottom region of every page, typically carrying legal links, contact details and secondary navigation.</p></li>
        <li class="glossary-item"><h3>Freshness</h3><p>How recently content was published or meaningfully updated; it matters most for time-sensitive queries.</p></li>
      </ul>
    </section>

    <section id="G" class="glossary-letter">
      <h2>G</h2>
      <ul>
        <li class="glossary-item"><h3>Gateway web page</h3><p>Another name for a doorway page: thin content built purely as a ranking entry point.</p></li>
        <li class="glossary-item"><h3>Generative AI</h3><p>Models that produce new text, images or code from prompts; the technology behind AI assistants and answer engines.</p></li>
        <li class="glossary-item"><h3>Generative Engine Optimization (GEO)</h3><p>Generative Engine Optimization is the practice of structuring and optimizing content so that generative AI systems cite it in their answers.</p></li>
        <li class="glossary-item"><h3>Geo redirect</h3><p>Sending visitors to a different URL based on their detected location.</p></li>
        <li class="glossary-item"><h3>Google AI Overviews</h3><p>The AI-generated summaries Google shows above results, synthesized from multiple sources with citations.</p></li>
        <li class="glossary-item"><h3>Google Alerts</h3><p>A free service that emails you when new pages matching your chosen terms are indexed.</p></li>
        <li class="glossary-item"><h3>Google algorithm</h3><p>The full system of ranking calculations Google applies to order results, refined continually.</p></li>
        <li class="glossary-item"><h3>Google Autocomplete</h3><p>The query predictions that appear as you type in the search box; a window into common phrasings.</p></li>
        <li class="glossary-item"><h3>Google Business Profile</h3><p>The business listing, formerly Google My Business, that powers Maps results and the local panel for companies.</p></li>
        <li class="glossary-item"><h3>Google Lighthouse</h3><p>An open-source audit tool scoring pages on performance, accessibility, best practices and SEO.</p></li>
        <li class="glossary-item"><h3>Google Quality Guidelines</h3><p>The published rules describing which practices Google considers manipulative and penalty-worthy.</p></li>
        <li class="glossary-item"><h3>Google Sandbox</h3><p>The unconfirmed theory that brand-new domains are held back from ranking strongly for a period.</p></li>
        <li class="glossary-item"><h3>Google Search Console</h3><p>Google's free console showing how it crawls, indexes and ranks your site, including the queries you appear for.</p></li>
        <li class="glossary-item"><h3>Google Search Quality Rater Guidelines</h3><p>The manual given to human raters who evaluate result quality; a public blueprint of what Google wants content to be.</p></li>
        <li class="glossary-item"><h3>Google Tag Manager</h3><p>A container system for deploying analytics and marketing tags without editing site code.</p></li>
        <li class="glossary-item"><h3>Google Trends</h3><p>A free tool charting how search interest in a topic changes over time and by region.</p></li>
        <li class="glossary-item"><h3>Google update</h3><p>Any change to Google's ranking systems, from silent tweaks to named core updates that reshuffle results.</p></li>
        <li class="glossary-item"><h3>Googlebot</h3><p>Google's crawler: the bot that fetches pages for its index.</p></li>
        <li class="glossary-item"><h3>Gray hat SEO</h3><p>Tactics sitting in the ambiguous zone between accepted practice and outright violations.</p></li>
        <li class="glossary-item"><h3>Guest posting</h3><p>Writing articles for other sites, usually in exchange for exposure and a link back.</p></li>
      </ul>
    </section>

    <section id="H" class="glossary-letter">
      <h2>H</h2>
      <ul>
        <li class="glossary-item"><h3>Header tag</h3><p>The HTML heading elements h1 through h6 that give a page its outline structure.</p></li>
        <li class="glossary-item"><h3>Heading</h3><p>A section title marked up with a header tag, helping readers and crawlers scan the structure.</p></li>
        <li class="glossary-item"><h3>Headline</h3><p>The user-facing title of a piece, often the h1, whose job is to earn the click and set expectations.</p></li>
        <li class="glossary-item"><h3>Helpful content update</h3><p>Google's ranking system rewarding content written for people and demoting content produced mainly to rank.</p></li>
        <li class="glossary-item"><h3>Holistic SEO</h3><p>Treating rankings as the outcome of overall site quality, spanning content, UX, speed and security, rather than isolated tweaks.</p></li>
        <li class="glossary-item"><h3>Homepage</h3><p>A site's root page and usually its strongest URL, distributing authority through its links.</p></li>
        <li class="glossary-item"><h3>Hreflang</h3><p>The attribute telling search engines which language and regional versions of a page exist and who each is for.</p></li>
        <li class="glossary-item"><h3>.htaccess file</h3><p>An Apache configuration file controlling redirects, rewrites and access rules at directory level.</p></li>
        <li class="glossary-item"><h3>HTML</h3><p>HyperText Markup Language: the structural language every web page is built from.</p></li>
        <li class="glossary-item"><h3>HTTP</h3><p>The protocol browsers and servers use to exchange web content.</p></li>
        <li class="glossary-item"><h3>HTTPS</h3><p>HTTP secured with TLS encryption; the standard today and a confirmed lightweight ranking signal.</p></li>
        <li class="glossary-item"><h3>Hummingbird</h3><p>Google's 2013 core rewrite that shifted matching from individual keywords toward the meaning of whole queries.</p></li>
        <li class="glossary-item"><h3>Hyperlink</h3><p>The clickable connection between one document and another: the basic unit of the web.</p></li>
      </ul>
    </section>

    <section id="I" class="glossary-letter">
      <h2>I</h2>
      <ul>
        <li class="glossary-item"><h3>Image carousel</h3><p>A swipeable strip of images, either on a page or as a search feature.</p></li>
        <li class="glossary-item"><h3>Image compression</h3><p>Shrinking image file sizes with minimal visible loss to speed up page loads.</p></li>
        <li class="glossary-item"><h3>Image SEO</h3><p>Optimizing images with descriptive filenames, alt text, compression and modern formats so they load fast and rank in image search.</p></li>
        <li class="glossary-item"><h3>Image sitemap</h3><p>A sitemap, or sitemap extension, listing image URLs so crawlers can discover them reliably.</p></li>
        <li class="glossary-item"><h3>Impression</h3><p>One appearance of your listing in a set of search results, whether or not it was clicked.</p></li>
        <li class="glossary-item"><h3>Inbound link</h3><p>A link arriving at your site from an external domain; the same thing as a backlink.</p></li>
        <li class="glossary-item"><h3>Index</h3><p>The searchable database of pages a search engine has crawled and stored.</p></li>
        <li class="glossary-item"><h3>Index Coverage report</h3><p>The Search Console report, now called Page indexing, showing which URLs are indexed and why others are not.</p></li>
        <li class="glossary-item"><h3>Indexing</h3><p>The stage after crawling in which a page is processed, understood and stored for retrieval.</p></li>
        <li class="glossary-item"><h3>Informational intent</h3><p>Searches made in order to learn something: how-tos, definitions and explanations.</p></li>
        <li class="glossary-item"><h3>Intent</h3><p>The underlying goal behind a query; matching it decides which page format can rank.</p></li>
        <li class="glossary-item"><h3>Interaction to Next Paint (INP)</h3><p>The Core Web Vital measuring how quickly a page visibly responds to user input across the whole visit.</p></li>
        <li class="glossary-item"><h3>Internal link</h3><p>A link between two pages on the same site, distributing authority and defining site structure.</p></li>
        <li class="glossary-item"><h3>IP address</h3><p>The numeric network address identifying a device or server on the internet.</p></li>
      </ul>
    </section>

    <section id="J" class="glossary-letter">
      <h2>J</h2>
      <ul>
        <li class="glossary-item"><h3>JavaScript</h3><p>The programming language of interactive web pages; heavy reliance on it complicates crawling and rendering.</p></li>
        <li class="glossary-item"><h3>JSON-LD</h3><p>The JSON-based format Google recommends for adding structured data to pages.</p></li>
      </ul>
    </section>

    <section id="K" class="glossary-letter">
      <h2>K</h2>
      <ul>
        <li class="glossary-item"><h3>Keyword</h3><p>Any word or phrase people type, or say, into a search engine.</p></li>
        <li class="glossary-item"><h3>Keyword cannibalization</h3><p>Multiple pages on one site competing for the same query, splitting signals and destabilizing rankings.</p></li>
        <li class="glossary-item"><h3>Keyword density</h3><p>The percentage of a text made up of a given term; an obsolete optimization target.</p></li>
        <li class="glossary-item"><h3>Keyword difficulty</h3><p>An estimate of how hard it would be to outrank the current results for a query, usually based on their link strength.</p></li>
        <li class="glossary-item"><h3>Keyword mapping</h3><p>Assigning each target query to a specific page so a site covers demand without overlaps.</p></li>
        <li class="glossary-item"><h3>Keyword metric</h3><p>Any measurement attached to a query, such as volume, difficulty, cost per click or trend, used to compare opportunities.</p></li>
        <li class="glossary-item"><h3>Keyword research</h3><p>Keyword research is the process of identifying and analyzing search terms used by people when searching for information.</p></li>
        <li class="glossary-item"><h3>Keyword stuffing</h3><p>Cramming a term unnaturally often into a page; an old spam tactic that now backfires.</p></li>
        <li class="glossary-item"><h3>KGR (Keyword Golden Ratio)</h3><p>A ratio comparing how many pages target a phrase in their title against its search volume, used to spot easy long-tail opportunities.</p></li>
        <li class="glossary-item"><h3>Knowledge Graph</h3><p>Google's database of entities, such as people, places and organizations, and the relationships between them.</p></li>
        <li class="glossary-item"><h3>Knowledge Panel</h3><p>The information box about an entity shown beside search results, drawn from the Knowledge Graph.</p></li>
        <li class="glossary-item"><h3>KPI</h3><p>A key performance indicator: the metric a team agrees to judge success by.</p></li>
      </ul>
    </section>

    <section id="L" class="glossary-letter">
      <h2>L</h2>
      <ul>
        <li class="glossary-item"><h3>Landing page</h3><p>The page a visitor arrives on from a search result, ad or link; often purpose-built for one campaign or query.</p></li>
        <li class="glossary-item"><h3>Large Language Model (LLM)</h3><p>A neural network trained on massive text collections to understand and generate language; the technology behind AI assistants.</p></li>
        <li class="glossary-item"><h3>Largest Contentful Paint (LCP)</h3><p>The Core Web Vital measuring how long a page's main content takes to appear.</p></li>
        <li class="glossary-item"><h3>Lazy loading</h3><p>Deferring images or other assets until they are about to scroll into view, cutting initial load weight.</p></li>
        <li class="glossary-item"><h3>Link accessibility</h3><p>Whether links can actually be followed by all users and crawlers: real anchors, visible and reachable without scripts.</p></li>
        <li class="glossary-item"><h3>Link bait</h3><p>Content deliberately crafted to be so useful, novel or provocative that other sites link to it.</p></li>
        <li class="glossary-item"><h3>Link building</h3><p>The practice of earning or acquiring backlinks to strengthen a site's authority.</p></li>
        <li class="glossary-item"><h3>Link equity</h3><p>The ranking value a link transfers from one page to another; informally called link juice.</p></li>
        <li class="glossary-item"><h3>Link exchange (reciprocal links)</h3><p>Mutual linking arrangements between sites; at scale, treated as a link scheme.</p></li>
        <li class="glossary-item"><h3>Link farm</h3><p>A network of sites existing mainly to interlink and inflate authority; classic penalty territory.</p></li>
        <li class="glossary-item"><h3>Link profile</h3><p>The overall picture of a site's backlinks: how many, from where, with what anchors, and how natural.</p></li>
        <li class="glossary-item"><h3>Link rot</h3><p>The gradual decay of the web as linked pages disappear or move, leaving broken links behind.</p></li>
        <li class="glossary-item"><h3>Link scheme</h3><p>Any coordinated attempt to manufacture links that would not exist on merit, whether bought, swapped or automated.</p></li>
        <li class="glossary-item"><h3>Link velocity</h3><p>The rate at which a site gains or loses backlinks over time; unnatural spikes attract scrutiny.</p></li>
        <li class="glossary-item"><h3>Link volume</h3><p>The raw count of links pointing at a page or domain, before any quality weighting.</p></li>
        <li class="glossary-item"><h3>Local business schema</h3><p>Structured data describing a business's name, address, hours and offerings for search engines.</p></li>
        <li class="glossary-item"><h3>Local pack</h3><p>The map-plus-listings block shown for queries with local intent.</p></li>
        <li class="glossary-item"><h3>Local query</h3><p>A search that implies a place: a city name, near me phrasing, or a service usually bought locally.</p></li>
        <li class="glossary-item"><h3>Local SEO</h3><p>Optimizing to appear for searches in a geographic area through profiles, citations, reviews and local pages.</p></li>
        <li class="glossary-item"><h3>Local teaser</h3><p>The lighter local result block, a map with brief listings, shown for some hospitality and venue queries.</p></li>
        <li class="glossary-item"><h3>Login form</h3><p>The username-and-password gate to an account area; content behind it is invisible to crawlers.</p></li>
        <li class="glossary-item"><h3>Long-tail keyword</h3><p>A longer, more specific query with modest volume but clearer intent and easier competition.</p></li>
        <li class="glossary-item"><h3>LSI (Latent Semantic Indexing)</h3><p>A 1980s text-analysis technique; in SEO folklore, LSI keywords are related terms, a concept Google says it does not use.</p></li>
      </ul>
    </section>

    <section id="M" class="glossary-letter">
      <h2>M</h2>
      <ul>
        <li class="glossary-item"><h3>Manual penalty (manual action)</h3><p>A human reviewer at Google flagging a site for guideline violations, with a notice in Search Console.</p></li>
        <li class="glossary-item"><h3>Mention rate</h3><p>Mention rate is the share of AI answers to relevant prompts in which a given brand is mentioned.</p></li>
        <li class="glossary-item"><h3>Meta description</h3><p>The page summary in the HTML head that search engines may display as the snippet; it influences clicks, not rankings.</p></li>
        <li class="glossary-item"><h3>Meta keywords</h3><p>A defunct meta tag once used to declare a page's topics; ignored by Google for ranking.</p></li>
        <li class="glossary-item"><h3>Meta robots tag</h3><p>The in-page tag controlling indexing and link-following behavior for that URL.</p></li>
        <li class="glossary-item"><h3>Meta tags</h3><p>The head-section tags describing a page to browsers and crawlers: title, description, robots and more.</p></li>
        <li class="glossary-item"><h3>Microdata</h3><p>An HTML attribute syntax for embedding structured data inline; largely superseded by JSON-LD.</p></li>
        <li class="glossary-item"><h3>Mirror website</h3><p>A full copy of a site hosted at a different address; without canonicalization, a duplicate-content problem.</p></li>
        <li class="glossary-item"><h3>Mobile SEO</h3><p>Ensuring a site works, loads fast and ranks on phones, where most searches now happen.</p></li>
        <li class="glossary-item"><h3>Mobile-first indexing</h3><p>Google indexing and ranking based on the mobile version of your pages rather than the desktop version.</p></li>
        <li class="glossary-item"><h3>MozRank</h3><p>Moz's discontinued logarithmic link-popularity score, an early approximation of PageRank.</p></li>
      </ul>
    </section>

    <section id="N" class="glossary-letter">
      <h2>N</h2>
      <ul>
        <li class="glossary-item"><h3>NAP</h3><p>Name, Address and Phone: the business details whose consistency across the web underpins local rankings.</p></li>
        <li class="glossary-item"><h3>Natural link (editorial link)</h3><p>A link someone gave freely because your content deserved it; the kind guidelines want.</p></li>
        <li class="glossary-item"><h3>Navigation</h3><p>The menu and link systems that let visitors move through a site.</p></li>
        <li class="glossary-item"><h3>Navigational intent</h3><p>Searches aimed at reaching a specific known site or page.</p></li>
        <li class="glossary-item"><h3>Negative SEO</h3><p>Attempts to damage a competitor's rankings, for example by pointing toxic links at their site.</p></li>
        <li class="glossary-item"><h3>Noarchive tag</h3><p>A robots directive asking search engines not to store a cached copy of the page.</p></li>
        <li class="glossary-item"><h3>NoFollow</h3><p>The rel attribute telling search engines a link is not an endorsement and should not pass authority.</p></li>
        <li class="glossary-item"><h3>NoIndex tag</h3><p>The directive telling search engines to keep a page out of their index.</p></li>
        <li class="glossary-item"><h3>Nosnippet tag</h3><p>A directive preventing search engines from showing any text or video snippet for the page.</p></li>
      </ul>
    </section>

    <section id="O" class="glossary-letter">
      <h2>O</h2>
      <ul>
        <li class="glossary-item"><h3>Off-page SEO</h3><p>Everything done away from your own site to build authority: links, mentions, reviews and PR.</p></li>
        <li class="glossary-item"><h3>On-page SEO</h3><p>Optimizing what is on the page itself: content, headings, titles, internal links and markup.</p></li>
        <li class="glossary-item"><h3>Open Graph</h3><p>Meta tags controlling how a URL previews when shared on social platforms.</p></li>
        <li class="glossary-item"><h3>Organic snippet</h3><p>A standard unpaid listing, made up of title, URL and description, in the results.</p></li>
        <li class="glossary-item"><h3>Organic traffic</h3><p>Visits arriving from unpaid search listings.</p></li>
        <li class="glossary-item"><h3>Orphaned page</h3><p>A live page no internal link points to, making it hard for crawlers and users to find.</p></li>
        <li class="glossary-item"><h3>Outbound link</h3><p>A link from your page to another domain.</p></li>
      </ul>
    </section>

    <section id="P" class="glossary-letter">
      <h2>P</h2>
      <ul>
        <li class="glossary-item"><h3>Page Authority</h3><p>Moz's 1-100 prediction of an individual page's ranking strength.</p></li>
        <li class="glossary-item"><h3>Page speed</h3><p>How fast a page loads and becomes usable; both a user-experience factor and a ranking input.</p></li>
        <li class="glossary-item"><h3>PageRank (link juice)</h3><p>Google's foundational algorithm scoring pages by the quantity and quality of links pointing at them.</p></li>
        <li class="glossary-item"><h3>Pagination</h3><p>Splitting long listings across a numbered sequence of pages.</p></li>
        <li class="glossary-item"><h3>Paid traffic</h3><p>Visits bought through advertising rather than earned organically.</p></li>
        <li class="glossary-item"><h3>Panda</h3><p>Google's 2011 algorithm targeting thin and low-quality content, later folded into the core systems.</p></li>
        <li class="glossary-item"><h3>Parasite SEO</h3><p>Publishing on high-authority third-party domains to piggyback on their ranking power.</p></li>
        <li class="glossary-item"><h3>PBN</h3><p>A private blog network: a ring of sites owned solely to link to a money site; a penalizable scheme.</p></li>
        <li class="glossary-item"><h3>Penguin algorithm</h3><p>Google's 2012 update targeting manipulative link profiles, now running in real time within the core.</p></li>
        <li class="glossary-item"><h3>People Also Ask</h3><p>The expandable question boxes in results revealing related queries and their answers.</p></li>
        <li class="glossary-item"><h3>People-first content</h3><p>Google's phrase for content written to help a reader, as opposed to content assembled to rank.</p></li>
        <li class="glossary-item"><h3>Permalink</h3><p>A page's permanent, stable URL.</p></li>
        <li class="glossary-item"><h3>Personalization</h3><p>Adjusting results per user based on location, history and context, which is why two people can see different rankings.</p></li>
        <li class="glossary-item"><h3>PHP</h3><p>A widely used server-side language powering platforms such as WordPress.</p></li>
        <li class="glossary-item"><h3>Pigeon</h3><p>Google's 2014 update tying local results more closely to traditional ranking signals.</p></li>
        <li class="glossary-item"><h3>Pogo-sticking</h3><p>A searcher bouncing back from a result and clicking a different one; a sign the first did not satisfy.</p></li>
        <li class="glossary-item"><h3>PPC</h3><p>Pay-per-click advertising, in which you pay only when someone clicks the ad.</p></li>
        <li class="glossary-item"><h3>Prominence</h3><p>In local search, how well known a business appears to be through reviews, mentions and links, beyond mere proximity.</p></li>
        <li class="glossary-item"><h3>Protocol</h3><p>The scheme portion of a URL declaring how the resource is fetched.</p></li>
        <li class="glossary-item"><h3>Pruning</h3><p>Removing or consolidating weak pages so a site's overall quality profile improves.</p></li>
        <li class="glossary-item"><h3>Purchased link</h3><p>A link paid for to influence rankings; it must be marked nofollow or sponsored or it violates guidelines.</p></li>
      </ul>
    </section>

    <section id="Q" class="glossary-letter">
      <h2>Q</h2>
      <ul>
        <li class="glossary-item"><h3>Query</h3><p>Whatever the user actually typed or spoke into the search box.</p></li>
      </ul>
    </section>

    <section id="R" class="glossary-letter">
      <h2>R</h2>
      <ul>
        <li class="glossary-item"><h3>Rank-tracking</h3><p>Rank-tracking is the process of monitoring the position of keywords or webpages in search results over time.</p></li>
        <li class="glossary-item"><h3>RankBrain</h3><p>Google's 2015 machine-learning system that helps interpret unfamiliar queries by meaning.</p></li>
        <li class="glossary-item"><h3>Ranking factor</h3><p>A ranking factor is an element or criterion used by a search system when determining the position of a result.</p></li>
        <li class="glossary-item"><h3>Ranking position</h3><p>Ranking position identifies the order in which a result appears for a particular query.</p></li>
        <li class="glossary-item"><h3>Readability score</h3><p>A numeric estimate of how easy a text is to read, such as the Flesch scales.</p></li>
        <li class="glossary-item"><h3>Redirection</h3><p>Forwarding one URL to another, permanently with a 301 or temporarily with a 302, preserving users and most equity.</p></li>
        <li class="glossary-item"><h3>Referral traffic</h3><p>Visits arriving via links on other sites, as distinct from search or direct visits.</p></li>
        <li class="glossary-item"><h3>Referrer</h3><p>The URL a visitor came from, passed along in the request headers.</p></li>
        <li class="glossary-item"><h3>Referring domain</h3><p>A unique domain that links to you at least once; usually a better health measure than raw link counts.</p></li>
        <li class="glossary-item"><h3>Rel=canonical</h3><p>The link element declaring which URL is the master version of duplicated or similar content.</p></li>
        <li class="glossary-item"><h3>Rel=sponsored</h3><p>The attribute marking paid or advertising links.</p></li>
        <li class="glossary-item"><h3>Rel=ugc</h3><p>The attribute marking links created by users, such as comments or forum posts.</p></li>
        <li class="glossary-item"><h3>Related searches</h3><p>The alternative queries search engines suggest alongside or below the results.</p></li>
        <li class="glossary-item"><h3>Relative link</h3><p>A link written from the current location instead of as a full address.</p></li>
        <li class="glossary-item"><h3>Relevance</h3><p>How closely a page matches what a query is actually asking; the first filter before authority matters.</p></li>
        <li class="glossary-item"><h3>Rendering</h3><p>Executing a page's code to produce what a user, or crawler, actually sees.</p></li>
        <li class="glossary-item"><h3>Responsive design</h3><p>One layout that adapts fluidly to any screen size; the recommended approach for mobile.</p></li>
        <li class="glossary-item"><h3>Rich snippet</h3><p>A result enhanced with extras such as stars, prices or FAQs, drawn from structured data.</p></li>
        <li class="glossary-item"><h3>Robots.txt</h3><p>The root file telling crawlers which parts of a site they may or may not fetch.</p></li>
        <li class="glossary-item"><h3>ROI</h3><p>Return on investment: what a marketing effort earned relative to what it cost.</p></li>
        <li class="glossary-item"><h3>Root domain</h3><p>The registrable domain itself, including all of its subdomains and pages.</p></li>
      </ul>
    </section>

    <section id="S" class="glossary-letter">
      <h2>S</h2>
      <ul>
        <li class="glossary-item"><h3>SaaS</h3><p>Software as a service: software delivered by subscription in the browser rather than installed locally.</p></li>
        <li class="glossary-item"><h3>Schema.org</h3><p>The shared vocabulary, backed by the major search engines, for describing content with structured data.</p></li>
        <li class="glossary-item"><h3>Scraped content</h3><p>Content lifted from other sites and republished without added value; both a quality and a legal problem.</p></li>
        <li class="glossary-item"><h3>Search engine</h3><p>The system that crawls, indexes and ranks the web to answer queries.</p></li>
        <li class="glossary-item"><h3>Search forms</h3><p>On-site search boxes; their result URLs usually should not be indexable.</p></li>
        <li class="glossary-item"><h3>Search history</h3><p>A user's past queries, which engines use to personalize what they show next.</p></li>
        <li class="glossary-item"><h3>Search operator</h3><p>Special query syntax, such as site: or quotation marks, that refines what a search returns.</p></li>
        <li class="glossary-item"><h3>Search result</h3><p>A single listing returned for a query, whether paid or organic.</p></li>
        <li class="glossary-item"><h3>Search volume</h3><p>The estimated number of times a query is searched per month.</p></li>
        <li class="glossary-item"><h3>Seasonal trend</h3><p>Predictable demand cycles in which interest for a topic rises and falls with the calendar.</p></li>
        <li class="glossary-item"><h3>Seed keyword</h3><p>The short starting phrase from which a keyword-research session expands.</p></li>
        <li class="glossary-item"><h3>SEM</h3><p>Search engine marketing: the umbrella term for winning search visibility, in practice usually meaning paid search.</p></li>
        <li class="glossary-item"><h3>Semantic search</h3><p>Ranking by the meaning and intent of queries and content rather than literal word matches.</p></li>
        <li class="glossary-item"><h3>SEO</h3><p>Search engine optimization: improving a site so it earns more, and better, organic search traffic.</p></li>
        <li class="glossary-item"><h3>SEO audit</h3><p>A structured review of a site's technical health, content and links, ending in a prioritized fix list.</p></li>
        <li class="glossary-item"><h3>SEO myth</h3><p>A widely repeated belief about rankings that evidence does not support.</p></li>
        <li class="glossary-item"><h3>SEO-friendly URL</h3><p>A short, readable address that describes the page instead of a string of parameters.</p></li>
        <li class="glossary-item"><h3>SERP</h3><p>A SERP, or search engine results page, is the page a search engine returns in response to a query.</p></li>
        <li class="glossary-item"><h3>SERP analysis</h3><p>Studying what currently ranks for a query, including formats, strength and features, before deciding to compete.</p></li>
        <li class="glossary-item"><h3>SERP feature</h3><p>Any result element beyond the classic organic listings: snippets, packs, panels, ads and AI overviews.</p></li>
        <li class="glossary-item"><h3>SERP visibility</h3><p>The share of available search real estate a site captures across its tracked queries.</p></li>
        <li class="glossary-item"><h3>SERP volatility</h3><p>How much rankings churn day to day; spikes usually mean an algorithm update is rolling out.</p></li>
        <li class="glossary-item"><h3>Server-side rendering</h3><p>Generating the full HTML on the server before sending it, so browsers and crawlers receive complete pages.</p></li>
        <li class="glossary-item"><h3>Share of market</h3><p>Your slice of an industry's total sales or customers.</p></li>
        <li class="glossary-item"><h3>Share of Search</h3><p>Share of Search is a brand's proportion of total search interest within its category, compared with competitors.</p></li>
        <li class="glossary-item"><h3>Share of voice</h3><p>The portion of total visibility, organic, paid or media, that your brand owns versus competitors.</p></li>
        <li class="glossary-item"><h3>Sitelinks</h3><p>The extra shortcut links sometimes shown beneath a top result, pointing to key pages of that site.</p></li>
        <li class="glossary-item"><h3>Sitemap</h3><p>A machine-readable file, usually XML, listing a site's URLs to help engines discover them.</p></li>
        <li class="glossary-item"><h3>Sitewide links</h3><p>Links appearing on every page of a site, typically in headers or footers.</p></li>
        <li class="glossary-item"><h3>Slug</h3><p>The final, human-readable part of a URL path identifying the page.</p></li>
        <li class="glossary-item"><h3>Spammy tactic</h3><p>Any manipulation aimed at rankings rather than users; the umbrella term in search spam policies.</p></li>
        <li class="glossary-item"><h3>SSL certificate</h3><p>The certificate enabling encrypted HTTPS connections and the padlock in the address bar.</p></li>
        <li class="glossary-item"><h3>Status code</h3><p>The server's numeric reply to a request, such as 200 for success, 301 for a move or 404 for missing.</p></li>
        <li class="glossary-item"><h3>Structured data</h3><p>Machine-readable annotations describing page content, enabling rich results.</p></li>
        <li class="glossary-item"><h3>Subdomain</h3><p>A named division before the root domain, treated partly as its own site.</p></li>
      </ul>
    </section>

    <section id="T" class="glossary-letter">
      <h2>T</h2>
      <ul>
        <li class="glossary-item"><h3>Technical SEO</h3><p>The infrastructure side of optimization: crawlability, indexation, speed, rendering, canonicalization and security.</p></li>
        <li class="glossary-item"><h3>Thin content</h3><p>Pages offering little substance or originality relative to what the query deserves.</p></li>
        <li class="glossary-item"><h3>Thumbnail</h3><p>A small preview image representing content in listings and features.</p></li>
        <li class="glossary-item"><h3>Time on page</h3><p>How long visitors spend on a page before moving on; a rough engagement proxy.</p></li>
        <li class="glossary-item"><h3>Title tag</h3><p>The HTML title of a page, shown in browser tabs and usually as the headline of its search listing.</p></li>
        <li class="glossary-item"><h3>TLD</h3><p>A top-level domain: the final suffix of a domain name, such as .com or .org.</p></li>
        <li class="glossary-item"><h3>Traffic</h3><p>The overall volume of visits a site receives.</p></li>
        <li class="glossary-item"><h3>Transactional intent</h3><p>Searches from people ready to act: buy, sign up, book or download.</p></li>
        <li class="glossary-item"><h3>Trust Flow</h3><p>Majestic's 0-100 metric weighing link quality by proximity to a curated set of trusted sites.</p></li>
      </ul>
    </section>

    <section id="U" class="glossary-letter">
      <h2>U</h2>
      <ul>
        <li class="glossary-item"><h3>UGC</h3><p>User-generated content: reviews, comments, forum posts and other visitor contributions.</p></li>
        <li class="glossary-item"><h3>Universal Search</h3><p>Blending verticals such as images, video, news and maps into one results page.</p></li>
        <li class="glossary-item"><h3>Unnatural link</h3><p>A link that exists to manipulate rankings rather than because it was deserved.</p></li>
        <li class="glossary-item"><h3>URL</h3><p>Uniform Resource Locator: the full web address of a resource.</p></li>
        <li class="glossary-item"><h3>URL folder</h3><p>A directory segment within a URL path used to organize content.</p></li>
        <li class="glossary-item"><h3>URL parameter</h3><p>The key-value pairs after a question mark in a URL, often creating duplicate variants of a page.</p></li>
        <li class="glossary-item"><h3>URL Rating</h3><p>Ahrefs' 0-100 measure of an individual URL's backlink strength.</p></li>
        <li class="glossary-item"><h3>User agent</h3><p>The identifier a browser or bot sends naming itself in each request.</p></li>
        <li class="glossary-item"><h3>UTM code</h3><p>Tagging parameters appended to URLs so analytics can attribute traffic to a campaign.</p></li>
        <li class="glossary-item"><h3>UX (user experience)</h3><p>The overall quality of using a site: clarity, speed and ease; increasingly inseparable from search performance.</p></li>
      </ul>
    </section>

    <section id="V" class="glossary-letter">
      <h2>V</h2>
      <ul>
        <li class="glossary-item"><h3>Voice search</h3><p>Spoken queries made through assistants; longer, conversational phrasing that favors direct answers.</p></li>
      </ul>
    </section>

    <section id="W" class="glossary-letter">
      <h2>W</h2>
      <ul>
        <li class="glossary-item"><h3>Webmaster guidelines</h3><p>The published rules, now called Google Search Essentials, defining acceptable practice.</p></li>
        <li class="glossary-item"><h3>Website navigation</h3><p>The overall system of menus and links structuring how a site is explored.</p></li>
        <li class="glossary-item"><h3>White hat SEO</h3><p>Working entirely within guidelines: earning rankings with quality, relevance and genuine links.</p></li>
        <li class="glossary-item"><h3>Word count</h3><p>The length of a text; a descriptive statistic, not a ranking target.</p></li>
      </ul>
    </section>

    <section id="X" class="glossary-letter">
      <h2>X</h2>
      <ul>
        <li class="glossary-item"><h3>X-Robots-Tag</h3><p>An HTTP header carrying robots directives, useful for non-HTML files such as PDFs.</p></li>
        <li class="glossary-item"><h3>XML</h3><p>Extensible Markup Language: the format sitemaps and many feeds are written in.</p></li>
      </ul>
    </section>

    <section id="Y" class="glossary-letter">
      <h2>Y</h2>
      <ul>
        <li class="glossary-item"><h3>Yahoo</h3><p>The veteran web portal whose search results have been powered by Bing for years.</p></li>
        <li class="glossary-item"><h3>Yandex</h3><p>The dominant search engine in Russia and neighboring markets.</p></li>
        <li class="glossary-item"><h3>YMYL</h3><p>Your Money or Your Life: topics affecting health, finances or safety, held to the strictest quality standards.</p></li>
        <li class="glossary-item"><h3>Yoast</h3><p>The widely installed WordPress plugin handling titles, sitemaps and on-page SEO checks.</p></li>
      </ul>
    </section>

    <section id="Z" class="glossary-letter">
      <h2>Z</h2>
      <ul>
        <li class="glossary-item"><h3>Zero-click searches</h3><p>Queries answered directly on the results page, so no listing receives the click.</p></li>
      </ul>
    </section>

  </div>

  <div id="no-results" class="no-results">No matching Echorank Lexicon entries were found.</div>

</section>

</main>

<footer class="footer">
  <div class="container">&copy; 2026 ECHORANK &middot; ChatLogic Insights Ltd &middot; Registered in England &amp; Wales No. 15593166<br><a href="/en/pricing">Pricing</a> &middot; <a href="/en/keyword-research">Keyword guide</a></div>
</footer>

<script>
document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("glossary-search");
  var clearSearchButton = document.getElementById("clear-search");
  var suggestionsList = document.getElementById("search-suggestions");
  var noResultsMessage = document.getElementById("no-results");
  var glossaryItems = document.querySelectorAll("#glossary-list .glossary-item");
  var glossaryLetters = document.querySelectorAll(".glossary-letter");
  var alphabetNav = document.getElementById("alphabet-nav");
  var alphabetLinks = alphabetNav.querySelectorAll("a");

  alphabetLinks.forEach(function (link) {
    var id = (link.getAttribute("href") || "").slice(1);
    if (!document.getElementById(id)) { link.classList.add("disabled"); }
  });

  function escapeRegExp(text) {
    return text.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  }

  function resetLexicon() {
    glossaryItems.forEach(function (item) {
      item.style.display = "list-item";
      var term = item.querySelector("h3");
      var description = item.querySelector("p");
      if (term) { term.innerHTML = term.textContent; }
      if (description) { description.innerHTML = description.textContent; }
    });
    glossaryLetters.forEach(function (letter) { letter.style.display = "block"; });
    noResultsMessage.style.display = "none";
    suggestionsList.innerHTML = "";
    suggestionsList.style.display = "none";
  }

  function filterLexicon() {
    var searchTerm = searchInput.value.trim().toLowerCase();
    var matchCount = 0;

    glossaryLetters.forEach(function (letter) { letter.style.display = "none"; });

    glossaryItems.forEach(function (item) {
      var termElement = item.querySelector("h3");
      var descriptionElement = item.querySelector("p");
      var termText = termElement ? termElement.textContent.toLowerCase() : "";
      var descriptionText = descriptionElement ? descriptionElement.textContent.toLowerCase() : "";
      var matches = termText.indexOf(searchTerm) !== -1 || descriptionText.indexOf(searchTerm) !== -1;

      if (matches) {
        item.style.display = "list-item";
        matchCount += 1;
        item.closest(".glossary-letter").style.display = "block";

        var highlightPattern = new RegExp("(" + escapeRegExp(searchTerm) + ")", "gi");
        if (termElement) {
          termElement.innerHTML = termElement.textContent.replace(highlightPattern, '<span class="highlight">$1</span>');
        }
        if (descriptionElement) {
          descriptionElement.innerHTML = descriptionElement.textContent.replace(highlightPattern, '<span class="highlight">$1</span>');
        }
      } else {
        item.style.display = "none";
        if (termElement) { termElement.innerHTML = termElement.textContent; }
        if (descriptionElement) { descriptionElement.innerHTML = descriptionElement.textContent; }
      }
    });

    noResultsMessage.style.display = matchCount > 0 ? "none" : "block";
    generateSuggestions(searchTerm);
  }

  function generateSuggestions(searchTerm) {
    var suggestions = [];
    if (searchTerm) {
      glossaryItems.forEach(function (item) {
        var termElement = item.querySelector("h3");
        var descriptionElement = item.querySelector("p");
        if (!termElement) { return; }
        var term = termElement.textContent;
        var termText = term.toLowerCase();
        var descriptionText = descriptionElement ? descriptionElement.textContent.toLowerCase() : "";
        if (termText.indexOf(searchTerm) !== -1 || descriptionText.indexOf(searchTerm) !== -1) {
          suggestions.push(term);
        }
      });
    }
    displaySuggestions(suggestions);
  }

  function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = "";
    if (suggestions.length === 0) {
      suggestionsList.style.display = "none";
      return;
    }
    suggestionsList.style.display = "block";
    suggestions.forEach(function (suggestion) {
      var item = document.createElement("li");
      item.textContent = suggestion;
      item.addEventListener("click", function () {
        searchInput.value = suggestion;
        filterLexicon();
        suggestionsList.innerHTML = "";
        suggestionsList.style.display = "none";
      });
      suggestionsList.appendChild(item);
    });
  }

  function updateActiveLetter() {
    var scrollPosition = window.scrollY;
    glossaryLetters.forEach(function (letter) {
      if (letter.style.display === "none") { return; }
      var letterTop = letter.offsetTop;
      var letterBottom = letterTop + letter.offsetHeight;
      var letterLink = alphabetNav.querySelector('a[href="#' + letter.id + '"]');
      if (scrollPosition >= letterTop - 170 && scrollPosition < letterBottom - 100) {
        alphabetLinks.forEach(function (link) { link.classList.remove("active"); });
        if (letterLink) { letterLink.classList.add("active"); }
      }
    });
  }

  searchInput.addEventListener("input", function () {
    if (searchInput.value.trim() === "") { resetLexicon(); return; }
    filterLexicon();
  });

  clearSearchButton.addEventListener("click", function () {
    searchInput.value = "";
    resetLexicon();
    searchInput.focus();
  });

  alphabetNav.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link || link.classList.contains("disabled")) { return; }
    if (searchInput.value.trim() !== "") {
      searchInput.value = "";
      resetLexicon();
    }
    alphabetLinks.forEach(function (alphabetLink) { alphabetLink.classList.remove("active"); });
    link.classList.add("active");
  });

  window.addEventListener("scroll", updateActiveLetter, { passive: true });

  resetLexicon();
});
</script>

</body>
</html>`;
