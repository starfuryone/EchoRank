"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportsHelpButton } from "@/components/help/ImportsHelpButton";
import { IMPORTS_COPY, type DashLocale, type ImportsCopy } from "@/lib/i18n/dashboard";

const CANONICAL_FIELDS = [
  { key: "content", required: true },
  { key: "rating", required: false },
  { key: "author", required: false },
  { key: "publishedAt", required: false },
  { key: "url", required: false },
  { key: "authorUrl", required: false },
  { key: "externalId", required: false },
  { key: "language", required: false },
] as const;

const PLATFORM_VALUES = ["GOOGLE", "FACEBOOK", "TRUSTPILOT", "YELP", "APP_STORE", "CUSTOM"];

type Mapping = Record<string, string>;

interface Preview {
  importId: string;
  filename: string;
  platform: string;
  totalRows: number;
  columns: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Mapping;
}

interface ImportRow {
  id: string;
  filename: string;
  platform: string;
  status: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  failedRows: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING_MAPPING: "info",
  QUEUED: "info",
  PROCESSING: "warning",
  COMPLETED: "success",
  PARTIAL: "warning",
  FAILED: "danger",
  CANCELLED: "default",
};

const IGNORE = "__ignore__";

export function ImportsPageClient({ locale }: { locale: DashLocale }) {
  const t = IMPORTS_COPY[locale];
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [platform, setPlatform] = useState("CUSTOM");
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/imports");
      if (res.status === 403) {
        setGated(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load imports");
      const json = await res.json();
      setHistory(json.data ?? []);
    } catch {
      // non-fatal; leave history empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Poll any in-flight imports until they reach a terminal state.
  useEffect(() => {
    const active = history.some((h) =>
      ["QUEUED", "PROCESSING"].includes(h.status),
    );
    if (!active) return;
    const t = setInterval(loadHistory, 2500);
    return () => clearInterval(t);
  }, [history, loadHistory]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("hasHeaderRow", String(hasHeaderRow));
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.uploadFailed);
      const data: Preview = json.data;
      setPreview(data);
      setPlatform(data.platform || "CUSTOM");
      // Seed mapping from server suggestion.
      setMapping(data.suggestedMapping ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : t.uploadFailed);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setError(null);
    setCommitting(true);
    try {
      const cleanMapping: Mapping = {};
      for (const [field, col] of Object.entries(mapping)) {
        if (col && col !== IGNORE) cleanMapping[field] = col;
      }
      const res = await fetch(`/api/imports/${preview.importId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping: cleanMapping, platform, hasHeaderRow }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.commitFailed);
      setPreview(null);
      setMapping({});
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.commitFailed);
    } finally {
      setCommitting(false);
    }
  }

  const platformOptions = PLATFORM_VALUES.map((value) => ({
    value,
    label: t.platformLabels[value] ?? value,
  }));

  const columnOptions = preview
    ? [{ value: IGNORE, label: t.ignoreOption }, ...preview.columns.map((c) => ({ value: c, label: c }))]
    : [];

  const contentMapped = Boolean(mapping.content && mapping.content !== IGNORE);
  const ratingMapped = Boolean(mapping.rating && mapping.rating !== IGNORE);
  const canCommit = contentMapped || ratingMapped;

  if (gated) {
    return (
      <div className="space-y-6">
        <PageHeader t={t} locale={locale} />
        <Card>
          <CardContent>
            <EmptyState
              icon={<Database className="h-8 w-8 text-gray-400" />}
              title={t.gatedTitle}
              description={t.gatedDescription}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader t={t} locale={locale} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload */}
      {!preview && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">{t.uploadTitle}</h2>
            <p className="mt-1 text-sm text-gray-500">{t.uploadSubtitle}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">{t.dropHint}</p>
              <div className="mt-4 flex flex-col items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  {t.chooseFile}
                </Button>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                  />
                  {t.headerRow}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column mapper */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {t.mapTitle(preview.filename)}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t.rowsDetected(preview.totalRows)}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {t.cancel}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 max-w-xs">
              <Select
                id="platform"
                label={t.platformLabel}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                options={platformOptions}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CANONICAL_FIELDS.map((field) => (
                <Select
                  key={field.key}
                  id={`map-${field.key}`}
                  label={`${t.fieldLabels[field.key] ?? field.key}${field.required ? " *" : ""}`}
                  value={mapping[field.key] ?? IGNORE}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field.key]: e.target.value }))
                  }
                  options={columnOptions}
                />
              ))}
            </div>

            {/* Sample preview */}
            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {preview.columns.map((c) => (
                        <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {String(row[c] ?? "").slice(0, 60)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              {!canCommit && (
                <span className="text-xs text-gray-500">{t.mapHint}</span>
              )}
              <Button onClick={handleCommit} loading={committing} disabled={!canCommit}>
                {t.importButton(preview.totalRows)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">{t.historyTitle}</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">{t.loading}</p>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-gray-400" />}
              title={t.emptyTitle}
              description={t.emptyDescription}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-500">
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-2 text-left font-medium">{t.colFile}</th>
                    <th className="px-3 py-2 text-left font-medium">{t.colPlatform}</th>
                    <th className="px-3 py-2 text-left font-medium">{t.colStatus}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.colImported}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.colDuplicates}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.colFailed}</th>
                    <th className="px-3 py-2 text-left font-medium">{t.colWhen}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-gray-900">
                        <span className="flex items-center gap-2">
                          {row.status === "COMPLETED" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {row.filename}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.platformLabels[row.platform] ?? row.platform}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_BADGE[row.status] ?? "default"}>
                          {t.statusLabels[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">
                        {row.importedRows.toLocaleString(locale)}
                        <span className="text-gray-400"> / {row.totalRows.toLocaleString(locale)}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {row.duplicateRows.toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {row.failedRows > 0 ? (
                          <span className="text-amber-600">{row.failedRows}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(row.createdAt).toLocaleString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader({ t, locale }: { t: ImportsCopy; locale: DashLocale }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <ImportsHelpButton locale={locale} />
      </div>
  );
}
