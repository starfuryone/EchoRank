"use client";

// White-Label Audit Funnels — config CRUD, the embed snippet, and the leads
// table for each funnel.
//
// ── One expanded funnel at a time ───────────────────────────────────────────
// Leads are fetched only for the funnel the agency has open. An agency with a
// dozen funnels and a few thousand leads each would otherwise pull all of it on
// mount to render tables nobody is looking at. The list itself carries a lead
// COUNT from the server, which is the number that has to be visible without
// expanding anything.
//
// ── The origin list is a textarea, and validated server-side ────────────────
// One origin per line, sent as an array, and the server returns the ones it
// refused with a reason. The client does not pre-validate: origins.ts is the
// single implementation, and a second copy of the https/wildcard/path rules
// here would be one that disagrees with it eventually. What the client DOES do
// is show the rejections, because a silent drop is how an agency ends up
// filing "the widget doesn't work on our staging site".
//
// Light mode only, deliberately: this dashboard has no dark theme — there is no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second set of styles would be unreachable code.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SEO_TOOLS_COPY, FUNNELS_COPY, type DashLocale } from "@/lib/i18n/dashboard";

type Copy = (typeof FUNNELS_COPY)[DashLocale];

const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

interface Branding {
  name?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
}

interface Funnel {
  id: string;
  label: string;
  key: string;
  allowedOrigins: string[];
  branding: Branding | null;
  notifyEmail: string | null;
  active: boolean;
  createdAt: string;
  leadCount: number;
}

interface Lead {
  id: string;
  email: string;
  domain: string;
  score: number | null;
  createdAt: string;
}

interface Rejection {
  raw: string;
  reason: string;
}

interface FormState {
  label: string;
  origins: string;
  notifyEmail: string;
  brandName: string;
  brandLogoUrl: string;
  brandAccent: string;
}

const EMPTY_FORM: FormState = {
  label: "",
  origins: "",
  notifyEmail: "",
  brandName: "",
  brandLogoUrl: "",
  brandAccent: "",
};

function formFor(funnel: Funnel): FormState {
  return {
    label: funnel.label,
    origins: funnel.allowedOrigins.join("\n"),
    notifyEmail: funnel.notifyEmail ?? "",
    brandName: funnel.branding?.name ?? "",
    brandLogoUrl: funnel.branding?.logoUrl ?? "",
    brandAccent: funnel.branding?.accentColor ?? "",
  };
}

/** The body a create or patch sends. Origins are split on newlines, not parsed. */
function payloadFor(form: FormState) {
  return {
    label: form.label,
    allowedOrigins: form.origins
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter(Boolean),
    notifyEmail: form.notifyEmail,
    branding: {
      name: form.brandName,
      logoUrl: form.brandLogoUrl,
      accentColor: form.brandAccent,
    },
  };
}

