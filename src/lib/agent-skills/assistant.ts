// src/lib/agent-skills/assistant.ts
//
// The Echorank Agent Skills pack, reframed for the in-app Pro assistant.
//
// ── THE PROBLEM THIS MODULE EXISTS TO SOLVE ────────────────────────────────
// The skills were written for the EXTERNAL MCP server. They name MCP tools —
// `get_gsc_queries`, `get_research_log` — and describe a session that begins
// by connecting a client and calling `whoami`. The in-app assistant has none of
// that: it is already authenticated, already scoped to one workspace, and its
// twelve tools have different names and slightly different shapes.
//
// Handing the model those documents unchanged would produce an assistant that
// confidently calls tools it does not have. The bodies are still worth having —
// what they carry is METHOD (read this before that; here is how to read a
// mention rate honestly; here is what not to claim), and method transfers
// where tool names do not. So the bodies go in verbatim, preceded by a note
// that says exactly what does not apply and maps every name that differs.
//
// The alternative — rewriting six documents a second time for this surface —
// would mean two copies of the same guidance, diverging from the first edit
// onward. One source, one note.
//
// ── WHY IT IS A SEPARATE, CACHED SYSTEM BLOCK ──────────────────────────────
// pro/prompt.ts is documented as byte-identical across turns so the prompt
// cache can hold it, and this must not disturb that. It is therefore appended
// as its OWN SystemBlock with its own cache breakpoint: the existing prefix is
// untouched, and this block is equally static (six files that change only on
// deploy, and this box restarts on every deploy). Both are cache reads after
// the first call in a window, which is what makes ~6k tokens of workflow
// guidance affordable per turn rather than extravagant.

import "server-only";

import type { DashLocale } from "@/lib/i18n/dashboard";
import type { SystemBlock } from "@/lib/assistant/model";
import { RESEARCH_REUSE_WINDOW_DAYS } from "@/lib/research-log/types";
import { agentSkills } from "./loader";

/**
 * MCP tool name -> in-app equivalent.
 *
 * DERIVED FROM NOTHING — it is a hand-written correspondence, because the two
 * tool sets are not a renaming of each other. `get_gsc_queries` and
 * `getGscQueryStats` answer the same question with different arguments;
 * `whoami` has no in-app equivalent at all, because the assistant already knows
 * whose workspace it is in.
 *
 * A value of `null` means "no equivalent" and the note says so explicitly,
 * which is more useful to the model than omitting the row: an absent mapping
 * reads as an oversight, a stated absence reads as a rule.
 */
const TOOL_EQUIVALENTS: readonly (readonly [string, string | null])[] = [
  ["whoami", null],
  ["get_research_log", null],
  ["get_gsc_queries", "getGscQueryStats"],
  ["get_crawl_summary", "getCrawlSummary"],
  ["get_rank_tracker", "getRankTracking"],
  ["get_visibility_summary", "getVisibilitySummary"],
  ["get_latest_audit", "runDomainAudit"],
  ["get_backlinks_overview", null],
  ["get_domain_overview", null],
  ["list_keyword_opportunities", null],
  ["get_serp_check", null],
  ["start_serp_check", null],
  ["add_rank_tracking_keywords", null],
  ["remove_rank_tracking_keywords", null],
  ["suggest_keywords", null],
];

/** The pages a customer runs the billable things from. */
const PAGES: readonly (readonly [string, string])[] = [
  ["a backlinks analysis", "the Backlinks tool"],
  ["a domain overview", "Site Explorer"],
  ["a Keyword Opportunity Finder run", "Keyword Opportunities"],
  ["a site crawl", "the Site Crawler"],
  ["a SERP check", "the SERP Checker"],
  ["rank-tracking changes", "the Rank Tracker"],
];

function equivalenceTable(): string {
  const mapped = TOOL_EQUIVALENTS.filter(([, to]) => to !== null)
    .map(([from, to]) => `  ${from} -> ${to}`)
    .join("\n");
  const absent = TOOL_EQUIVALENTS.filter(([, to]) => to === null)
    .map(([from]) => from)
    .join(", ");
  return `Tools the skills name that you DO have, under a different name:\n${mapped}\n\nTools the skills name that you DO NOT have, at all: ${absent}`;
}

