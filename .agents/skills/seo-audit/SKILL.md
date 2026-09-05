---
name: seo-audit
description: "Turn a workspace's stored site crawl, AI-visibility audit and Search Console data into a one-page report a non-expert can act on, built around a single action for this week."
---

# Echorank SEO audit

## Goal

Produce a one-page report someone with no SEO background can read once and act
on. The whole report exists to support **one** action they can take this week.
Everything else is the evidence for it.

Use this when the ask is "audit my site", "review my SEO", or "what is wrong
with my website". For "what should I work on in general", use `seo-coach`.

## Before you read anything

1. `whoami` — confirms the connection and shows what allowance is left. Nothing
   in this skill has to spend, but knowing the ceiling changes what you
   recommend at the end.
2. `get_research_log` — what has already been paid for. If a crawl or a domain
   overview ran in the last 30 days, that is your evidence; do not tell the user
   to run it again.

If `whoami` fails, Echorank is not connected. Stop and say so rather than
guessing at the site from the outside.

## Tools, and what each is for

Every tool below is read-only. This skill spends nothing.

- `get_crawl_summary` — the newest completed site crawl: pages crawled, total
  issues, and the most common issues by type and severity. **This is the spine
  of the report.** If it returns nothing, the workspace has never crawled the
  site, and the report's one action is "run a site crawl on the Site Crawler
  page" — say that and stop rather than inventing findings.
- `get_latest_audit` — the stored AI-visibility audit: score, grade, per-check
  results. Use it for the "can AI assistants read this site" half.
- `get_gsc_queries` — real clicks and impressions from Google, free. The
  strongest evidence in the report, because it is measured rather than
  estimated. An empty result on a connected property is normal for a
  low-traffic site (Google withholds queries searched by too few people) and
  must not be reported as a broken sync.
- `get_domain_overview` — stored Site Explorer analysis: organic keywords,
  estimated traffic, competitors. Context, not the headline. Skip it entirely
  if nothing is stored; do not send someone to buy one for a report.
- `get_backlinks_overview` — stored backlinks analysis. Same rule: use it if it
  exists, skip it if it does not.

## Workflow

1. Read `get_crawl_summary`. Group the issues by what a person would actually
   do about them, not by the crawler's category. Three broken links and forty
   missing meta descriptions are one afternoon and one afternoon; a site that
   blocks crawlers in robots.txt is everything.
2. Read `get_latest_audit`. Note failed checks that AI assistants care about
   specifically — structured data, crawlability, clear answers on the page.
3. Read `get_gsc_queries` over 28 days. Look for the gap: queries with high
   impressions and low clicks are pages that rank but do not get chosen, which
   is usually a title-and-description problem and is usually the cheapest win
   on the site.
4. Pull the domain overview and backlinks picture in only if they are already
   stored.
5. Decide **the one thing**. It has to be something the site owner can start
   this week without hiring anyone. Rank the candidates by (how much it moves
   the needle) ÷ (how hard it is), and pick one. Not three.

## Output

A single page, in this order:

1. **The one thing** — what to do, why it matters here specifically, and how
   long it takes. Two or three sentences. No jargon.
2. **What we looked at** — the crawl date, the audit date, the Search Console
   window. Dates matter: a reader has to know whether this describes their site
   today or three months ago.
3. **What is working** — two or three genuine positives, with numbers.
4. **What is holding you back** — the top three issues, each with the number of
   pages affected and one sentence on the consequence in plain language.
   "Forty-two pages have no meta description" means "Google is writing your
   search result snippets for you".
5. **Not urgent, but worth knowing** — everything else, in a short list.

Rules for the writing: quote real numbers and the window they cover; never
state a fact no tool returned; if you did not check something, say you did not
check it. Do not predict traffic or ranking outcomes.

## Ending

If the report's evidence was thin — no crawl, no audit, no Search Console —
close by naming the ONE page in the app that would fix that, and what it costs.
Do not list all of them.
