"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Plus,
  Mail,
  MessageSquare,
  AlertCircle,
  Pencil,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TemplatesHelpModal } from "./help-modal";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { TEMPLATES_COPY, type DashLocale } from "@/lib/i18n/dashboard";

interface Template {
  id: string;
  name: string;
  type: string;
  channel: string;
  subject: string | null;
  body: string;
  updatedAt: string;
  createdAt: string;
}

const CHANNEL_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  EMAIL: "info",
  SMS: "success",
};

export function TemplatesPageClient({ locale }: { locale: DashLocale }) {
  const t = TEMPLATES_COPY[locale];
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"EMAIL" | "SMS">("EMAIL");
  const [modalOpen, setModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "feedback_request",
    channel: "EMAIL",
    subject: "",
    body: "",
  });

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setTemplates(json.templates ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed, t.genericError]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setForm({
      name: "",
      type: "feedback_request",
      channel: activeTab,
      subject: "",
      body: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      type: template.type,
      channel: template.channel,
      subject: template.subject ?? "",
      body: template.body,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(t.saveFailed);
      setModalOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      alert(t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.deleteFailed);
      fetchTemplates();
    } catch {
      alert(t.deleteFailed);
    } finally {
      setDeleting(null);
    }
  };

  const filteredTemplates = templates.filter((tpl) => tpl.channel === activeTab);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          {t.errorTitle}
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
            {t.createTemplate}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("EMAIL")}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === "EMAIL"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Mail className="h-4 w-4" />
            {t.tabEmail}
            <Badge variant={activeTab === "EMAIL" ? "info" : "default"}>
              {templates.filter((tpl) => tpl.channel === "EMAIL").length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab("SMS")}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === "SMS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            {t.tabSms}
            <Badge variant={activeTab === "SMS" ? "info" : "default"}>
              {templates.filter((tpl) => tpl.channel === "SMS").length}
            </Badge>
          </button>
        </nav>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <EmptyState
            title={t.emptyTitle(activeTab)}
            description={t.emptyDescription}
            actionLabel={t.createTemplate}
            onAction={openCreateModal}
            icon={<FileText className="h-12 w-12" />}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {template.name}
                      </h3>
                      <Badge variant="default">
                        {t.typeLabels[template.type] ?? template.type}
                      </Badge>
                      <Badge variant={CHANNEL_BADGE[template.channel] ?? "default"}>
                        {t.channelLabels[template.channel] ?? template.channel}
                      </Badge>
                    </div>
                    {template.subject && (
                      <p className="mt-1 text-sm text-gray-600">
                        {t.subjectLine(template.subject)}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500 truncate max-w-2xl">
                      {template.body}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {t.lastModified(formatDate(template.updatedAt, locale))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={deleting === template.id}
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? t.modalEditTitle : t.modalCreateTitle}
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t.nameLabel}
            id="template-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.namePlaceholder}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t.typeLabel}
              id="template-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: "feedback_request", label: t.typeLabels.feedback_request },
                { value: "review_request", label: t.typeLabels.review_request },
                { value: "recovery", label: t.typeLabels.recovery },
              ]}
            />
            <Select
              label={t.channelLabel}
              id="template-channel"
              value={form.channel}
              onChange={(e) =>
                setForm({ ...form, channel: e.target.value })
              }
              options={[
                { value: "EMAIL", label: t.channelLabels.EMAIL },
                { value: "SMS", label: t.channelLabels.SMS },
              ]}
            />
          </div>
          {form.channel === "EMAIL" && (
            <Input
              label={t.subjectLabel}
              id="template-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder={t.subjectPlaceholder}
            />
          )}
          <Textarea
            label={t.bodyLabel}
            id="template-body"
            required
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={t.bodyPlaceholder}
            rows={6}
          />
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600 mb-1">
              {t.placeholdersTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "{{customer_name}}",
                "{{business_name}}",
                "{{feedback_link}}",
                "{{review_link}}",
              ].map((ph) => (
                <code
                  key={ph}
                  className="rounded bg-white px-2 py-0.5 text-xs text-blue-600 border border-gray-200 cursor-pointer hover:bg-blue-50"
                  onClick={() =>
                    setForm({ ...form, body: form.body + " " + ph })
                  }
                >
                  {ph}
                </code>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {editingTemplate ? t.saveChanges : t.createTemplate}
            </Button>
          </div>
        </form>
      </Modal>

      <TemplatesHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} locale={locale} />
    </div>
  );
}
