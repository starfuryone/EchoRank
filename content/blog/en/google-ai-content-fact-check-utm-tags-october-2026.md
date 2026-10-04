---
featuredImage: /blog/google-ai-content-fact-check-utm-tags-october-2026/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Google demands manual fact-checks on AI content, including metadata'"
slug: google-ai-content-fact-check-utm-tags-october-2026
title: Google demands manual fact-checks on AI content, including metadata
seoTitle: Google's new AI content rules require fact-checking before publishing
metaDescription: Google updated its guidance on Oct. 1 to require manual fact-checks of all AI-generated content, including titles and metadata, before publishing.
excerpt: Google updated its AI content guidance on Oct. 1 to explicitly require manual fact-checking of all AI-generated output, including metadata like titles and image alt text. Gemini is now adding UTM parameters to outgoing links to help site owners track referral traffic more accurately.
category: AI Visibility
tags: [AI content, fact-checking, metadata, Gemini, UTM tags, search guidance]
searchIntent: informational
primaryKeyword: AI content fact-checking
secondaryKeywords: [metadata review, Gemini UTM, AI guidance, generative AI content, manual review]
publishedAt: 2026-10-04
tldr:
  - Google now requires manual fact-checking of all AI-generated content before publishing, including titles and metadata.
  - Gemini is adding UTM parameters to links, allowing site owners to track AI traffic separately from direct visits.
  - The fact-check requirement applies to structured data and image alt text, not just article body copy.
  - Google's update aligns its public guidance with what Search Quality Raters already use to evaluate pages.
relatedTool: free-audit
relatedSlugs: [structure-content-for-ai-answers, schema-markup-for-ai-answers, find-your-ai-citation-gap]
status: draft
featured: false
---

## Google now requires manual fact-checking of all AI-generated content before publishing

[According to Search Engine Journal](https://www.searchenginejournal.com/google-fact-check-ai-content-before-publishing/591782/), Google updated its AI content guidance on Oct. 1 to add explicit language requiring sites to manually fact-check all generative AI output before it goes live. The update added three sentences to the "Focus on accuracy, quality, and relevance" section, clarifying that generative models predict word sequences rather than retrieve facts, and that hallucinations are common. Google also expanded the requirement to cover metadata—titles, meta descriptions, structured data, and image alt text—not just article body text.

This is a significant hardening of Google's stance. The previous version asked for accuracy but did not mandate manual review. Now it does.

## Why metadata matters as much as article copy

The metadata requirement changes how you should think about AI in your content pipeline. If your process fact-checks article drafts but auto-publishes AI-generated titles and alt text, you are now out of compliance with Google's guidance. Our recommendation is to audit your content workflow and make sure human review touches every field that can appear in Search results.

The metadata line in the updated guidance reads: "This review also applies to metadata," and it specifically names title elements, meta descriptions, structured data, and alternate texts for images. Many teams use AI to generate these fields because they are repetitive, but Google is now saying that approach carries the same risk of inaccuracy as letting AI write your articles unsupervised.

This also affects how you [structure content for AI answers](/blog/structure-content-for-ai-answers). If the structured data you publish contains factual errors, AI systems that rely on that data will inherit those errors. A hypothesis is that Google's emphasis on metadata may reflect an increase in AI systems querying structured data directly, rather than crawling and parsing page text.

## Gemini is now tagging outgoing links with UTM parameters

[A Reddit user discovered, and Google's John Mueller confirmed](https://www.searchenginejournal.com/google-gemini-adds-utm-parameters-for-referral-attribution/591754/), that Gemini is adding UTM parameters to links that point to websites. This is undocumented behavior, so the exact rules for when Gemini adds them are not yet clear. Mueller asked for examples and said he would forward details about referrer handling to the team.

The UTM tags solve a real tracking problem. Gemini traffic often shows up as "direct" in Google Analytics because the mobile app and Android assistant do not pass referrer headers reliably. UTM parameters survive those contexts better and show up in raw server logs, making attribution easier.

Our recommendation is to begin monitoring your Google Analytics for medium "gemini" or campaign names that match Gemini. Compare those sessions to your referrer-based Gemini data to understand how much traffic each method captures. This gives you a clearer picture of Gemini's actual contribution to your traffic.

The behavior is still undocumented, so you cannot yet rely on it. We cannot yet verify whether Gemini always adds UTM tags, under what conditions it does so, or whether the parameter format will remain consistent across different types of Gemini answers.

## What you should track and verify now

- Set up a Google Analytics segment or custom report to isolate traffic from Gemini UTM tags.
- Compare UTM-tagged sessions to referrer-based Gemini traffic to measure tracking completeness.
- Audit your content review process to confirm manual fact-checking applies to titles, meta descriptions, and image alt text.
- Document which fields your AI tools generate, and make sure each one has a human checkpoint before publication.
- Monitor Search Console and your server logs for new referrer patterns as Gemini's UTM implementation rolls out further.

## How these changes relate to AI visibility

Both of these updates affect how you appear in AI systems. The fact-check requirement protects your reputation: if your titles and descriptions contain false information, that is what AI systems will cite and amplify. Google is explicit that fabricated metadata is a signal of low quality.

The UTM tags give you better measurement of where your traffic actually comes from. This matters for [measuring AI search visibility](/blog/how-to-measure-ai-search-visibility). If you cannot track Gemini traffic accurately, you cannot argue for resource allocation to content strategies that serve AI systems. Cleaner attribution lets you see which topics, content formats, and citation patterns actually drive Gemini referrals.

Our recommendation is to treat these two updates as a connected pair. Invest in process and tooling to ensure human review of metadata, and begin setting up separate tracking for Gemini sessions so you can measure whether that investment pays off in AI-driven traffic.

## What remains unclear

Google's October 1 changelog lists the fact-check update but does not provide examples of how its automated quality systems detect fabricated metadata in practice. The guidance says deception makes a page untrustworthy to "automated quality systems," but Google does not explain how those systems would identify, for instance, an AI-generated photo in an author bio or a false credential. It is a hypothesis that Google uses some combination of image detection, rater signals, and third-party verification data to flag deceptive author profiles, but this is not documented.

Similarly, Gemini's UTM tagging is undocumented. Mueller's response suggests Google has not yet published rules for when and how UTMs are added. The sources do not state whether Gemini adds UTM tags to every outgoing link, only to links that cite a source, or only under specific conditions. Until Google documents this behavior, you should track both UTM and referrer data in parallel.

Use [our free audit tool](/free-audit) to assess your current metadata accuracy and identify fields where human review might be missing. Then check your analytics setup to ensure you can measure Gemini traffic separately as the UTM rollout continues.
