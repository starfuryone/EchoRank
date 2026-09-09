---
featuredImage: /blog/llms-txt-misuse-common-crawl-analysis/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Common Crawl finds widespread llms.txt misuse and confusion'"
slug: llms-txt-misuse-common-crawl-analysis
title: Common Crawl finds widespread llms.txt misuse and confusion
seoTitle: How sites misuse llms.txt like robots.txt — Common Crawl data
metaDescription: Common Crawl analyzed 500k llms.txt files. 68% are auto-generated, 22% have no links, and sites confuse it with robots.txt. What it means for your AI visibility.
excerpt: A Common Crawl analysis of over 500,000 llms.txt files reveals widespread confusion about the format's purpose. Most files come from plugins, many sites treat it as robots.txt, and crawlers ignore its restrictions anyway.
category: AI Visibility
tags: [llms.txt, robots.txt, AI crawlers, Common Crawl, content discovery]
searchIntent: informational
primaryKeyword: llms.txt misuse
secondaryKeywords: [Common Crawl analysis, robots.txt confusion, AI crawler directives, llms.txt format]
publishedAt: 2026-09-09
tldr:
  - Common Crawl found 68% of llms.txt files originate from plugins or templates, not human choice
  - 22% of analyzed files contain no links at all, defeating the file's purpose as a curation tool
  - Sites incorrectly use llms.txt to block crawlers—a rule it cannot enforce, unlike robots.txt
relatedTool: free-audit
relatedSlugs: [what-llms-txt-is-and-is-not, ai-crawler-user-agents-and-robots-txt, make-your-site-readable-to-ai-crawlers]
status: draft
featured: false
---

## Most llms.txt files are auto-generated templates with no real curation

[Common Crawl analyzed over 500,000 llms.txt files](https://www.searchenginejournal.com/common-crawl-llms-txt-robots-txt/588786/) and found that 68% originated from a plugin or template rather than deliberate site owner choice. Wix alone accounts for 41% of the sample. The data suggests that llms.txt adoption is not a thoughtful strategy but a side effect of how site builders and SEO plugins ship their defaults. This is the core problem: the file exists on hundreds of thousands of sites, but most site owners probably do not know it exists.

The analysis also found that 22% of llms.txt files contain no links at all. The llms.txt spec requires only an H1 title; everything else—the summary, the link list, descriptions—is optional. But a file with no links defeats the entire purpose of the format: to offer AI crawlers a curated list of pages worth citing. When Wix templates generate a file by default, and that file has no links, the outcome is noise rather than signal.

Just under half of the files (49%) include the full structure the analysis tested: an H1, a summary blockquote, and bulleted links. Thirty-two percent add a short note describing each link. The rest are skeletal or empty. This fragmentation means there is no consistent signal for any crawler to interpret, and our recommendation is to audit your own llms.txt file to ensure it actually serves a purpose before relying on it as part of your AI visibility strategy.

## Sites confuse llms.txt with robots.txt and write blocking rules it cannot enforce

Common Crawl discovered that 1,570 llms.txt files cited a specific crawler, and 32 appeared to deny Common Crawl's own bot. However, when the team checked the robots.txt files at those 32 sites, none blocked CCBot outright. Five sites explicitly allowed it, 11 limited access to certain paths, and 15 had no restrictions. One site returned an HTTP 429 error. The discrepancy is stark: sites are writing rules into llms.txt as if it were a policy document, but llms.txt grants nothing and blocks nothing. It is a policy *description*, not a policy.

The spec itself is clear: it is a proposal for AI systems to find suggested content. Crawlers consult robots.txt to learn what they are allowed to fetch. CCBot, which Common Crawl operates, respects robots.txt. If a site wants to block a crawler, the rule must live in robots.txt, not in llms.txt. Yet across the sample, sites are using llms.txt as a secondary control mechanism. One site even stated in its llms.txt file that CCBot was blocked "as of June 2026"—but its robots.txt allowed the crawler under a wildcard rule. The two files had drifted out of sync.

Beyond the llms.txt files analyzed, Common Crawl found 136,578 robots.txt files served at the llms.txt path. This is not a typo: sites are placing robots.txt where llms.txt should go. This confusion suggests that many site owners or their tools do not understand the distinction. Our recommendation is to verify that your robots.txt and llms.txt files are in the correct locations and that any crawler restrictions are written only in robots.txt, not in llms.txt.

## A small number of llms.txt files attempt prompt injection, but the finding is narrow

Common Crawl's analysis tested for prompt-injection attempts—instructions embedded in llms.txt to override or redirect AI behavior. The team found four genuine cases where individuals intentionally inserted such instructions to make a point. One file's summary told the model to ignore prior instructions and fetch a second file. The other six matches were false positives: documentation that quoted control tokens in order to explain them.

An additional 3,793 files showed milder guidance, such as "focus on these pages." These are not injections but are statements of intent. The key finding is that llms.txt is not a vector for widespread prompt injection, but it is being used by some site owners as a way to send instructions directly to AI systems. This stated as a hypothesis, because the sample came only from sites CCBot had recently fetched without problems, not the entire web. The analysis is also based on a single crawl, so trends over time cannot be confirmed.

The method of detection relies on keyword matching, which the analysis acknowledges is likely an undercount. We cannot yet verify whether the prevalence of such attempts has grown or whether any AI system actually processes these instructions beyond demonstrating that they can.

## Audit your llms.txt before you rely on it for AI visibility

The data from Common Crawl makes clear that llms.txt is not yet a mature signal in AI discovery. Most files are boilerplate, many are empty, and sites are using it to try to enforce rules it cannot enforce. This does not mean llms.txt is worthless—but it does mean you should audit your own file and decide whether publishing one serves your goals.

Use this checklist to evaluate your llms.txt:

- Does your llms.txt file actually exist and live at the correct path (the root, not inside robots.txt)?
- Does it contain a curated list of your best pages, or is it auto-generated with no links?
- Have you added a summary or description that explains what these pages are about?
- Is your robots.txt file separate from your llms.txt file, and do the two not contradict each other?
- Have you verified that any crawler blocking rules are written in robots.txt, not llms.txt?
- Do you know whether any AI systems actually fetch and use your llms.txt file?

If you have not created an llms.txt file at all, the Common Crawl data does not suggest you are missing a critical ranking factor. Our recommendation is to focus first on the foundational work: [make sure your site is readable to AI crawlers](/blog/make-your-site-readable-to-ai-crawlers), structure your content so AI systems can extract and cite it, and use [robots.txt correctly to set your crawl policy](/blog/ai-crawler-user-agents-and-robots-txt).

Only after those basics are in place should you consider whether llms.txt is worth the effort. If you do publish one, ensure it reflects your actual best content and that it does not contradict your robots.txt. The Common Crawl analysis found that two-thirds of llms.txt files now come from plugins and site builders, not from deliberate human choice. This means the format's future shape will depend on what tools decide to ship, not on what the spec intends. Until that normalizes, treat llms.txt as a supplementary discovery signal, not as a control mechanism.

To measure whether your pages are actually cited by AI systems, use [our free audit](/free-audit) to see where your brand and content appear in AI-generated answers.
