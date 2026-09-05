---
name: rank-tracking-setup
description: "Choose which keywords a workspace should track and add them to an existing rank-tracking project, within the plan's tracked-keyword limit."
---

# Echorank rank-tracking setup

## Goal

Decide what a workspace should be tracking, and set it up — without filling the
plan's allowance with keywords nobody will look at.

A tracked keyword is not free. It is checked on the project's schedule, and
each check costs money. Twenty-five keywords that answer a question beat a
hundred that produce a chart.

Use this when the ask is "track my rankings", "am I tracking the right things",
or "add these keywords". For finding candidates in the first place, run
`keyword-research` and come back.

## Before you touch anything

1. `whoami` — read `trackedKeywords: used of limit`. That headroom is the whole
   budget for this exercise. If it is nearly full, this becomes a conversation
   about what to REMOVE, not what to add.
2. `get_rank_tracker` (no arguments) — the existing projects: domain, market,
   device, frequency, keyword count, average position, when it last ran. You
   are almost always adding to one of these, not designing from scratch.
3. `get_gsc_queries` — free, and the best source of candidates that exist. A
   keyword the site already gets impressions for is worth tracking; a keyword
   invented from nothing usually is not.
4. `get_research_log` — what this workspace has already paid to research. A
   SERP check or a Keyword Opportunity Finder run from the last 30 days is
   evidence about which keywords are worth a tracking slot, and it is already
   bought. Reuse it rather than checking the same keyword again.

Adding a tracked keyword is not a one-off purchase — it commits the workspace
to checking that keyword on every future run. That is why the allowance is read
before the list is drafted and not after.

## What you can do

- `add_rank_tracking_keywords` — adds keywords to an existing project. Refused
  if the workspace's tracked-keyword limit would be exceeded. Keywords already
  in the project are ignored rather than duplicated, so re-running is safe.
- `remove_rank_tracking_keywords` — stops tracking. **The keyword's recorded
  position history is deleted with it and cannot be recovered.** Confirm with
  the person before removing anything they did not name themselves.

You cannot create a project or change its market, device or frequency — those
live on the Rank Tracker page. If no project exists, say so and send them there
rather than trying to work around it.

## Choosing what to track

Aim for a set that answers a question. A good twenty-five looks like:

- **Money terms** (5–8) — what someone types when they are ready to buy. These
  are the ones a business actually cares about.
- **Category terms** (5–8) — the broad description of what the business does.
  Slow to move; the long-term score.
- **Close calls** (5–8) — from Search Console, currently position 11–20. These
  move first and are where progress becomes visible.
- **Brand** (2–3) — the business's own name. Not exciting, but a drop here is
  an emergency, and you will not see it if it is not tracked.

Deliberately leave out: keywords with no plausible path to page one, seasonal
one-offs, and anything the site does not have a page for. Tracking a keyword
with nothing to rank produces a flat line of nulls.

A null position means "not in the top 100" — a real result, not missing data.
Expect several of them at the start and say so, or the first report will look
broken.

## Workflow

1. Read the three tools above.
2. Propose the set, grouped as above, with a one-line reason each, and the
   arithmetic: current count + proposed = new total, against the limit.
3. Get agreement. Do not add keywords the person has not seen.
4. `add_rank_tracking_keywords` once, with the whole list, on the right
   `projectId`.
5. Read the result back: `changed` is what actually went in, `ignored` is what
   was already there. Report both — "eight added, two already tracked" is the
   honest sentence.

## Output

- The keywords added, grouped by why.
- Anything ignored as already tracked.
- The new tracked-keyword total against the plan limit.
- When the first results appear — the project's own frequency (daily or weekly)
  decides this, and it is on the project row from `get_rank_tracker`.
- Anything you recommended NOT tracking, and why. That list is often the more
  useful half.
