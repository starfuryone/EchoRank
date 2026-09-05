// The agent skills, as the in-app Pro assistant receives them.
//
// The risk this suite is about: the skills were written for the EXTERNAL MCP
// server, and handing them to the in-app assistant unchanged would produce an
// assistant that confidently calls tools it does not have and quotes
// allowances it cannot read. The surface note is what stops that, so the note
// is what gets asserted — not merely that it exists, but that it names every
// specific falsehood the documents carry onto this surface.
//
// It also guards the property that makes the whole thing affordable: the Pro
// prompt's own block must stay byte-identical across turns for the prompt
// cache, and appending skills must not disturb it.

import { describe, expect, it } from "vitest";
import { skillSystemBlocks, surfaceNote, skillIndexForPrompt } from "@/lib/agent-skills/assistant";
import { agentSkills } from "@/lib/agent-skills/loader";
import { proSystemBlocks } from "@/lib/assistant/pro/prompt";
import { RESEARCH_REUSE_WINDOW_DAYS } from "@/lib/research-log/types";

const LOCALES = ["en", "fr", "de-CH"] as const;
const skills = agentSkills();

/** Every tool the Pro assistant actually has. Kept literal on purpose: the
 *  real table is 1100 lines of zod and instrumentation, and this suite is
 *  asserting a correspondence a human wrote, not deriving one. */
const PRO_TOOLS = [
  "getProjectSummary",
  "getVisibilitySummary",
  "runDomainAudit",
  "getTrackedPrompts",
  "getCompetitorSnapshots",
  "getGscQueryStats",
  "getCrawlSummary",
  "getRankTracking",
  "getAiLensResults",
  "getCitations",
  "getBrandMentions",
  "getWeeklyIntelligence",
];

describe("skill blocks", () => {
  it("returns one block carrying the note and every skill body", () => {
    const blocks = skillSystemBlocks("en");
    expect(blocks).toHaveLength(1);
    const text = blocks[0].text;
    expect(text).toContain("# Workflow guidance");
    for (const skill of skills) {
      expect(text).toContain(`<skill name="${skill.name}">`);
      // The body goes in whole. A truncated skill is a workflow that stops
      // halfway, which is worse than not shipping it.
      expect(text).toContain(skill.body.trim());
    }
  });

  it("carries its own cache breakpoint", () => {
    // ~6k tokens of workflow guidance is affordable only because it is cached.
    // Without this it would be re-billed as input on every single turn.
    expect(skillSystemBlocks("en")[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("is byte-identical across turns and across locales", () => {
    // The prompt cache keys on an exact prefix. Anything varying per turn here
    // — a date, a count, a tenant name — would silently disable caching for the
    // whole prefix behind it.
    const a = skillSystemBlocks("en")[0].text;
    const b = skillSystemBlocks("en")[0].text;
    expect(a).toBe(b);
    for (const locale of LOCALES) {
      expect(skillSystemBlocks(locale)[0].text).toBe(a);
    }
  });

  it("leaves the Pro prompt's own block untouched", () => {
    // proSystemBlocks is documented as byte-identical per locale so its own
    // cache_control breakpoint does real work. Appending must not edit it.
    for (const locale of LOCALES) {
      const before = proSystemBlocks(locale, "Acme Co");
      const combined = [...proSystemBlocks(locale, "Acme Co"), ...skillSystemBlocks(locale)];
      expect(combined[0]).toEqual(before[0]);
      expect(combined).toHaveLength(before.length + 1);
    }
  });
});

describe("the surface note corrects what the skills assume", () => {
  const note = surfaceNote();

  it("cancels the whoami step rather than leaving it to be attempted", () => {
    // Every skill opens by telling the agent to call whoami. The assistant has
    // no such tool, so the note has to say so explicitly — an omission would
    // read as an oversight.
    expect(note).toContain("whoami");
    expect(note).toMatch(/already .*(connected|authenticated)/i);
    expect(note).toMatch(/skip that step/i);
  });

  it("maps every MCP name that has an in-app equivalent, to a tool that exists", () => {
    const arrows = [...note.matchAll(/^\s{2}([a-z_]+) -> (\w+)$/gm)];
    expect(arrows.length).toBeGreaterThan(0);
    for (const [, mcpName, proName] of arrows) {
      expect(PRO_TOOLS, `${mcpName} maps to ${proName}, which is not a Pro tool`).toContain(
        proName,
      );
    }
  });

  it("names the MCP tools that have NO equivalent, so the model does not try them", () => {
    for (const absent of [
      "get_backlinks_overview",
      "get_domain_overview",
      "list_keyword_opportunities",
      "start_serp_check",
      "get_research_log",
    ]) {
      expect(note).toContain(absent);
    }
    expect(note).toMatch(/DO NOT have/);
  });

  it("states there is no filesystem and no shell", () => {
    expect(note).toMatch(/no filesystem/i);
    expect(note).toMatch(/shell|command/i);
  });

  it("forecloses spend authority in the strongest terms", () => {
    // The one property that must not erode: skills are guidance, and guidance
    // cannot grant capability.
    expect(note).toMatch(/cannot spend/i);
    expect(note).toMatch(/Every tool you have READS/);
    // And it must route the customer somewhere real instead.
    expect(note).toContain("Backlinks tool");
    expect(note).toContain("Site Explorer");
    expect(note).toContain("Keyword Opportunities");
    expect(note).toContain("Site Crawler");
  });

  it("carries the reuse window from the code, not a hardcoded number", () => {
    expect(note).toContain(`${RESEARCH_REUSE_WINDOW_DAYS} days old`);
  });

  it("is branded correctly", () => {
    expect(note).not.toMatch(/EchoRank|echoRank|Echo Rank/);
    expect(note).not.toMatch(/OpenSEO/i);
    expect(note).toContain("Echorank");
  });
});

describe("the index helper", () => {
  it("lists every skill as name plus description, and no bodies", () => {
    const index = skillIndexForPrompt();
    for (const skill of skills) {
      expect(index).toContain(`- ${skill.name}: ${skill.description}`);
    }
    expect(index.length).toBeLessThan(2000);
  });
});
