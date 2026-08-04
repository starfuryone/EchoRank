"use client";

// The one thing every existing help surface gains: a way out to the knowledge
// base — the article for THIS page, and the index of everything.
//
// Deliberately a link row and nothing more. This repo has three help systems
// already (ToolHelpModal for the SEO tools, HelpModal for the metric-card
// pages, and the iframe-embed buttons for the Caddy guides), and the right
// move was not a fourth: each of them keeps its own shape and adds this one
// row at the bottom.
//
// Which article a route maps to lives in src/lib/help-content.ts, asserted
// against learnRoutes() in tests — so a renamed chapter fails a test instead of
// quietly turning a Help button into a 404.

import Link from "next/link";
import { HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { HELP_HUB, helpArticleFor, learnHref } from "@/lib/help-content";

export function KnowledgeBaseLinks({
  locale = "en",
  route,
  className,
}: {
  locale?: DashLocale;
  /** The dashboard route this help belongs to, e.g. "/imports". */
  route: string;
  className?: string;
}) {
  const copy = HELP_COPY[locale];
  const article = helpArticleFor(route);

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-4 text-sm ${className ?? "mt-3"}`}
    >
      {article && (
        // New tab: the knowledge base is a public marketing page, and losing
        // the dashboard screen you were mid-task on is not a fair trade.
        <a
          href={learnHref(locale, article)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:underline"
        >
          {copy.readFullGuide}
        </a>
      )}
      <Link href={HELP_HUB} className="font-medium text-gray-500 hover:underline">
        {copy.browseAll}
      </Link>
    </div>
  );
}
