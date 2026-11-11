---
slug: ai-visibility-audit
title: "AI Visibility Audit: How to Measure Your Brand's Presence in AI Search"
seoTitle: "AI Visibility Audit: How to Measure Your Brand's Presence in AI Search"
metaDescription: "A complete, repeatable audit of how AI search engines reach, understand, mention and cite your brand, with a scoring rubric, a step-by-step process and a report template."
excerpt: "A complete, repeatable audit of how AI search engines reach, understand, mention and cite your brand, with a scoring rubric, a step-by-step process and a report template."
category: AI Visibility
tags: [AI visibility, audit, AI search]
searchIntent: informational
primaryKeyword: AI visibility audit
secondaryKeywords: [AI search audit, brand presence in AI search, AI visibility score]
publishedAt: 2026-11-11
featuredImage: /blog/ai-visibility-audit/cover.svg
ogImage: /blog/ai-visibility-audit/cover.png
featuredImageAlt: "AI visibility audit: measure your AI presence"
relatedTool: free-audit
relatedSlugs: [where-does-chatgpt-get-its-information, how-to-optimize-for-ai-search, how-to-rank-on-chatgpt, monitor-brand-mentions-in-chatgpt, chatgpt-traffic-playbook]
status: published
featured: false
---

An SEO audit tells you how search engines see your website. An **AI visibility audit** answers a broader question: when someone asks ChatGPT, Gemini, Google AI Mode, Perplexity or Claude about your category, does your brand show up, is it described correctly, and which sources shape that answer?

The answer depends on more than your website. It depends on your reputation across the web, on whether AI crawlers can read your pages, and on how clearly your facts are stated. This guide gives you a repeatable audit with five pillars, a scoring rubric and a report template.

## The five pillars

![The five pillars of an AI visibility audit](/blog/ai-visibility-audit/five-pillars.svg)

| Pillar | Core question | Where the evidence comes from |
|---|---|---|
| **1. Access** | Can AI crawlers reach and read your pages? | robots.txt, firewall/CDN rules, server logs, rendered vs raw HTML |
| **2. Clarity** | Is it obvious what you do, for whom, and at what price? | Your site's key pages, structured data, fact consistency |
| **3. Presence** | How often are you mentioned for buyer questions? | A fixed prompt set run across AI engines |
| **4. Accuracy** | When you're described, is it correct? | Brand-direct prompts checked against your real facts |
| **5. Authority** | Which sources do AI answers cite, and are you among them? | Cited URLs, third-party coverage, reviews |

Pillars 1 and 2 are about your own site and are fully in your control. Pillars 3 to 5 measure the outcome, which you influence but don't control.

## Step 1: Audit access

Start here, because nothing else matters if AI crawlers can't read you.

| Check | How | Pass looks like |
|---|---|---|
| AI crawler rules | Read robots.txt for OAI-SearchBot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Googlebot | Rules match a deliberate policy (for example, search crawlers allowed, training opt-out if you want it) |
| Firewall and CDN | Check bot-fighting and WAF settings for blocks on AI user agents or published IP ranges | Allowed crawlers aren't challenged or blocked |
| Actual crawl activity | Search server or CDN logs for AI user agents | Allowed crawlers visit key pages regularly |
| Rendering | Compare raw HTML with the rendered page on your top pages | Key text, prices and headings are in the raw HTML |
| Indexability | Check key pages for noindex, canonical errors and broken links | Key pages are indexable and return 200 |

Remember that crawler settings are independent. OpenAI, for example, lets you allow its search crawler while blocking its training crawler.

## Step 2: Audit clarity

AI engines summarize. Make sure there's a clear, consistent story to summarize.

- **Core facts on dedicated pages.** What you sell, who it's for, pricing, locations, integrations, policies. One canonical page per topic.
- **Answer-first writing.** Important pages open with a direct, one- or two-sentence answer before the detail.
- **Structured data.** Organization, Product or Service, FAQ and LocalBusiness markup where relevant, matching the visible content.
- **Consistency.** Your name, description and prices match across your site, social profiles, review sites, directories and press pages.
- **Specifics.** Numbers, comparisons and original data give AI answers something concrete to repeat.

## Step 3: Measure presence

Build a prompt set that mirrors how buyers actually ask. Keep it fixed so results stay comparable over time.

| Prompt group | Examples | Suggested share of set |
|---|---|---|
| Category discovery | "Best [category] for [customer type]" | 40% |
| Use case / problem | "How do I [problem you solve]?" | 20% |
| Comparison | "[You] vs [competitor]", "alternatives to [competitor]" | 20% |
| Brand direct | "What is [brand]? How much does it cost?" | 10% |
| Reputation | "Is [brand] good? Common complaints?" | 10% |

Run every prompt **several times on each engine** you care about, in fresh sessions with no personal memory. Answers vary between runs, so you're measuring rates, not one-off results. Then calculate:

- **Mention rate**: share of answers that name you
- **Average position**: where you appear in lists when named
- **Share of voice**: your mentions as a share of all brand mentions in the set
- **Competitor overlap**: which brands appear when you don't

Expect a gap between recognition and recommendation. A Q2 2026 study by Victorious found that AI platforms described 96% of brands accurately when asked about them directly, yet mentioned far fewer of them in category questions. Category prompts are where an audit earns its keep.

## Step 4: Check accuracy

For every answer that describes you, compare it with the truth:

