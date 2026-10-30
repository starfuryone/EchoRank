---
featuredImage: /blog/ai-citation-direct-answers-dataset/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'AI cites pages that answer questions up front'"
slug: ai-citation-direct-answers-dataset
title: AI cites pages that answer questions up front
seoTitle: Pages with direct answers get cited by AI more often
metaDescription: Analysis of 193,507 AI answers shows cited pages open with direct answers 23% of the time vs 14% for uncited pages. What this means for your content.
excerpt: A dataset of nearly 200,000 AI answers reveals cited pages lead with direct answers far more often than pages AI skips. Completeness and recency matter. Schema markup shows weak gains.
category: AI Visibility
tags: [ai citations, content strategy, direct answers, geo, schema markup]
searchIntent: informational
primaryKeyword: AI citations direct answers
secondaryKeywords: [AI answer structure, GEO strategy, content traits AI cites, schema markup]
publishedAt: 2026-10-30
tldr:
  - Cited pages open with direct answers 23% of the time; uncited pages do so 14% of the time
  - Completeness, recency (within 12 months), and tables correlate with higher citation odds
  - Schema markup shows only 13% higher odds; prior JSON-LD testing showed no significant gain
  - One-quarter of cited pages still did not answer the question within the rated section
relatedTool: free-audit
relatedSlugs: [structure-content-for-ai-answers, schema-markup-for-ai-answers, find-your-ai-citation-gap, why-ai-recommends-your-competitors]
status: draft
featured: false
---

## Pages that lead with answers get cited more often

[According to analysis published via Search Engine Journal](https://www.searchenginejournal.com/ai-cited-pages-more-often-got-straight-to-the-answer/594781/), cited pages opened with a direct answer to the query 23% of the time, compared to 14% for pages the same AI systems retrieved but did not cite. When cited pages were compared to Google Top-10 results the AI never selected, the gap widened to 20% versus 5%. The dataset covered 193,507 AI answers across ChatGPT, Google AI Mode, and AI Overviews, drawn from 4,167 questions across 78 client companies.

The research comes from TJ Robertson's firm, TJ Digital, which conducted blind-rated comparisons of cited and uncited pages. Robertson himself notes the findings show associations, not definitive causation. One critical caveat: nearly a quarter of cited pages did not provide an answer to the question within the portion of the page that raters reviewed—meaning being cited does not guarantee the page answered the query.

## Completeness and freshness outweigh promotional tone

Cited pages scored higher on completeness (2.3 on a 1-to-5 scale versus 1.7 for uncited pages). Both categories were mostly business pages promoting their own products or services, and both rated similarly on tone (3.8 and 3.7). The real differentiators were content recency and structure. Pages updated within the past 12 months showed 88% higher odds of citation. Tables correlated with 69% higher odds. First-hand experience was linked to 45% higher odds, and explicit pricing with 28%.

The analysis also measured domain authority and page type as baseline factors. A year in the headline came with more than twice the citation odds. Pages with author bylines showed 28% lower odds, and those with calls to action showed 12% lower odds—results Robertson acknowledges he cannot explain.

Our recommendation: audit your pages for freshness and completeness before assuming structure alone will improve citation rates. Use your [free audit](/free-audit) to see which of your pages AI systems are citing and which they skip.

## Schema markup shows modest gains; JSON-LD testing proved inconclusive

Schema markup correlated with 13% higher citation odds in this dataset. That finding appears weaker than expected given prior industry reporting. [Search Engine Journal covered an earlier Ahrefs report from May 2026](https://www.searchenginejournal.com/ai-cited-pages-more-often-got-straight-to-the-answer/594781/) showing pages cited by AI Overviews were roughly three times as likely to contain JSON-LD. However, when Ahrefs tested adding JSON-LD to previously cited pages, the addition resulted in no statistically significant increase in citations.

A hypothesis: the presence of schema markup may be a trailing indicator of pages that already practice structured, complete content strategies—not a driver of citations in isolation. The 13% bump in odds could reflect correlation with unobserved factors like content quality or freshness.

We recommend testing schema markup on high-priority pages, but [do not treat it as a standalone fix](/blog/schema-markup-for-ai-answers). Pair it with direct answers, recency, and tables. The work you do on structure matters only if the underlying content answers the user's question first.

## What remains unknown: the mechanics of AI selection

The study does not reveal which specific AI model Robertson used to evaluate pages in the 23%-to-14% comparison round. The original analysis page is also missing visible tables and graphs showing trait odds per engine as of the publication date. This limits our ability to compare trait performance across ChatGPT, Google, and other systems.

A hypothesis: different AI systems may weight these traits differently. ChatGPT may favor first-hand experience, while Google Overviews may prioritize recency. The dataset pools all answers together, which could mask engine-specific patterns.

Another open question: does the order in which AI systems encounter cited content on a page affect selection, or only the presence of answers? The blind-rating methodology tells us cited pages look different, but not how deeply AI systems scan a page or which signals they weight most heavily.

## How to act on these patterns

TJ Digital derived these patterns from questions posed by one agency for its specific clients across nine business models. They may not hold equally across all verticals or query types. Robertson explicitly frames his findings as patterns worth testing, not universal rules.

Consider running this checklist on your owned content:

- Does your page answer the primary question in the first 150 words?
- Is your content dated or explicitly marked as updated in the past 12 months?
- Do you include at least one table or structured data element?
- Are you citing first-hand research, testing, or proprietary data?
- Is pricing or a key metric visible without scrolling?
- Does the page use schema markup (JSON-LD preferred)?

Avoid rash decisions based on the byline and CTA findings. Robertson flagged both as counterintuitive and would not remove them without additional evidence. Removing trust signals like author credentials or action buttons is unlikely to improve citation rates.

## Cited pages and AI crawler visibility are separate problems

[Understanding how pages appear to AI crawlers](/blog/make-your-site-readable-to-ai-crawlers) is a prerequisite for any citation strategy. A page cannot be cited if AI systems cannot access or parse it. Cited pages in this study were already being retrieved. The analysis identifies traits of pages that *won* the selection battle, not traits that make pages discoverable in the first place.

[If you are missing mentions altogether across AI systems](/blog/find-your-ai-citation-gap), your first priority is ensuring your site is crawlable and indexed by AI models. Only after that should you optimize for the content traits this dataset measures.

The real takeaway: leading with an answer, keeping content fresh, and using tables and structured formats are associated with higher citation odds. But these are necessary conditions, not sufficient ones. Nearly one in four cited pages still did not answer the question in the section raters reviewed—suggesting AI systems also weigh other signals: authority, domain history, or patterns in training data that remain opaque to outside analysis.
