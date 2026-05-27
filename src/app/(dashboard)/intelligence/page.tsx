"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Bell,
  CheckCircle,
  MapPin,
  Brain,
  BarChart3,
  Heart,
  MessageSquare,
  Star,
  AlertCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReputationData {
  current: {
    overallScore: number;
    sentimentScore: number;
    responseRateScore: number;
    recoveryScore: number;
    reviewVelocityScore: number;
    volatilityIndex: number;
    riskLevel: string;
    trendDirection: string;
    sampleSize: number;
    confidence: number;
  };
  historical: {
    overallScore: number;
    riskLevel: string;
    trendDirection: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }[];
  locations: {
    location: string;
    overallScore: number;
    sentimentScore: number;
    riskLevel: string;
    trendDirection: string;
    sampleSize: number;
  }[];
}

interface Alert {
  id: string;
  alertType: string;
  riskLevel: string;
  probability: number;
  title: string;
  description: string;
  suggestedAction: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
  pagination: { total: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, { bg: string; text: string; ring: string; badge: "default" | "success" | "warning" | "danger" | "info" }> = {
  LOW: { bg: "bg-green-50", text: "text-green-700", ring: "stroke-green-500", badge: "success" },
  MODERATE: { bg: "bg-yellow-50", text: "text-yellow-700", ring: "stroke-yellow-500", badge: "warning" },
  HIGH: { bg: "bg-orange-50", text: "text-orange-700", ring: "stroke-orange-500", badge: "warning" },
  CRITICAL: { bg: "bg-red-50", text: "text-red-700", ring: "stroke-red-500", badge: "danger" },
};

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

function riskBadgeVariant(level: string): BadgeVariant {
  return (RISK_COLORS[level]?.badge as BadgeVariant) ?? "default";
}

function riskRingColor(level: string): string {
  return RISK_COLORS[level]?.ring ?? "stroke-gray-300";
}

function trendIcon(direction: string) {
  if (direction === "improving") return <TrendingUp className="h-5 w-5 text-green-500" />;
  if (direction === "declining") return <TrendingDown className="h-5 w-5 text-red-500" />;
  return <Minus className="h-5 w-5 text-gray-400" />;
}

function trendLabel(direction: string) {
  if (direction === "improving") return "Improving";
  if (direction === "declining") return "Declining";
  return "Stable";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Score Ring SVG Component
// ---------------------------------------------------------------------------

function ScoreRing({
  score,
  riskLevel,
  size = 180,
}: {
  score: number;
  riskLevel: string;
  size?: number;
}) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className={riskRingColor(riskLevel)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", scoreColor(score))}>
          {score}
        </span>
        <span className="text-xs font-medium text-gray-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function IntelligencePage() {
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [repRes, alertRes] = await Promise.all([
        fetch(`/api/ai/reputation?days=${dateRange}`),
        fetch("/api/ai/alerts?limit=10&acknowledged=false"),
      ]);

      if (!repRes.ok || !alertRes.ok) {
        throw new Error("Failed to load intelligence data");
      }

      const [repData, alertData] = await Promise.all([
        repRes.json(),
        alertRes.json(),
      ]);

      setReputation(repData);
      setAlerts(alertData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      setAcknowledging(alertId);
      const res = await fetch("/api/ai/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, action: "acknowledge" }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev
            ? {
                ...prev,
                alerts: prev.alerts.map((a) =>
                  a.id === alertId
                    ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() }
                    : a,
                ),
              }
            : prev,
        );
      }
    } finally {
      setAcknowledging(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      setAcknowledging(alertId);
      const res = await fetch("/api/ai/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, action: "resolve" }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev
            ? {
                ...prev,
                alerts: prev.alerts.filter((a) => a.id !== alertId),
              }
            : prev,
        );
      }
    } finally {
      setAcknowledging(null);
    }
  };

  // ---------- Loading state ----------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 h-72 animate-pulse rounded-xl bg-gray-200" />
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-80 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  // ---------- Error state ----------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load intelligence data
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  if (!reputation) return null;

  const current = reputation.current;
  const activeAlerts = alerts?.alerts.filter((a) => !a.acknowledged) ?? [];
  const criticalAlerts = activeAlerts.filter((a) => a.riskLevel === "CRITICAL").length;
  const highAlerts = activeAlerts.filter((a) => a.riskLevel === "HIGH").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            Reputation Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered insights into your brand reputation and customer risk signals.
          </p>
        </div>
        <Select
          id="date-range"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
        />
      </div>

