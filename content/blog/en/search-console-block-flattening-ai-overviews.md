---
featuredImage: /blog/search-console-block-flattening-ai-overviews/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Search Console's Block Flattening Problem'"
slug: search-console-block-flattening-ai-overviews
title: Search Console's Block Flattening Problem
seoTitle: Why Search Console rankings don't work for AI Overviews
metaDescription: Google admits Search Console can't track AI Overview visibility accurately. Block flattening hides where your content actually sits in AI answers.
excerpt: Google Search Advocate John Mueller confirmed that Search Console treats entire AI-generated overviews as a single block, obscuring which links users actually see and click.
category: AI Visibility
tags: [AI Overviews, Search Console, rankings, visibility, GEO]
searchIntent: informational
primaryKeyword: Search Console AI Overviews
secondaryKeywords: [block flattening, AI visibility, ranking metrics, impression tracking]
publishedAt: 2026-09-25
tldr:
  - Google Search Advocate John Mueller admitted Search Console cannot track AI Overview rankings accurately because the tool treats entire AI boxes as single blocks
  - Block flattening assigns position 1 to all links inside an AI Overview regardless of their actual placement, hiding prominence differences from users
  - Impression counts inflate because visible links are logged as impressions even if users never scroll to see them, while links behind toggles are undercounted
  - Average position metrics now mask whether your content appears in a prominent spot or buried in an interactive dropdown within an AI answer
relatedSlugs: [structure-content-for-ai-answers, seo-vs-geo-metrics, find-your-ai-citation-gap, how-to-measure-ai-search-visibility]
relatedTool: free-audit
status: draft
featured: false
---

## Google admits Search Console can't measure AI Overview visibility

Google Search Advocate John Mueller confirmed on Reddit that [Search Console treats entire AI-generated overviews as a single block](https://www.searchenginejournal.com/search-console-uses-block-flattening-for-aios-forget-position-focus-on-outcomes/589582/), making traditional ranking metrics unreliable for AI answers. Mueller said tracking traditional rankings for AI features is "hard to do in a way that makes it useful." This admission exposes a critical gap: the metrics marketers have relied on for years no longer reflect how users actually discover content in search results when AI Overviews appear.

The problem runs deeper than ranking position alone. Search Console's approach, called block flattening, assigns a single position to every link appearing inside an AI Overview. An eye-catching link near the top and a buried link inside a "Show More" dropdown both get labeled as position 1. This destroys visibility granularity and leaves site owners unable to see which links users actually notice.

## Block flattening hides where your content sits in AI answers

Block flattening treats each AI Overview as an atomic unit instead of recording where individual cited links appear within it. [Every link inside an AI Overview gets marked as position 1 in Search Console reports](https://www.searchenginejournal.com/search-console-uses-block-flattening-for-aios-forget-position-focus-on-outcomes/589582/), even though searchers are far more likely to click a link displayed prominently near the first sentence than one tucked inside an expandable section. This creates a false sense of uniform visibility across all links cited in the same answer.

The flattening issue is not accidental. It reflects Search Console's design constraints. Google built these metrics for static, ranked lists of ten blue links. AI Overviews are interactive, multi-layered, and personalized by location and device. Retrofitting old metrics to cover new layouts was always going to create blind spots.

Our recommendation: treat Search Console's average position as a lagging indicator only. For AI visibility, focus instead on click-through rates and actual traffic changes, which reflect real user behavior better than position numbers. Consider auditing your content structure for AI readability by reviewing how you've formatted definitions, lists, and data that AI systems extract and display.

## Impression counting inflates for visible links, deflates for hidden ones

Search Console logs impressions the moment a page loads, regardless of scroll depth. When an AI Overview appears, all its default links are immediately counted as impressions, even if a searcher reads only the first sentence and leaves. This automatic credit happens because those links are visible by default. Links hidden behind a "Show More" toggle, by contrast, are not counted as impressions until someone clicks to expand the section.

[This contradiction means unread links in the main AI text receive full credit for views they never received, while useful links behind toggles look invisible until explicitly clicked](https://www.searchenginejournal.com/search-console-uses-block-flattening-for-aios-forget-position-focus-on-outcomes/589582/). Research from Seer Interactive showed that AI Overview CTR fell by 61%, a drop largely attributable to inflated impression counts skewing the math.

The practical outcome: your impression numbers no longer correlate with actual exposure. A hypothesis worth testing is that links appearing in the default view of an AI Overview may drive engagement at rates far below what their impression count suggests, because users never scrolled down or noticed them at all.

## Average position metrics now mask real visibility outcomes

Traditional ranking reports show a clean average position by blending all the different placements a URL achieves across time, geography, and device type. [When a page ranks at position 1 with an AI Overview but position 19 in normal organic results, and both occur equally often, Search Console reports an average position of 10](https://www.searchenginejournal.com/search-console-uses-block-flattening-for-aios-forget-position-focus-on-outcomes/589582/). That neat average hides the extremes and gives owners a false sense of consistency.

Block flattening makes this worse. Your link might sit in a prime spot inside an AI Overview one day and disappear from the overview entirely the next, because Google regenerated the answer with different sources. Search Console would dutifully update your rank, but the aggregate number masks the instability. You cannot tell from the metric alone whether you're being cited consistently, being added and removed randomly, or losing favor over time.

This framing problem explains why stakeholder communication has become harder. Marketers have spent years teaching leadership that position and traffic are linked. Now they are not. A hypothesis we cannot yet verify is whether AI Overviews will eventually stabilize around a smaller set of regularly-cited sources, or whether citation volatility will remain high, making historical benchmarks useless.

## What you should track instead

- Click-through rate (CTR) changes month-over-month, as this reflects real user clicks rather than algorithmic impression grants
- Actual organic traffic trends in Google Analytics, not Search Console's position averages
- Which specific pages get cited in AI Overviews by manually checking SERPs for your target queries
- How often your content appears in the main text versus hidden expandable sections of AI answers
- Brand mention volume across search and AI tools, separate from citation patterns

Our recommendation: shift your reporting framework away from position and toward outcomes. Begin measuring whether your cited links drive conversions, engagement, or onsite time. If a link appears in an AI Overview but receives no clicks, position 1 is meaningless. If a link drives steady referral traffic despite a rank drop, the ranking change may not matter.

For teams ready to audit their AI visibility baseline, use our [free audit](/free-audit) to see where your site stands across AI answer engines and search results today.

## Why this changes how you should approach content

The shift from position-based metrics to outcome-based ones should influence how you structure and promote content. If your goal is no longer to rank at position 1 but to be cited accurately and clicked when cited, your content strategy needs to change. Links inside AI Overviews are more likely to be clicked when they appear early, with clear context, and in a format that an AI can extract cleanly.

We recommend revisiting how you [structure content for AI answers](/blog/structure-content-for-ai-answers) so that key information is immediately accessible to AI systems. Use clear headings, short definitions, and scannable formatting. The more digestible your content is to AI, the higher the chance you'll be cited in a prominent position within the overview, even if Search Console cannot measure that prominence.

A related consideration: check whether your site's citation patterns across AI systems align with your Search Console data. [Find your AI citation gap](/blog/find-your-ai-citation-gap) to see where you're mentioned but not directly linked, or linked but not prominently displayed. These gaps often reveal opportunities to restructure content or refine your outreach strategy.

The metrics problem is real, but it is also an opportunity. Sites that stop chasing position numbers and start optimizing for clear, extractable, useful content may find they earn more consistent AI citations—and more sustainable traffic—than sites still trying to game ranking formulas designed for a different era.
