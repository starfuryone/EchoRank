// Module 3 — Make your site answerable. Original Echorank course copy.

import type { AeoLesson } from "./types";

export const MODULE_3: AeoLesson[] = [
  {
    slug: "what-machines-actually-read",
    module: 3,
    title: "What machines actually read",
    summary:
      "Many AI crawlers read the raw HTML your server sends and do not run JavaScript. Content that appears only after scripts run may be invisible to them.",
    metaDescription:
      "Raw HTML versus the rendered page: why content loaded by JavaScript can be invisible to AI crawlers, how to check what they get, and how to fix it.",
    objectives: [
      "Tell the raw HTML of a page apart from what a browser renders",
      "Check what a non-rendering crawler receives from your key pages",
      "Prioritise fixes that move important text into the server response",
    ],
    produces: "A list of key pages with content a crawler cannot see",
    body: [
      {
        k: "p",
        t: "What you see in a browser is not always what a crawler receives. A browser downloads the page's HTML, runs its JavaScript and builds the final page. Many AI crawlers stop at the first step: they read the HTML the server sends and do not run scripts. Anything that only appears after JavaScript runs may be missing from what they read, and an assistant cannot quote what it never saw.",
      },
      { k: "graphic", id: "crawler-view" },
      { k: "h2", t: "Raw HTML versus the rendered page" },
      {
        k: "p",
        t: "The raw HTML is the text your server returns for a URL, before any script runs. The rendered page is what exists after the browser has run every script, fetched data and filled in the template. On a server-rendered site the two are nearly identical. On a site that builds its content in the browser, the raw HTML can be an almost empty shell with a script tag.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Some major search crawlers render JavaScript, often later than they fetch the HTML. Several AI crawlers document no rendering at all. Server-rendered text is the only kind every crawler can read.",
      },
      { k: "h2", t: "Where content hides" },
      {
        k: "table",
        caption: "Where content lives, and whether non-rendering crawlers see it",
        head: ["Content location", "Visible to non-rendering crawlers?", "Action"],
        rows: [
          ["Text in the server's HTML response", "Yes", "Keep it there; this is the target state"],
          ["Text injected by JavaScript after load", "No", "Render it on the server or at build time"],
          ["Text inside images, including charts of prices or hours", "No", "Repeat the facts in text near the image"],
          ["Tabs and accordions present in the HTML but hidden", "Usually yes", "Fine, if the text is in the HTML; check it"],
          ["Content behind a login, form or cookie wall", "No", "Publish a public version of what buyers need to know"],
          ["Text loaded on scroll or by clicking “load more”", "No", "Put the first, most important part in the initial HTML"],
        ],
      },
      { k: "h2", t: "How to check a page" },
      {
        k: "list",
        ordered: true,
        items: [
          "Open the page and view its source (not the inspector, which shows the rendered page).",
          "Search the source for a sentence you care about: a price, your opening hours, the first line of your product description.",
          "If the sentence is not in the source, a non-rendering crawler does not get it.",
          "Repeat for your most important page types: home, product or service pages, pricing, locations, and your best answers to buyer questions.",
        ],
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Check by page type, not page by page. If one product page hides its description behind a script, every page built from the same template probably does too, and one fix to the template repairs them all.",
      },
      { k: "h2", t: "Fixes, from cheapest to most thorough" },
      {
        k: "p",
        t: "The cheapest fix is often to repeat a few key facts in plain text: the hours under the image of the opening times, the price beside the interactive calculator. Next comes rendering the important sections on the server while keeping interactive parts in the browser. Most modern frameworks can do this page by page. The thorough fix is server-side or static rendering for every page that answers a buyer question.",
      },
      {
        k: "p",
        t: "Whatever you change, check the raw HTML again afterwards. It is easy to fix the visible page and leave the source exactly as it was.",
      },
      { k: "h2", t: "Worked example: Lumen CRM" },
      {
        k: "p",
        t: "Lumen CRM's pricing page loads its plans from an API after the page opens, so the raw HTML contains a heading and an empty container. The comparison table on the features page is built the same way. In the team's scorecard, assistants describe Lumen's pricing vaguely or not at all, and never cite the pricing page.",
      },
      {
        k: "p",
        t: "The developers move the plan names, what each includes and the billing terms into the server response, and keep only the currency switcher in the browser. They do the same for the comparison table. Viewing the source now shows every plan in text. The team notes the date of the change in the worksheet so the next scorecard cycles can be read against it.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Making text visible to crawlers removes a barrier; it does not guarantee the page will be read or cited. Measure the effect on your own panel over several cycles.",
      },
      { k: "h2", t: "What not to do" },
      {
        k: "p",
        t: "Do not show crawlers different content from what people see. Serving a special text-only version to bots, with claims your visitors never read, is cloaking, and it undermines the trust you are trying to build. The goal is one page that people and machines can both read in full.",
      },
    ],
    takeaways: [
      "Many AI crawlers read only the server's HTML and do not run JavaScript.",
      "Check the page source, not the rendered page, for the facts that matter.",
      "Move key text into the server response, template by template, and never show bots something people cannot see.",
    ],
    practice: {
      section: "site",
      steps: [
        "Pick one page of each important type on your site.",
        "View the source of each and search for its key facts: name, price or hours, the main claim.",
        "List every page type where a key fact is missing from the source, with the fix you will ask for.",
      ],
    },
    quiz: [
      {
        q: "Where should you look to see what a non-rendering crawler receives?",
        options: ["The browser's element inspector", "The page source (raw HTML)", "A screenshot of the page"],
        correct: 1,
        explain: "The inspector shows the rendered page; the source shows what the server sent.",
      },
      {
        q: "Your opening hours are only in an image. What is the simplest fix?",
        options: ["Make the image larger", "Repeat the hours in text near the image", "Add more images"],
        correct: 1,
        explain: "Crawlers read text, not pictures of text.",
      },
      {
        q: "Is it acceptable to serve bots a special version with extra claims?",
        options: ["Yes, if it helps visibility", "No; people and machines should get the same content", "Only for AI crawlers"],
        correct: 1,
        explain: "Different content for bots is cloaking and erodes trust.",
      },
    ],
    tool: {
      kind: "seo",
      tool: "ai_lens",
      name: "AI Lens",
      body: "Echorank's AI Lens compares your raw HTML with the fully rendered page and shows which content non-rendering crawlers miss.",
      href: "/technical-geo",
      cta: "See how it works",
    },
  },
  {
    slug: "crawler-access",
    module: 3,
    title: "Crawler access: robots.txt, AI user agents and llms.txt",
    summary:
      "Decide, agent by agent, which AI crawlers may read your site and for what purpose, then check that your CDN and firewall respect that decision.",
    metaDescription:
      "Control AI crawler access: robots.txt rules for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended, CDN blocks, bot logs and llms.txt.",
    objectives: [
      "Separate AI crawlers that fetch for search from those that collect training data",
      "Make a deliberate robots.txt decision per user agent",
      "Confirm in your logs and CDN settings that the decision is applied",
    ],
    produces: "A crawler access decision for each AI user agent",
    body: [
      {
        k: "p",
        t: "Your robots.txt file tells crawlers which parts of your site they may fetch. AI companies operate several crawlers with different purposes: some collect pages for model training, others fetch pages so an assistant can answer a question with current sources. Decide for each one whether you want it, write that decision in robots.txt, and then check that your CDN or firewall is not silently overriding it.",
      },
      { k: "graphic", id: "crawler-gate" },
      { k: "h2", t: "Search purposes and training purposes" },
      {
        k: "p",
        t: "The distinction matters because the trade-off is different. Blocking a crawler that fetches pages for search answers can remove you from those answers. Blocking a crawler that collects training data affects what future models learn from your pages, not today's searched answers. Several operators now document separate user agents for the two purposes, so you can make the decisions independently.",
      },
      {
        k: "table",
        caption: "Common AI user agents (check each operator's current documentation)",
        head: ["User agent", "Operator", "Purpose", "Decision to make"],
        rows: [
          ["OAI-SearchBot", "OpenAI", "Finds pages to show in ChatGPT's search answers", "Allow if you want to appear as a source in those answers"],
          ["GPTBot", "OpenAI", "Collects pages that may be used to train models", "Allow or block based on your stance on training"],
          ["ClaudeBot", "Anthropic", "Collects pages that may be used to train models", "Allow or block based on your stance on training"],
          ["PerplexityBot", "Perplexity", "Indexes pages for Perplexity's answers", "Allow if you want to appear in those answers"],
          ["Google-Extended", "Google", "A robots.txt token controlling use of content for Gemini models; it does not change Google Search", "Decide on model use separately from Search"],
          ["Googlebot", "Google", "Crawls for Google Search, which AI Overviews and AI Mode draw on", "Keep allowed if you want to be in Google Search"],
        ],
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "robots.txt is a request that well-behaved crawlers follow, not an access control. Operators publish their user agents and can change them; the table above reflects public documentation at the time of writing.",
      },
      { k: "h2", t: "Writing the rules" },
      {
        k: "p",
        t: "Each rule names a user agent and the paths it may not fetch. A blanket “disallow everything” for an agent blocks it entirely; an empty disallow allows it. Keep the rules simple and comment why each one exists, so the next person to edit the file understands the decision. After any change, request the live robots.txt from your domain and confirm the server returns exactly what you wrote.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "If you want to appear in AI answers, allow the crawlers that fetch for search and Googlebot, and make the training decision separately and deliberately. Write both decisions down with a date and the name of whoever made them.",
      },
      { k: "h2", t: "The blocks you did not choose" },
      {
        k: "p",
        t: "Many sites block AI crawlers without anyone deciding to. Bot-protection settings on a CDN or web application firewall can challenge or block unfamiliar agents by default, and the crawler gets an error page instead of your content while robots.txt says it is welcome. Check your CDN's bot settings for rules that mention AI crawlers, and confirm with your logs.",
      },
      { k: "h2", t: "Reading your bot logs" },
      {
        k: "p",
        t: "Your server or CDN logs record every request, including the user agent and the response code. Filter them for the AI user agents in the table. Requests that receive a success response are reaching your content; challenge pages, forbidden responses or no requests at all point to a block. Be aware that a user agent string can be faked, so treat logs as a signal and use the operators' published verification methods when it matters.",
      },
      { k: "h2", t: "What about llms.txt?" },
      {
        k: "p",
        t: "llms.txt is a proposed plain-text file at the root of a site that summarises the site and links to its most useful pages, written for language models. It is easy to publish and does no harm.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Adoption of llms.txt by the major answer engines is unconfirmed. Treat it as an experiment: publish one if it is cheap for you, but do not expect it to change answers on its own, and keep your real pages crawlable either way.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind's robots.txt is a template from its web agency and blocks nothing. Its logs, though, show no requests from OAI-SearchBot or PerplexityBot at all, and a handful of challenge responses for GPTBot. The CDN's bot-protection mode is set to challenge unfamiliar agents. Northwind decides to allow the search crawlers and Googlebot and to block training crawlers, writes that into robots.txt with comments, and adds allow rules for the search agents in the CDN. A week later, the logs show successful requests from both search crawlers.",
      },
    ],
    takeaways: [
      "AI crawlers serve different purposes; decide search access and training access separately.",
      "robots.txt states your decision, but CDN and firewall settings can override it, so check your logs.",
      "llms.txt is an unproven experiment; it is no substitute for crawlable pages.",
    ],
    practice: {
      section: "site",
      steps: [
        "Open your live robots.txt and list every rule that mentions an AI user agent.",
        "For each agent in the lesson's table, write allow or block, the reason and today's date.",
        "Check your CDN bot settings and a week of logs for those agents, and note any block you did not choose.",
      ],
    },
    quiz: [
      {
        q: "Why decide search crawlers and training crawlers separately?",
        options: [
          "They are operated by different countries",
          "Blocking search crawlers can remove you from answers; blocking training crawlers affects future models",
          "Training crawlers ignore robots.txt",
        ],
        correct: 1,
        explain: "The two purposes have different trade-offs, so they deserve separate decisions.",
      },
      {
        q: "robots.txt allows a crawler but your logs show challenge pages. What is the likely cause?",
        options: ["The crawler is broken", "A CDN or firewall bot setting", "llms.txt is missing"],
        correct: 1,
        explain: "Bot-protection rules can block agents that robots.txt welcomes.",
      },
      {
        q: "How should you treat llms.txt today?",
        options: ["As required by every engine", "As an inexpensive, unproven experiment", "As a replacement for robots.txt"],
        correct: 1,
        explain: "Major engines have not confirmed using it; your crawlable pages still matter most.",
      },
    ],
    tool: {
      kind: "external",
      name: "llms.txt Generator",
      body: "A free generator and validator for llms.txt files, by Echorank. Useful if you decide to run the experiment.",
      href: "https://llmstxt.echorank360.com/llms-txt-generator",
      cta: "Open the generator",
    },
  },
  {
    slug: "writing-answer-ready-pages",
    module: 3,
    title: "Writing answer-ready pages",
    summary:
      "Put the answer first, make each passage stand on its own, name things explicitly, date what changes, and keep structured data true to the visible page.",
    metaDescription:
      "Write answer-ready pages: lead with the answer, write self-contained passages, name entities and dates, use comparison tables and FAQs, and keep schema honest.",
    objectives: [
      "Rewrite a page so its first paragraph answers the question it targets",
      "Make passages that still make sense when quoted on their own",
      "Use tables, FAQs and schema.org markup that match what the page shows",
    ],
    produces: "A rewrite plan for your three most important answer pages",
    body: [
      {
        k: "p",
        t: "An answer-ready page states its answer in the first paragraph, explains it in passages that make sense when quoted alone, names products, places and dates explicitly, and backs claims with specifics. Assistants read pages in pieces and quote the pieces that answer a sub-question cleanly. Write so that any paragraph could be lifted out and still be correct.",
      },
      { k: "graphic", id: "page-anatomy" },
      { k: "h2", t: "Answer first" },
      {
        k: "p",
        t: "Open with the direct answer to the question the page exists for, in plain words, then give the detail. A page about children's appointments starts with who you see, when and where, not with the history of the practice. This helps readers as much as machines: someone who arrives from an answer wants confirmation fast.",
      },
      { k: "h2", t: "Self-contained passages" },
      {
        k: "p",
        t: "Assistants often retrieve a passage rather than a whole page. A passage that depends on the heading above it, or that refers to “it” and “this plan” without saying which, loses its meaning when quoted. Repeat the subject in each section, keep one idea per paragraph and put the important fact in the sentence itself rather than in a link.",
      },
      {
        k: "table",
        caption: "Weak patterns and answer-ready rewrites",
        head: ["Weak pattern", "Why it fails", "Answer-ready rewrite"],
        rows: [
          ["“Welcome to our world of smiles!” as the opening line", "Says nothing a question could be answered with", "“Northwind Dental sees children on weekday evenings at both Riverside locations.”"],
          ["“It's included in this plan.”", "“It” and “this plan” mean nothing out of context", "“Email reply tracking is included in Lumen CRM's Team plan.”"],
          ["Prices or hours only in an image", "Crawlers cannot read text inside images", "The same facts in a short text list beside the image"],
          ["“Recently updated our features”", "No date, so no way to judge freshness", "“Updated in March: shared inboxes for teams.”"],
          ["A long FAQ with marketing answers", "Answers dodge the question", "Short, direct answers that start with yes, no or the fact"],
        ],
      },
      { k: "h2", t: "Explicit entities and dates" },
      {
        k: "p",
        t: "Use full names the first time: your brand, the product, the city, the standard you meet. Write the date next to anything that changes, such as prices, opening hours, availability and feature lists. A dated fact can be trusted or flagged as stale; an undated one forces the reader, human or machine, to guess.",
      },
      { k: "h2", t: "Comparisons, tables and FAQs" },
      {
        k: "p",
        t: "Buyers ask comparison questions constantly, and the pages that answer them honestly tend to be the ones retrieved. Publish comparison pages that explain trade-offs fairly, including when a competitor is the better fit. Put specifications and plan differences in real HTML tables, not images. Add an FAQ where people genuinely ask the questions, with answers that begin with the answer.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Write comparison pages you would be comfortable showing the competitor. Unfair comparisons get contradicted by independent sources, and an assistant that reads both may trust neither.",
      },
      { k: "h2", t: "Structured data that matches the page" },
      {
        k: "p",
        t: "schema.org markup describes a page in a machine-readable form: an organisation, a local business with its hours, a product with its offers, a set of questions and answers. It helps machines identify what the page is about. It must describe what the page visibly shows. Markup that claims reviews, prices or answers the visitor cannot see is misleading, and search engines treat it as a violation.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Search engines document that structured data must reflect the visible content of the page. Markup is a description of the page, not a separate channel for extra claims.",
      },
      { k: "h2", t: "Refresh what goes stale" },
      {
        k: "p",
        t: "Keep a list of pages whose facts change: pricing, hours, team, feature lists, policies. Review them on a schedule, update the date when you change them, and remove or redirect pages about products you no longer sell. A stale page that ranks well can keep feeding wrong facts into answers long after you changed your offer.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind's children's dentistry page opens with three paragraphs about the founder. The rewrite opens with one sentence answering the question parents ask: which locations see children, on which evenings, and how to book. Below it, a short list gives the hours in text, a table compares the two locations, and an FAQ answers what parents actually ask at reception. The page's LocalBusiness markup lists the same hours the page shows, and the page carries the date it was last reviewed.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "A single page rewrite rarely moves answers on its own. Rewrite the pages tied to your weakest MRCA stage first and watch the scorecard for that stage over several cycles.",
      },
    ],
    takeaways: [
      "Lead with the answer and make every passage make sense when quoted alone.",
      "Name entities and date anything that changes; put comparisons and specs in real tables.",
      "Structured data must match the visible page, and stale pages need a review schedule.",
    ],
    practice: {
      section: "site",
      steps: [
        "Pick the three pages that should answer your most important unbranded prompts.",
        "For each, write the one-sentence answer it should open with, and list the facts that need dates.",
        "Note in the worksheet which weak patterns from the table each page has, and the owner of each rewrite.",
      ],
    },
    quiz: [
      {
        q: "Why should each passage make sense on its own?",
        options: [
          "Assistants often retrieve and quote passages rather than whole pages",
          "Shorter pages rank higher",
          "It reduces page weight",
        ],
        correct: 0,
        explain: "A passage that depends on context loses its meaning when quoted alone.",
      },
      {
        q: "Your FAQ markup lists answers that are not visible on the page. What is wrong?",
        options: ["Nothing", "Structured data must match the visible content", "FAQ markup is never allowed"],
        correct: 1,
        explain: "Markup describes the page; claims the visitor cannot see are misleading.",
      },
      {
        q: "Which change helps most with stale facts?",
        options: ["Removing all dates", "Dating facts that change and reviewing them on a schedule", "Adding more images"],
        correct: 1,
        explain: "Dated facts can be trusted or flagged; a review schedule keeps them current.",
      },
    ],
    tool: {
      kind: "seo",
      tool: "site_crawler",
      name: "Site Crawler",
      body: "Echorank's site crawler checks every page of your site and shows the evidence for each issue, so stale, thin or broken answer pages are easy to find.",
      href: "/site-crawler",
      cta: "See the crawler",
    },
  },
];
