"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Send,
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  TrendingUp,
  MapPin,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalSent: number;
  totalResponses: number;
  avgRating: number;
  positiveCount: number;
  negativeCount: number;
  recoveryOpen: number;
  ratingDistribution: Record<string, number>;
  responseRateByWeek: { week: string; sent: number; responses: number }[];
  topLocations: { location: string; avgRating: number; count: number }[];
  satisfactionTrend: { period: string; score: number }[];
}

const RATING_COLORS: Record<number, string> = {
  5: "bg-green-500",
  4: "bg-green-400",
  3: "bg-yellow-400",
  2: "bg-orange-400",
  1: "bg-red-500",
};

const RATING_LABELS: Record<number, string> = {
  5: "Excellent",
  4: "Good",
  3: "Neutral",
  2: "Poor",
  1: "Terrible",
};

function AnalyticsHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Reading your analytics">
      <div className="space-y-4 text-sm leading-relaxed text-gray-600">
        <p>
          Everything here reflects the period chosen in the date selector
          (last 7, 30, 90 days, or 12 months). Change it to widen or narrow the
          view.
        </p>
        <div>
          <p className="font-medium text-gray-900">The numbers up top</p>
          <p className="mt-1">
            Sent and Responses show how many feedback requests went out and came
            back; Avg Rating is the mean score. Positive and Negative split those
            responses, and Recovery Open counts low-rating tickets still being
            worked.
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">Rating distribution</p>
          <p className="mt-1">
            How responses break down across 1 to 5 stars, so you can see whether
            scores cluster high or low.
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">Response rate by week</p>
          <p className="mt-1">
            Requests sent versus responses received each week &mdash; a read on
            how engaged your customers are over time.
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">Top locations &amp; satisfaction trend</p>
          <p className="mt-1">
            Average rating per location helps you spot which sites need
            attention, while the satisfaction trend shows whether your overall
            score is moving up or down.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30");
  const [helpOpen, setHelpOpen] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ days: dateRange });
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-72 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load analytics
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const totalRatings = Object.values(data.ratingDistribution ?? {}).reduce(
    (sum, v) => sum + v,
    0
  );

  const maxWeeklyResponses = Math.max(
    ...((data.responseRateByWeek ?? []).map((w) => w.sent) || [1]),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your reputation performance over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            id="date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "365", label: "Last 12 months" },
            ]}
          />
          <Button variant="outline" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Button>
        </div>
      </div>

      <AnalyticsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Sent"
          value={data.totalSent}
          icon={<Send className="h-5 w-5" />}
        />
        <StatCard
          title="Responses"
          value={data.totalResponses}
          change={
            data.totalSent > 0
              ? `${Math.round((data.totalResponses / data.totalSent) * 100)}% response rate`
              : undefined
          }
          changeType="neutral"
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatCard
          title="Avg Rating"
          value={data.avgRating > 0 ? data.avgRating.toFixed(1) : "--"}
          icon={<Star className="h-5 w-5" />}
        />
        <StatCard
          title="Positive (4-5)"
          value={data.positiveCount}
          changeType="positive"
          icon={<ThumbsUp className="h-5 w-5" />}
        />
        <StatCard
          title="Negative (1-2)"
          value={data.negativeCount}
          changeType="negative"
          icon={<ThumbsDown className="h-5 w-5" />}
        />
        <StatCard
          title="Recovery Open"
          value={data.recoveryOpen}
          icon={<AlertCircle className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Rating Distribution
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            {totalRatings === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No ratings data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = data.ratingDistribution?.[String(rating)] ?? 0;
                  const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="w-20 text-sm font-medium text-gray-600">
                        {rating} {RATING_LABELS[rating]}
                      </span>
                      <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            RATING_COLORS[rating]
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm text-gray-500">
                        {count} ({Math.round(pct)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Rate Over Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Response Rate Over Time
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            {(data.responseRateByWeek ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No response data available yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(data.responseRateByWeek ?? []).map((week) => {
                  const sentPct = (week.sent / maxWeeklyResponses) * 100;
                  const responsePct = (week.responses / maxWeeklyResponses) * 100;
                  const rate =
                    week.sent > 0
                      ? Math.round((week.responses / week.sent) * 100)
                      : 0;
                  return (
                    <div key={week.week} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{week.week}</span>
                        <span>
                          {week.responses}/{week.sent} ({rate}%)
                        </span>
                      </div>
                      <div className="relative h-5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-blue-200 transition-all duration-500"
                          style={{ width: `${sentPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${responsePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-200" />
                    Sent
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Responses
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Top Performing Locations
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            {(data.topLocations ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No location data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {(data.topLocations ?? []).map((loc, i) => (
                  <div
                    key={loc.location}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {loc.location}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loc.count} responses
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-semibold text-gray-900">
                        {loc.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Satisfaction Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Customer Satisfaction Trend
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            {(data.satisfactionTrend ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No trend data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {(data.satisfactionTrend ?? []).map((point) => {
                  const pct = (point.score / 5) * 100;
                  const color =
                    point.score >= 4
                      ? "bg-green-500"
                      : point.score >= 3
                        ? "bg-yellow-400"
                        : "bg-red-500";
                  return (
                    <div key={point.period} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{point.period}</span>
                        <span className="font-medium">
                          {point.score.toFixed(1)} / 5.0
                        </span>
                      </div>
                      <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            color
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
