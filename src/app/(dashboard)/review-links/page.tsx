"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ExternalLink,
  Plus,
  AlertCircle,
  Star,
  MousePointerClick,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Pencil,
  Globe,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface ReviewLink {
  id: string;
  platform: string;
  url: string;
  label: string | null;
  location: string | null;
  clicks: number;
  isDefault: boolean;
  createdAt: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  Google: "🟢",
  Facebook: "🔵",
  Trustpilot: "🟢",
  Yelp: "🔴",
  Other: "🔗",
};

const PLATFORM_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  Google: "success",
  Facebook: "info",
  Trustpilot: "success",
  Yelp: "danger",
  Other: "default",
};

function ReviewLinksHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="How review links work">
      {/* Animated flow graphic */}
      <style>{`
        @keyframes erTravel {
          0% { transform: translateX(0); opacity: 0; }
          8% { opacity: 1; }
          46% { transform: translateX(190px); opacity: 1; }
          54% { transform: translateX(190px); opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translateX(380px); opacity: 0; }
        }
        .er-star { animation: erTravel 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .er-star { animation: none; transform: translateX(190px); }
        }
      `}</style>
      <div className="rounded-lg bg-gray-50 p-4">
        <svg viewBox="0 0 520 170" className="w-full" role="img" aria-label="Flow: customer feedback to your review link to the public review platform">
          <defs>
            <marker id="erAh" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#cbd5e1" />
            </marker>
          </defs>
          <line x1="120" y1="85" x2="218" y2="85" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erAh)" />
          <line x1="302" y1="85" x2="400" y2="85" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#erAh)" />
          <g>
            <rect x="20" y="55" width="100" height="60" rx="10" fill="#f1f5f9" stroke="#e2e8f0" />
            <text x="70" y="80" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0f172a">Customer</text>
            <text x="70" y="97" textAnchor="middle" fontSize="11" fill="#64748b">feedback</text>
          </g>
          <g>
            <rect x="220" y="53" width="80" height="64" rx="10" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
            <text x="260" y="79" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2563eb">Your</text>
            <text x="260" y="95" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2563eb">link</text>
          </g>
          <g>
            <rect x="400" y="55" width="100" height="60" rx="10" fill="#f0fdf4" stroke="#86efac" />
            <text x="450" y="80" textAnchor="middle" fontSize="11" fontWeight="600" fill="#15803d">Google /</text>
            <text x="450" y="97" textAnchor="middle" fontSize="11" fill="#16a34a">Facebook</text>
          </g>
          <text x="120" y="91" fontSize="18" fill="#f59e0b" className="er-star">★</text>
        </svg>
      </div>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
        <p>
          A <strong>review link</strong> is the public URL where a customer
          leaves a review — your Google, Facebook, or Trustpilot page. When a
          customer is invited to review you, this link is where they go.
        </p>
        <p>
          <strong>Finding your Google link:</strong> in your Google Business
          Profile, use the &ldquo;Ask for reviews&rdquo; share link, or a
          write-a-review URL of the form
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">https://g.page/r/&hellip;/review</code>.
          Set this one as Default so it is used when no platform-specific link
          applies.
        </p>
        <p>
          <strong>Default</strong> marks the link customers are sent to by
          default. <strong>Clicks</strong> counts how many times each link has
          been opened, so you can see which platform customers use most.
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

export default function ReviewLinksPage() {
  const [links, setLinks] = useState<ReviewLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ReviewLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    platform: "Google",
    url: "",
    label: "",
    location: "",
    isDefault: false,
  });

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/review-links");
      if (!res.ok) throw new Error("Failed to load review links");
      const json = await res.json();
      setLinks(json.links ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const openCreateModal = () => {
    setEditingLink(null);
    setForm({ platform: "Google", url: "", label: "", location: "", isDefault: false });
    setModalOpen(true);
  };

  const openEditModal = (link: ReviewLink) => {
    setEditingLink(link);
    setForm({
      platform: link.platform,
      url: link.url,
      label: link.label ?? "",
      location: link.location ?? "",
      isDefault: link.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      const url = editingLink
        ? `/api/review-links/${editingLink.id}`
        : "/api/review-links";
      const method = editingLink ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save review link");
      setModalOpen(false);
      setEditingLink(null);
      fetchLinks();
    } catch {
      alert("Failed to save review link. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefault = async (link: ReviewLink) => {
    try {
      const res = await fetch(`/api/review-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: !link.isDefault }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchLinks();
    } catch {
      alert("Failed to update review link.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review link?")) return;
    try {
      const res = await fetch(`/api/review-links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchLinks();
    } catch {
      alert("Failed to delete review link.");
    }
  };

  const columns = [
    {
      key: "platform",
      header: "Platform",
      render: (l: ReviewLink) => (
        <div className="flex items-center gap-2">
          <span>{PLATFORM_ICONS[l.platform] ?? "🔗"}</span>
          <Badge variant={PLATFORM_BADGE[l.platform] ?? "default"}>
            {l.platform}
          </Badge>
        </div>
      ),
    },
    {
      key: "url",
      header: "URL",
      render: (l: ReviewLink) => (
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline truncate max-w-xs"
        >
          {l.url}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ),
    },
    {
      key: "label",
      header: "Label",
      render: (l: ReviewLink) => (
        <span className="text-gray-600">{l.label || "--"}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (l: ReviewLink) => (
        <span className="text-gray-600">{l.location || "--"}</span>
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      render: (l: ReviewLink) => (
        <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <MousePointerClick className="h-3.5 w-3.5 text-gray-400" />
          {l.clicks}
        </span>
      ),
    },
    {
      key: "isDefault",
      header: "Default",
      render: (l: ReviewLink) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleDefault(l);
          }}
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title={l.isDefault ? "Remove as default" : "Set as default"}
        >
          {l.isDefault ? (
            <ToggleRight className="h-6 w-6 text-blue-600" />
          ) : (
            <ToggleLeft className="h-6 w-6" />
          )}
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (l: ReviewLink) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(l);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(l.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load review links
        </h2>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Links</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage links where customers can leave public reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Review Link
          </Button>
        </div>
      </div>

      <ReviewLinksHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            title="No review links yet"
            description="Add your review platform links so customers can be directed to leave public reviews."
            actionLabel="Add Review Link"
            onAction={openCreateModal}
            icon={<Globe className="h-12 w-12" />}
          />
        ) : (
          <DataTable<ReviewLink & Record<string, unknown>>
            columns={columns}
            data={links as (ReviewLink & Record<string, unknown>)[]}
            keyField="id"
          />
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLink ? "Edit Review Link" : "Add Review Link"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Platform"
            id="link-platform"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            options={[
              { value: "Google", label: "Google" },
              { value: "Facebook", label: "Facebook" },
              { value: "Trustpilot", label: "Trustpilot" },
              { value: "Yelp", label: "Yelp" },
              { value: "Other", label: "Other" },
            ]}
          />
          <Input
            label="URL"
            id="link-url"
            type="url"
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://g.page/r/your-business/review"
          />
          <Input
            label="Label (optional)"
            id="link-label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. Main Location Google"
          />
          <Input
            label="Location (optional)"
            id="link-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Downtown Office"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm({ ...form, isDefault: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Set as default review link
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingLink ? "Save Changes" : "Add Link"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
