// The plan an in-tool locked message names (src/lib/locked-plan.ts).
//
// 1. Each lock's plan IS the upgrade-label helper's answer (upgradeTarget),
//    on every plan.
// 2. Each locked message names exactly that plan, in every locale, and types
//    no plan name of its own.
// 3. Each component renders the message with the helper's name for its lock.
// 4. Each lock is the check its route makes.
// 5. The upgrade screen: the crawler-only plan's crawl-limits line, and
//    "Cancel anytime".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanType } from "@/generated/prisma";
import { PlanUpgradeScreen } from "@/components/billing/PlanUpgradeScreen";
import { ACCOUNT_COPY } from "@/lib/i18n/account";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import {
  ACTION_AGENT_COPY,
  AI_CITATIONS_COPY,
  AI_LENS_COPY,
  ANSWER_TRACKING_COPY,
  BACKLINKS_TOOL_COPY,
  BENCHMARK_CARD_COPY,
  BOT_ANALYTICS_COPY,
  CONTENT_EXPLORER_COPY,
  FUNNELS_COPY,
  IMPORTS_COPY,
  MARKETING_COPY,
  MONITOR_CARD_COPY,
  OPPORTUNITY_SCANNER_COPY,
  RANK_TRACKER_COPY,
  REPUTATION_HELP_COPY,
  SEO_TOOLS_COPY,
  SEO_TOOLS_HUB_HELP_COPY,
  SETTINGS_COPY,
  SHARE_OF_VOICE_COPY,
  VISIBILITY_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import { LOCKS, LOCK_IDS, lockOpen, lockedPlan, lockedPlanName, type LockId } from "@/lib/locked-plan";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { planMeets, planName, upgradeTarget } from "@/lib/upgrade-target";
import { benchmarkDailyLimit } from "@/lib/visibility-limits";

const PLANS = Object.keys(PLAN_CONFIGS) as PlanType[];
const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
const NAMES = PLANS.map(planName);
const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

/**
 * Every locked message: its lock, the component that renders it, the key it
 * calls there, and how it renders for a plan name.
 */
interface Message {
  lock: LockId;
  file: string;
  key: string;
  render: (l: DashLocale, plan: string) => string;
}
const SOV = "src/components/seo-tools/share-of-voice-client.tsx";
const MESSAGES: Message[] = [
  { lock: "csv_import", file: "src/app/(dashboard)/imports/page-client.tsx", key: "gatedDescription", render: (l, p) => IMPORTS_COPY[l].gatedDescription(p) },
  { lock: "whitelabel", file: "src/app/(dashboard)/settings/page-client.tsx", key: "planRequired", render: (l, p) => SETTINGS_COPY[l].planRequired(p) },
  { lock: "whitelabel", file: "src/app/(dashboard)/settings/page-client.tsx", key: "whitelabelBody", render: (l, p) => SETTINGS_COPY[l].helpModal.whitelabelBody(p) },
  { lock: "visibility_monitor", file: "src/components/visibility/MonitorCard.tsx", key: "lockedDescription", render: (l, p) => MONITOR_CARD_COPY[l].lockedDescription(p) },
  { lock: "monitor_daily", file: "src/components/visibility/MonitorCard.tsx", key: "daily", render: (l, p) => MONITOR_CARD_COPY[l].daily(p) },
  { lock: "monitor_daily", file: "src/components/visibility/MonitorCard.tsx", key: "dailyRequiresPlan", render: (l, p) => MONITOR_CARD_COPY[l].dailyRequiresPlan(p) },
  { lock: "benchmark", file: "src/components/visibility/BenchmarkCard.tsx", key: "lockedDescription", render: (l, p) => BENCHMARK_CARD_COPY[l].lockedDescription(p) },
  { lock: "benchmark_more", file: "src/components/visibility/BenchmarkCard.tsx", key: "limitLink", render: (l, p) => BENCHMARK_CARD_COPY[l].limitLink(p, 5) },
  { lock: "answer_tracking", file: "src/components/visibility/AnswerTrackingCard.tsx", key: "lockedDescription", render: (l, p) => ANSWER_TRACKING_COPY[l].lockedDescription(p) },
  { lock: "roi_attribution", file: "src/app/(dashboard)/visibility/page-client.tsx", key: "lockedAttr", render: (l, p) => VISIBILITY_COPY[l].lockedAttr(p) },
  { lock: "remediation", file: "src/app/(dashboard)/visibility/page-client.tsx", key: "lockedFixesA", render: (l, p) => VISIBILITY_COPY[l].lockedFixesA + p + VISIBILITY_COPY[l].lockedFixesB },
  { lock: "seo_tools", file: "src/components/seo-tools/upgrade-state.tsx", key: "upgradeBody", render: (l, p) => SEO_TOOLS_COPY[l].upgradeBody(p) },
  { lock: "seo_tools", file: "src/components/seo-tools/tools-hub-help.tsx", key: "accessBody", render: (l, p) => SEO_TOOLS_HUB_HELP_COPY[l].accessBody(p) },
  { lock: "bot_logs", file: "src/components/seo-tools/bot-analytics-client.tsx", key: "upsellTitle", render: (l, p) => BOT_ANALYTICS_COPY[l].upsellTitle(p) },
  { lock: "content_explorer", file: "src/components/seo-tools/content-explorer-client.tsx", key: "planLockedTitle", render: (l, p) => CONTENT_EXPLORER_COPY[l].planLockedTitle(p) },
  { lock: "content_explorer", file: "src/components/seo-tools/content-explorer-client.tsx", key: "planLockedBody", render: (l, p) => CONTENT_EXPLORER_COPY[l].planLockedBody(p) },
  { lock: "ai_citations", file: "src/components/seo-tools/ai-citations-client.tsx", key: "errorPlanLocked", render: (l, p) => AI_CITATIONS_COPY[l].errorPlanLocked(p) },
  { lock: "rank_tracker", file: "src/components/seo-tools/rank-tracker-client.tsx", key: "lockedBody", render: (l, p) => RANK_TRACKER_COPY[l].lockedBody(p) },
  { lock: "rank_daily", file: "src/components/seo-tools/rank-tracker-client.tsx", key: "frequencyLockedNote", render: (l, p) => RANK_TRACKER_COPY[l].frequencyLockedNote(p) },
  { lock: "backlinks", file: "src/components/seo-tools/backlinks-client.tsx", key: "lockedBody", render: (l, p) => BACKLINKS_TOOL_COPY[l].lockedBody(p) },
  { lock: "backlinks_full", file: "src/components/seo-tools/backlinks-client.tsx", key: "upsellIntro", render: (l, p) => BACKLINKS_TOOL_COPY[l].upsellIntro(p) },
  { lock: "ai_lens_any_url", file: "src/components/seo-tools/ai-lens-client.tsx", key: "foreignBody", render: (l, p) => AI_LENS_COPY[l].foreignBody(p) },
  { lock: "marketing_studio", file: "src/components/seo-tools/marketing-studio-client.tsx", key: "lockedTitle", render: (l, p) => MARKETING_COPY[l].lockedTitle(p) },
  { lock: "marketing_studio", file: "src/components/seo-tools/marketing-brief-client.tsx", key: "lockedBody", render: (l, p) => MARKETING_COPY[l].lockedBody(p) },
  { lock: "action_agent", file: "src/components/seo-tools/action-agent-client.tsx", key: "lockedTitle", render: (l, p) => ACTION_AGENT_COPY[l].lockedTitle(p) },
  { lock: "action_agent", file: "src/components/seo-tools/fix-with-ai-button.tsx", key: "errLocked", render: (l, p) => ACTION_AGENT_COPY[l].errLocked(p) },
  { lock: "share_of_voice", file: SOV, key: "lockedTitle", render: (l, p) => SHARE_OF_VOICE_COPY[l].lockedTitle(p) },
  { lock: "share_of_voice", file: SOV, key: "lockedBody", render: (l, p) => SHARE_OF_VOICE_COPY[l].lockedBody(p) },
  { lock: "opportunity_scanner", file: "src/components/seo-tools/opportunity-scanner-client.tsx", key: "lockedBody", render: (l, p) => OPPORTUNITY_SCANNER_COPY[l].lockedBody(p) },
  { lock: "funnels", file: "src/components/seo-tools/funnels-client.tsx", key: "lockedBody", render: (l, p) => FUNNELS_COPY[l].lockedBody(p) },
  { lock: "monitoring", file: "src/components/help/ReputationHelp.tsx", key: "s5Note", render: (l, p) => REPUTATION_HELP_COPY[l].s5Note(p, "§") },
  { lock: "intelligence", file: "src/components/help/ReputationHelp.tsx", key: "s5Note", render: (l, p) => REPUTATION_HELP_COPY[l].s5Note("§", p) },
  { lock: "team_chat", file: "src/components/account/TeamChatSection.tsx", key: "chatLockedTitle", render: (l, p) => ACCOUNT_COPY[l].chatLockedTitle(p) },
  { lock: "team_chat", file: "src/components/account/TeamChatSection.tsx", key: "chatLockedBody", render: (l, p) => ACCOUNT_COPY[l].chatLockedBody(p) },
];

/** Plan names a string mentions, by whole word ("AI Visibility" counts as one). */
const namesIn = (s: string) => NAMES.filter((n) => new RegExp(`(^|[^A-Za-z])${n}([^A-Za-z]|$)`).test(s));

describe("1. a lock's plan is the upgrade-label helper's answer", () => {
  it("on every plan, for every lock", () => {
    for (const id of LOCK_IDS) {
      for (const plan of PLANS) {
        const target = upgradeTarget(plan, LOCKS[id]);
        if (target) {
          expect(lockedPlan(plan, id), `${plan} ${id}`).toBe(target);
          expect(planMeets(target, LOCKS[id]), `${plan} ${id} → ${target}`).toBe(true);
        } else {
          // Already included: the plan named is the cheapest that includes it.
          expect(planMeets(plan, LOCKS[id]), `${plan} ${id}`).toBe(true);
          expect(lockedPlan(plan, id)).toBe(upgradeTarget(null, LOCKS[id]));
        }
      }
    }
  });

  it("names the tool's real plan, not the one the copy used to type", () => {
    // "Growth and Agency" was wrong for both: Starter has them.
    expect(lockedPlan("AI_VISIBILITY", "rank_tracker")).toBe("STARTER");
    expect(lockedPlan("AI_VISIBILITY", "backlinks")).toBe("STARTER");
    expect(lockedPlan("STARTER", "csv_import")).toBe("GROWTH");
    expect(lockedPlan("STARTER", "rank_daily")).toBe("AGENCY");
    expect(lockedPlan("GROWTH", "ai_lens_any_url")).toBe("AGENCY");
    expect(lockedPlan("STARTER", "team_chat")).toBe("GROWTH");
    // Never sideways: the crawler-only plan is sent to a plan that keeps its crawler.
    expect(lockedPlan("NOSY_BAT", "marketing_studio")).toBe("STARTER");
    expect(lockedPlan(null, "seo_tools")).toBe("STARTER");
  });

  it("lockOpen agrees with the plan meeting the lock", () => {
    for (const id of LOCK_IDS) for (const plan of PLANS) expect(lockOpen(plan, id)).toBe(planMeets(plan, LOCKS[id]));
    expect(lockOpen("ENTERPRISE", "whitelabel")).toBe(true);
    expect(lockOpen("GROWTH", "whitelabel")).toBe(false);
  });
});

describe("2. each locked message names the helper's plan, and only it", () => {
  it("covers every lock", () => {
    expect(new Set(MESSAGES.map((m) => m.lock))).toEqual(new Set(LOCK_IDS));
  });

  for (const m of MESSAGES) {
    it(`${m.lock}: ${m.key}`, () => {
      for (const l of LOCALES) {
        // Typed names: with a placeholder, the message names no plan at all.
        expect(namesIn(m.render(l, "§PLAN§")), `${l} ${m.key} types a plan name`).toEqual([]);
        for (const plan of PLANS) {
          if (lockOpen(plan, m.lock)) continue;
          const name = lockedPlanName(plan, m.lock);
          const text = m.render(l, name);
          expect(namesIn(text), `${plan} ${l} ${m.key}`).toEqual([name]);
        }
      }
    });
  }

  it("the benchmark line's numbers are the plan config's", () => {
    const more = lockedPlan("GROWTH", "benchmark_more");
    expect(benchmarkDailyLimit(more)).toBeGreaterThan(benchmarkDailyLimit("GROWTH"));
    expect(src("src/components/visibility/BenchmarkCard.tsx")).toContain("benchmarkDailyLimit(morePlan)");
  });
});

describe("3. each component renders the message with the helper's name for its lock", () => {
  for (const m of MESSAGES) {
    it(`${m.file.split("/").pop()} ${m.key} (${m.lock})`, () => {
      const code = src(m.file);
      expect(code, "asks the helper for this lock").toMatch(
        new RegExp(`(useLockedPlanName|lockedPlanName|lockedPlan)\\((?:[^)]*, *)?"${m.lock}"\\)`),
      );
      if (m.key !== "lockedFixesA") expect(code, "calls the message with a name").toMatch(new RegExp(`\\.${m.key}\\(`));
    });
  }

  it("no plan name is typed as JSX text in those components", () => {
    for (const file of new Set(MESSAGES.map((m) => m.file))) {
      expect(src(file), file).not.toMatch(/>\s*(Starter|Growth|Agency|Enterprise)\s*</);
    }
    expect(src("src/components/visibility/help-modal.tsx")).not.toMatch(/Available on (Starter|Growth|Agency)/);
  });
});

describe("4. each lock is the check its route makes", () => {
  it("feature gates", () => {
    expect(src("src/app/api/imports/route.ts")).toMatch(/IMPORT_FEATURE = "ai_analysis"/);
    expect(src("src/app/api/ai/visibility/prompts/route.ts")).toContain('requireFeature("answer_tracking")');
    for (const r of ["monitor", "benchmark", "attribute", "remediate"]) {
      expect(src(`src/app/api/ai/visibility/${r}/route.ts`), r).toContain('requireFeature("ai_visibility")');
    }
    expect(src("src/app/(dashboard)/settings/account/page.tsx")).toContain('hasFeature(tenant.planType, "matrix_chat")');
    expect(LOCKS.team_chat.features).toEqual(["matrix_chat"]);
    expect(LOCKS.csv_import.features).toEqual(["ai_analysis"]);
  });

  it("limits read the same predicate the route or usage endpoint does", () => {
    expect(src("src/app/api/ai/visibility/monitor/route.ts")).toContain("requirePlan(MONITOR_DAILY_MIN_PLAN)");
    expect(src("src/app/api/ai/visibility/benchmark/route.ts")).toContain("benchmarkDailyLimit");
    expect(src("src/app/api/ai/visibility/bots/route.ts")).toContain("enabled: canUploadLogs(plan)");
    expect(src("src/lib/content-explorer/usage.ts")).toContain("planCanSearchContent(plan)");
    expect(src("src/lib/rank-tracker/usage.ts")).toContain("planCanTrack(plan)");
    expect(src("src/lib/rank-tracker/usage.ts")).toContain("allowedFrequencies(plan)");
    expect(src("src/lib/backlinks/usage.ts")).toContain("planCanAnalyzeBacklinks(plan)");
    expect(src("src/lib/ai-citations/service.ts")).toContain("planCanUseAiCitations(plan)");
    expect(src("src/lib/ai-lens/url.ts")).toContain("CROSS_DOMAIN_PLANS.includes(plan)");
  });

  it("the AI Citations API refusal names the same plan", async () => {
    const { AiCitationsPlanLockedError } = await import("@/lib/ai-citations/service");
    expect(new AiCitationsPlanLockedError("STARTER").message).toContain(lockedPlanName("STARTER", "ai_citations"));
  });
});

describe("5. the upgrade screen", () => {
  const html = (plan: PlanType, target: PlanType, l: DashLocale = "en") =>
    renderToStaticMarkup(<PlanUpgradeScreen locale={l} plan={plan} target={target} />);

  it("shows Cancel anytime, from the pricing cards' source, in every locale", () => {
    for (const l of LOCALES) {
      expect(html("AI_VISIBILITY", "STARTER", l)).toContain(HOME_PRICING_CHROME[l].cancelAnytime);
      expect(html("NOSY_BAT", "STARTER", l)).toContain(HOME_PRICING_CHROME[l].cancelAnytime);
    }
  });

  it("for the crawler-only plan, adds the suggested plan's crawl limits beside its own", () => {
    const out = html("NOSY_BAT", "STARTER");
    const fmt = new Intl.NumberFormat("en");
    const s = PLAN_CONFIGS.STARTER;
    const nb = PLAN_CONFIGS.NOSY_BAT;
    expect(out).toContain('data-testid="plan-upgrade-crawl-limits"');
    for (const v of [s.crawlUrlCap, s.crawlsPerMonth, s.crawlPagesPerMonth, nb.crawlUrlCap, nb.crawlPagesPerMonth]) {
      expect(out).toContain(fmt.format(v!));
    }
    expect(out).toContain(nb.crawlsPerMonth === null ? "unlimited" : fmt.format(nb.crawlsPerMonth));
    expect(out).toContain(`${s.name} crawler limits`);
  });

  it("and only for it", () => {
    expect(html("AI_VISIBILITY", "STARTER")).not.toContain("plan-upgrade-crawl-limits");
  });
});