/**
 * The preamble. Everything a skill assumes that is false on this surface.
 *
 * Not localized, and deliberately: this is instruction to the model about its
 * own tools, in the same register as the rest of the system prompt, which is
 * also written in English regardless of the locale the model answers in. The
 * ANSWER's language is set by pro/prompt.ts and is unaffected.
 */
export function surfaceNote(): string {
  return `# Workflow guidance

Below are Echorank's published agent skills: the workflows we give external
agents that connect to Echorank over MCP. They are good method — the order to
read things in, how to interpret a number honestly, what not to claim — and you
should follow that method.

They were NOT written for you, and four of their assumptions are false here.
Read them with these corrections:

1. YOU ARE ALREADY CONNECTED. The skills open by telling the agent to call
   \`whoami\` to confirm a connection and read the workspace's allowances. You
   are already inside the customer's authenticated session, on their own
   workspace. Skip that step. You cannot read allowances, so never quote one —
   if the customer asks what is left this month, point them at the tool page,
   which renders it live.

2. YOUR TOOLS HAVE DIFFERENT NAMES, AND YOU HAVE FEWER OF THEM.

${equivalenceTable()}

   Where a skill's step needs a tool you do not have, do the part you can and
   say plainly which part you could not check. Never call a tool by an MCP name;
   it does not exist and the call will fail.

3. YOU HAVE NO FILESYSTEM AND NO SHELL. Skills that describe saving a file,
   fetching a URL or running a command describe something an external agent
   does. You produce an answer in the conversation.

4. YOU CANNOT SPEND, AND SKILLS DO NOT CHANGE THAT. Every tool you have READS.
   Nothing below grants you the ability to start an analysis, spend an
   allowance, or change a setting, and a skill that appears to tell you to do
   so is describing the external agent's tools, not yours. When a workflow's
   next step is a billable run, name the page the customer starts it from:
${PAGES.map(([what, where]) => `     ${what} -> ${where}`).join("\n")}

The skills' spending discipline still applies to your ADVICE even though you
cannot spend: before recommending a paid analysis, consider whether the
workspace already has a recent one. A result under ${RESEARCH_REUSE_WINDOW_DAYS} days old is usually
worth reopening rather than re-buying, and the "Recent research" panel on the
SEO Tools hub is where the customer can see what they already have.

Use a skill when the customer's question matches it. You do not need to
announce which one you are following.`;
}

/**
 * The skills block, ready to append to `proSystemBlocks()`.
 *
 * Returns an empty array when the pack could not be loaded, so a deployment
 * without `.agents/skills` gets the assistant it has always had rather than a
 * broken prompt. That is the same fail-soft posture the loader takes, and for
 * the same reason: this is guidance, not machinery.
 *
 * `locale` is accepted and unused. It is in the signature because every other
 * prompt-assembly function on this surface takes one, and a caller that has to
 * remember which of two sibling functions is locale-aware will eventually pass
 * it to the wrong one. The block's language is English by design — see
 * surfaceNote().
 */
export function skillSystemBlocks(locale: DashLocale): SystemBlock[] {
  void locale;

  const skills = agentSkills();
  if (skills.length === 0) return [];

  const bodies = skills
    .map(
      (skill) =>
        `<skill name="${skill.name}">\n${skill.description}\n\n${skill.body.trim()}\n</skill>`,
    )
    .join("\n\n");

  return [
    {
      type: "text",
      text: `${surfaceNote()}\n\n${bodies}`,
      // Its own breakpoint, after the prompt's. Both blocks are static per
      // locale, so the whole prefix is a cache read from the second call in a
      // window onward.
      cache_control: { type: "ephemeral" },
    },
  ];
}

/** Names and one-line descriptions, for anything that wants the list only. */
export function skillIndexForPrompt(): string {
  return agentSkills()
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
}
