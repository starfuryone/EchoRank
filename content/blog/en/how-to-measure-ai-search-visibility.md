---
slug: how-to-measure-ai-search-visibility
title: "How to measure AI search visibility without guessing"
seoTitle: "How to Measure AI Search Visibility"
metaDescription: "AI search visibility is measured by running a fixed prompt set on a schedule and recording four things: coverage, citation share, position and framing."
excerpt: "You cannot rank-track an answer engine the way you rank-track Google, because there is no stable list of ten results. Here is the measurement model that does work, and the four numbers worth keeping."
category: GEO Guides
tags: [GEO, AI visibility, measurement, ChatGPT, Perplexity]
searchIntent: informational
primaryKeyword: measure AI search visibility
secondaryKeywords: [AI search tracking, GEO measurement, AI citation share, prompt set]
publishedAt: 2026-08-05
featuredImage: /blog/how-to-measure-ai-search-visibility/hero.svg
featuredImageAlt: "Four measurement bars — coverage, citation share, position and framing — plotted over a repeated weekly prompt run."
tldr:
  - "There is no position 1 in an answer engine. Measure how often you appear across a fixed prompt set, not where you sit in a list."
  - "Four numbers carry almost all the signal: prompt coverage, citation share, position within the answer, and how you are framed."
  - "The prompt set has to be frozen. A set you keep editing measures your editing, not your visibility."
  - "Run it on a schedule from a clean session. One-off checks in your own logged-in chat window are not measurements."
faq:
  - q: "How often should I re-run my prompt set?"
    a: "Weekly is enough for most sites, and it is what we recommend as a default. Answer engines change their retrieval and their model versions without notice, so daily runs mostly measure that noise; monthly runs miss a drop long enough for it to cost you."
  - q: "Can I just ask ChatGPT whether it recommends my brand?"
    a: "Not usefully. Your own session carries memory, history and account context, so the answer you get is partly a reflection of you. A measurement has to come from a clean session with no personalization, repeated the same way every time."
  - q: "Do I need a different prompt set for each engine?"
    a: "No, and you should not have one. The whole value of a frozen set is comparing engines against the same questions. Run the identical prompts through each engine and let the differences in the answers be the finding."
relatedTool: free-audit
relatedSlugs: [seo-vs-geo-metrics, find-your-ai-citation-gap]
status: published
featured: true
---

You measure AI search visibility by running a fixed set of buyer questions through each answer engine on a schedule, from a clean session, and recording four things every time: how many of those prompts produce an answer mentioning you, how much of the cited source list is yours, where in the answer you appear, and how you are described. That is the whole model. There is no position 1 to track, because an answer engine does not publish a ranked list of ten blue links — it composes one response and cites a handful of sources, and which sources those are can change between two runs of the same question.

That difference is why importing a rank-tracking mental model into GEO produces numbers that look precise and mean very little.

## Why rank tracking does not transfer

A rank tracker works because a SERP is a stable, ordered, public artifact: the same query from the same location returns a list you can index into, so "position 4" is a fact both you and your competitor can verify. An answer engine returns prose. Two runs of one prompt can cite different sources, in a different order, at different lengths. The unit of observation is not a position — it is an appearance.

So the question changes from "where do I rank for this keyword" to "how reliably do I show up when someone asks this". Reliability is a rate, and a rate needs repetition. One run tells you nothing; twenty runs of the same prompt tell you that you appear in fourteen of them, which is a number you can move.

This is also why a single screenshot of ChatGPT naming your brand is not evidence of anything. It is one draw from a distribution.

## The four numbers worth keeping

Four measurements cover almost everything a team actually acts on. **Prompt coverage** is the share of your prompt set that produces an answer mentioning your brand at all — the broadest signal, and usually the first to move. **Citation share** is your share of the linked sources across the set, which is the closest thing GEO has to a share-of-voice figure. **Position within the answer** records whether you are the first option named or the fourth. **Framing** records what the answer says about you.

The four are deliberately not collapsed into one score. They move independently and they mean different things:

