---
featuredImage: /blog/ai-models-pick-different-products-shopify-catalog/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the article 'Three AI Models, One Catalog, Three Different Winners'"
slug: ai-models-pick-different-products-shopify-catalog
title: Three AI Models, One Catalog, Three Different Winners
seoTitle: Why AI models pick different products from the same list
metaDescription: Test shows Claude models consistently pick different products from Shopify's catalog. What that means for your store's visibility to AI agents.
excerpt: A controlled test of three Claude models given identical product lists from Shopify's catalog revealed each model favored a different product. The implications for e-commerce visibility are significant.
category: AI Visibility
tags: [AI agents, Shopify, e-commerce, product ranking, model behavior]
searchIntent: informational
primaryKeyword: AI model product selection
secondaryKeywords: [Shopify catalog, AI shopping agents, model preferences, e-commerce visibility]
publishedAt: 2026-11-03
tldr:
  - Three Claude models given the same 20 products and the same instruction picked different winners on every search
  - Model choice matters more than catalog ranking: Haiku picked Shopify's top-ranked product only 8% of the time
  - Commission structures now incentivize agents to pick specific products and route buyers to Shop instead of merchant sites
  - Stores need visibility strategies that work across multiple AI models, not just one
  - Disclosure of AI agent commissions remains legally unclear
relatedTool: free-audit
relatedSlugs: [why-ai-recommends-your-competitors, structure-content-for-ai-answers]
status: draft
featured: false
---

## Which AI model a shopper uses determines which product they buy

