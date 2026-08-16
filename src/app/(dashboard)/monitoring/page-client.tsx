"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Radar,
  Plus,
  Globe,
  Star,
  MessageSquare,
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";
import { FixWithAiButton } from "@/components/seo-tools/fix-with-ai-button";
import {
  ACTION_AGENT_COPY,
  MONITORING_COPY,
  type DashLocale,
  type MonitoringCopy,
} from "@/lib/i18n/dashboard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MonitoringSource {
  id: string;
  platform: string;
  externalId: string;
  name: string;
  url: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  checkInterval: number;
  createdAt: string;
  _count: { reviews: number };
}

interface ExternalReview {
  id: string;
  platform: string;
  externalId: string;
  authorName: string | null;
  rating: number | null;
  content: string | null;
  sentimentLabel: string | null;
  riskLevel: string;
  publishedAt: string | null;
  url: string | null;
  createdAt: string;
  source: { id: string; name: string; platform: string };
}

/* ------------------------------------------------------------------ */
/*  Platform helpers                                                   */
/* ------------------------------------------------------------------ */

// Brand names — always English (product names).
const PLATFORM_BRAND_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  TRUSTPILOT: "Trustpilot",
  YELP: "Yelp",
  REDDIT: "Reddit",
  TWITTER: "X (Twitter)",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  APP_STORE: "App Store",
};

function platformOptions(copy: MonitoringCopy) {
  return [
    { value: "", label: copy.selectPlatform },
    ...Object.entries(PLATFORM_BRAND_LABELS).map(([value, label]) => ({ value, label })),
    { value: "CUSTOM", label: copy.platformCustom },
  ];
}

const PLATFORM_COLORS: Record<string, string> = {
  GOOGLE: "bg-blue-100 text-blue-700",
  FACEBOOK: "bg-indigo-100 text-indigo-700",
  TRUSTPILOT: "bg-green-100 text-green-700",
  YELP: "bg-red-100 text-red-700",
  REDDIT: "bg-orange-100 text-orange-700",
  TWITTER: "bg-sky-100 text-sky-700",
  TIKTOK: "bg-pink-100 text-pink-700",
  YOUTUBE: "bg-red-100 text-red-700",
  APP_STORE: "bg-purple-100 text-purple-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

const RISK_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  LOW: "success",
  MODERATE: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

const SENTIMENT_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  positive: "success",
  neutral: "info",
  negative: "danger",
};

function platformLabel(platform: string, copy: MonitoringCopy): string {
  if (platform === "CUSTOM") return copy.platformCustom;
  return PLATFORM_BRAND_LABELS[platform] ?? platform;
}

function timeAgo(dateStr: string | null, copy: MonitoringCopy): string {
  if (!dateStr) return copy.never;
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return copy.daysAgo(days);
}

