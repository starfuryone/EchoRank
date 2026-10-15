---
featuredImage: /blog/google-pdf-ranking-html-conversion/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Google Converts PDFs to HTML Before Ranking Them'"
slug: google-pdf-ranking-html-conversion
title: Google Converts PDFs to HTML Before Ranking Them
seoTitle: How Google ranks PDFs: HTML conversion explained
metaDescription: Google's Martin Splitt explains how PDFs are converted to HTML for indexing and ranking in search and AI Mode. What publishers need to know.
excerpt: Google converts PDFs into HTML before indexing and ranking them, treating links and text the same as web pages. Images in PDFs may not be processed for image search.
category: AI Visibility
tags: [PDF, indexing, ranking, HTML, Google Search]
searchIntent: informational
primaryKeyword: PDF ranking Google
secondaryKeywords: [PDF indexing, HTML conversion, Google Search, PDF SEO]
publishedAt: 2026-10-15
tldr:
  - Google uses a converter component to transform PDFs into HTML during indexing, then processes the HTML version like a regular web page.
  - Links embedded in PDFs work because Google indexes the HTML conversion, which preserves link structure and allows normal link following.
  - Images inside PDFs may not be indexed or processed for image search since they lack standalone URLs within the PDF structure.
  - PDFs can rank in both regular search and AI Mode with the same ranking rules as HTML, though plain HTML is pragmatically easier for search engines.
  - Size limits for PDFs are likely larger than regular HTML pages, similar to video limits, but Google has not disclosed the exact thresholds.
relatedTool: free-tools
relatedSlugs: [structure-content-for-ai-answers, schema-markup-for-ai-answers]
status: draft
featured: false
---

## Google converts PDFs to HTML during indexing, then ranks the HTML version

Google does not index or rank the actual PDF file. Instead, [Google's Martin Splitt explained](https://www.searchenginejournal.com/google-explains-how-they-rank-pdfs-and-what-it-means-for-seo-geo/592902/) that Google has a converter component in its indexing pipeline that transforms PDFs into HTML. Google then indexes and ranks the HTML representation, not the original format. This happens after rendering and before content enters the index. The converter supports PDFs alongside rich text files, Word documents, Excel sheets, and other formats. Once converted to HTML, Google's standard ranking pipeline processes the content identically to native web pages.

## Links in PDFs function as normal links because the HTML version preserves them

Splitt confirmed that links embedded inside PDFs work for ranking and crawling purposes because Google's indexing system preserves the link structure during HTML conversion. Once the PDF becomes HTML, Google's systems recognize and follow links the same way they would on any web page. The conversion maintains the link relationships from the original PDF, making embedded links valuable for internal linking strategies and link equity distribution. This means a PDF with internal or external links passes link signals just as an HTML page would.

## Images inside PDFs likely are not indexed for image search

Splitt expressed uncertainty about how Google handles images embedded in PDFs. He stated a hypothesis that Google recognizes images exist within PDFs but cannot process them for image search the way it processes standalone image files. The core limitation is that images embedded in PDFs lack individual URLs. Google's image search pipeline normally assigns URLs to images and processes them through a separate image ranking system. Inside a PDF, there is no URL to pass to that system. Splitt noted this understanding could change in the future as Google's capabilities evolve.

## PDFs can rank in AI Mode using the same ranking rules as regular search

[According to Splitt](https://www.searchenginejournal.com/google-explains-how-they-rank-pdfs-and-what-it-means-for-seo-geo/592902/), PDFs can appear in AI Overviews and AI Mode because they rank through the same indexing and ranking process as HTML pages. A PDF must meet the same content quality and relevance standards that any web page must meet. The HTML conversion preserves text content in a way that allows AI systems to read, understand, and cite from it. However, Splitt noted that not all PDFs can rank in text results. PDFs that function as images (scanned documents with no selectable text) cannot be converted to HTML and therefore cannot rank as text content.

A practical test exists: if you can highlight and copy text from a PDF to a text editor, Google can convert it to HTML and rank it.

## HTML remains pragmatically easier for search engines to rank

John Mueller noted that regular HTML pages are likely better for ranking purposes than PDFs, though this does not mean PDFs cannot rank. The advantage is pragmatic: HTML is a more flexible format that search engines have more practice processing. Mueller suggested thinking about PDF use cases practically. If your content needs specific print formatting, interactive forms, or a particular visual appearance, a PDF may be justified. Examples include holiday lodge registration forms, restaurant menus, or any document designed for printing. If the choice is between publishing content as a PDF or not publishing it at all, the PDF is preferable. But if HTML is feasible, it removes unnecessary friction from the indexing process.

## Size limits for PDFs are larger than regular HTML but remain undisclosed

Splitt indicated that Google likely applies larger file limits to PDFs than to standard HTML pages, similar to how video files have higher size allowances. However, he did not know the specific limit for PDFs. He suggested that once a PDF is converted to HTML, the HTML size limits documented by Google may apply to the converted representation. The exact point where size limits are enforced—during PDF fetching or during HTML processing—remains unclear. Splitt also noted that whatever limits exist today could change if Google detects widespread publishing of larger PDFs.

## Checklist: preparing PDFs for ranking

- Ensure all text in the PDF is selectable and copyable (not scanned images)
- Include meaningful links in the PDF that you want to pass link equity or help with internal linking
- Consider whether HTML would serve the same purpose with less friction for search engines
- Verify that interactive elements (forms, buttons) function as intended after conversion
- Use standard PDF formatting rather than complex graphics-heavy layouts that may not convert cleanly to HTML
- Remember that embedded images will likely not be indexed for image search
- Test that your PDF displays correctly in a standard PDF viewer before publishing

## What remains unknown about PDF ranking

We cannot yet verify whether Google applies any ranking adjustments between PDFs and HTML pages after conversion. [Google's Splitt and Mueller](https://www.searchenginejournal.com/google-explains-how-they-rank-pdfs-and-what-it-means-for-seo-geo/592902/) acknowledged they don't know all the details of PDF processing, particularly around size limits and image handling. It is also stated as a hypothesis that the current uncertainty around image indexing inside PDFs may change over time as Google refines its converter. The exact file size thresholds remain undisclosed, making it impossible to know when a PDF might exceed limits during fetching or after HTML conversion.

Our recommendation is to treat PDFs as a secondary format option rather than a first choice for ranking. Use them when content genuinely requires them—for forms, print-ready layouts, or specific formatting needs. For standard text content, use HTML. If you publish PDFs with valuable content, audit them with [our free SERP audit tool](/free-audit) to verify Google is indexing them and check whether they're appearing in search results and AI citations alongside your HTML pages. Monitor your Search Console for any "Crawled, Not Currently Indexed" notices, which might signal that your PDF was not converted successfully.

For more on making content visible to both traditional search and AI systems, see our guides on [structuring content for AI answers](/blog/structure-content-for-ai-answers) and [schema markup for AI answers](/blog/schema-markup-for-ai-answers).
