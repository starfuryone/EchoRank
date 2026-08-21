---
slug: make-your-site-readable-to-ai-crawlers
title: "Make your site readable to AI crawlers before you write anything else"
seoTitle: "Make Your Site Readable to AI Crawlers"
metaDescription: "AI crawlers do not run your JavaScript, and many are blocked by a robots.txt nobody has read since 2021. Check access and rendering before writing more content."
excerpt: "The most expensive GEO mistake is commissioning content for a site that answer engines cannot fetch or parse. Four checks, in order, that decide whether anything you publish is even visible."
category: Best Practices
tags: [AI crawlers, robots.txt, rendering, technical SEO, GEO]
searchIntent: informational
primaryKeyword: AI crawler accessibility
secondaryKeywords: [GPTBot, robots.txt AI crawlers, server-side rendering GEO, AI crawler blocked]
publishedAt: 2026-08-15
featuredImage: /blog/make-your-site-readable-to-ai-crawlers/hero.svg
featuredImageAlt: "A crawler icon meeting three gates in sequence — robots.txt, server response, and rendered HTML — with the third gate closed."
tldr:
  - "Check access before content. A blocked or unparseable page is invisible no matter how well it is written."
  - "Most AI crawlers do not execute JavaScript. If the substance appears only after hydration, assume it is not there."
  - "Blanket AI-bot blocks are often inherited from an old robots.txt or a CDN preset nobody chose deliberately."
  - "Assistants that fetch a page live are a separate case from training crawlers, and blocking one does not block the other."
faq:
  - q: "Should I block AI crawlers?"
    a: "That is a business decision, not a technical one, and it is legitimate either way. What is not legitimate is discovering by accident that you blocked them. Decide deliberately, write the decision down next to the robots.txt rule, and revisit it when your goals change."
  - q: "Does blocking GPTBot remove me from ChatGPT answers?"
    a: "Not necessarily, and this is where most confusion lives. A training or indexing crawler and a live retrieval fetcher are different user-agents with different jobs. Blocking one leaves the other unaffected, so check what each agent you care about is actually named before writing a rule."
  - q: "Is server-side rendering strictly required?"
    a: "No, but the substance has to be in the HTML that arrives. Static generation, server rendering and prerendering all satisfy that. What does not is shipping an empty shell and fetching the content client-side, which is the pattern that most often turns a good page into a blank one."
relatedTool: free-audit
relatedSlugs: [what-llms-txt-is-and-is-not, find-your-ai-citation-gap]
status: published
featured: false
---

Before you commission another article, confirm that answer engines can fetch your pages and read them without running a browser. Four checks, in this order, decide it: does robots.txt allow the agents you care about, does the server return the page to a plain request, does the HTML contain the actual substance without JavaScript, and does the page state its subject in its own text rather than only in an image or a component. A page that fails any of them is invisible to retrieval no matter how well written it is, and a content budget spent on an invisible page buys nothing.

This is the least glamorous work in GEO and, in our experience, the most frequently decisive.

## Check one: what robots.txt actually allows

Open your robots.txt and read it as a stranger would. You are looking for two things: a blanket rule that disallows agents you did not intend to disallow, and named AI user-agents with explicit rules. Both are commonly inherited rather than chosen — from a CDN's security preset, from a bot-blocking plugin, or from an edit somebody made during a scraping incident three years ago and nobody revisited.

A concrete pattern we see often enough to name. A site adds a broad block during a scraping problem, the problem passes, the rule stays, and two years later the marketing team is measuring AI visibility on a domain whose robots.txt has been refusing the relevant crawlers the entire time. The visibility number is real; the diagnosis everyone reaches for — thin content — is wrong.

Blocking is a legitimate choice. Blocking by inheritance is not a choice at all.

## Check two: what the server returns

Request one of your important pages the way a crawler does: no browser, no cookies, no JavaScript, a plain user-agent, and look at the status code and the body you get back. The failures here are unglamorous and common — a 403 from a WAF rule that fires on unfamiliar user-agents, an interstitial challenge page returned with a 200, a redirect chain that ends somewhere unexpected, or a geo-gate that serves a country selector instead of the page.

The challenge-page case is worth calling out because it is the hardest to notice: the status code says 200, so every uptime check and every crawl report is green, and the body is a bot-protection page containing none of your content. From the outside, the page exists and says nothing.

## Check three: whether the substance survives without JavaScript

Fetch the page and read the raw HTML. If your headings, your body copy and your key facts are not in it, assume an AI crawler does not see them. Most crawlers that feed retrieval systems do not execute JavaScript, and the ones that do execute it do not promise to. This is the single most common way a modern, well-built, fast site ends up invisible: the shell arrives, the content arrives afterwards, and afterwards never happens.

The fix is not "stop using a framework". It is making sure the substance is in the first response — static generation, server rendering, or prerendering all do that. What does not work is treating a client-rendered page as acceptable because Google eventually renders it. Google's rendering budget is not the same thing as an AI crawler's, and assuming otherwise is a hypothesis a lot of sites are quietly betting on.

## Check four: whether the page says what it is about

The last check is not technical. Read the raw HTML and ask whether a reader with no context could tell what the page is about from the text alone. A page whose subject lives in a hero image, a video, a carousel of logos or an icon grid is legible to a human and empty to a parser. So is a page whose H1 is the company name and whose first paragraph is a slogan.

This is where accessibility work and GEO turn out to be the same work. Text that a screen reader can announce is text a retrieval system can index, and the pages that fail one usually fail the other.

## The order matters

Doing these in order saves the most money. Access before rendering, rendering before content, content before conventions. A team that starts at the other end — publishing an llms.txt, adding structured data, commissioning twenty articles — can do all of it correctly and change nothing, because the gate that was closed was the first one. If you are working on the conventions layer, [what llms.txt is and is not](/blog/what-llms-txt-is-and-is-not) explains why that file is a curation aid rather than a fix for any of the four failures above.

Once access is confirmed, the work becomes the writing: whether your pages contain passages worth quoting, which is a different problem with a different diagnosis. [Finding your AI citation gap](/blog/find-your-ai-citation-gap) covers that, and it is only worth reading after these four checks pass.

## An accessibility checklist

- Read robots.txt end to end and list every rule that mentions an AI user-agent.
- Identify which rules were deliberate. Delete or document the rest.
- Distinguish training or indexing agents from live retrieval fetchers, by name.
- Fetch three important pages with no browser and no cookies; record status and body.
- Check for challenge or interstitial pages returned with a 200.
- Confirm your headings and body copy are present in the raw HTML.
- Confirm key facts are text, not baked into images or rendered components.
- Check that the H1 names the subject rather than the company.
- Re-check after any CDN, WAF or bot-protection change — those are the changes that silently revert this.
- Write down the AI-crawler policy you chose, and the date, next to the rules that implement it.

## Confirm it rather than assume it

Most of these checks can be done by hand in an afternoon with a plain HTTP client, and doing them by hand is genuinely instructive. If you would rather see the summary first, [run a free GEO audit](/free-audit) — it reports which AI user-agents your robots.txt allows or blocks, whether the page carries its substance in the HTML, what structured data is present, and whether you publish an llms.txt, with an itemized recommendation for each. It is a snapshot of the gates in this article, which is exactly the thing worth confirming before you write anything else.
