"use client";

// The Billing page's "Usage this month" card: ONLY the meters the plan
// includes. Feedback requests belong to the reputation area, the page
// allowance to the crawler; a plan with neither gets no card at all, not an
// empty one and not a meter for something it did not buy (a crawler-only
// tenant used to see "Feedback Requests 0 / 10,000").

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BillingCopy, DashLocale } from "@/lib/i18n/dashboard";

export interface UsageMetersProps {
  locale: DashLocale;
  t: BillingCopy;
  crawlerName: string;
  feedback: { used: number; limit: number } | null;
  crawlPages: { used: number; limit: number | null; resetsAt: string } | null;
}

export function UsageMeters({ locale, t, crawlerName, feedback, crawlPages }: UsageMetersProps) {
  if (!feedback && !crawlPages) return null;
  const pct = feedback && feedback.limit > 0 ? Math.round((feedback.used / feedback.limit) * 100) : 0;

  return (
    <Card data-testid="billing-usage">
      <CardHeader>
        <h3 className="text-base font-semibold text-gray-900">{t.usageTitle}</h3>
      </CardHeader>
      <CardContent>
        {feedback && (
          <div className="space-y-3" data-testid="billing-feedback-meter">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t.feedbackRequests}</span>
              <span className="font-medium text-gray-900">
                {feedback.used.toLocaleString(locale)} / {feedback.limit.toLocaleString(locale)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-blue-500",
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{t.usagePct(pct)}</p>
          </div>
        )}
        {crawlPages && (
          <div className={cn("space-y-1", feedback && "mt-5")} data-testid="billing-crawl-pages">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t.crawlPages(crawlerName)}</span>
              <span className="font-medium text-gray-900">
                {crawlPages.limit === null
                  ? t.crawlPagesUnlimited(crawlPages.used.toLocaleString(locale))
                  : t.crawlPagesValue(crawlPages.used.toLocaleString(locale), crawlPages.limit.toLocaleString(locale))}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {t.crawlPagesResets(
                new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(crawlPages.resetsAt)),
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
