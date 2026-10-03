---
featuredImage: /blog/standing-instructions-in-ai-search/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Standing Instructions: What AI Agents Mean for Your Site'"
slug: standing-instructions-in-ai-search
title: Standing Instructions: What AI Agents Mean for Your Site
seoTitle: Standing Instructions in AI Search: visibility beyond the one-time query
metaDescription: Google's info monitoring and OpenAI's dots create persistent requests that can change what content appears. Here's what that means for your visibility.
excerpt: Search queries that stay active, sending updates over time, are reshaping how AI systems discover and cite sources. We explain what standing instructions are and how to prepare.
category: AI Visibility
tags: [AI agents, standing instructions, monitoring, information agents, AI Overviews]
searchIntent: informational
primaryKeyword: standing instructions AI search
secondaryKeywords: [information monitoring, AI agents, Google info monitoring, persistent queries, OpenAI dots, continuous monitoring]
publishedAt: 2026-10-03
tldr:
  - Standing instructions are persistent requests that stay active after you leave, updating over time as new information appears.
  - Google's info monitoring (rolling out to all users) and OpenAI's dots agents work differently but share this core behavior.
  - Content that ranks well today may not appear in updates if those updates pull from different sources or prioritize recency differently.
  - Your visibility strategy needs to account for how standing instructions discover and evaluate sources over time, not just initial ranking.
  - Prepare by understanding how AI systems handle ongoing fact-checking and source evaluation across your domain.
relatedSlugs: [structure-content-for-ai-answers, track-brand-mentions-across-llms, find-your-ai-citation-gap]
relatedTool: free-tools
status: draft
featured: false
---

## What standing instructions are and why they matter now

