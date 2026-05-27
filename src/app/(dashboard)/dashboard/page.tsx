"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

interface Analytics {
  totalSent: number;
  totalResponses: number;
  avgRating: number;
  positiveCount: number;
  negativeCount: number;
  recoveryOpen: number;
  recentFeedback: {
    id: string;
    customerName: string;
    rating: number | null;
    comment: string | null;
    status: string;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const ratingColor = (rating: number | null) => {
    if (rating === null) return "text-gray-400";
    if (rating >= 4) return "text-green-500";
    if (rating === 3) return "text-yellow-500";
    return "text-red-500";
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
      PENDING: "warning",
      SUBMITTED: "success",
      EXPIRED: "danger",
    };
    return map[status] ?? "default";
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent feedback */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Recent Feedback
              </h3>
              <Link
                href="/feedback"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentFeedback.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No feedback yet. Send your first feedback request to get started.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {data.recentFeedback.map((fb) => (
                  <li key={fb.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fb.customerName}
                      </p>
                      {fb.comment && (
                        <p className="mt-0.5 text-sm text-gray-500 truncate">
                          {fb.comment}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {fb.rating !== null && (
                        <span className={`flex items-center gap-1 text-sm font-semibold ${ratingColor(fb.rating)}`}>
                          <Star className="h-4 w-4 fill-current" />
                          {fb.rating}
                        </span>
                      )}
                      <Badge variant={statusBadge(fb.status)}>
                        {fb.status}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(fb.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">
              Quick Actions
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/feedback" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send Feedback Request
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/recovery" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  View Recovery Tickets
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/customers" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Manage Customers
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/campaigns" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Create Campaign
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
