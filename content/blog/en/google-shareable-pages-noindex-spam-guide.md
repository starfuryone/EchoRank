---
featuredImage: /blog/google-shareable-pages-noindex-spam-guide/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Google's new noindex advice for shareable pages'"
slug: google-shareable-pages-noindex-spam-guide
title: Google's new noindex advice for shareable pages
seoTitle: Google adds noindex guidance for shareable pages
metaDescription: Google updated its spam guide Oct. 26 with new indexing advice for user-generated shareable content. Here's what it means for AI visibility.
excerpt: Google's October update to its spam guide includes new guidance on blocking indexing of shareable pages, generated outputs, and interactive tools. We explain what this means for your AI visibility strategy.
category: AI Visibility
tags: [noindex, robots.txt, Google-Extended, indexing, shareable content]
searchIntent: informational
primaryKeyword: noindex shareable pages
secondaryKeywords: [robots.txt, spam guide, user-generated content, Google indexing, generated outputs]
publishedAt: 2026-10-27
tldr:
  - Google added a new "Only index content meant for Search" section to its spam guide on Oct. 26
  - The guidance advises using noindex tags or robots.txt blocks for pages meant for direct sharing, not search discovery
  - Robots.txt alone does not keep pages out of Google—noindex or X-Robots-Tag headers are required
  - AI agents like Google-Agent treat robots.txt differently than traditional crawlers
  - Your monitoring strategy must account for pages Google indexes despite robots.txt blocks
relatedSlugs: [ai-crawler-user-agents-and-robots-txt, make-your-site-readable-to-ai-crawlers, structure-content-for-ai-answers]
relatedTool: free-audit
status: draft
featured: false
---

## Google updated its spam guide with new noindex rules for shareable content

