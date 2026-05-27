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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

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

const TYPE_LABELS: Record<string, string> = {
  feedback_request: "Feedback Request",
  review_request: "Review Request",
  recovery: "Recovery",
};

const CHANNEL_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  EMAIL: "info",
  SMS: "success",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"EMAIL" | "SMS">("EMAIL");
  const [modalOpen, setModalOpen] = useState(false);
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
      if (!res.ok) throw new Error("Failed to load templates");
      const json = await res.json();
      setTemplates(json.templates ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!res.ok) throw new Error("Failed to save template");
      setModalOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      alert("Failed to save template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      fetchTemplates();
    } catch {
      alert("Failed to delete template. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const filteredTemplates = templates.filter((t) => t.channel === activeTab);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load templates
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
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your email and SMS templates for feedback and review requests.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
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
            Email Templates
            <Badge variant={activeTab === "EMAIL" ? "info" : "default"}>
              {templates.filter((t) => t.channel === "EMAIL").length}
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
            SMS Templates
            <Badge variant={activeTab === "SMS" ? "info" : "default"}>
              {templates.filter((t) => t.channel === "SMS").length}
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
            title={`No ${activeTab.toLowerCase()} templates`}
            description="Create a template to streamline your feedback collection process."
            actionLabel="Create Template"
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
                        {TYPE_LABELS[template.type] ?? template.type}
                      </Badge>
                      <Badge variant={CHANNEL_BADGE[template.channel] ?? "default"}>
                        {template.channel}
                      </Badge>
                    </div>
                    {template.subject && (
                      <p className="mt-1 text-sm text-gray-600">
                        Subject: {template.subject}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500 truncate max-w-2xl">
                      {template.body}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      Last modified: {formatDate(template.updatedAt)}
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
        title={editingTemplate ? "Edit Template" : "Create Template"}
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Template Name"
            id="template-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Post-Purchase Feedback"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              id="template-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: "feedback_request", label: "Feedback Request" },
                { value: "review_request", label: "Review Request" },
                { value: "recovery", label: "Recovery" },
              ]}
            />
            <Select
              label="Channel"
              id="template-channel"
              value={form.channel}
              onChange={(e) =>
                setForm({ ...form, channel: e.target.value })
              }
              options={[
                { value: "EMAIL", label: "Email" },
                { value: "SMS", label: "SMS" },
              ]}
            />
          </div>
          {form.channel === "EMAIL" && (
            <Input
              label="Subject"
              id="template-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="We'd love your feedback, {{customer_name}}!"
            />
          )}
          <Textarea
            label="Body"
            id="template-body"
            required
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Hi {{customer_name}}, thank you for choosing {{business_name}}..."
            rows={6}
          />
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600 mb-1">
              Available placeholders:
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
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