When [three Claude models received identical product lists from Shopify's catalog](https://www.searchenginejournal.com/3-ai-models-shopped-shopifys-catalog-each-picked-a-different-winner/594298/), each consistently picked a different product across multiple product categories. Claude Haiku 4.5 and Sonnet 5 favored the product with the most reviews. Claude Opus 5 picked the medium roast coffee 48 times out of 50, reasoning that it was "the safest crowd-pleaser" with no stated shopper preferences. On six product searches, the three models' most-picked product matched in zero categories. The model itself, not the catalog's ranking or the product's quality, determined the winner.

## Shopify's catalog ranking has less influence than you might think

Shopify's search results ranked products by review count and rating, but AI models ignored that order far more than expected. Across the six test searches, Haiku picked Shopify's first-ranked product only 8% of the time, Sonnet never picked it, and Opus picked it 20% of the time. Each model applied its own logic to the same list. Haiku and Sonnet explicitly stated their reasoning: they chose products with the highest review counts. Opus prioritized different attributes entirely—perceived safety and balance rather than popularity signals. The catalog's work of surfacing products was undone by the model's work of selecting one.

The test used real Shopify products fetched through Shop MCP, Shopify's Model Context Protocol connection announced in October 2026, which lets any company building a shopping agent search Shopify's catalog of over a billion products without an API key. Each model saw product title, store name, price, star rating, review count, and the catalog's one-line summary. No agent company's custom instructions were applied. No shopping history or budget constraints existed. The models ran at default settings with no tools or web access. This was the raw model behavior underneath everything else.

## Different models mean different stores get the order

On three of six searches, the model's preferred product came from a different store than the competitors' preferred products. For water bottles, Haiku and Sonnet picked nobl's bottle; Opus always picked Owala's. For yoga mats, Haiku chose POPFLEX while Sonnet and Opus both chose Liforme. For running shoes, Haiku and Opus picked a Brooks shoe from Fit2Run; Sonnet picked an adidas shoe from Commonwealth Running Co. A shopper's AI agent's model choice directly routed their purchase to one merchant instead of another, even when all products were identical in category, price range, and availability.

Our recommendation: test your products across multiple AI models to understand which ones surface your inventory and which favor competitors. Use [/free-audit](/free-audit) to identify how your brand and products appear to AI agents today.

## Commission structures now give agents a reason to pick specific products

As of October 27, 2026, [Shopify introduced a commission system for AI agents](https://www.searchenginejournal.com/shopify-now-lets-stores-pay-the-company-behind-your-ai-shopping-agent/594544/). When a shopper buys a promoted product through an agent, Shopify pays the agent's developer 0.3% of the order. Stores can increase that commission by running Shop Campaigns and enabling external platforms; Shopify's documentation shows an example of 1.5% total. The agent's developer earns more money when the shopper buys a promoted product and completes the purchase through Shop instead of the merchant's website.

This creates a conflict of interest. The agent now has financial incentive to pick the product that pays its developer more, not necessarily the best product for the shopper. Shopify's documentation does not state whether a larger commission also moves a product higher in the search results returned to the agent. The disclosure requirements remain unclear. Shopify asks developers to label promoted products and disclose commissions "before buyers act on a promoted result," citing FTC endorsement guides and EU and UK advertising rules. But those rules were written for ads and recommendations, not for AI agents making purchasing decisions. No court ruling has clarified whether commission-based selection by an agent constitutes a recommendation requiring disclosure under current law.

In the earlier test, when Claude models saw a water bottle listed with 447,221 reviews on Shopify's catalog (but only 6,537 on the store's own website), they picked it 84 times out of 100. The discrepancy suggests the catalog's data can be optimized separately from the store's records. A hypothesis: if developers begin favoring high-commission products, the same review-count optimization could shift toward whichever product pays more.

## Your product strategy needs to work across multiple AI models

Since no two models agreed on a single winner across any product category, your visibility cannot rest on optimization for one model or one agent. Here is what we recommend:

- Audit how your products appear on Shopify's catalog and in other agent-accessible product feeds
- Review your product titles, descriptions, and feature lists for clarity when models see them without context
- Monitor which products models pick most often, and identify patterns in their reasoning
- Track whether your merchants' products are being listed with outdated or inflated review counts
- Understand which stores the dominant AI agents route customers to, and whether you appear in those routes
- Test your product visibility across multiple AI agents and models, not just one

The test ran 1,980 model picks in total and found that each model was internally consistent with itself but never with the others. Sonnet's most-picked product took 94% of its picks on average. Opus's took 89%. Haiku's took 67%. Change the model, and a completely different product dominated the selections. A shopper using Claude Opus will almost certainly get a different recommendation than one using Claude Haiku, even if both are shopping from identical catalogs.

## Legal disclosure requirements remain a hypothesis

Shopify calls promoted placements a Developer Preview and has not named which developers have joined the program. The program is only available by invitation. Shopify's documentation states that details "are not final and might change." We cannot yet verify how many agents have adopted commission-based product selection, or what disclosure language they are using. A hypothesis: as commission structures become standard across agent platforms, regulators may clarify whether financial incentives in AI-driven product selection require the same disclosure as paid search ads.

The FTC's endorsement guides require disclosure when a paid relationship exists that people wouldn't expect. The EU's Directive 2019/2161 bans search results that hide "payment specifically for achieving higher ranking." An AI agent selecting a product based on commission is neither clearly a recommendation nor clearly a search result in the regulatory sense. Until a ruling clarifies this, developers have room to interpret disclosure requirements loosely. Our recommendation: document what your AI agents disclose about commissions and where they route customers. Track whether that disclosure influences which products models actually pick.

## What still matters for AI visibility

The test revealed that review count and rating still drive model selection on some searches. Haiku and Sonnet's stated reasons centered on review volume. That means [structuring your product data clearly](/blog/structure-content-for-ai-answers) remains important—models need to parse title, rating, and count easily. It also means [understanding why AI recommends your competitors](/blog/why-ai-recommends-your-competitors) now includes understanding which model the agent runs on and what financial incentives it faces.

The pathway from shopper request to purchase now has three layers: the catalog's ranking (Shopify's), the agent developer's instructions (private and hidden), and the model's own preferences (revealed here for the first time at scale). Shopify controls the first. The developer controls the second. The model controls the third, and that third layer proved decisive.
