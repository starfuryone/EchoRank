"use client";

import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";

/**
 * "Download PDF report" for the AI Visibility dashboard. Thin wrapper around the
 * shared ReportDownloadButton — kept so existing imports in /visibility continue
 * to work. Behaviour is unchanged: probes GET /api/ai/visibility/report and shows
 * the button only once the tenant has audit or prompt data; the click POSTs to the
 * same route, which assembles the tenant's real data server-side and streams back a
 * PDF — no tenant id is ever sent from here.
 */
export function VisibilityReportButton() {
  return <ReportDownloadButton endpoint="/api/ai/visibility/report" />;
}
