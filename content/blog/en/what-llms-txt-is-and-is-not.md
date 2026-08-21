---
slug: what-llms-txt-is-and-is-not
title: "What llms.txt is, what it is not, and whether to publish one"
seoTitle: "llms.txt: What It Is and What It Is Not"
metaDescription: "llms.txt is a proposed convention, not a standard and not an access control. Here is what it can do, what it cannot, and how to write one worth having."
excerpt: "llms.txt has been described as everything from robots.txt for AI to a ranking factor. It is neither. It is a curated map of your best pages, and it is only worth publishing if you treat it as one."
category: Best Practices
tags: [llms.txt, GEO, technical SEO, AI crawlers]
searchIntent: informational
primaryKeyword: llms.txt
secondaryKeywords: [llms.txt format, llms full txt, AI crawler file, GEO technical setup]
publishedAt: 2026-08-12
featuredImage: /blog/what-llms-txt-is-and-is-not/hero.svg
featuredImageAlt: "A plain text file icon beside a crossed-out padlock and a crossed-out ranking chart, indicating llms.txt is neither access control nor a ranking signal."
tldr:
  - "llms.txt is a proposed community convention, not a web standard and not something any engine is obliged to read."
  - "It is not access control. robots.txt and your server are what stop a crawler; llms.txt has no enforcement of any kind."
  - "Its real job is curation: a short markdown map pointing at the pages you would want quoted, with one line of context each."
  - "Publish one only if you will keep it current. A stale llms.txt is a confident list of your out-of-date pages."
faq:
  - q: "Will publishing llms.txt improve my rankings?"
    a: "There is no evidence that it does, and we do not claim it. No major engine has documented llms.txt as an input to retrieval or ranking. Publish it because it is a cheap, honest map of your best content, not because you expect a lift."
  - q: "Does llms.txt block AI crawlers?"
    a: "No. It has no directive syntax, no allow or deny semantics, and nothing enforces it. If your goal is to stop a specific crawler, that is robots.txt plus server-level rules, and neither is optional if you actually mean it."
  - q: "What is llms-full.txt?"
    a: "A companion convention that inlines the full text of the listed pages into one file instead of linking to them. It is useful for a small documentation site and impractical for a large one. If you cannot regenerate it on every deploy, do not publish it."
relatedTool: free-audit
relatedSlugs: [make-your-site-readable-to-ai-crawlers, how-to-measure-ai-search-visibility]
status: published
featured: false
---

llms.txt is a proposed convention for publishing a short, curated markdown file at the root of your site that points an AI system at the pages you consider most worth reading. That is all it is. It is not a web standard, no engine has committed to reading it, it carries no allow or deny directives, and there is no published evidence that it affects how any answer engine retrieves or ranks anything. Treated as what it is — a hand-written map of your best content — it is a reasonable thing to publish. Treated as robots.txt for AI, or as a ranking lever, it will disappoint you.

The confusion is understandable. It sits at the root, it has a lowercase dotted filename, and it is addressed to machines. Those are also the only things it has in common with robots.txt.

## What it is not

It is not access control. robots.txt expresses a request that well-behaved crawlers honour, and server-level blocking is what enforces anything against the rest. llms.txt has neither: no syntax for permission, no convention for refusal, and nothing that would carry weight if it did. A site that publishes llms.txt and expects it to keep a crawler out has published a suggestion and called it a lock.

It is also not a ranking signal, and we would rather say so plainly than sell a file. No major answer engine has documented it as an input. Any claim that adding llms.txt lifted a site's AI visibility is, absent a controlled comparison, a claim about a site that changed several things at once.

Finally, it is not a sitemap. A sitemap is exhaustive and machine-generated; the entire value of llms.txt is that it is short and chosen. A generated llms.txt listing every URL is a worse sitemap.

## What it is for

Its real job is curation with context. A sitemap tells a machine that a URL exists. llms.txt tells it which handful of pages actually explain what you do, and adds one line saying what each is for — which is exactly the information a retrieval system has to infer expensively from the pages themselves.

The format is plain markdown with a small, conventional shape: an H1 with your site name, an optional blockquote summarizing it, then H2 sections containing link lists where each item is a link followed by a colon and a short description.

```
# Echorank

> Reputation and AI visibility monitoring: track how answer engines
> describe your brand, and what they cite when they do.

## Docs

- [Getting started](https://echorank360.com/en/guides/getting-started): Set up
  your first monitored domain and prompt set.
- [AI visibility guide](https://echorank360.com/en/guides/ai-visibility): What
  is measured, and how the numbers are produced.

## Optional

- [Glossary](https://echorank360.com/en/glossary): Definitions for search,
  ranking and AI visibility terms.
```

Two conventions in that example are worth copying. Use absolute URLs, because the file may be read far from its origin. And keep an "Optional" section at the end for material a reader can skip — it is the one place the format lets you express priority, and most published files ignore it.

## Whether to publish one

Publish one if you can answer yes to all of: you have fewer than about thirty pages worth pointing at, you can describe each in one honest sentence, and you have somewhere in your deploy process for keeping it current. Otherwise skip it. This is a recommendation, not a rule, and the reasoning is that the cost of a stale file is real: an llms.txt listing a pricing page that moved, or a guide you deleted, is a confident, machine-addressed list of your mistakes.

A hypothesis, stated as one because we cannot yet test it: the curation itself may be worth more to you than to any crawler. Teams that sit down to pick fifteen pages and write one line about each usually discover that four of them cannot be described in one sentence, which is a content finding regardless of who reads the file.

## Where the real work is

If your goal is to be retrieved and cited, llms.txt is nowhere near the top of the list. A page that a crawler cannot fetch, or that renders its substance only after JavaScript runs, is invisible whether or not it appears in a curated file — and that failure is far more common than a missing convention file. [Making your site readable to AI crawlers](/blog/make-your-site-readable-to-ai-crawlers) covers the checks that actually change what gets retrieved, and it is the article to read first if you only read one.

After access comes measurement. Publishing llms.txt without a baseline means you will never know whether it did anything, which is how the ranking-factor folklore started in the first place — see [how to measure AI search visibility](/blog/how-to-measure-ai-search-visibility) for the frozen prompt set that makes a before-and-after readable.

## A checklist for a file worth having

- Put it at the site root, served as `text/plain` or `text/markdown`.
- Open with an H1 naming the site and a one-blockquote summary of what it does.
- Group links under H2 sections that reflect how a stranger would look for them.
- Use absolute URLs throughout.
- Give every link a description of one sentence, written for someone who has never heard of you.
- Cap it at roughly thirty links. If it needs more, it is a sitemap.
- Put genuinely skippable material under a final "Optional" heading.
- Add regeneration or review to your deploy checklist, so it cannot rot silently.
- Do not use it to try to block anything. That is robots.txt and your server.

## Set expectations before you ship it

There is no generator for this on Echorank, and we would rather point you at the honest next step than invent a tool page: the file is short enough to write by hand in twenty minutes, and hand-writing it is where the value is. What is worth doing first is finding out whether you have a retrieval problem at all. [Run a free GEO audit](/free-audit): among its checks it reports whether you already publish an llms.txt, which AI user-agents your robots.txt allows, and whether your pages carry their substance in the HTML rather than assembling it in the browser. Browse the [free tools](/free-tools) for the adjacent questions. If that audit says your pages cannot be fetched or parsed, llms.txt is not the fix, and knowing it before you spend the afternoon is the point.