| Measurement | What it answers | What moves it |
| --- | --- | --- |
| Prompt coverage | Am I in the conversation at all? | Topical coverage, crawler access |
| Citation share | How much of the sourcing is mine? | Citable, quotable, well-structured pages |
| Position in answer | Am I the default or the alternative? | Perceived authority, third-party corroboration |
| Framing | What is said about me? | Reviews, comparisons, your own clarity |

An observed pattern worth naming: coverage and citation share often move in opposite directions for a while. A site that publishes a burst of thin comparison pages can get mentioned more and cited less, because the pages are easy to reference and hard to quote. If you track only one number you will read that as a win.

## Building a prompt set that reflects real demand

A prompt set is a frozen list of the questions your buyers actually ask, written the way they would type them into a chat box — full sentences, context, constraints. Thirty to sixty prompts is usually enough. Build it from the questions your sales team answers on calls, the searches in your own site search logs, and the "people also ask" tail of your existing keywords. Then stop editing it.

Freezing it is the part teams get wrong. Every prompt you add or reword resets the baseline, and a metric with a moving baseline cannot show a trend. Our recommendation is to version the set: keep v1 running unchanged for at least two quarters, and start v2 alongside it rather than in place of it.

A concrete example. A managed-IT provider in Ottawa might freeze a set that includes:

- "best managed IT provider for a 50-person law firm in Ottawa"
- "how much should a small business pay for managed IT in Canada"
- "compare managed IT providers with 24/7 support in Ontario"
- "is co-managed IT worth it for a company with one internal sysadmin"

Four prompts, four different intents — vendor selection, pricing, comparison, and a category question where the winner is whoever explains the concept best. That last kind is the one most teams leave out of their set, and it is frequently the easiest to win.

## Run it the same way every time

The measurement has to come from a clean session: no logged-in account, no chat history, no memory, no personalization, and a consistent location. Your own logged-in window has been trained on months of your own behaviour, and it will name your brand more readily than a stranger's session will. That is not a measurement, it is a mirror.

Hold four things constant across runs — the prompt text, the engine, the locale, and the session state — and let only the calendar change. Anything else you vary is a variable you have introduced into your own trend line.

Before you read a low number as a content problem, rule out the boring explanation. [Run a free GEO audit](/free-audit): it does not run your prompt set — only a prompt run does that — but it does report which AI user-agents your robots.txt allows, whether your pages carry their substance in the HTML, and what structured data is present. A site the crawlers cannot read will score zero on every one of the four measurements above for reasons that have nothing to do with your writing.

## What to do with the numbers

Low coverage and low citation share together almost always mean an access or an inventory problem: either the engines cannot fetch and parse your pages, or you have not written anything on the topic. Start with access — see [making your site readable to AI crawlers](/blog/make-your-site-readable-to-ai-crawlers), because no amount of content fixes a page nothing can retrieve.

High coverage with low citation share is the more interesting case. You are being talked about and not quoted, which usually means your pages state conclusions without the specifics that make a passage worth lifting: no numbers, no named conditions, no dates. That is a writing problem, and it is the gap [the AI citation gap](/blog/find-your-ai-citation-gap) is about closing.

Framing that is accurate but unflattering is a third, separate problem, and it is rarely solved on your own site.

## Measurement checklist

- Freeze a set of 30 to 60 real buyer questions, written as sentences.
- Cover four intent types: vendor selection, pricing, comparison, and category explanation.
- Run every prompt through every engine you care about, unchanged.
- Use a clean, logged-out session with no memory and a fixed locale.
- Record all four numbers per run, not a single blended score.
- Keep the raw answer text, not just the score — the framing is in the prose.
- Re-run weekly, on the same day.
- Version the set rather than editing it; run v2 alongside v1.
- Re-baseline after any deliberate site change, and note the date.

## Where this fits alongside SEO

None of this replaces your existing reporting. Organic sessions, rankings and conversions still describe a channel that still sends traffic, and AI visibility describes a different surface with a different unit of observation. Reporting them in one blended "visibility score" hides which one moved. The relationship between the two — where they overlap, where they genuinely conflict, and which SEO metrics stop meaning what they used to — is the subject of [SEO metrics vs GEO metrics](/blog/seo-vs-geo-metrics).
