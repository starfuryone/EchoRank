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

export default function CampaignsPage() {
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
      if (!res.ok) throw new Error("Failed to load campaigns");
      const json = await res.json();
      setCampaigns(json.campaigns ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!res.ok) throw new Error("Failed to create campaign");
      setModalOpen(false);
      setForm({ name: "", description: "", channel: "EMAIL", location: "" });
      fetchCampaigns();
    } catch {
      alert("Failed to create campaign. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
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
      header: "Status",
      render: (c: Campaign) => (
        <Badge variant={STATUS_BADGE[c.status] ?? "default"}>
          {c.status}
        </Badge>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (c: Campaign) => (
        <Badge variant="default">{c.channel}</Badge>
      ),
    },
    {
      key: "totalSent",
      header: "Sent",
      render: (c: Campaign) => (
        <span className="text-gray-900 font-medium">{c.totalSent}</span>
      ),
    },
    {
      key: "totalResponses",
      header: "Responses",
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
      header: "Location",
      render: (c: Campaign) => (
        <span className="text-gray-600">{c.location ?? "--"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (c: Campaign) => (
        <span className="text-gray-500">{formatDate(c.createdAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to load campaigns</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
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
            title="No campaigns yet"
            description="Create your first campaign to start collecting feedback at scale."
            actionLabel="Create Campaign"
            onAction={() => setModalOpen(true)}
            icon={<Megaphone className="h-12 w-12" />}
          />
        ) : (
          <DataTable<Campaign & Record<string, unknown>>
            columns={columns}
            data={campaigns as (Campaign & Record<string, unknown>)[]}
            keyField="id"
          />
        )}
      </Card>

      {/* Create Campaign Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Campaign"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Campaign Name"
            id="campaign-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Q1 Feedback Campaign"
          />
          <Textarea
            label="Description"
            id="campaign-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the purpose of this campaign..."
          />
          <Select
            label="Channel"
            id="campaign-channel"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
            options={[
              { value: "EMAIL", label: "Email" },
              { value: "SMS", label: "SMS" },
            ]}
          />
          <Input
            label="Location (optional)"
            id="campaign-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="New York, NY"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create Campaign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