      {/* Top section: Score Ring + Stat Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Score Ring Card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ScoreRing score={current.overallScore} riskLevel={current.riskLevel} />
            <div className="mt-4 flex items-center gap-2">
              <Badge variant={riskBadgeVariant(current.riskLevel)}>
                {current.riskLevel} RISK
              </Badge>
              <span className="flex items-center gap-1 text-sm text-gray-600">
                {trendIcon(current.trendDirection)}
                {trendLabel(current.trendDirection)}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Based on {current.sampleSize} data points ({(current.confidence * 100).toFixed(0)}% confidence)
            </p>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            title="Sentiment Score"
            value={current.sentimentScore}
            change={current.sentimentScore >= 70 ? "Healthy" : current.sentimentScore >= 50 ? "Needs attention" : "At risk"}
            changeType={current.sentimentScore >= 70 ? "positive" : current.sentimentScore >= 50 ? "neutral" : "negative"}
            icon={<Heart className="h-5 w-5" />}
          />
          <StatCard
            title="Response Rate"
            value={current.responseRateScore}
            change={`${current.responseRateScore >= 60 ? "Good" : "Low"} engagement`}
            changeType={current.responseRateScore >= 60 ? "positive" : "negative"}
            icon={<MessageSquare className="h-5 w-5" />}
          />
          <StatCard
            title="Recovery Score"
            value={current.recoveryScore}
            change={current.recoveryScore >= 70 ? "Effective recovery" : "Improve follow-up"}
            changeType={current.recoveryScore >= 70 ? "positive" : "negative"}
            icon={<Shield className="h-5 w-5" />}
          />
          <StatCard
            title="Review Velocity"
            value={current.reviewVelocityScore}
            change={current.reviewVelocityScore >= 50 ? "Steady flow" : "Needs boost"}
            changeType={current.reviewVelocityScore >= 50 ? "positive" : "neutral"}
            icon={<Star className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Volatility + Alert Summary Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Volatility Index</p>
              <p className={cn("text-2xl font-bold", current.volatilityIndex > 50 ? "text-red-600" : current.volatilityIndex > 25 ? "text-yellow-600" : "text-green-600")}>
                {current.volatilityIndex}
              </p>
              <p className="text-xs text-gray-400">
                {current.volatilityIndex > 50 ? "High variability" : current.volatilityIndex > 25 ? "Moderate variability" : "Stable"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", criticalAlerts > 0 ? "bg-red-50" : highAlerts > 0 ? "bg-orange-50" : "bg-green-50")}>
              <Bell className={cn("h-5 w-5", criticalAlerts > 0 ? "text-red-600" : highAlerts > 0 ? "text-orange-600" : "text-green-600")} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{activeAlerts.length}</p>
              <p className="text-xs text-gray-400">
                {criticalAlerts > 0 ? `${criticalAlerts} critical` : highAlerts > 0 ? `${highAlerts} high priority` : "No urgent alerts"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Sample Size</p>
              <p className="text-2xl font-bold text-gray-900">{current.sampleSize}</p>
              <p className="text-xs text-gray-400">
                {current.confidence >= 0.8 ? "High confidence" : current.confidence >= 0.5 ? "Moderate confidence" : "Low confidence"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts + Score History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Escalation Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="text-base font-semibold text-gray-900">
                  Escalation Alerts
                </h3>
              </div>
              {activeAlerts.length > 0 && (
                <Badge variant="danger">{activeAlerts.length} active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="mb-2 h-10 w-10 text-green-400" />
                <p className="text-sm font-medium text-gray-700">All clear</p>
                <p className="text-xs text-gray-400">No active escalation alerts</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-lg border p-4",
                      alert.riskLevel === "CRITICAL"
                        ? "border-red-200 bg-red-50"
                        : alert.riskLevel === "HIGH"
                          ? "border-orange-200 bg-orange-50"
                          : "border-gray-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={riskBadgeVariant(alert.riskLevel)}>
                            {alert.riskLevel}
                          </Badge>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(alert.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {alert.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        {alert.suggestedAction && (
                          <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            {alert.suggestedAction}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={acknowledging === alert.id}
                        onClick={() => handleAcknowledge(alert.id)}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={acknowledging === alert.id}
                        onClick={() => handleResolve(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Breakdown Visual */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Score Breakdown
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {[
                { label: "Sentiment", score: current.sentimentScore, weight: "35%" },
                { label: "Response Rate", score: current.responseRateScore, weight: "20%" },
                { label: "Recovery", score: current.recoveryScore, weight: "20%" },
                { label: "Review Velocity", score: current.reviewVelocityScore, weight: "15%" },
                {
                  label: "Stability",
                  score: Math.max(0, 100 - current.volatilityIndex),
                  weight: "10%",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", scoreColor(item.score))}>
                        {item.score}
                      </span>
                      <span className="text-xs text-gray-400">({item.weight})</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", scoreBarColor(item.score))}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Comparison Table */}
      {reputation.locations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Location Comparison
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Location</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Overall Score</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Sentiment</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Risk Level</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Trend</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Samples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reputation.locations.map((loc) => (
                    <tr key={loc.location} className="hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">
                        {loc.location}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={cn("font-bold", scoreColor(loc.overallScore))}>
                          {loc.overallScore}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={cn("font-medium", scoreColor(loc.sentimentScore))}>
                          {loc.sentimentScore}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={riskBadgeVariant(loc.riskLevel)}>
                          {loc.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {trendIcon(loc.trendDirection)}
                          <span className="text-xs text-gray-500">
                            {trendLabel(loc.trendDirection)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500">
                        {loc.sampleSize}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Score Trend */}
      {reputation.historical.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Reputation Score History
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reputation.historical
                .slice(0, 10)
                .reverse()
                .map((entry, idx) => {
                  const date = new Date(entry.periodEnd).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-gray-500 shrink-0">
                        {date}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            scoreBarColor(entry.overallScore),
                          )}
                          style={{ width: `${entry.overallScore}%` }}
                        />
                      </div>
                      <span className={cn("w-10 text-right text-sm font-bold", scoreColor(entry.overallScore))}>
                        {entry.overallScore}
                      </span>
                      <Badge variant={riskBadgeVariant(entry.riskLevel)} className="w-20 justify-center">
                        {entry.riskLevel}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
