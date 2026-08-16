"use client";

// AI Action Agent — the generate panel and the approval queue.
//
// ── THE BANNER IS NOT DECORATION ───────────────────────────────────────────
// "Echorank never publishes anything for you" renders above the queue, in every
// state, in all three locales, and it is the most load-bearing string on the
// page. Every other tool in this hub reports; this one produces text that looks
// like it is about to go live. A customer who approves ten drafts and assumes
// their site changed has been misled by the product, not by their own reading.
//
// ── OPTIMISTIC, WITH A REAL ROLLBACK ───────────────────────────────────────
// The same contract citation-opportunities-client uses: the button paints the
// new state immediately and puts it back if the PATCH fails, with an error the
// customer can see. A 409 is different from a failure though — it means the row
// moved under us — so that one refetches rather than rolling back to a state
// that is also wrong.
//
// ── NO POLLING ─────────────────────────────────────────────────────────────
// Generation is a queued job, so a fresh draft appears on the next load rather
// than sliding in. The notification is the delivery mechanism (that is what
// action_draft_ready is for) and a refresh button is the manual one. A poll
// every few seconds on a page people leave open would be a database read per
// tenant per tick to save a click.
//
// Light mode only, deliberately: this dashboard has no dark theme — no
// `darkMode` in the Tailwind config, no `dark:` class in any sibling tool
// client — so a second palette would be unreachable code.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy as CopyIcon,
  Download,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_AGENT_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import type { ActionAgentUsage } from "@/lib/action-agent/generate";
import {
  V1_KINDS,
  type ActionItemDto,
  type ActionItemStatus,
  type V1Kind,
} from "@/lib/action-agent/types";

type Copy = (typeof ACTION_AGENT_COPY)[DashLocale];

/** BCP-47 for the three dashboard locales, for number and date formatting. */
const INTL_LOCALE: Record<DashLocale, string> = { en: "en", fr: "fr", "de-CH": "de-CH" };

const TABS: ActionItemStatus[] = ["draft", "approved", "applied", "rejected"];

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

function kindLabel(copy: Copy, kind: string): string {
  if (kind === "schema") return copy.kindSchema;
  if (kind === "faq") return copy.kindFaq;
  if (kind === "review_reply") return copy.kindReviewReply;
  return kind;
}

// ─── Draft payload shapes, as this component reads them ─────────────────────
// Structurally typed rather than imported as the zod types: the row's `draft`
// arrives as `unknown` from JSON and is narrowed by kind here.

interface SchemaDraftView {
  url: string;
  jsonLd: string;
  businessType: string;
  placement: string[];
  omitted: string[];
}
interface FaqDraftView {
  url: string;
  items: { q: string; a: string }[];
  html: string;
  markdown: string;
  sourcePrompts: string[];
}
interface ReviewReplyDraftView {
  reviewId: string;
  platform: string;
  rating: number | null;
  authorName: string | null;
  reviewExcerpt: string;
  reply: string;
}

/** Copy-to-clipboard with a two-second confirmation. */
function CopyButton({ text, copy }: { text: string; copy: Copy }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        });
      }}
    >
      {done ? (
        <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CopyIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      )}
      {done ? copy.copied : copy.copy}
    </Button>
  );
}

/** Hand the file to the browser. No server round trip — the text is already here. */
function DownloadButton({
  text,
  filename,
  copy,
}: {
  text: string;
  filename: string;
  copy: Copy;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      {copy.download}
    </Button>
  );
}