function renderStars(rating: number | null) {
  if (rating == null) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MonitoringPageClient({ locale }: { locale: DashLocale }) {
  const t = MONITORING_COPY[locale];
  const aa = ACTION_AGENT_COPY[locale];
  const [sources, setSources] = useState<MonitoringSource[]>([]);
  const [reviews, setReviews] = useState<ExternalReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterRisk, setFilterRisk] = useState("");

  // Add source form state
  const [newPlatform, setNewPlatform] = useState("");
  const [newName, setNewName] = useState("");
  const [newExternalId, setNewExternalId] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set("platform", filterPlatform);
      if (filterRisk) params.set("riskLevel", filterRisk);

      const [sourcesRes, reviewsRes] = await Promise.all([
        fetch("/api/monitoring/sources"),
        fetch(`/api/monitoring/reviews?${params.toString()}&limit=50`),
      ]);

      if (sourcesRes.ok) {
        const sourcesData = await sourcesRes.json();
        setSources(sourcesData.data);
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData.data);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterRisk]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/monitoring/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: newPlatform,
          externalId: newExternalId,
          name: newName,
          url: newUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t.createSourceFailedShort);
        return;
      }

      setShowAddModal(false);
      setNewPlatform("");
      setNewName("");
      setNewExternalId("");
      setNewUrl("");
      fetchData();
    } catch {
      setError(t.createSourceFailed);
    } finally {
      setCreating(false);
    }
  }

  /* -- Platform distribution chart data -------------------------------- */
  const platformCounts: Record<string, number> = {};
  for (const review of reviews) {
    platformCounts[review.platform] = (platformCounts[review.platform] || 0) + 1;
  }
  const maxPlatformCount = Math.max(1, ...Object.values(platformCounts));

  /* -- Risk distribution ----------------------------------------------- */
  const riskCounts: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  for (const review of reviews) {
    riskCounts[review.riskLevel] = (riskCounts[review.riskLevel] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportDownloadButton endpoint="/api/monitoring/report" />
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {t.refresh}
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t.addSource}
          </Button>
        </div>
      </div>

      {/* Active Sources */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t.sourcesHeading}</h2>
        {sources.length === 0 && !loading ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Radar className="h-10 w-10" />}
                title={t.sourcesEmptyTitle}
                description={t.sourcesEmptyDescription}
                actionLabel={t.addSource}
                onAction={() => setShowAddModal(true)}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          PLATFORM_COLORS[source.platform] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {platformLabel(source.platform, t)}
                      </span>
                      {source.isActive ? (
                        <span className="h-2 w-2 rounded-full bg-green-500" title={t.active} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-gray-400" title={t.inactive} />
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {t.reviewCount(source._count.reviews)}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 truncate">{source.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">{source.externalId}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {t.lastChecked} {timeAgo(source.lastCheckedAt, t)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">{t.reviewsByPlatform}</h3>
          </CardHeader>
          <CardContent>
            {Object.keys(platformCounts).length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t.noReviewData}</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(platformCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([platform, count]) => (
                    <div key={platform}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{platformLabel(platform, t)}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(count / maxPlatformCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">{t.riskDistribution}</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as const).map((level) => (
                <div
                  key={level}
                  className="rounded-lg border border-gray-200 p-3 text-center"
                >
                  <p className="text-2xl font-bold text-gray-900">{riskCounts[level]}</p>
                  <Badge variant={RISK_BADGE_VARIANT[level]}>{t.riskLabels[level] ?? level}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t.recentReviews}</h2>
          <div className="flex items-center gap-2">
            <Select
              options={[
                { value: "", label: t.allPlatforms },
                ...platformOptions(t).filter((o) => o.value !== ""),
              ]}
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="w-40"
            />
            <Select
              options={[
                { value: "", label: t.allRiskLevels },
                { value: "LOW", label: t.riskLabels.LOW },
                { value: "MODERATE", label: t.riskLabels.MODERATE },
                { value: "HIGH", label: t.riskLabels.HIGH },
                { value: "CRITICAL", label: t.riskLabels.CRITICAL },
              ]}
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Batch drafting, above the list rather than a button per row.
            A per-row button would be the obvious placement and the wrong one:
            answering reviews is work somebody sits down and does, the generator
            is a batch by design (one model call per review, up to ten), and a
            button on every card invites ten separate clicks that each enqueue a
            separate job. The drafts land in the Action Agent queue and NOTHING
            is posted to any platform — this repo has no path that publishes a
            reply, and the copy says so rather than letting somebody find out. */}
        {reviews.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-900">{aa.entryIntroReviews}</p>
            <div className="mt-2">
              <FixWithAiButton locale={locale} kind="review_reply" reviewLimit={5} />
            </div>
          </div>
        )}

        {reviews.length === 0 && !loading ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Search className="h-10 w-10" />}
                title={t.reviewsEmptyTitle}
                description={t.reviewsEmptyDescription}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            PLATFORM_COLORS[review.platform] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {platformLabel(review.platform, t)}
                        </span>
                        {renderStars(review.rating)}
                        {review.sentimentLabel && (
                          <Badge variant={SENTIMENT_BADGE_VARIANT[review.sentimentLabel] ?? "default"}>
                            {t.sentimentLabels[review.sentimentLabel] ?? review.sentimentLabel}
                          </Badge>
                        )}
                        <Badge variant={RISK_BADGE_VARIANT[review.riskLevel] ?? "default"}>
                          {t.riskLabels[review.riskLevel] ?? review.riskLevel}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-1.5">
                        {review.authorName && (
                          <span className="text-sm font-medium text-gray-900">
                            {review.authorName}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {review.source.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {timeAgo(review.publishedAt, t)}
                        </span>
                      </div>

                      {review.content && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {review.content}
                        </p>
                      )}
                    </div>

                    {review.url && (
                      <a
                        href={review.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setError("");
        }}
        title={t.addModalTitle}
      >
        <form onSubmit={handleAddSource} className="space-y-4">
          <Select
            label={t.platformFieldLabel}
            id="platform"
            options={platformOptions(t)}
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
            required
          />

          <Input
            label={t.sourceNameLabel}
            id="name"
            placeholder={t.sourceNamePlaceholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <Input
            label={t.externalIdLabel}
            id="externalId"
            placeholder={t.externalIdPlaceholder}
            value={newExternalId}
            onChange={(e) => setNewExternalId(e.target.value)}
            required
          />

          <Input
            label={t.urlLabel}
            id="url"
            placeholder="https://..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setError("");
              }}
            >
              {t.cancel}
            </Button>
            <Button type="submit" loading={creating} disabled={!newPlatform || !newName || !newExternalId}>
              {t.addSource}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
