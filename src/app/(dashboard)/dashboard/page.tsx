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
  HelpCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/utils";
import { GettingStarted } from "@/components/onboarding/getting-started";

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

function DashboardHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Understanding your dashboard">
      <style>{`
        @keyframes erDashPulse {
          0%, 100% { opacity: .3; }
          50% { opacity: 1; }
        }
        .er-fdot { animation: erDashPulse 1.8s ease-in-out infinite; }
        .er-f2 { animation-delay: .3s; }
        .er-f3 { animation-delay: .6s; }
        .er-f4 { animation-delay: .9s; }
        @media (prefers-reduced-motion: reduce) {
          .er-fdot { animation: none; opacity: 1; }
        }
      `}</style>
      <div className="rounded-lg bg-gray-50 p-4">
        <svg viewBox="0 0 560 195" className="w-full" role="img" aria-label="Metrics funnel: sent requests to responses to positive or negative feedback, with negative opening a recovery ticket">
          <defs>
            <marker id="erFa" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#cbd5e1" />
            </marker>
          </defs>
          <line x1="110" y1="100" x2="150" y2="100" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erFa)" />
          <path d="M256,95 C290,95 296,55 330,55" fill="none" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erFa)" />
          <path d="M256,105 C290,105 296,145 330,145" fill="none" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erFa)" />
          <line x1="446" y1="145" x2="488" y2="145" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erFa)" />
          <rect x="20" y="82" width="90" height="36" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
          <text x="65" y="100" textAnchor="middle" fontSize="11" fontWeight="600" fill="#2563eb">Sent</text>
          <text x="65" y="112" textAnchor="middle" fontSize="9" fill="#60a5fa">requests</text>
          <rect x="150" y="82" width="106" height="36" rx="8" fill="#f1f5f9" stroke="#e2e8f0" />
          <text x="203" y="104" textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">Responses</text>
          <rect x="330" y="37" width="116" height="36" rx="8" fill="#f0fdf4" stroke="#86efac" />
          <text x="388" y="59" textAnchor="middle" fontSize="11" fontWeight="600" fill="#15803d">Positive (4-5)</text>
          <rect x="330" y="127" width="116" height="36" rx="8" fill="#fef2f2" stroke="#fca5a5" />
          <text x="388" y="149" textAnchor="middle" fontSize="11" fontWeight="600" fill="#b91c1c">Negative (1-2)</text>
          <rect x="488" y="127" width="64" height="36" rx="8" fill="#fffbeb" stroke="#fcd34d" />
          <text x="520" y="143" textAnchor="middle" fontSize="9" fontWeight="600" fill="#b45309">Recovery</text>
          <text x="520" y="154" textAnchor="middle" fontSize="9" fontWeight="600" fill="#b45309">ticket</text>
          <circle className="er-fdot" cx="65" cy="100" r="5" fill="#2563eb" />
          <circle className="er-fdot er-f2" cx="203" cy="100" r="5" fill="#64748b" />
          <circle className="er-fdot er-f3" cx="388" cy="55" r="5" fill="#16a34a" />
          <circle className="er-fdot er-f4" cx="388" cy="145" r="5" fill="#dc2626" />
        </svg>
      </div>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
        <p>
          The cards at the top track your feedback funnel.
          <strong> Total Sent</strong> is how many feedback requests went out;
          <strong> Responses</strong> is how many customers replied;
          <strong> Avg Rating</strong> is the mean score across responses.
        </p>
        <p>
          Responses split into <span className="font-medium text-green-700">Positive (4&ndash;5)</span> and
          <span className="font-medium text-red-700"> Negative (1&ndash;2)</span>. A negative
          response opens a <span className="font-medium text-amber-700">recovery ticket</span> so your
          team can follow up &mdash; that count is <strong>Recovery Open</strong>.
        </p>
        <p>
          <strong>Recent Feedback</strong> lists the latest responses; use
          <strong> Quick Actions</strong> to send a request, review recovery
          tickets, or manage customers.
        </p>
      </div>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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
      <DashboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Title + help */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Overview
        </h2>
        <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help
        </Button>
      </div>

      <GettingStarted />

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