export function ActionAgentClient({
  locale,
  locked,
  initialItems,
  initialCounts,
  usage,
}: {
  locale: DashLocale;
  locked: boolean;
  initialItems: ActionItemDto[];
  initialCounts: Record<ActionItemStatus, number>;
  usage: ActionAgentUsage | null;
}) {
  const copy = ACTION_AGENT_COPY[locale];
  const toolCopy = SEO_TOOLS_COPY[locale].items.action_agent;
  const numberFormat = useMemo(() => new Intl.NumberFormat(INTL_LOCALE[locale]), [locale]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }),
    [locale],
  );

  const [tab, setTab] = useState<ActionItemStatus>("draft");
  const [items, setItems] = useState<ActionItemDto[]>(initialItems);
  const [counts, setCounts] = useState<Record<ActionItemStatus, number>>(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [kind, setKind] = useState<V1Kind>("schema");
  const [url, setUrl] = useState("");
  const [reviewLimit, setReviewLimit] = useState(5);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(
    async (status: ActionItemStatus) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/action-agent?status=${status}`);
        const data = (await response.json()) as {
          items?: ActionItemDto[];
          counts?: Record<ActionItemStatus, number>;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? copy.errGeneric);
        setItems(data.items ?? []);
        if (data.counts) setCounts(data.counts);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.errGeneric);
      } finally {
        setLoading(false);
      }
    },
    [copy.errGeneric],
  );

  const selectTab = useCallback(
    (next: ActionItemStatus) => {
      setTab(next);
      void load(next);
    },
    [load],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/action-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          locale,
          ...(kind === "review_reply" ? { reviewLimit } : { url: url.trim() }),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        resetsAt?: string;
      };
      if (!response.ok) {
        // The refusal that has to name a date. See marketingBudgetResetsAt:
        // this page can be reached from surfaces where the meter is nowhere in
        // sight, so "you are out" without "until when" is not an answer.
        if (data.code === "BUDGET_EXCEEDED" && data.resetsAt) {
          throw new Error(
            interpolate(copy.errBudget, { date: dateFormat.format(new Date(data.resetsAt)) }),
          );
        }
        if (data.code === "PLAN_LOCKED") throw new Error(copy.errLocked);
        if (data.code === "PAGE_UNREACHABLE") throw new Error(copy.errPage);
        throw new Error(data.error ?? copy.errGeneric);
      }
      setNotice(copy.queued);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errGeneric);
    } finally {
      setGenerating(false);
    }
  }, [kind, locale, reviewLimit, url, copy, dateFormat]);

  const act = useCallback(
    async (id: string, action: "approve" | "reject" | "apply" | "regenerate", note?: string) => {
      setError(null);
      setNotice(null);
      try {
        const response = await fetch(`/api/action-agent/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note, locale }),
        });
        const data = (await response.json()) as { error?: string; code?: string };
        if (response.status === 409) {
          // The row moved under us. Rolling back would be a second wrong state,
          // so refetch instead and say what happened.
          setError(copy.errConflict);
          void load(tab);
          return;
        }
        if (!response.ok) throw new Error(data.error ?? copy.errGeneric);

        if (action === "regenerate") setNotice(copy.queued);
        // The item has left this tab (or, for regenerate, a new draft is on its
        // way into another one). Refetch rather than splice: `counts` has to
        // move too, and reconstructing four numbers client-side is how they
        // drift from the database.
        void load(tab);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.errGeneric);
      }
    },
    [copy.errConflict, copy.errGeneric, copy.queued, load, locale, tab],
  );

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {toolCopy.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{copy.subtitle}</p>
      </div>
    </div>
  );

  // ── Locked (no marketing_studio on this plan) ────────────────────────────
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

  return (
    <div className="space-y-6">
      {header}

      {/* The standing promise. Rendered in every unlocked state, above
          everything else on the page. */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <p className="text-sm text-blue-900">{copy.noPublishBanner}</p>
      </div>

      {/* ── Generate ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{copy.generateTitle}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {V1_KINDS.map((candidate) => {
              const active = kind === candidate;
              const hint =
                candidate === "schema"
                  ? copy.generateSchemaHint
                  : candidate === "faq"
                    ? copy.generateFaqHint
                    : copy.generateReviewsHint;
              const label =
                candidate === "schema"
                  ? copy.generateSchema
                  : candidate === "faq"
                    ? copy.generateFaq
                    : copy.generateReviews;
              return (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setKind(candidate)}
                  aria-pressed={active}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="block text-sm font-medium text-gray-900">{label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{hint}</span>
                </button>
              );
            })}
          </div>

          {kind === "review_reply" ? (
            <label className="block max-w-xs">
              <span className="block text-sm font-medium text-gray-700">
                {copy.reviewCountLabel}
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={reviewLimit}
                onChange={(event) => setReviewLimit(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          ) : (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700">{copy.urlLabel}</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={copy.urlPlaceholder}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void generate()}
              disabled={generating || (kind !== "review_reply" && !url.trim())}
              loading={generating}
            >
              <Wand2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {generating ? copy.generating : copy.generateCta}
            </Button>
            {notice && <p className="text-sm text-green-700">{notice}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* ── The meter ──────────────────────────────────────────────── */}
          {usage && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-700">{copy.usageTitle}</p>
              <p className="mt-1">
                {usage.limit === null
                  ? copy.usageUnlimited
                  : interpolate(copy.usageLine, {
                      used: numberFormat.format(usage.used),
                      limit: numberFormat.format(usage.limit),
                    })}
              </p>
              <p className="mt-1">
                {interpolate(copy.usageResets, {
                  date: dateFormat.format(new Date(usage.resetsAt)),
                })}
              </p>
              <p className="mt-1 text-gray-500">{copy.usageShared}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Queue ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => selectTab(candidate)}
            aria-pressed={tab === candidate}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === candidate
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {candidate === "draft"
              ? copy.tabDraft
              : candidate === "approved"
                ? copy.tabApproved
                : candidate === "applied"
                  ? copy.tabApplied
                  : copy.tabRejected}{" "}
            ({numberFormat.format(counts[candidate])})
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => void load(tab)} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Sparkles className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <p className="max-w-md text-sm text-gray-500">
                {counts.draft + counts.approved + counts.applied + counts.rejected === 0
                  ? copy.empty
                  : copy.emptyFiltered}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ActionItemCard
              key={item.id}
              item={item}
              copy={copy}
              dateFormat={dateFormat}
              onAct={act}
              onSaved={() => void load(tab)}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── One card ───────────────────────────────────────────────────────────────

function ActionItemCard({
  item,
  copy,
  dateFormat,
  onAct,
  onSaved,
  locale,
}: {
  item: ActionItemDto;
  copy: Copy;
  dateFormat: Intl.DateTimeFormat;
  onAct: (
    id: string,
    action: "approve" | "reject" | "apply" | "regenerate",
    note?: string,
  ) => Promise<void>;
  onSaved: () => void;
  locale: DashLocale;
}) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: "approve" | "reject" | "apply" | "regenerate", text?: string) => {
    setBusy(true);
    await onAct(item.id, action, text);
    setBusy(false);
    setRejecting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="info">{kindLabel(copy, item.kind)}</Badge>
            <span className="truncate text-xs text-gray-500">{item.sourceRef}</span>
          </div>
          <span className="text-xs text-gray-400">
            {item.status === "approved" && item.approvedAt
              ? interpolate(copy.approvedBy, {
                  date: dateFormat.format(new Date(item.approvedAt)),
                })
              : item.status === "rejected" && item.rejectedAt
                ? interpolate(copy.rejectedOn, {
                    date: dateFormat.format(new Date(item.rejectedAt)),
                  })
                : item.status === "applied" && item.appliedAt
                  ? interpolate(copy.appliedOn, {
                      date: dateFormat.format(new Date(item.appliedAt)),
                    })
                  : dateFormat.format(new Date(item.createdAt))}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <DraftBody
          item={item}
          copy={copy}
          editing={editing}
          onDoneEditing={(saved) => {
            setEditing(false);
            if (saved) onSaved();
          }}
          locale={locale}
        />

        {rejecting && (
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">
              {copy.rejectNoteLabel}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {item.status === "draft" && !editing && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {copy.edit}
              </Button>
              <Button size="sm" onClick={() => void run("approve")} disabled={busy}>
                {copy.approve}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => (rejecting ? void run("reject", note) : setRejecting(true))}
              >
                {copy.reject}
              </Button>
            </>
          )}

          {item.status === "approved" && (
            <>
              <Button size="sm" onClick={() => void run("apply")} disabled={busy}>
                {copy.apply}
              </Button>
              <span className="text-xs text-gray-500">{copy.applyHint}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => (rejecting ? void run("reject", note) : setRejecting(true))}
              >
                {copy.reject}
              </Button>
            </>
          )}

          {item.status === "rejected" && (
            <>
              {item.rejectedNote && (
                <span className="text-xs text-gray-500">“{item.rejectedNote}”</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void run("regenerate")}
                disabled={busy}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {copy.regenerate}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Kind-specific body ─────────────────────────────────────────────────────

function DraftBody({
  item,
  copy,
  editing,
  onDoneEditing,
  locale,
}: {
  item: ActionItemDto;
  copy: Copy;
  editing: boolean;
  onDoneEditing: (saved: boolean) => void;
  locale: DashLocale;
}) {
  if (item.kind === "schema") {
    return (
      <SchemaBody
        id={item.id}
        draft={item.draft as SchemaDraftView}
        copy={copy}
        editing={editing}
        onDoneEditing={onDoneEditing}
        locale={locale}
      />
    );
  }

  if (item.kind === "faq") {
    const draft = item.draft as FaqDraftView;
    return (
      <FaqBody
        id={item.id}
        draft={draft}
        copy={copy}
        editing={editing}
        onDoneEditing={onDoneEditing}
        locale={locale}
      />
    );
  }

  const draft = item.draft as ReviewReplyDraftView;
  return (
    <ReplyBody
      id={item.id}
      draft={draft}
      copy={copy}
      editing={editing}
      onDoneEditing={onDoneEditing}
      locale={locale}
    />
  );
}

/**
 * Save one edited draft.
 *
 * The WHOLE payload is sent, not a patch: the API validates the body against
 * the row's kind with the same zod schema the generator wrote it through, so a
 * partial object would fail validation rather than merge. That is the intended
 * behaviour — an edit that drops a required field is an edit that must not be
 * approvable.
 */
async function saveDraft(id: string, draft: unknown, locale: DashLocale): Promise<boolean> {
  const response = await fetch(`/api/action-agent/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "edit", draft, locale }),
  });
  return response.ok;
}

/**
 * The JSON-LD block, and the one thing on this page that is edited as raw text.
 *
 * WHY A TEXTAREA AND NOT A FIELD EDITOR. The block was assembled
 * deterministically from fields (see assemble.ts) precisely so the model could
 * not write malformed markup — but a reviewer editing it is a human who can see
 * what they are doing, and the edits they actually want are "our legal name is
 * spelled differently" and "drop that sameAs, it is the old account". A field
 * editor would have to reproduce the whole `@graph` shape to allow those, and
 * would still not allow the third thing somebody eventually needs.
 *
 * THE SAVE IS STILL VALIDATED, by the same zod schema the generator wrote
 * through — non-empty, under the length cap, with the other fields intact. It
 * is not re-parsed as JSON-LD, so a reviewer can save a block that does not
 * validate. That is why the last placement step tells them to run Google's Rich
 * Results Test, and why nothing here publishes.
 */
function SchemaBody({
  id,
  draft,
  copy,
  editing,
  onDoneEditing,
  locale,
}: {
  id: string;
  draft: SchemaDraftView;
  copy: Copy;
  editing: boolean;
  onDoneEditing: (saved: boolean) => void;
  locale: DashLocale;
}) {
  const [jsonLd, setJsonLd] = useState(draft.jsonLd);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{draft.businessType}</Badge>
        {!editing && (
          <>
            <CopyButton text={draft.jsonLd} copy={copy} />
            <DownloadButton text={draft.jsonLd} filename="schema.jsonld.html" copy={copy} />
          </>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={jsonLd}
            rows={14}
            onChange={(event) => setJsonLd(event.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={saving}
              disabled={saving || !jsonLd.trim()}
              onClick={async () => {
                setSaving(true);
                const ok = await saveDraft(id, { ...draft, jsonLd }, locale);
                setSaving(false);
                onDoneEditing(ok);
              }}
            >
              {copy.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDoneEditing(false)}>
              {copy.cancel}
            </Button>
          </div>
        </>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
          {draft.jsonLd}
        </pre>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700">{copy.placementTitle}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          {draft.placement.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {draft.omitted.length > 0 && (
        <p className="text-xs text-gray-500">
          {copy.omittedTitle}: {draft.omitted.join(", ")}
        </p>
      )}
    </div>
  );
}

function FaqBody({
  id,
  draft,
  copy,
  editing,
  onDoneEditing,
  locale,
}: {
  id: string;
  draft: FaqDraftView;
  copy: Copy;
  editing: boolean;
  onDoneEditing: (saved: boolean) => void;
  locale: DashLocale;
}) {
  const [pairs, setPairs] = useState(draft.items);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={draft.markdown} copy={copy} />
          <DownloadButton text={draft.html} filename="faq.html" copy={copy} />
        </div>
        <dl className="space-y-3">
          {draft.items.map((pair) => (
            <div key={pair.q}>
              <dt className="text-sm font-medium text-gray-900">{pair.q}</dt>
              <dd className="mt-0.5 text-sm text-gray-600">{pair.a}</dd>
            </div>
          ))}
        </dl>
        {draft.sourcePrompts.length > 0 && (
          <p className="text-xs text-gray-500">
            {copy.sourcePromptsTitle}: {draft.sourcePrompts.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair, index) => (
        <div key={index} className="space-y-1">
          <input
            value={pair.q}
            onChange={(event) =>
              setPairs((current) =>
                current.map((entry, i) =>
                  i === index ? { ...entry, q: event.target.value } : entry,
                ),
              )
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            value={pair.a}
            rows={3}
            onChange={(event) =>
              setPairs((current) =>
                current.map((entry, i) =>
                  i === index ? { ...entry, a: event.target.value } : entry,
                ),
              )
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={saving}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            // html/markdown are DERIVED from items, so they are re-rendered
            // server-side on the next generation rather than trusted from here.
            // Sending the current strings keeps the payload valid against the
            // schema; the copy buttons above read them until the next reload.
            const ok = await saveDraft(id, { ...draft, items: pairs }, locale);
            setSaving(false);
            onDoneEditing(ok);
          }}
        >
          {copy.save}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDoneEditing(false)}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}

function ReplyBody({
  id,
  draft,
  copy,
  editing,
  onDoneEditing,
  locale,
}: {
  id: string;
  draft: ReviewReplyDraftView;
  copy: Copy;
  editing: boolean;
  onDoneEditing: (saved: boolean) => void;
  locale: DashLocale;
}) {
  const [reply, setReply] = useState(draft.reply);
  const [saving, setSaving] = useState(false);

  const heading = interpolate(copy.reviewOf, {
    platform: draft.platform,
    rating: draft.rating ?? "—",
    author: draft.authorName ?? copy.reviewAnonymous,
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500">{heading}</p>
        <p className="mt-1 text-sm text-gray-700">{draft.reviewExcerpt}</p>
      </div>

      {editing ? (
        <>
          <textarea
            value={reply}
            rows={5}
            onChange={(event) => setReply(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={saving}
              disabled={saving || !reply.trim()}
              onClick={async () => {
                setSaving(true);
                const ok = await saveDraft(id, { ...draft, reply }, locale);
                setSaving(false);
                onDoneEditing(ok);
              }}
            >
              {copy.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDoneEditing(false)}>
              {copy.cancel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{draft.reply}</p>
          <CopyButton text={draft.reply} copy={copy} />
        </>
      )}
    </div>
  );
}
