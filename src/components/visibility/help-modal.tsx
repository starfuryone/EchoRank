"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Bot, ShieldCheck, Wrench, BarChart3, Cloud } from "lucide-react";

export function VisibilityHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="About AI Visibility">
      <div className="space-y-5 text-sm leading-relaxed text-gray-600">
        <section>
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-gray-900">
            <Bot className="h-4 w-4 text-blue-600" />
            What this checks
          </div>
          <p>
            Search is shifting from links to answers. When someone asks ChatGPT,
            Claude, Perplexity, or Gemini about your business, those engines can
            only recommend you if they can <strong>find, crawl, and read</strong>{" "}
            your site. This tool scores how visible you are to them and shows
            exactly what to fix.
          </p>
        </section>

        <section>
          <div className="mb-1.5 font-semibold text-gray-900">Your score</div>
          <p>
            The <strong>Visibility Score</strong> (0–100) and letter grade
            summarize seven checks: robots.txt access for AI crawlers,
            server-rendered content (AI crawlers rarely run JavaScript),
            schema.org structured data, an XML sitemap, page metadata, heading
            structure, and content depth. Each scored check lists what was found
            and how to improve it.
          </p>
        </section>

        <section>
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-gray-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Answer-engine reachability
          </div>
          <p>
            Each engine shows{" "}
            <span className="font-medium text-emerald-700">OPEN</span> or{" "}
            <span className="font-medium text-rose-700">BLOCKED</span>. Blocked
            means that engine&apos;s crawler is disallowed and cannot index or
            cite you. Most blocks come from your CDN or hosting provider — not
            your own site — which is why the fix often isn&apos;t in your code.
            See below.
          </p>
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
            <Cloud className="h-4 w-4" />
            Crawlers showing BLOCKED? Unblock them at Cloudflare
          </div>
          <p className="text-amber-900/90">
            Cloudflare blocks AI crawlers by default on many plans. It injects
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
              Disallow: /
            </code>
            rules into your robots.txt for bots like GPTBot and ClaudeBot — so
            editing your own robots.txt won&apos;t help. Turn the block off in
            Cloudflare:
          </p>
          <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-amber-900/90">
            <li>
              Sign in to the <strong>Cloudflare dashboard</strong> and select
              your domain.
            </li>
            <li>
              Open <strong>AI Crawl Control</strong> in the left menu (older
              accounts: <strong>Security → Bots</strong>).
            </li>
            <li>
              Find <strong>Manage robots.txt</strong> (the managed AI-crawler
              setting) and <strong>disable</strong> it. This removes the
              auto-injected{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
                Disallow
              </code>{" "}
              rules for AI bots.
            </li>
            <li>
              In the crawler list, set the engines you want (GPTBot, ClaudeBot,
              Google-Extended, PerplexityBot, CCBot, Applebot-Extended, Meta) to{" "}
              <strong>Allow</strong>, not Block.
            </li>
            <li>
              Save, wait 1–2 minutes, then <strong>re-run the audit</strong> —
              the engines should flip to OPEN.
            </li>
          </ol>
          <p className="mt-2.5 text-xs text-amber-800">
            Tip: you can still discourage AI <em>training</em> while allowing
            crawling for answers by keeping a{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">
              Content-Signal: ai-train=no
            </code>{" "}
            directive. Allowing crawlers is what makes you eligible to be cited.
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Not on Cloudflare? Check your CDN or WAF (Fastly, Akamai, AWS
            CloudFront) or server config for AI-bot rules, and confirm your own{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">/robots.txt</code>{" "}
            doesn&apos;t contain{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">Disallow: /</code>{" "}
            for those agents.
          </p>
        </section>

        <section>
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-gray-900">
            <Wrench className="h-4 w-4 text-blue-600" />
            Generating fixes
          </div>
          <p>
            <strong>Generate fixes</strong> turns the findings into paste-ready
            artifacts — schema markup, FAQ content, a robots.txt patch, and
            metadata — written from your live page. Available on Growth and
            above.
          </p>
        </section>

        <section>
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-gray-900">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Proving impact
          </div>
          <p>
            After you ship fixes, <strong>Measure AI impact</strong> reads your
            server access logs and shows, before vs after, whether AI crawlers
            and referral traffic actually increased.
          </p>
        </section>
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