export function FunnelsClient({
  locale,
  locked,
  siteUrl,
}: {
  locale: DashLocale;
  locked: boolean;
  siteUrl: string;
}) {
  const copy: Copy = FUNNELS_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.audit_funnels;
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale]);
  const df = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  // Seeded from `locked` rather than set to false inside the effect below: a
  // locked tenant never fetches, so it is never loading, and expressing that as
  // initial state keeps the effect free of a synchronous setState.
  const [loading, setLoading] = useState(!locked);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [rejected, setRejected] = useState<Rejection[]>([]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsCursor, setLeadsCursor] = useState<string | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Fetchers are PURE of state ────────────────────────────────────────────
  // They fetch and return; the caller decides what to store. That is the
  // sibling tool clients' shape, and it is what lets the mount effect below
  // apply its own cancelled guard rather than racing an unmount.
  async function fetchFunnels() {
    const res = await fetch("/api/agency/funnels");
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  // Mount load. The cancelled flag matters because an agency clicking through
  // the tool hub can unmount this before the response lands.
  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    void (async () => {
      try {
        const json = await fetchFunnels();
        if (cancelled) return;
        setFunnels(json.funnels ?? []);
        setQuota(json.quota ?? null);
        setError(null);
      } catch {
        if (!cancelled) setError(copy.errorLoad);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locked, copy.errorLoad]);

  /** Refresh after a mutation. Called from event handlers, never from an effect. */
  const loadFunnels = useCallback(async () => {
    try {
      const json = await fetchFunnels();
      setFunnels(json.funnels ?? []);
      setQuota(json.quota ?? null);
      setError(null);
    } catch {
      setError(copy.errorLoad);
    }
  }, [copy.errorLoad]);

  const loadLeads = useCallback(
    async (funnelId: string, cursor?: string) => {
      setLeadsLoading(true);
      try {
        const url = cursor
          ? `/api/agency/funnels/${funnelId}/leads?cursor=${encodeURIComponent(cursor)}`
          : `/api/agency/funnels/${funnelId}/leads`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        // Append on a cursor fetch, replace on the first page — otherwise
        // "show more" twice would duplicate the first page.
        setLeads((prev) => (cursor ? [...prev, ...(json.items ?? [])] : (json.items ?? [])));
        setLeadsCursor(json.nextCursor ?? null);
      } catch {
        setError(copy.errorLoad);
      } finally {
        setLeadsLoading(false);
      }
    },
    [copy.errorLoad],
  );

  function toggleOpen(funnelId: string) {
    if (openId === funnelId) {
      setOpenId(null);
      setLeads([]);
      setLeadsCursor(null);
      return;
    }
    setOpenId(funnelId);
    setLeads([]);
    setLeadsCursor(null);
    void loadLeads(funnelId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setError(null);
    setRejected([]);
    try {
      const editing = editingId !== null;
      const res = await fetch(
        editing ? `/api/agency/funnels/${editingId}` : "/api/agency/funnels",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFor(form)),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? copy.errorSave);
        return;
      }
      // Rejections are shown even on success: six of eight origins saved is a
      // success with two things the agency has to know about.
      setRejected(json.rejected ?? []);
      setCreating(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadFunnels();
    } catch {
      setError(copy.errorSave);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(funnel: Funnel) {
    setError(null);
    try {
      // Only `active` is sent. Every other field is absent and the server
      // leaves it alone — see the note in the PATCH route.
      const res = await fetch(`/api/agency/funnels/${funnel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !funnel.active }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await loadFunnels();
    } catch {
      setError(copy.errorSave);
    }
  }

  async function remove(funnel: Funnel) {
    // Destructive and cascading. The confirmation lives here rather than in the
    // API, which does what it is told.
    if (!window.confirm(copy.removeConfirm)) return;
    setError(null);
    try {
      const res = await fetch(`/api/agency/funnels/${funnel.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      if (openId === funnel.id) setOpenId(null);
      await loadFunnels();
    } catch {
      setError(copy.errorDelete);
    }
  }

  function snippetFor(funnel: Funnel): string {
    return `<script async src="${siteUrl}/api/public/funnel.js?key=${funnel.key}"></script>`;
  }

  async function copySnippet(funnel: Funnel) {
    try {
      await navigator.clipboard.writeText(snippetFor(funnel));
      setCopiedId(funnel.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* Clipboard denied. The snippet is on screen and selectable regardless. */
    }
  }

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
      </div>
    </div>
  );

  // ── Locked (below Agency) ──────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copy.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formPanel = (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          {editingId ? copy.edit : copy.createTitle}
        </h3>

        <div>
          <label htmlFor="fn-label" className="block text-sm font-medium text-gray-700">
            {copy.labelLabel}
          </label>
          <input
            id="fn-label"
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">{copy.labelHint}</p>
        </div>

        <div>
          <label htmlFor="fn-origins" className="block text-sm font-medium text-gray-700">
            {copy.originsLabel}
          </label>
          <textarea
            id="fn-origins"
            rows={4}
            value={form.origins}
            onChange={(e) => setForm({ ...form, origins: e.target.value })}
            placeholder="https://acme.com"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">{copy.originsHint}</p>
        </div>

        <div>
          <label htmlFor="fn-notify" className="block text-sm font-medium text-gray-700">
            {copy.notifyLabel}
          </label>
          <input
            id="fn-notify"
            type="email"
            value={form.notifyEmail}
            onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">{copy.notifyHint}</p>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-900">{copy.brandingTitle}</h4>
          <p className="mt-1 text-xs text-gray-500">{copy.brandingHint}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="fn-brand-name" className="block text-sm font-medium text-gray-700">
                {copy.brandNameLabel}
              </label>
              <input
                id="fn-brand-name"
                type="text"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="fn-brand-accent" className="block text-sm font-medium text-gray-700">
                {copy.brandAccentLabel}
              </label>
              <input
                id="fn-brand-accent"
                type="text"
                value={form.brandAccent}
                onChange={(e) => setForm({ ...form, brandAccent: e.target.value })}
                placeholder="#334155"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="fn-brand-logo" className="block text-sm font-medium text-gray-700">
              {copy.brandLogoLabel}
            </label>
            <input
              id="fn-brand-logo"
              type="url"
              value={form.brandLogoUrl}
              onChange={(e) => setForm({ ...form, brandLogoUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">{copy.brandLogoHint}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? (editingId ? copy.saving : copy.creating) : editingId ? copy.save : copy.create}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setEditingId(null);
              setForm(EMPTY_FORM);
              setRejected([]);
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {copy.cancel}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {header}

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200"
        >
          {error}
        </div>
      )}

      {/* Rejected origins. Shown after a save, never swallowed. */}
      {rejected.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-medium">{copy.errorOrigins}</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {rejected.map((r, i) => (
              <li key={`${r.raw}-${i}`}>
                {r.raw} — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quota. Interpolated from the API, never a hardcoded plan number. */}
      {quota && (
        <p className="text-sm text-gray-500">
          {interpolate(copy.quotaLine, {
            used: nf.format(quota.used),
            limit: nf.format(quota.limit),
          })}
        </p>
      )}

      {(creating || editingId) && formPanel}

      {!creating && !editingId && (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setForm(EMPTY_FORM);
            setRejected([]);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.create}
        </button>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">{copy.loading}</p>
      ) : funnels.length === 0 && !creating ? (
        <Card>
          <CardContent>
            <div className="py-12 text-center">
              <h3 className="text-base font-semibold text-gray-900">{copy.emptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{copy.emptyBody}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        funnels.map((funnel) => (
          <Card key={funnel.id}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {funnel.label}
                    </h3>
                    <span
                      className={
                        funnel.active
                          ? "rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200"
                          : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200"
                      }
                    >
                      {funnel.active ? copy.activeLabel : copy.inactiveLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {nf.format(funnel.leadCount)} {copy.leadCountLabel}
                    {funnel.allowedOrigins.length > 0 && (
                      <> · {funnel.allowedOrigins.join(", ")}</>
                    )}
                  </p>
                  {funnel.allowedOrigins.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">{copy.errorNoOrigins}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(funnel)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {funnel.active ? copy.togglePause : copy.toggleActivate}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(funnel.id);
                      setCreating(false);
                      setForm(formFor(funnel));
                      setRejected([]);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {copy.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(funnel)}
                    aria-label={copy.remove}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* ── Embed snippet ── */}
              <div className="rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {copy.snippetTitle}
                  </h4>
                  <button
                    type="button"
                    onClick={() => void copySnippet(funnel)}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {copiedId === funnel.id ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copiedId === funnel.id ? copy.snippetCopied : copy.snippetCopy}
                  </button>
                </div>
                <code className="mt-2 block overflow-x-auto whitespace-pre text-xs text-gray-700">
                  {snippetFor(funnel)}
                </code>
                <p className="mt-2 text-xs text-gray-500">{copy.snippetHint}</p>
              </div>

              {/* ── Leads ── */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleOpen(funnel.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {copy.leadsTitle} ({nf.format(funnel.leadCount)})
                  </button>
                  {openId === funnel.id && funnel.leadCount > 0 && (
                    <a
                      href={`/api/agency/funnels/${funnel.id}/leads/export`}
                      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.exportCsv}
                    </a>
                  )}
                </div>

                {openId === funnel.id && (
                  <div className="mt-3">
                    {leadsLoading && leads.length === 0 ? (
                      <p className="text-sm text-gray-500">{copy.loading}</p>
                    ) : leads.length === 0 ? (
                      <p className="text-sm text-gray-500">{copy.leadsEmpty}</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-4 font-medium">{copy.colEmail}</th>
                                <th className="py-2 pr-4 font-medium">{copy.colDomain}</th>
                                <th className="py-2 pr-4 font-medium">{copy.colScore}</th>
                                <th className="py-2 font-medium">{copy.colCaptured}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leads.map((lead) => (
                                <tr key={lead.id} className="border-b border-gray-100">
                                  <td className="py-2 pr-4 text-gray-900">{lead.email}</td>
                                  <td className="py-2 pr-4 text-gray-600">{lead.domain}</td>
                                  <td className="py-2 pr-4 text-gray-900">
                                    {lead.score === null ? (
                                      <span title={copy.noScoreHint} className="text-gray-400">
                                        {copy.noScore}
                                      </span>
                                    ) : (
                                      nf.format(lead.score)
                                    )}
                                  </td>
                                  <td className="py-2 text-gray-500">
                                    {df.format(new Date(lead.createdAt))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {leadsCursor && (
                          <button
                            type="button"
                            onClick={() => void loadLeads(funnel.id, leadsCursor)}
                            disabled={leadsLoading}
                            className="mt-3 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                          >
                            {leadsLoading ? copy.loading : copy.loadMore}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <p className="text-xs leading-relaxed text-gray-500">{copy.methodNote}</p>
    </div>
  );
}
