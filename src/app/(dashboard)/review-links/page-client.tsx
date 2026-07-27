"use client";

import Link from "next/link";
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
import { ShareToolsCard } from "./share-tools";
import {
  REVIEW_LINKS_COPY,
  type DashLocale,
  type ReviewLinksCopy,
} from "@/lib/i18n/dashboard";

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

/** Link shapes are identical in every locale, so they live here, not in i18n. */
const PLACE_ID_FINDER_URL =
  "https://developers.google.com/maps/documentation/places/web-service/place-id";
const EXT_DOWNLOAD_URL = "https://echorank360.com/extension/download.html";
const EXT_HOWTO_URL =
  "https://echorank360.com/extension/howto-import-reviews.html";
const WRITE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=<PLACE_ID>";
const VIEW_REVIEWS_URL =
  "https://search.google.com/local/reviews?placeid=<PLACE_ID>";

const extLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer",
  className: "text-blue-600 hover:underline",
} as const;

function UrlCard({ label, url }: { label: string; url: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="mb-1 text-xs font-semibold text-gray-900">{label}</p>
      <code className="block break-all font-mono text-xs text-gray-600">
        {url}
      </code>
    </div>
  );
}

function ReviewLinksHelpModal({
  open,
  onClose,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  copy: ReviewLinksCopy["helpModal"];
}) {
  return (
    <Modal open={open} onClose={onClose} title={copy.title} closeLabel={copy.close}>
      <div className="space-y-5 text-sm leading-relaxed text-gray-600">
        <div className="space-y-3">
          <p>{copy.intro}</p>
          <UrlCard label={copy.writeLabel} url={WRITE_REVIEW_URL} />
          <UrlCard label={copy.viewLabel} url={VIEW_REVIEWS_URL} />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            {copy.placeIdTitle}
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-gray-900">{copy.finderStrong}</strong>{" "}
              <a href={PLACE_ID_FINDER_URL} {...extLinkProps}>
                {copy.finderLink}
              </a>
              {copy.finderAfter}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                ChIJ&hellip;
              </code>
            </li>
            <li>
              <strong className="text-gray-900">{copy.ownStrong}</strong>
              {copy.ownTextA}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                g.page/r/&hellip;/review
              </code>
              {copy.ownTextB}
            </li>
          </ol>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            {copy.importTitle}
          </h3>
          <p>{copy.importIntro}</p>
          <p className="mt-2">
            <a href={EXT_DOWNLOAD_URL} {...extLinkProps}>
              <span className="break-all">{EXT_DOWNLOAD_URL}</span>
            </a>
          </p>
          <p className="mt-2">
            {copy.guideLabel}{" "}
            <a href={EXT_HOWTO_URL} {...extLinkProps}>
              {copy.guideLink}
            </a>
          </p>
          <p className="mt-2">
            <Link href="/extension" className="text-blue-600 hover:underline">
              {copy.extensionInApp}
            </Link>
          </p>
        </section>
      </div>

      <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {copy.close}
        </Button>
      </div>
    </Modal>
  );
}

export function ReviewLinksPageClient({ locale }: { locale: DashLocale }) {
  const t = REVIEW_LINKS_COPY[locale];
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
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setLinks(json.links ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed, t.genericError]);

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
      if (!res.ok) throw new Error(t.saveFailed);
      setModalOpen(false);
      setEditingLink(null);
      fetchLinks();
    } catch {
      alert(t.saveFailed);
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
      if (!res.ok) throw new Error(t.updateFailed);
      fetchLinks();
    } catch {
      alert(t.updateFailed);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/review-links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.deleteFailed);
      fetchLinks();
    } catch {
      alert(t.deleteFailed);
    }
  };

  const columns = [
    {
      key: "platform",
      header: t.colPlatform,
      render: (l: ReviewLink) => (
        <div className="flex items-center gap-2">
          <span>{PLATFORM_ICONS[l.platform] ?? "🔗"}</span>
          <Badge variant={PLATFORM_BADGE[l.platform] ?? "default"}>
            {t.platformLabels[l.platform] ?? l.platform}
          </Badge>
        </div>
      ),
    },
    {
      key: "url",
      header: t.colUrl,
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
      header: t.colLabel,
      render: (l: ReviewLink) => (
        <span className="text-gray-600">{l.label || "--"}</span>
      ),
    },
    {
      key: "location",
      header: t.colLocation,
      render: (l: ReviewLink) => (
        <span className="text-gray-600">{l.location || "--"}</span>
      ),
    },
    {
      key: "clicks",
      header: t.colClicks,
      render: (l: ReviewLink) => (
        <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <MousePointerClick className="h-3.5 w-3.5 text-gray-400" />
          {l.clicks}
        </span>
      ),
    },
    {
      key: "isDefault",
      header: t.colDefault,
      render: (l: ReviewLink) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleDefault(l);
          }}
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title={l.isDefault ? t.removeDefault : t.setDefault}
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
          {t.loadFailed}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            {t.helpButton}
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            {t.addLink}
          </Button>
        </div>
      </div>

      <ReviewLinksHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        copy={t.helpModal}
      />

      <ShareToolsCard links={links} loading={loading} locale={locale} />

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
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.addLink}
            onAction={openCreateModal}
            icon={<Globe className="h-12 w-12" />}
          />
        ) : (
          <DataTable<ReviewLink & Record<string, unknown>>
            columns={columns}
            data={links as (ReviewLink & Record<string, unknown>)[]}
            keyField="id"
            emptyMessage={t.tableEmpty}
          />
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLink ? t.modalEditTitle : t.modalAddTitle}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label={t.formPlatform}
            id="link-platform"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            options={[
              { value: "Google", label: "Google" },
              { value: "Facebook", label: "Facebook" },
              { value: "Trustpilot", label: "Trustpilot" },
              { value: "Yelp", label: "Yelp" },
              { value: "Other", label: t.platformLabels.Other ?? "Other" },
            ]}
          />
          <Input
            label={t.formUrl}
            id="link-url"
            type="url"
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder={t.formUrlPlaceholder}
          />
          <Input
            label={t.formLabel}
            id="link-label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={t.formLabelPlaceholder}
          />
          <Input
            label={t.formLocation}
            id="link-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t.formLocationPlaceholder}
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
              {t.setAsDefaultCheckbox}
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {editingLink ? t.saveChanges : t.addLinkSubmit}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
