---
featuredImage: /blog/crawl-to-refer-ratio-four-denominators/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'The crawl-to-refer ratio's hidden denominators'"
slug: crawl-to-refer-ratio-four-denominators
title: The crawl-to-refer ratio's hidden denominators
seoTitle: Why crawl-to-refer ratios differ wildly (and what to do)
metaDescription: The same Cloudflare metric produces ratios spanning an order of magnitude. Four stacked denominators explain why.
excerpt: Cloudflare's crawl-to-refer ratio spread rapidly through AI visibility discussions. The same source produces wildly different figures because most people quote only the numerator.
category: AI Visibility
tags: [metrics, cloudflare, ai-crawlers, citation-tracking]
searchIntent: informational
primaryKeyword: crawl-to-refer ratio
secondaryKeywords: [cloudflare, ai-visibility, metrics, citation-gap]
publishedAt: 2026-09-12
tldr:
  - Cloudflare's crawl-to-refer metric appears in reports as 70,900 to one, 38,000 to one, 10,300 to one and more from the same source
  - The variation comes from four stacked denominators: measurement window, which bots you count, whose sites you measured, and which referrals you detected
  - A single week's crawl scheduling shift moved Google's ratio by 19.4%, showing how sensitive the number is to timing
  - Native app traffic typically carries no Referer header, so referral counts capture only web-based tools and may overstate ratios by an unknown amount
  - Our recommendation: treat crawl-to-refer as directional, not absolute, and track your own ratio against your logs rather than relying on aggregate figures
relatedTool: free-audit
relatedSlugs: [find-your-ai-citation-gap, track-brand-mentions-across-llms]
status: draft
featured: false
---

Cloudflare published one metric. [According to Search Engine Journal](https://www.searchenginejournal.com/everyone-is-quoting-the-same-number-and-getting-different-answers/588659/), that metric has since circulated as 70,900 to one, 38,000 to one, 23,951 to one, 11,122 to one, 10,300 to one, 4,580 to one, and 2,237 to one—all attributed to Anthropic's crawl-to-refer ratio, all from the same publisher, all within 13 months. Two of them claim the same month and differ by a factor of 17. The metric itself is sound. The problem is not carelessness or spin. It is what happens to a ratio when people quote the numerator and forget about the four denominators stacked inside it.

## What is crawl-to-refer

The crawl-to-refer ratio compares pages a platform fetches against visitors it returns. AI crawlers take your content and, in many cases, serve answers in place of it. The ratio measures that imbalance. Seventy thousand to one means a platform fetched 70,000 pages and sent back one visitor. Five to one means it took five pages and returned one visitor. This metric matters because it quantifies the economic break in how the open web funds itself—the old trade of crawl-for-traffic no longer holds.

## Why the same source produces different numbers

Cloudflare introduced the ratio in July 2025 with a documented formula: take HTML requests from a platform's user agents, divide by HTML requests with a Referer header naming that platform. The methodology was published in full. The numbers still scatter across an order of magnitude because a ratio is a denominator stacked inside another denominator inside another one.

### The measurement window

The first denominator is how long you measure. Cloudflare's launch post used June 19 to 26, 2025—one week—and reported Anthropic at 70,900 to one. A separate post the same month, measuring June 2025 as a whole, reported 73,000 to one. Same publisher, same month, different windows. Downstream, you find weekly figures, monthly figures, quarterly figures, and rolling 28-day figures circulating as though they are the same number. Cloudflare tracked Google's ratio moving 19.4% week over week, attributable to a drop in GoogleBot crawling that began on a specific day. A scheduling decision shifted the published number by a fifth in seven days.

### Which bots you count

The second denominator is aggregation. Cloudflare counts a platform's training crawler and its user-request crawler—operating under different user agents—as a single platform figure. One crawler consumes at scale and returns nothing by design. The other fetches on demand and can send traffic back. Rolled together, the platform figure describes neither behavior cleanly. This also breaks the standard comparison against Google, because some operators run purpose-split crawler fleets and others run unified ones. The aggregate is therefore measuring a different kind of object on each side.

### Whose sites you measured

The third denominator is sample composition. Cloudflare sees traffic crossing Cloudflare's network—an enormous dataset and still a sample, weighted toward properties behind Cloudflare. When one analyst measured the same metric across Cloudflare's network and their own commercial panel in the same period, one platform's ratio roughly doubled. Panel composition alone moved it.

### Which referrals you detected

The fourth and most consequential denominator is what you can see. A referral only counts if the request carried a Referer header naming the platform. Cloudflare stated directly that Claude's native app does not send that header, that other providers' native apps likely do not either, and that referral counts therefore capture only web-based tools. They also stated that the size of this distortion is unclear—a quiet acknowledgment that the metric understates platforms in an unknown direction.

## What this means for measuring your own AI visibility

Our recommendation: treat published crawl-to-refer figures as directional, not absolute. They show relative patterns—which platforms take more and return less—but the specific numbers are fragile. If you want to know how an AI platform treats your site, measure your own logs. Look at requests from known AI user agents and match them against referrals carrying that platform's domain in the Referer header. You control the window, you control which bots you count, and you see all the referrals that exist, not just the ones that announce themselves in headers.

This is also why tracking your own [AI citation gap](/blog/find-your-ai-citation-gap) and understanding [which AI crawlers are hitting your site](/blog/ai-crawler-user-agents-and-robots-txt) matters more than waiting for industry-wide ratios. The aggregates are useful for context, but they flatten out the variation that actually drives your traffic. Your site sits on its own topology of AI platforms, each with its own ratio to you.

## Checklist: measuring crawl-to-refer for your site

- Log all requests to your site by user agent over a fixed period (we recommend 28 days)
- Identify which user agents belong to which AI platforms using public documentation
- Count HTML requests from each platform's crawlers
- Count HTTP requests where the Referer header contains each platform's domain
- Divide crawls by referrals for each platform
- Repeat this measurement monthly to track whether the ratio improves or worsens
- Keep the measurement window consistent so you can compare across months
- Document which native apps you use to access each platform and note that they likely carry no Referer header

## What remains unknown

A hypothesis: the true size of the Referer header gap. Cloudflare knows Claude's native app does not announce itself. They do not know how many users rely on native apps versus the web interface, and they state the impact on their figures as unclear. This matters because if native app usage is high and growing, the published ratios overstate how lopsided the exchange actually is—or more precisely, they measure only half the exchange. We cannot yet verify how much traffic moves through native apps versus web, or whether that proportion is shifting.

The growth rates matter too. Google announced that AI Mode had passed a billion monthly users and that queries had "more than doubled every quarter since launch." A doubling every quarter with no base is a growth rate you cannot interpret. Doubled from what? That same problem sits inside an earnings call, not just inside this metric.

Use [/free-audit](/free-audit) to measure what your site actually sends and receives from AI platforms. The aggregate numbers are a map; your logs are the territory.
