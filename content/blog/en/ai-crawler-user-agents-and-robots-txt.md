---
slug: ai-crawler-user-agents-and-robots-txt
title: "AI crawler user-agents: who is hitting your site and what to allow"
seoTitle: "AI Crawler User-Agents & robots.txt Guide"
metaDescription: "GPTBot, ClaudeBot, PerplexityBot, Google-Extended and friends do different jobs. Blocking the wrong one removes you from answers, not just from training."
excerpt: "Every AI company runs several crawlers, and they do not all do the same thing. One feeds training, one feeds live answers, one fetches on a user's behalf. Treating them as one bot in robots.txt is how sites disappear from AI answers by accident."
category: GEO Guides
tags: [GEO, AI crawlers, robots.txt, GPTBot, ClaudeBot]
searchIntent: informational
primaryKeyword: AI crawler user agents
secondaryKeywords: [GPTBot robots.txt, ClaudeBot, PerplexityBot, block AI crawlers]
publishedAt: 2026-08-23
featuredImage: /blog/ai-crawler-user-agents-and-robots-txt/hero.svg
featuredImageAlt: "Three lanes of crawler traffic — training, indexing and live retrieval — approaching one robots.txt gate."
tldr:
  - "Each AI vendor runs distinct crawlers for training, search indexing and live retrieval. They honor robots.txt separately."
  - "Blocking a retrieval agent removes you from answers today. Blocking a training bot only affects future model builds."
  - "Decide per function, not per company: most sites want retrieval and indexing allowed, training a business decision."
  - "Verify what actually hits your server from access logs, not from vendor documentation alone."
faq:
  - q: "If I block GPTBot, does my site disappear from ChatGPT?"
    a: "Not immediately and not entirely. GPTBot gathers training data. ChatGPT's browsing and search answers rely on other agents such as OAI-SearchBot and ChatGPT-User, so blocking GPTBot alone mainly affects whether future models learn from your content."
  - q: "Should I block AI training crawlers?"
    a: "That is a business call, not a technical one. Blocking training protects content from being learned, but there is no evidence it improves visibility, and models trained without your content have no reason to mention you. Decide it at the company level and write robots.txt to match."
  - q: "Do AI crawlers actually respect robots.txt?"
    a: "The major named agents from OpenAI, Anthropic, Google and Apple do. Perplexity has been credibly accused of fetching through undeclared agents in the past. Enforcement beyond robots.txt means firewall rules keyed on verified IP ranges, which the larger vendors publish."
relatedTool: free-audit
relatedSlugs: [make-your-site-readable-to-ai-crawlers, what-llms-txt-is-and-is-not]
status: published
featured: false
---

Your access logs already contain the answer to a question most teams are still debating in the abstract: which AI systems are reading your site. The debate worth having is not whether they visit — they do — but which of their crawlers you allow, because the crawlers do different jobs and the cost of blocking each one is different.

## Three jobs, three kinds of bot

Every major AI vendor splits its crawling into roughly three functions.

**Training collectors** gather content to train future models. OpenAI's `GPTBot`, Anthropic's `ClaudeBot`, and Google's `Google-Extended` token belong here. Blocking them changes what the next model version knows, not what today's answers say.

**Search indexers** build the retrieval index behind AI search products. `OAI-SearchBot` feeds ChatGPT search; `PerplexityBot` builds Perplexity's index. Block these and your pages stop being candidates for citation.

**Live retrieval agents** fetch a page at answer time because a user's question called for it. `ChatGPT-User`, `Claude-User` and `Perplexity-User` are in this class. They arrive with a user waiting on the other end; blocking them turns a would-be citation into a dead fetch.

The practical consequence: a robots.txt line written during a 2023-era "block the AI scrapers" sweep may today be silently removing you from answer engines whose traffic you now want.


## What a sensible default looks like

For a commercial site whose goal is AI visibility, the default that matches intent is: allow retrieval, allow search indexing, decide training deliberately.

```
# Live retrieval — allow: a user is waiting
User-agent: ChatGPT-User
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Perplexity-User
Allow: /

# Search indexing — allow: this is how you get cited
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Training — a business decision; shown here allowed
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /
```

Note what is absent: there is no `User-agent: *` block anywhere near these rules. A wildcard disallow above a specific allow behaves differently across parsers, and AI crawlers are exactly the population you don't want interpreting ambiguity.

## Verify against reality

Vendor docs describe intent; logs describe behavior. Ten minutes of grep answers what documentation cannot:

```
grep -iE 'gptbot|claudebot|oai-searchbot|perplexity|claude-user|chatgpt-user|google-extended|applebot' access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

Two things to look for. First, which agents actually visit and how often — retrieval agents spiking on one URL means that page is being cited somewhere. Second, whether the visits come from published IP ranges; OpenAI, Anthropic and Google publish theirs, and traffic claiming a bot name from outside those ranges is someone spoofing a crawler to bypass your rules, which is a firewall problem rather than a robots.txt one.

## Where this bites

The common failure is inheritance. An agency-installed robots.txt from a previous era, a WordPress plugin with an "AI protection" toggle, a CDN bot-management preset — each can be blocking retrieval agents without anyone having decided that. If your brand shows up in an AI answer as a mention without a link, or competitors get cited for queries where your page is objectively the better source, a crawler block is one of the first three things to check.

Crawl access is the plumbing layer of AI visibility. It decides whether you are in the candidate pool at all; the content itself decides whether you get picked from it.
