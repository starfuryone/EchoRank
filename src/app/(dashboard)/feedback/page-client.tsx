"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Star, Send, AlertCircle, Eye, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { FEEDBACK_COPY, type DashLocale, type FeedbackCopy } from "@/lib/i18n/dashboard";

interface FeedbackItem {
  id: string;
  customerName: string;
  customerEmail: string | null;
  rating: number | null;
  comment: string | null;
  status: string;
  createdAt: string;
  submittedAt: string | null;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  SUBMITTED: "success",
  EXPIRED: "danger",
};

/** Accent + tone derived from the rating we actually have. Not AI sentiment. */
function ratingTone(rating: number | null, status: string): string {
  if (status === "PENDING") return "border-l-amber-400";
  if (rating === null) return "border-l-slate-200";
  if (rating >= 4) return "border-l-emerald-500";
  if (rating === 3) return "border-l-amber-400";
  return "border-l-rose-500";
}

function initialsOf(name: string): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function StarRating({ rating, t }: { rating: number | null; t: FeedbackCopy }) {
  if (rating === null) return <span className="text-sm text-gray-400">{t.noRating}</span>;
  const color =
    rating >= 4 ? "text-green-500" : rating === 3 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="flex items-center gap-0.5" aria-label={t.ratingAria(rating)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? `${color} fill-current` : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline strip — counts computed from real feedback, not invented  */
/* ------------------------------------------------------------------ */

function FeedbackPipeline({
  items,
  t,
  locale,
}: {
  items: FeedbackItem[];
  t: FeedbackCopy;
  locale: DashLocale;
}) {
  const s = useMemo(() => {
    const sent = items.length;
    const pending = items.filter((f) => f.status === "PENDING").length;
    const submitted = items.filter((f) => f.status === "SUBMITTED").length;
    const promoters = items.filter(
      (f) => f.status === "SUBMITTED" && (f.rating ?? 0) >= 4
    ).length;
    const recovery = items.filter(
      (f) => f.status === "SUBMITTED" && f.rating !== null && f.rating <= 2
    ).length;
    return { sent, pending, submitted, promoters, recovery };
  }, [items]);

  const nodes: { value: number; label: string; tone: string }[] = [
    { value: s.sent, label: t.pipeline.requestsSent, tone: "text-gray-900" },
    { value: s.pending, label: t.pipeline.awaitingReply, tone: "text-amber-600" },
    { value: s.submitted, label: t.pipeline.responded, tone: "text-gray-900" },
    { value: s.promoters, label: t.pipeline.promoters, tone: "text-emerald-600" },
    { value: s.recovery, label: t.pipeline.needsRecovery, tone: "text-rose-600" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <style>{`
        @keyframes erPipe { 0%{offset-distance:0%;opacity:0} 12%{opacity:1} 88%{opacity:1} 100%{offset-distance:100%;opacity:0} }
        .er-pipe { position:relative; align-self:center; width:1.5rem; height:2px; background:#e5e7eb; }
        .er-pipe::after { content:""; position:absolute; top:-2px; width:6px; height:6px; border-radius:9999px; background:#f59e0b;
          offset-path: path('M0,1 L24,1'); animation: erPipe 2.6s ease-in-out infinite; }
        .er-pipe.d2::after{animation-delay:.6s}.er-pipe.d3::after{animation-delay:1.2s}.er-pipe.d4::after{animation-delay:1.8s}
        @media (prefers-reduced-motion: reduce){ .er-pipe::after{animation:none;opacity:0} }
      `}</style>

      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          {t.pipeline.title}
        </h3>
        <span className="font-mono text-[11px] text-gray-400">{t.pipeline.currentView}</span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {nodes.map((n, i) => (
          <div key={n.label} className="contents md:flex md:flex-1 md:items-stretch md:gap-3">
            <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3">
              <div className={`font-mono text-2xl font-semibold tabular-nums ${n.tone}`}>
                {n.value.toLocaleString(locale)}
              </div>
              <div className="mt-1 text-xs font-medium text-gray-500">{n.label}</div>
            </div>
            {i < nodes.length - 1 && <div className={`er-pipe d${i + 1} hidden md:block`} />}
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-500">
        {t.pipeline.note}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function FeedbackPageClient({ locale }: { locale: DashLocale }) {
  const t = FEEDBACK_COPY[locale];
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [sending, setSending] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      const res = await fetch(`/api/feedback?${params}`);
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setFeedback(
        (json.feedback ?? json.data ?? []).map((f: any) => ({
          id: f.id,
          customerName: f.customerName ?? f.customer?.name ?? t.unknownCustomer,
          customerEmail: f.customerEmail ?? f.customer?.email ?? null,
          rating: f.rating ?? null,
          comment: f.comment ?? null,
          status: f.status ?? "PENDING",
          createdAt: f.createdAt ?? "",
          submittedAt: f.submittedAt ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ratingFilter, t.loadFailed, t.somethingWrong, t.unknownCustomer]);

  // Unfiltered pull powers the pipeline counts so the strip does not shift
  // when you narrow the list below it.
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback`);
      if (!res.ok) return;
      const json = await res.json();
      setSummary(json.feedback ?? json.data ?? []);
    } catch {
      // pipeline simply shows nothing if this fails
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?limit=100");
      if (!res.ok) return;
      const json = await res.json();
      setCustomers(json.customers ?? json.data ?? []);
    } catch {
      // silently fail
    }
  };

  const openSendModal = () => {
    fetchCustomers();
    setSendModalOpen(true);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomerId }),
      });
      if (!res.ok) throw new Error(t.sendFailed);
      setSendModalOpen(false);
      setSelectedCustomerId("");
      fetchFeedback();
      fetchSummary();
    } catch {
      alert(t.sendAlert);
    } finally {
      setSending(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  // Client-side text search over the already-fetched (status/rating-filtered) list.
  const visible = useMemo(() => {
    if (!query.trim()) return feedback;
    const q = query.toLowerCase();
    return feedback.filter(
      (f) =>
        f.customerName.toLowerCase().includes(q) ||
        (f.customerEmail && f.customerEmail.toLowerCase().includes(q)) ||
        (f.comment && f.comment.toLowerCase().includes(q))
    );
  }, [feedback, query]);

  const isFiltered = statusFilter !== "all" || ratingFilter !== "all" || query.trim().length > 0;

  // Headline metrics from the unfiltered set.
  const rated = summary.filter((f) => f.rating !== null);
  const avgRating = rated.length
    ? (rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";
  const responseRate = summary.length
    ? Math.round(
        (summary.filter((f) => f.status === "SUBMITTED").length / summary.length) * 100
      )
    : null;

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
      {/* Title + at-a-glance metrics */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            {t.eyebrow}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            {t.subtitle}
          </p>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-gray-900">
              {avgRating}
            </div>
            <div className="text-xs text-gray-500">{t.avgRating}</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-emerald-600">
              {responseRate === null ? "—" : `${responseRate}%`}
            </div>
            <div className="text-xs text-gray-500">{t.responseRate}</div>
          </div>
        </div>
      </div>

      <FeedbackPipeline items={summary} t={t} locale={locale} />

      {/* Filters and actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="feedback-search"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t.searchLabel}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="feedback-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <Select
            label={t.statusFilterLabel}
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: t.allStatuses },
              { value: "PENDING", label: t.statusLabels.PENDING },
              { value: "SUBMITTED", label: t.statusLabels.SUBMITTED },
              { value: "EXPIRED", label: t.statusLabels.EXPIRED },
            ]}
          />
          <Select
            label={t.ratingFilterLabel}
            id="rating-filter"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            options={[
              { value: "all", label: t.allRatings },
              { value: "5", label: t.starsOption(5) },
              { value: "4", label: t.starsOption(4) },
              { value: "3", label: t.starsOption(3) },
              { value: "2", label: t.starsOption(2) },
              { value: "1", label: t.starsOption(1) },
            ]}
          />
        </div>
        <Button onClick={openSendModal}>
          <Send className="mr-2 h-4 w-4" />
          {t.sendRequestButton}
        </Button>
      </div>

      {/* Feedback list */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          isFiltered ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <h3 className="text-base font-semibold text-gray-900">{t.nothingMatches}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                {t.widenFilters}
              </p>
            </div>
          ) : (
            <EmptyState
              title={t.emptyTitle}
              description={t.emptyDescription}
              actionLabel={t.sendRequestButton}
              onAction={openSendModal}
              icon={<Star className="h-12 w-12" />}
            />
          )
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((fb) => {
              const atRisk =
                fb.status === "SUBMITTED" && fb.rating !== null && fb.rating <= 2;
              return (
                <li
                  key={fb.id}
                  onClick={() => setDetailItem(fb)}
                  className={`group flex cursor-pointer items-center gap-4 border-l-4 ${ratingTone(
                    fb.rating,
                    fb.status
                  )} px-5 py-4 transition-colors hover:bg-gray-50`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                    {initialsOf(fb.customerName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {fb.customerName}
                      </p>
                      <Badge variant={STATUS_BADGE[fb.status] ?? "default"}>
                        {t.statusLabels[fb.status] ?? fb.status}
                      </Badge>
                      {atRisk && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                          <AlertCircle className="h-3 w-3" /> {t.atRisk}
                        </span>
                      )}
                    </div>
                    {fb.comment && (
                      <p className="mt-1 line-clamp-1 max-w-xl text-sm text-gray-600">
                        {fb.comment}
                      </p>
                    )}
                    <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(fb.createdAt, locale)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <StarRating rating={fb.rating} t={t} />
                    <Eye className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Detail modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title={t.detailTitle}>
        {detailItem && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">{t.detailCustomer}</p>
              <p className="text-sm font-medium text-gray-900">{detailItem.customerName}</p>
              {detailItem.customerEmail && (
                <p className="text-sm text-gray-500">{detailItem.customerEmail}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">{t.detailRating}</p>
              <div className="mt-1">
                <StarRating rating={detailItem.rating} t={t} />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t.detailStatus}</p>
              <Badge variant={STATUS_BADGE[detailItem.status] ?? "default"} className="mt-1">
                {t.statusLabels[detailItem.status] ?? detailItem.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t.detailComment}</p>
              <p className="mt-1 text-sm text-gray-900">
                {detailItem.comment || t.noComment}
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-gray-500">{t.detailCreated}</p>
                <p className="text-sm text-gray-900">{formatDateTime(detailItem.createdAt, locale)}</p>
              </div>
              {detailItem.submittedAt && (
                <div>
                  <p className="text-sm text-gray-500">{t.detailSubmitted}</p>
                  <p className="text-sm text-gray-900">{formatDateTime(detailItem.submittedAt, locale)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Send feedback request modal */}
      <Modal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title={t.sendRequestButton}
      >
        <form onSubmit={handleSendRequest} className="space-y-4">
          <div>
            <Input
              label={t.searchCustomersLabel}
              id="customer-search"
              placeholder={t.customerSearchPlaceholder}
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
            {filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">{t.noCustomersFound}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredCustomers.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                      selectedCustomerId === c.id
                        ? "border-l-2 border-l-blue-600 bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setSendModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" loading={sending} disabled={!selectedCustomerId}>
              {t.sendRequest}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