A standing instruction is a request that stays active even after the user closes the conversation. Google started rolling out its info monitoring feature to all users on September 28, allowing people to ask a search query and keep receiving updates as new information appears on the web. On the same day, [OpenAI launched dots—always-on agents that can monitor for changes, run recurring tasks, and work between conversations](https://www.searchenginejournal.com/when-a-search-query-becomes-a-standing-instruction/591690/). Both systems share a critical property: the request does not expire when the user walks away. For publishers, that means your content is being evaluated not just when someone first searches, but continuously as those systems check the web for changes.

The term "standing instruction" is not official language from Google or OpenAI—it comes from [the Search Engine Journal's analysis](https://www.searchenginejournal.com/when-a-search-query-becomes-a-standing-instruction/591690/) of these two product launches. But the distinction matters. Standing instructions are different from one-time searches or static content rankings. They represent a new class of persistent user intent that AI systems must satisfy over weeks or months, not seconds.

## How Google's info monitoring works

Google's info monitoring feature watches for changing information across the web and sends updates to the user. You activate it by adding "keep me updated" to a search and setting your criteria. Google then continuously checks for new information that matches your request and suggests updates during searches. The updates include links to explore further, but [Google has not yet published how it decides which sources to include in an update, or how monitoring updates are counted separately in Search Console](https://www.searchenginejournal.com/when-a-search-query-becomes-a-standing-instruction/591690/). This gap in transparency makes it difficult for publishers to understand whether their content will appear in these ongoing monitoring responses.

The feature builds on Google's information agents, which were introduced at I/O in May and expanded to more users in June. Those agents were designed to scan everything on the web—blogs, news sites, social posts, and Google's own real-time finance, shopping, and sports data—for continuously changing information. An apartment hunter, for example, could ask the agent to monitor listings that match exact criteria, and the agent would scan continuously on their behalf. What's new is that this capability is now available to all users, not just paid subscribers, making standing instructions a mainstream search behavior rather than a premium feature.

## How OpenAI's dots differ—and what they share

OpenAI's dots are always-on agents with their own cloud computer and browser access. Unlike Google's monitoring, dots can take actions beyond sending updates—they can interact with connected apps, read permitted sources, and gather information even before being asked. A dot assigned to monitor a project, for instance, can connect new information to previous work, noticing that a release date change conflicts with an earlier draft. Dots are rolling out to Pro and Business Premium users outside the EEA, Switzerland, and the UK.

The critical shared trait is that [dots can be set to monitor for changes and "send a notification when a relevant update occurs," using information from previous runs](https://www.searchenginejournal.com/when-a-search-query-becomes-a-standing-instruction/591690/). This means a dot assigned to track your industry news or competitive intelligence will revisit sources over time, potentially citing different content at different moments depending on what is current. Some websites block cloud browsers or require further verification, which could limit dot visibility to your content.

## What this means for your AI visibility

Our recommendation is to prepare your content for persistent evaluation, not one-time discovery. Standing instructions change the visibility timeline. A piece of content that ranks in an initial search result might not appear in an update if the standing instruction uses different source evaluation logic, weights recency more heavily, or pulls from sources you are not yet aware of. This is particularly important for sites competing in spaces where information changes—finance, news, product reviews, local business data, real estate, travel, and health.

The opacity around source selection compounds the challenge. Neither Google nor OpenAI has published the rules for how standing instructions decide which sources appear in updates. We cannot yet verify whether these systems re-rank the entire web for each update, pull from a curated set of sources, or use some combination of both. This means your visibility strategy cannot rely purely on current SERP position.

Consider a hypothesis: standing instructions may prioritize sources that have historically provided accurate updates to that user, or sources that publish more frequently, or sources that explicitly signal updates through structured data or content patterns. If true, a site that publishes infrequently or lacks clear signals about what has changed since the last publication might be deprioritized in updates, even if it ranked well for the initial query.

## How to prepare for standing instruction visibility

- **Audit your content update frequency.** Standing instructions reward sources that change. If your content is evergreen but relevant to monitoring requests, consider a publishing strategy that signals updates—dates, version numbers, or change logs.
- **Structure content for re-evaluation.** Use clear headings, summaries, and dates so standing instruction systems can easily identify what is new since the last check. This is separate from optimizing for initial ranking.
- **Map your domain to standing instruction use cases.** Apartment hunting, stock tracking, competitor news, health condition research, travel planning—which standing instruction scenarios naturally involve your content? Focus there first.
- **Test your content's appearance in updates.** Set up standing instructions yourself (in Google Search or ChatGPT) around queries your site targets. Do you appear? If not, work backward to understand why.
- **Monitor for citations in ongoing monitoring.** Use [our free audit tool](/free-audit) to track where your content appears across AI systems, and then set up your own standing instructions to see if and when you appear in updates over time.

## The visibility tax of standing instructions

There is another angle worth considering. [In a separate piece, Search Engine Journal reported that some publishers in Google's AI contribution pilot earn less than 0.1% of their advertising revenue from AI-generated content use](https://www.searchenginejournal.com/google-ai-pilot-pays-some-sites-under-0-1-of-ad-revenue/591717/). The article does not directly address standing instructions, but the implication is relevant: AI systems can use your content without driving proportional traffic. A standing instruction that cites your content in an update might never lead a user to your site. This reinforces why visibility in standing instructions is different from visibility in search—you may be cited without seeing direct return.

For this reason, our recommendation is to think about standing instruction visibility as part of your broader AI citation strategy, not as a replacement for traditional search ranking. Use [/free-tools](/free-tools) to track your mentions across LLM outputs and AI search features, and note whether those mentions are converting to traffic or citations. Standing instructions will expand the number of contexts where you need to appear, but each appearance may carry different value.

## What remains unclear

Google's Search Console documentation now includes AI Mode in its reporting, but [the help pages do not explain how monitoring updates are counted or identified separately from other AI responses](https://www.searchenginejournal.com/when-a-search-query-becomes-a-standing-instruction/591690/). This is a hypothesis: Search Console may eventually show you which standing instructions cite your content, how often, and in what context. Until then, you are operating blind. Similarly, OpenAI has not published how dots determine which sources to check for monitoring, or whether a dot assigned to monitor for changes will revisit your site automatically or only when explicitly connected.

For more on how AI systems actually choose and structure content, see [how to structure content so AI answers can actually use it](/blog/structure-content-for-ai-answers) and [why AI recommends your competitors instead of you](/blog/why-ai-recommends-your-competitors). Both articles explore source selection logic at a deeper level and will help you understand what standing instructions are likely to prioritize.

The shift from one-time search queries to standing instructions is still in early stages. But the momentum is clear: users are asking AI systems to watch the web for them, and those systems are learning to do it. Your visibility strategy needs to account for what happens when a request never stops asking.
