---
name: keyword-research
description: "Find what a site should target next, starting from what it already ranks for and what a stored Keyword Opportunity Finder run already scored, before suggesting anything new."
---

# Echorank keyword research

## Goal

Produce a short, defensible list of keywords worth working on next, with a
reason attached to each. Not a spreadsheet of two hundred ideas — a list
someone could act on in a month.

Use this for "what keywords should I target", "what should I write about
next", or "am I missing anything obvious". For checking where a specific
keyword ranks today, use `get_serp_check` directly or `rank-tracking-setup`.

## Order of operations, and it matters

Work outward from what is already known and free, and only then reach for
something new. Each step narrows the next.

1. `whoami` — the pooled monthly SEO search allowance is what bounds this. Read
   it first so you know whether you can afford to check anything.
2. `get_research_log` — a Keyword Opportunity Finder run in the last 30 days is
   the answer to most of this question. Reopen it rather than starting another.
3. `get_gsc_queries` (28 days, free) — **what the site already ranks for.** This
   is the most undervalued input in keyword research and the only one that is
   measured rather than estimated. Look for two patterns:
   - high impressions, low clicks → the page ranks but is not chosen. A title
     and description rewrite, not a new page.
   - position 11–20 → the page is one improvement away from page one. Cheaper
     than anything net-new.
4. `list_keyword_opportunities` — the newest stored Keyword Opportunity Finder
   run: scored keywords with volume, difficulty, intent, trend, and whether AI
   assistants were tested on them. If it is recent, this is your candidate set.
5. `suggest_keywords` — only when the steps above leave a genuine gap. It reads
   a URL and returns seed keywords, question keywords and AI-visibility prompts.
   Free, and useful for a site with no history at all.

## Spending

This skill is read-only except for one optional step: `start_serp_check`, which
queues a live top-100 check for a single keyword (roughly $0.006, drawn from the
pooled allowance). Use it at most once or twice, to settle a specific question
like "who actually holds position one for this". Results are not immediate —
the provider's queue usually takes a few minutes; poll `get_serp_check` with
the id returned.

**Never loop.** If you want ten SERP checks, that is a decision for the person,
not for you. Say what you would check and why, and let them ask.

Starting a Keyword Opportunity Finder run is not available to you at all — it
spends a domain analysis and lives on the Keyword Opportunities page.

## Judging a keyword

- **Intent beats volume.** Someone searching "best X software" is closer to
  buying than someone searching "what is X", even at a tenth the volume.
- **Difficulty is relative to this site**, not absolute. Check the domain
  overview if one is stored; a site with forty referring domains should not be
  told to go after a term the incumbents have spent years on.
- **Trend matters more than the current number** on anything seasonal or new.
- A keyword the site already ranks 11–20 for beats a new one at the same
  volume, every time.

## Output

Between five and fifteen keywords, grouped by what the person would do about
them:

1. **Fix what you have** — pages that rank but underperform. Cheapest work.
2. **Push what is close** — position 11–20, one improvement from page one.
3. **Worth building** — genuinely new pages, with why this site can win them.

For each keyword give: the keyword, monthly volume, where the site stands
today (or "not ranking", which is a real answer and not missing data), the
intent, and one line on why it is on the list.

Close with what you did NOT check and what it would cost — honestly, once.
