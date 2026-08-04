"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Megaphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { CAMPAIGNS_COPY, type CampaignsCopy, type DashLocale } from "@/lib/i18n/dashboard";
import { KnowledgeBaseLinks } from "@/components/help/KnowledgeBaseLinks";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  location: string | null;
  totalSent: number;
  totalResponses: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "info",
};

function CampaignLifecycleBanner({ t }: { t: CampaignsCopy }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <style>{`
        @keyframes erCpTravel {
          0%   { offset-distance: 0%; opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .er-cp-dot {
          offset-path: path('M140,100 L190,100');
          animation: erCpTravel 2.4s ease-in-out infinite;
        }
        .er-cp-dot2 {
          offset-path: path('M320,100 L370,100');
          animation: erCpTravel 2.4s ease-in-out infinite;
          animation-delay: .8s;
        }
        .er-cp-dot3 {
          offset-path: path('M540,100 L590,100');
          animation: erCpTravel 2.4s ease-in-out infinite;
          animation-delay: 1.6s;
        }
        @media (prefers-reduced-motion: reduce) {
          .er-cp-dot, .er-cp-dot2, .er-cp-dot3 { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t.bannerTitle}</h3>
        <span className="text-xs text-gray-500">{t.bannerTagline}</span>
      </div>
      <svg
        viewBox="0 0 760 165"
        className="w-full max-w-3xl"
        role="img"
        aria-label={t.svgAria}
      >
        <defs>
          <marker id="erCpAh" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <line x1="140" y1="80" x2="190" y2="80" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erCpAh)" />
        <line x1="320" y1="80" x2="370" y2="80" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erCpAh)" />
        <line x1="540" y1="80" x2="590" y2="80" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erCpAh)" />
        <rect x="30" y="56" width="110" height="48" rx="12" fill="#475569" />
        <text x="85" y="85" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">{t.svgDraft}</text>
        <rect x="190" y="56" width="130" height="48" rx="12" fill="#16a34a" />
        <text x="255" y="78" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">{t.svgActive}</text>
        <text x="255" y="94" textAnchor="middle" fontSize="10" fontWeight="600" fill="#dcfce7">{t.svgSendsToMany}</text>
        <rect x="370" y="56" width="170" height="48" rx="12" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2" />
        <text x="455" y="78" textAnchor="middle" fontSize="13" fontWeight="700" fill="#15803d">{t.svgResponses}</text>
        <text x="455" y="94" textAnchor="middle" fontSize="10" fontWeight="600" fill="#16a34a">{t.svgReviewsRecovery}</text>
        <rect x="590" y="56" width="140" height="48" rx="12" fill="#2563eb" />
        <text x="660" y="85" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">{t.svgCompleted}</text>
        <circle className="er-cp-dot" r="7" fill="#fbbf24" />
        <circle className="er-cp-dot2" r="7" fill="#fbbf24" />
        <circle className="er-cp-dot3" r="7" fill="#fbbf24" />
      </svg>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {t.p1a}
        <span className="font-medium text-gray-700">{t.p1strong1}</span>
        {t.p1b}
        <span className="font-medium text-green-700">{t.p1strong2}</span>
        {t.p1c}
      </p>
    </div>
  );
}

export function CampaignsPageClient({ locale }: { locale: DashLocale }) {
  const t = CAMPAIGNS_COPY[locale];
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    channel: "EMAIL",
    location: "",
  });

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setCampaigns(json.campaigns ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed, t.genericError]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(t.createFailed);
      setModalOpen(false);
      setForm({ name: "", description: "", channel: "EMAIL", location: "" });
      fetchCampaigns();
    } catch {
      alert(t.createFailedAlert);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t.colName,
      render: (c: Campaign) => (
        <div>
          <p className="font-medium text-gray-900">{c.name}</p>
          {c.description && (
            <p className="mt-0.5 text-xs text-gray-500 truncate max-w-xs">
              {c.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t.colStatus,
      render: (c: Campaign) => (
        <Badge variant={STATUS_BADGE[c.status] ?? "default"}>
          {t.statusLabels[c.status] ?? c.status}
        </Badge>
      ),
    },
    {
      key: "channel",
      header: t.colChannel,
      render: (c: Campaign) => (
        <Badge variant="default">{t.channelLabels[c.channel] ?? c.channel}</Badge>
      ),
    },
    {
      key: "totalSent",
      header: t.colSent,
      render: (c: Campaign) => (
        <span className="text-gray-900 font-medium">{c.totalSent}</span>
      ),
    },
    {
      key: "totalResponses",
      header: t.colResponses,
      render: (c: Campaign) => (
        <span className="text-gray-900 font-medium">
          {c.totalResponses}
          {c.totalSent > 0 && (
            <span className="ml-1 text-xs text-gray-400">
              ({Math.round((c.totalResponses / c.totalSent) * 100)}%)
            </span>
          )}
        </span>
      ),
    },
    {
      key: "location",
      header: t.colLocation,
      render: (c: Campaign) => (
        <span className="text-gray-600">{c.location ?? "--"}</span>
      ),
    },
    {
      key: "createdAt",
      header: t.colCreated,
      render: (c: Campaign) => (
        <span className="text-gray-500">{formatDate(c.createdAt, locale)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">{t.loadFailed}</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CampaignLifecycleBanner t={t} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.createCampaign}
        </Button>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.createCampaign}
            onAction={() => setModalOpen(true)}
            icon={<Megaphone className="h-12 w-12" />}
          />
        ) : (
          <DataTable<Campaign & Record<string, unknown>>
            columns={columns}
            data={campaigns as (Campaign & Record<string, unknown>)[]}
            keyField="id"
            emptyMessage={t.emptyTitle}
          />
        )}
      </Card>

      {/* Create Campaign Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t.createCampaign}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Inline help */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">{t.helpTitle}</p>
            <p className="mt-1 text-blue-800">{t.helpBody}</p>
            <ul className="mt-2 space-y-1 text-blue-800">
              <li>
                <span className="font-medium">{t.helpChannelStrong}</span>{" "}
                {t.helpChannelBody}
              </li>
              <li>
                <span className="font-medium">{t.helpLocationStrong}</span>{" "}
                {t.helpLocationBody}
              </li>
            </ul>
            {/* The templates guide covers the copy and the timing rules this
                banner can only gesture at. */}
            <KnowledgeBaseLinks locale={locale} route="/campaigns" className="mt-2" />
          </div>
          <Input
            label={t.nameLabel}
            id="campaign-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.namePlaceholder}
          />
          <Textarea
            label={t.descriptionLabel}
            id="campaign-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t.descriptionPlaceholder}
          />
          <Select
            label={t.channelLabel}
            id="campaign-channel"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
            options={[
              { value: "EMAIL", label: t.channelLabels.EMAIL },
              { value: "SMS", label: t.channelLabels.SMS },
            ]}
          />
          <Input
            label={t.locationLabel}
            id="campaign-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t.locationPlaceholder}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {t.createCampaign}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
