---
name: backlinks-review
description: "Read a stored backlinks analysis — referring domains, anchors, most-linked pages — and say what the link profile means and what to do next, without buying a new lookup."
---

# Echorank backlinks review

## Goal

Explain what a site's link profile actually says, and what to do about it.

A backlinks analysis is the most expensive lookup in Echorank — roughly $0.37
a time, several provider calls in one action. This skill is built around that
fact: **it reads what has already been bought and never buys more.**

Use this for "how are my backlinks", "is my link profile healthy", "who links
to my competitor". For where a domain ranks and what for, use
`get_domain_overview` or the `seo-audit` skill.

## Before anything

1. `whoami` — shows the pooled allowance and this month's provider spend
   against the workspace cap. Relevant here because a backlinks analysis is a
   meaningful fraction of a month's budget, so "should we run another" is a
   real question with a real answer.
2. `get_research_log`, filtered to `feature: "backlinks"` — every backlinks
   analysis this workspace has paid for, with its age. **An entry under 30 days
   old is your data.** A link profile does not move enough in a month to be
   worth re-buying, and telling someone to spend $0.37 to re-learn what they
   learned three weeks ago is the failure this skill exists to prevent.

## Tools

- `get_backlinks_overview` — the newest stored analysis for a target, or for a
  specific one if you pass `target`. Read-only, spends nothing. Returns the
  headline summary (total backlinks, referring domains, domain rank, broken
  links, dofollow split), the strongest referring domains, the top anchors, and
  the most-linked pages.
- `get_domain_overview` — stored Site Explorer analysis. Useful context: a link
  profile is only meaningful next to the traffic it produces.

If `get_backlinks_overview` returns nothing, the workspace has never run one.
Say that, say what it costs, and name the Backlinks page. Do not fabricate a
picture from the domain overview.

## Reading a link profile

- **Referring domains matter far more than total backlinks.** Ten thousand
  links from forty domains is forty votes, not ten thousand. Lead with the
  domain count; mention the link count second.
- **Domain rank is a 0–1000 scale and it is relative.** Quote it next to
  something — a competitor's, or the site's own from an earlier analysis — or
  it means nothing to the reader.
- **Anchor text tells you what the web thinks the site is about.** A profile
  where every anchor is the brand name is a site nobody links to for a topic.
  A profile stuffed with one commercial phrase is a profile someone bought.
- **The dofollow split** is worth a sentence, not a paragraph. A natural
  profile has both.
- **Broken backlinks are free money** — links pointing at pages that no longer
  exist. A redirect recovers them in an afternoon. This is frequently the best
  single recommendation in the whole review.
- **Most-linked pages** show what the site is actually known for. If it is not
  what the business sells, that is the finding.

Note the analysis date and its age in everything you say. "As of the analysis
from 12 days ago" is the honest framing.

## Sections that did not load

An analysis can be `partial` — one provider endpoint failed while the others
succeeded, and the result carries `failedSections`. Say which sections are
missing rather than reasoning around the hole silently. History and
most-linked-pages are also absent by design on an exact-URL analysis, because
neither has a meaning for a single page; that is not a failure.

## Output

1. **The verdict** — one sentence. "Forty-one referring domains, most of them
   directories, and nobody links to you for what you sell."
2. **The numbers** — referring domains, backlinks, domain rank, broken links,
   with the analysis date.
3. **Who links to you** — the strongest referring domains, and what kind of
   sites they are.
4. **What the web thinks you do** — the anchor picture, in one paragraph.
5. **Next action** — one thing. Broken-link recovery if there are any; a
   specific kind of site to get links from if there are not.
6. **What is not covered** — failed or skipped sections, and the age of the
   data.

Do not recommend buying links. Do not promise a ranking outcome from a link.