[Google updated its spam guide on Oct. 26](https://www.searchenginejournal.com/google-indexing-advice-shareable-pages-spam-guide/594451/) with a new "Only index content meant for Search" section that advises websites to block indexing of pages created for direct sharing, collaboration, or utility. The guidance specifically recommends using noindex tags (via meta tag or X-Robots-Tag HTTP header) or robots.txt blocks by default for generated outputs, interactive tools, and shareable pages that are not intended for public search discovery. This update targets what Google calls "blocking indexing of link-shared content" and reflects a broader effort to keep user-created pages that aren't meant for Search out of the index.

However, the critical flaw in relying solely on robots.txt is now formally documented in Google's own materials: [according to its robots.txt introduction page, a page blocked by robots.txt can still be indexed if linked to from other sites](https://www.searchenginejournal.com/google-indexing-advice-shareable-pages-spam-guide/594451/). When that happens, your URL and its anchor text can appear in search results without a description. This gap has direct implications for how you should approach blocking user-generated content from AI systems.

## Robots.txt blocks crawling, not indexing—and AI agents often bypass it anyway

Robots.txt only prevents Google's crawler from *requesting* a page. It does not prevent indexing if Google already knows about the URL from another source. Our recommendation: never rely on robots.txt alone to keep shareable content out of the search index. The updated spam guide confirms this by explicitly stating that noindex or X-Robots-Tag headers must be paired with robots.txt when you want to block indexing of user-generated content.

The complication deepens with AI agents. [Google's Gary Illyes recently clarified that robots.txt is an access preference protocol that governs which URLs a crawler may request, not what happens to content afterward](https://www.searchenginejournal.com/google-illyes-robots-txt-crawling-ai-training/593957/). More importantly, [Google-Agent—the user agent Google uses for its hosted AI agents—is classified as a user-triggered fetcher, meaning these agents generally do not follow robots.txt directives](https://www.searchenginejournal.com/pichai-ai-agents-browsing-protocols/593986/). If a user asks a Gemini agent to perform actions on your site, the agent may access shareable pages even if you've blocked the standard Googlebot in robots.txt.

A hypothesis: as AI agents become more common, robots.txt rules that block traditional search crawlers may become less effective as a complete content control strategy. We cannot yet verify how extensively Google-Agent or other agents bypass robots.txt in production, but the documentation suggests it is routine.

## Monitor your indexing status in Search Console for unexpected spikes

Google's updated guidance emphasizes active monitoring of pages that shouldn't be indexed. The spam guide now recommends:

- Verifying your website or subdomain in Search Console to receive alerts about manual actions or security issues
- Checking the Page Indexing report regularly for unexpected spikes in indexed pages
- Checking the Search Performance report for anomalies in impressions or queries that don't align with your platform's intent
- Tracking creation and indexing at the platform level, with alerts for spikes in newly published public pages or cases where a small number of users generate a large share of indexable URLs

Our recommendation: pay special attention to the Page Indexing report's status labeled "Indexed, though blocked by robots.txt." If shareable content appears under that status, it means Google found the URL through external links and indexed it despite your robots.txt block. In those cases, remove the robots.txt block and apply noindex instead. Robots.txt won't matter—Google already knows the page exists.

- Check your Page Indexing report weekly for spikes in user-generated content
- Document when new shareable pages are created and track their indexing lag
- Set up alerts for keywords that should not appear in your search results
- Review the Search Performance report for queries linked to shareable content you didn't intend to rank
- Test both noindex tags and X-Robots-Tag headers on a sample of pages before rolling out platform-wide

## What robots.txt and noindex can and cannot do

Google's documentation now makes the distinction clear. Robots.txt prevents Googlebot from *crawling* a page. If Google can't crawl it, the crawler will never see a noindex rule, so [noindex and robots.txt together create a dead end: noindex won't work if robots.txt blocks access](https://www.searchenginejournal.com/google-indexing-advice-shareable-pages-spam-guide/594451/).

Noindex, by contrast, works only if Googlebot can read it. You can apply noindex via a meta tag in the HTML head or via an X-Robots-Tag HTTP response header. Both methods allow Googlebot to crawl the page, see your instruction, and remove it from the index.

For shareable pages, the pattern should be:
1. Do not use robots.txt to block shareable URLs by default.
2. Use noindex on all shareable pages at creation time.
3. Apply noindex via X-Robots-Tag headers if you can't modify HTML (for example, on third-party platforms).
4. Monitor the Page Indexing report for pages that slip into "Indexed, though blocked by robots.txt" state, which signals external links are overriding your robots.txt block.

One wrinkle: [Google-Extended is a separate robots.txt token that governs whether content Google crawls can be used to train Gemini models](https://www.searchenginejournal.com/google-illyes-robots-txt-crawling-ai-training/593957/). It does not affect Google Search inclusion. A hypothesis: if your shareable pages appear in Google Search despite noindex, Google-Extended rules may not prevent them from being used in Gemini training or grounding. We cannot yet confirm whether removing pages from the search index also removes them from AI training pipelines.

## AI agents visit pages differently than search crawlers

[Sundar Pichai, Google's CEO, stated that AI agents will access website content via two methods: by browsing like humans, and through protocols designed for agent use](https://www.searchenginejournal.com/pichai-ai-agents-browsing-protocols/593986/). He expects both approaches to grow, but noted that browser-based access will remain visible while protocols like the Universal Commerce Protocol (UCP) develop over time.

This creates a detection problem. When an AI agent browses your shareable pages via browser-like access (as Google-Agent does), it behaves like a user clicking a link, not like a crawler that respects robots.txt. The same noindex and X-Robots-Tag rules should still apply, but if your architecture serves different headers or HTML to different user agents, you must ensure that shareable pages always return noindex regardless of whether the visitor is identified as an AI agent.

Our recommendation: [review your noindex and robots.txt setup using our free audit](/free-audit) to identify shareable URLs that may be missing noindex tags or improperly blocked by robots.txt alone. If you're hosting user-generated content or running a platform that allows link-sharing, add monitoring for the Page Indexing report as part of your weekly routine.

## Apply this guidance to your site now

The timing of Google's update matters. As more AI agents move beyond search and into direct browsing of your site, the lines between "content meant for search" and "content meant for sharing" will blur. Shareable pages that aren't properly blocked can leak into search results, inflate your indexing footprint, and potentially be used for AI training. The new spam guide clarifies that platforms and site owners are expected to make this distinction explicit.

For most sites, shareable pages are low-value for search rankings and high-risk for spam signals. Noindex them at creation time. Don't rely on robots.txt. Monitor your Page Indexing report for exceptions. And as you [structure your content for AI answers](/blog/structure-content-for-ai-answers), remember that shareable URLs should be excluded from that effort unless they're truly meant for public discovery.

Finally, consider whether [your current AI crawler blocks are actually working](/blog/ai-crawler-user-agents-and-robots-txt). Google-Agent and other hosted agents may not respect robots.txt, and as browsing protocols mature, the tools available to control which pages AI systems can access will evolve.
