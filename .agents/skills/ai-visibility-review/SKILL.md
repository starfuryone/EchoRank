---
name: ai-visibility-review
description: "Report whether AI assistants are recommending this business — mention rate, per-engine coverage, recent alerts and the stored visibility audit — and what to fix first."
---

# Echorank AI visibility review

## Goal

Answer one question honestly: **when someone asks ChatGPT, Claude, Gemini or
Perplexity about this kind of business, does this business come up?**

Then say what to do about it. This is what Echorank exists for, and it is a
different question from "does this site rank on Google" — a site can rank
first and still never be named in an AI answer.

Use this for "are AI assistants recommending us", "how visible are we in AI
search", or "why did we stop being mentioned". For the technical health of the
site itself, use `seo-audit`.

## Tools

All read-only. This skill spends nothing.

- `get_visibility_summary` — the core of the review: the latest audit score,
  the 30-day AI mention rate, per-engine coverage (how often each assistant
  mentioned the brand, out of how many runs), and recent visibility alerts.
- `get_latest_audit` — the stored AI-visibility audit for a URL: score out of
  100, a grade, and per-check results. This is the technical side — whether an
  assistant can read and trust the site at all.
- `get_gsc_queries` — free, and useful as a reality check. If the site gets no
  search traffic for a topic, its absence from AI answers about that topic is
  less mysterious.

Start with `whoami` to confirm the connection and read the remaining allowance,
and `get_research_log` to see what has already been looked at. An entry under 30
days old is data this workspace has already paid for — reopen it rather than
recommending the same analysis again.

## Reading the numbers carefully

This is the part most reviews get wrong.

- **Mention rate is over a window and a set of prompts.** "42% over 30 days"
  means the brand appeared in 42% of the tracked prompt runs in that window —
  not that 42% of all people asking get told about it. Say the window and the
  run count every time you quote it.
- **A per-engine rate over few runs is noise.** Two mentions out of three runs
  is not "67% on Gemini"; it is three data points. Check the run count before
  drawing a line through anything.
- **Zero runs is not zero visibility.** If no prompts are tracked, the summary
  has nothing to report and the finding is "nothing is being measured", which
  is a different problem with a different fix.
- **An alert is an event, not a trend.** Read what it says; do not extrapolate
  one drop into a decline.

## What actually moves AI visibility

When you recommend, prefer causes over symptoms, in roughly this order:

1. **Can the assistant read the site at all** — crawlability, robots.txt, and
   whether the answer is in the HTML rather than rendered by script. The stored
   audit's failed checks tell you this.
2. **Is the answer on the page in plain terms** — assistants quote pages that
   state things directly. A page that never says what the product costs will
   not be the source for a question about price.
3. **Does anyone else say it** — assistants lean on third-party sources.
   Reviews, directories and mentions elsewhere matter more here than they do
   for classic ranking.
4. **Structured data** — helps, and is the easiest of the four, which is why it
   is fourth and not first. Do not lead with schema markup.

## Output

1. **The answer** — one sentence. "You are mentioned in about a third of
   tracked prompts, mostly by Perplexity, and not at all by ChatGPT."
2. **By engine** — the table, with run counts, not just percentages.
3. **What changed** — recent alerts, with dates, and what each one actually
   says. No causal claims unless a tool made one.
4. **The technical picture** — the audit score and the checks that failed,
   translated out of jargon.
5. **First fix** — one thing, with why it is first here.

Never claim a change caused a movement unless a tool said so. Two things
moving in the same week is a sentence you may write; one causing the other is
not.