| Fact type | What to check | Common problem |
|---|---|---|
| What you do | Category, core offering, audience | Old positioning from years ago |
| Pricing and plans | Prices, tiers, free trial | Outdated or invented prices |
| Features | Key capabilities, integrations | Missing new features, or a competitor's features attributed to you |
| Company facts | Location, founding, ownership | Confusion with similarly named companies |
| Reputation | Strengths and weaknesses mentioned | One old complaint repeated as current |

Every inaccuracy should be traced to a source. Usually it's an outdated page of yours, an old directory listing or a third-party article.

## Step 5: Map authority

Collect every URL cited in the answers from Step 3 and sort them:

| Source type | Example | Your action |
|---|---|---|
| Your own pages | Your pricing or comparison page | Keep them updated and strengthen them |
| Encyclopedic | Wikipedia | Make sure facts about you are accurate and well-sourced |
| Community | Reddit, forums, Q&A sites | Join genuinely; answer questions; fix misinformation |
| Media and reviews | Industry press, review sites, comparison lists | Pitch, get listed, earn reviews |
| Competitors' pages | Their "vs" and "alternatives" pages | Publish your own balanced comparison |

Concentration is the norm. Similarweb's early-2026 data showed Wikipedia and Reddit each taking around 12–13% of ChatGPT citations in the US, so the specific sources that dominate *your* category's answers are where outreach pays off most.

## Score it

Rate each pillar from 0 to 4 and keep the scoring rules the same for every audit:

![Sample AI visibility scorecard](/blog/ai-visibility-audit/scorecard.svg)

| Score | Access | Clarity | Presence | Accuracy | Authority |
|---|---|---|---|---|---|
| **0** | Key crawlers blocked | Core facts missing | Never mentioned | Mostly wrong | Never cited; few third-party mentions |
| **1** | Partly blocked or not rendered | Facts scattered or inconsistent | Mentioned only in brand-direct prompts | Several major errors | Rarely cited; thin coverage |
| **2** | Reachable, some gaps | Facts present but buried | Mentioned in some category prompts | Minor errors | Cited occasionally; some coverage |
| **3** | Fully reachable | Clear, mostly consistent | Mentioned in most relevant prompts | Accurate, small gaps | Often cited; solid coverage |
| **4** | Reachable, monitored | Clear, consistent everywhere | Top positions across engines | Fully accurate and current | Frequently cited; strong coverage |

A total out of 20 makes progress easy to communicate, but the pillar breakdown is what tells you where to act.

## Turn findings into a plan

| Lowest pillar | First moves |
|---|---|
| Access | Fix robots.txt and WAF rules; server-render key content |
| Clarity | Rewrite key pages answer-first; add structured data; align facts everywhere |
| Presence | Earn reviews and comparison-list inclusion; publish category and use-case pages |
| Accuracy | Update stale pages; correct third-party listings and old press |
| Authority | Targeted PR and outreach to the sources your category's answers cite |

Re-run the audit **every quarter** with the same prompts and rubric, and keep monthly presence checks in between.

## Audit report template

| Section | Contents |
|---|---|
| Summary | Total score, pillar scores, change since last audit |
| Access | Crawler policy, issues found, fixes |
| Clarity | Pages reviewed, inconsistencies, schema status |
| Presence | Mention rate, position, share of voice by engine and prompt group |
| Accuracy | Errors found, likely source, correction owner |
| Authority | Top cited domains, owned citation rate, outreach targets |
| 90-day plan | Prioritized actions with owners and dates |

## Key takeaways

| | |
|---|---|
| **Five pillars** | Access, clarity, presence, accuracy, authority |
| **Fix the foundation first** | Access and clarity are fully in your control |
| **Measure rates** | Run a fixed prompt set several times per engine |
| **Trace every error** | Inaccuracies come from somewhere: find and fix the source |
| **Repeat quarterly** | Same prompts, same rubric, so progress is real |

## Further reading

- [Where Does ChatGPT Get Its Answers? A Plain-English Guide for Businesses](/blog/where-does-chatgpt-get-its-information)
- [How to Optimize for AI Search: A Guide for You and Your AI Agent](/blog/how-to-optimize-for-ai-search)
- [How to Rank on ChatGPT: What Actually Works (Based on Data)](/blog/how-to-rank-on-chatgpt)
- [How to Monitor Brand Mentions in ChatGPT](/blog/monitor-brand-mentions-in-chatgpt)
- [The ChatGPT Traffic Playbook: How to Track, Measure, and Grow](/blog/chatgpt-traffic-playbook)

---

**Start your audit in minutes.** Run Echorank's [free AI visibility audit](/free-audit) to check how AI engines read your site, then [see our plans](/pricing) for scheduled AI answer tracking, AI crawler analytics and full-site crawling with Nosy Bat.

### Sources

- [OpenAI: Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- [Search Engine Journal: AI recognizes 96% of brands but mentions almost none (Victorious)](https://searchenginejournal.com/ai-brand-mention-study-victorious-spa/582765)
- [Similarweb: The most cited domains by LLMs](https://aisearch.similarweb.com/blog/most-cited-domains-llms/)
- [Ahrefs: Top brand visibility factors in ChatGPT, AI Mode and AI Overviews](https://ahrefs.com/blog/ai-brand-visibility-correlations)
- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)

*Editor: Frederic Desjardins - Echorank*
