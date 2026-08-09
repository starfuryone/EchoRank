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
        <li class="glossary-item"><h3>AI Lens</h3><p>AI Lens is an Echorank tool that compares the raw HTML of a page with its rendered output to measure how much of your content AI crawlers can actually read.</p></li>
        <li class="glossary-item"><h3>AI visibility</h3><p>AI visibility describes how often and how prominently a brand appears in the answers produced by AI assistants and answer engines.</p></li>
        <li class="glossary-item"><h3>Algorithm</h3><p>An algorithm is a set of rules or calculations used to process information and determine outputs such as search rankings.</p></li>
        <li class="glossary-item"><h3>Answer engine</h3><p>An answer engine is a system that responds to a query with a direct answer instead of a list of links.</p></li>
      </ul>
    </section>

    <section id="G" class="glossary-letter">
      <h2>G</h2>
      <ul>
        <li class="glossary-item"><h3>Generative Engine Optimization (GEO)</h3><p>Generative Engine Optimization is the practice of structuring and optimizing content so that generative AI systems cite it in their answers.</p></li>
      </ul>
    </section>

    <section id="K" class="glossary-letter">
      <h2>K</h2>
      <ul>
        <li class="glossary-item"><h3>Keyword research</h3><p>Keyword research is the process of identifying and analyzing search terms used by people when searching for information.</p></li>
      </ul>
    </section>

    <section id="M" class="glossary-letter">
      <h2>M</h2>
      <ul>
        <li class="glossary-item"><h3>Mention rate</h3><p>Mention rate is the share of AI answers to relevant prompts in which a given brand is mentioned.</p></li>
      </ul>
    </section>

    <section id="R" class="glossary-letter">
      <h2>R</h2>
      <ul>
        <li class="glossary-item"><h3>Rank-tracking</h3><p>Rank-tracking is the process of monitoring the position of keywords or webpages in search results over time.</p></li>
        <li class="glossary-item"><h3>Ranking factor</h3><p>A ranking factor is an element or criterion used by a search system when determining the position of a result.</p></li>
        <li class="glossary-item"><h3>Ranking position</h3><p>Ranking position identifies the order in which a result appears for a particular query.</p></li>
      </ul>
    </section>

    <section id="S" class="glossary-letter">
      <h2>S</h2>
      <ul>
        <li class="glossary-item"><h3>SERP</h3><p>A SERP, or search engine results page, is the page a search engine returns in response to a query.</p></li>
        <li class="glossary-item"><h3>Share of Search</h3><p>Share of Search is a brand's proportion of total search interest within its category, compared with competitors.</p></li>
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
