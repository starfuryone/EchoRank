---
featuredImage: /blog/cloudflare-robots-txt-bot-preference-sync/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Cloudflare's Bot Preference Sync and the robots.txt honesty problem'"
slug: cloudflare-robots-txt-bot-preference-sync
title: Cloudflare's Bot Preference Sync and the robots.txt honesty problem
seoTitle: Cloudflare Bot Preference Sync: What it means for your AI visibility
metaDescription: Cloudflare's Bot Preference Sync auto-writes robots.txt from your dashboard settings—but it cannot express granular per-bot policies, and it is on by default.
excerpt: Cloudflare announced Bot Preference Sync, which generates your robots.txt from dashboard settings. The product fixes a real problem—drift between policy and enforcement—but it abstracts bot control to three categories and cannot express per-company decisions.
category: AI Visibility
tags: [robots.txt, bots, Cloudflare, AI crawlers, visibility]
searchIntent: informational
primaryKeyword: robots.txt
secondaryKeywords: [Bot Preference Sync, AI crawlers, bot blocking, Cloudflare, crawler policy]
publishedAt: 2026-09-19
tldr:
  - Cloudflare's Bot Preference Sync automatically writes robots.txt entries from dashboard settings, keeping policy and enforcement in sync.
  - The product abstracts crawler control into three categories (Search, Agent, Training) that cannot express granular per-company allow/block decisions.
  - Cloudflare names no specific crawlers that bypass conflicting policies, but confirms that gaps between stated and enforced rules invite circumvention.
  - Site owners whose crawler strategy varies by company must turn the sync off and maintain robots.txt by hand, which negates the product's benefit.
relatedSlugs: [ai-crawler-user-agents-and-robots-txt, what-llms-txt-is-and-is-not, find-your-ai-citation-gap]
relatedTool: free-audit
status: draft
featured: false
---

## Cloudflare's Bot Preference Sync fixes one problem but creates a new constraint

[According to Search Engine Journal](https://www.searchenginejournal.com/cloudflare-will-write-your-robots-txt-and-it-has-a-point/589262/), Cloudflare announced Bot Preference Sync on August 21, 2026—the day after an SEJ editor published a piece arguing that robots.txt files and actual enforcement often drift apart. Bot Preference Sync auto-generates robots.txt entries from your Cloudflare dashboard settings, keeping the two honest with each other. The feature runs from the free tier upward and is on by default for new customers. The generated entries are wrapped in `# BEGIN Cloudflare Bot Preference Sync` and `# END` markers, leaving your existing robots.txt content underneath.

The core problem Cloudflare identifies is real: a file you wrote months or years ago can contradict the edge rules you enforce today, and that gap invites crawlers to treat your policy as a basis for circumvention. Site owners who use Cloudflare to block specific bots at the edge may not realize their robots.txt still welcomes them by name—or vice versa. Sync closes that loop automatically.

However, the product's three-category framework—Search, Agent, and Training, each with block-all, block-on-ad-pages, or allow options—cannot express decisions made one crawler at a time. Many site owners' actual policies do not fit those buckets.

## The three-category model assumes all crawlers within a category deserve the same treatment

Bot Preference Sync groups crawlers into three buckets determined by Cloudflare's internal bot list. Search crawlers, Agent crawlers (assistants and answer engines), and Training crawlers (AI model training) each receive the same instruction: block everywhere, block on pages with ads, or allow everywhere. The Training category's "disallow" option writes a no-training line into robots.txt; the other two write Disallow entries.

That design works for many sites. A publisher that wants to allow all search crawlers and block all training crawlers can set two toggles and be done. The sync keeps those settings reflected in the file.

But it breaks down when a site owner's actual decision-making differs by company. [The SEJ report gives a concrete example](https://www.searchenginejournal.com/cloudflare-will-write-your-robots-txt-and-it-has-a-point/589262/): the author allows OpenAI's GPTBot, Anthropic's crawler, and PerplexityBot—all training crawlers—because they put content in front of people who ask assistants questions. The author blocks Bytespider and meta-externalagent because "they take and return nothing." The decision rule is not "block training crawlers" but "ask per company: what am I getting in return?"

Cloudflare's documented remedy is to turn the sync off and maintain robots.txt by hand—which negates the entire point of the product for those users. Our recommendation is to audit your crawler policy before enabling Bot Preference Sync. If you allow or block crawlers based on individual company decisions rather than category, you will need to manage the file yourself.

## Cloudflare names no crawlers that bypass conflicting policies, but confirms the risk is real

Cloudflare's announcement states that when stated preferences and enforced rules disagree, "some crawlers treat it as a basis to disregard your preferences or try to bypass your enforced rules." [The company does not say which crawlers, or how many, or how it knows](https://www.searchenginejournal.com/cloudflare-will-write-your-robots-txt-and-it-has-a-point/589262/). Cloudflare sits in front of a large share of the web and observes that traffic—it is uniquely positioned to name the crawlers that ignore robots.txt in favor of enforcement signals or vice versa—but it names none.

The absence of specifics does not mean the claim is false. It means we cannot yet verify which crawlers exhibit this behavior, or under what conditions. A hypothesis is that some newer or less-scrupulous crawlers read robots.txt as advisory and test your actual edge enforcement; another is that ambiguous signals invite opportunistic interpretation. Courts recognize that gap as a vulnerability in any compliance argument. A site owner facing litigation over bot exclusion would struggle to prove intent if robots.txt and edge rules contradicted each other.

This is where Bot Preference Sync has real value. It eliminates that ambiguity by guaranteeing that the file always matches the dashboard. For most sites, that is enough.

## The training category's conditions may be unmet by major crawlers

Bot Preference Sync's Training category allows you to write a no-training line into robots.txt. The announcement describes this as a Disallow option that blocks crawlers Cloudflare judges opaque. To avoid that block, a crawler must meet four conditions published by Cloudflare. Two of them illuminate a friction point between site policy and crawler compliance.

Condition two asks for "a way to opt out of AI training without impacting search visibility." Condition four asks for a public statement that the crawler distinguishes between search indexing and model training. [Google's crawler documentation, last updated July 14, 2026, describes Google-Extended as the mechanism for that distinction](https://www.searchenginejournal.com/cloudflare-will-write-your-robots-txt-and-it-has-a-point/589262/). Google-Extended "does not impact a site's inclusion in Google Search nor is it used as a ranking signal." That satisfies condition four on Google's own say-so.

Condition two is where Google and Cloudflare's framework diverge. Google's documentation on AI features lists the controls available: nosnippet, data-nosnippet, max-snippet, or noindex. Every one of those also restricts what Google Search shows. To remove a page from AI Overviews, you must also limit your search snippet or remove indexing entirely. There is no switch that takes you out of AI Overviews alone. [One Google rule governs both: to be shown as a supporting link in an AI Overview, "a page must be indexed and eligible to be shown in Google Search with a snippet."](https://www.searchenginejournal.com/cloudflare-will-write-your-robots-txt-and-it-has-a-point/589262/)

Microsoft answered condition two in September 2023 with a NO_INDEX-like signal. The gap remains for Google.

## Cloudflare also introduced a separate compensation model that ties payment to a different event

[Separately, Cloudflare has been testing Pay Per Crawl and evolving it into Pay Per Use](https://www.searchenginejournal.com/googles-ai-payment-pilot-vs-cloudflare-and-microsoft-models/589636/), where AI companies bring their own payment models. Under Pay Per Crawl, the site owner sets a per-domain price (minimum $0.001) and chooses whether to charge, allow, or block each crawler. Payment happens on each successful HTTP 200 retrieval.

This is where Bot Preference Sync's abstraction creates friction. If you use Bot Preference Sync, you cannot charge one training crawler and block another. If you need that granularity, you must disable the sync and manage robots.txt and your pricing strategy separately. The two systems do not communicate.

Our recommendation is to treat Bot Preference Sync and per-crawler pricing as incompatible for most use cases. If you intend to charge some crawlers or allow some while blocking others within the same category, disable the sync before enabling Pay Per Crawl.

## What you should do now

Use the [Echorank free audit](/free-audit) to document your current crawler policy: which bots you allow, which you block, and whether your decisions group into Cloudflare's three categories or vary by company.

- If all your training crawlers should be handled the same way, and all Agent crawlers the same way, enable Bot Preference Sync and let it keep your robots.txt in sync with the dashboard.
- If you allow some training crawlers and block others (or allow some Agent crawlers and block others), leave the sync off and [manage your robots.txt and AI crawler allow/block decisions as a single system](/blog/ai-crawler-user-agents-and-robots-txt).
- If you plan to charge some crawlers, disable Bot Preference Sync before setting up per-crawler pricing.
- Before you choose, review [what robots.txt actually does and does not do](/blog/what-llms-txt-is-and-is-not) in the context of AI crawlers.
- Document your crawler policy in writing and check it quarterly. Nothing automatic keeps it honest with what you would decide today.

The broader lesson is that abstraction is useful when it matches your decision-making. Where it does not, you trade convenience for constraint. Cloudflare's three categories work for many sites. For the others, the old way—writing the file by hand and testing it—remains the clearer path.
