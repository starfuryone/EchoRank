"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HeartHandshake,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { RECOVERY_COPY, type RecoveryCopy, type DashLocale } from "@/lib/i18n/dashboard";

interface RecoveryTicket {
  id: string;
  customerName: string;
  customerEmail: string | null;
  rating: number;
  comment: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const PRIORITY_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "default",
};

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  OPEN: "danger",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "default",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN: <XCircle className="h-3.5 w-3.5" />,
  IN_PROGRESS: <Clock className="h-3.5 w-3.5" />,
  RESOLVED: <CheckCircle2 className="h-3.5 w-3.5" />,
  CLOSED: <CheckCircle2 className="h-3.5 w-3.5" />,
};

function RecoveryLifecycleBanner({ t }: { t: RecoveryCopy }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <style>{`
        @keyframes erRcTravel {
          0%   { offset-distance: 0%; opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .er-rc-dot {
          offset-path: path('M155,80 L200,80');
          animation: erRcTravel 2.2s ease-in-out infinite;
        }
        .er-rc-dot2 {
          offset-path: path('M300,80 L345,80');
          animation: erRcTravel 2.2s ease-in-out infinite;
          animation-delay: .55s;
        }
        .er-rc-dot3 {
          offset-path: path('M475,80 L520,80');
          animation: erRcTravel 2.2s ease-in-out infinite;
          animation-delay: 1.1s;
        }
        .er-rc-dot4 {
          offset-path: path('M650,80 L695,80');
          animation: erRcTravel 2.2s ease-in-out infinite;
          animation-delay: 1.65s;
        }
        @media (prefers-reduced-motion: reduce) {
          .er-rc-dot, .er-rc-dot2, .er-rc-dot3, .er-rc-dot4 { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t.bannerTitle}</h3>
        <span className="text-xs text-gray-500">{t.bannerTagline}</span>
      </div>
      <svg
        viewBox="0 0 800 130"
        className="w-full max-w-4xl"
        role="img"
        aria-label={t.svgAria}
      >
        <defs>
          <marker id="erRcAh" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <line x1="155" y1="55" x2="200" y2="55" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erRcAh)" />
        <line x1="300" y1="55" x2="345" y2="55" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erRcAh)" />
        <line x1="475" y1="55" x2="520" y2="55" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erRcAh)" />
        <line x1="650" y1="55" x2="695" y2="55" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erRcAh)" />
        <rect x="20" y="31" width="135" height="48" rx="12" fill="#d97706" />
        <text x="87" y="53" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff">{t.svgLowRating}</text>
        <text x="87" y="69" textAnchor="middle" fontSize="10" fontWeight="600" fill="#fde68a">{t.svgStars}</text>
        <rect x="200" y="31" width="100" height="48" rx="12" fill="#dc2626" />
        <text x="250" y="60" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">{t.svgOpen}</text>
        <rect x="345" y="31" width="130" height="48" rx="12" fill="#d97706" />
        <text x="410" y="60" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">{t.svgInProgress}</text>
        <rect x="520" y="31" width="130" height="48" rx="12" fill="#16a34a" />
        <text x="585" y="60" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">{t.svgResolved}</text>
        <rect x="695" y="31" width="90" height="48" rx="12" fill="#475569" />
        <text x="740" y="60" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">{t.svgClosed}</text>
        <circle className="er-rc-dot" r="7" fill="#fbbf24" />
        <circle className="er-rc-dot2" r="7" fill="#fbbf24" />
        <circle className="er-rc-dot3" r="7" fill="#fbbf24" />
        <circle className="er-rc-dot4" r="7" fill="#fbbf24" />
      </svg>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {t.p1a}
        <span className="font-medium text-red-700">{t.p1open}</span>
        {t.p1b}
        <span className="font-medium text-amber-700">{t.p1inProgress}</span>
        {t.p1c}
        <span className="font-medium text-green-700">{t.p1resolved}</span>
        {t.p1d}
        <span className="font-medium text-gray-700">{t.p1closed}</span>
        {t.p1e}
      </p>
    </div>
  );
}

export function RecoveryPageClient({ locale }: { locale: DashLocale }) {
  const t = RECOVERY_COPY[locale];
  const [tickets, setTickets] = useState<RecoveryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [detailTicket, setDetailTicket] = useState<RecoveryTicket | null>(null);
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const res = await fetch(`/api/recovery?${params}`);
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setTickets(
        (json.tickets ?? json.data ?? []).map((t2: any) => ({
          ...t2,
          customerName: t2.customerName ?? t2.customer?.name ?? t.unknownCustomer,
          customerEmail: t2.customerEmail ?? t2.customer?.email ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, t.loadFailed, t.genericError, t.unknownCustomer]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openDetail = (ticket: RecoveryTicket) => {
    setDetailTicket(ticket);
    setNotes(ticket.notes ?? "");
    setNewStatus(ticket.status);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailTicket) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/recovery/${detailTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (!res.ok) throw new Error(t.updateFailed);
      setDetailTicket(null);
      fetchTickets();
    } catch {
      alert(t.updateFailedAlert);
    } finally {
      setUpdating(false);
    }
  };

  const statusOptions = [
    { value: "OPEN", label: t.statusLabels.OPEN },
    { value: "IN_PROGRESS", label: t.statusLabels.IN_PROGRESS },
    { value: "RESOLVED", label: t.statusLabels.RESOLVED },
    { value: "CLOSED", label: t.statusLabels.CLOSED },
  ];

  const columns = [
    {
      key: "customerName",
      header: t.colCustomer,
      render: (t2: RecoveryTicket) => (
        <div>
          <p className="font-medium text-gray-900">{t2.customerName}</p>
          {t2.customerEmail && (
            <p className="text-xs text-gray-500">{t2.customerEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      header: t.colRating,
      render: (t2: RecoveryTicket) => (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-500">
          {"★".repeat(t2.rating)}
          {"☆".repeat(5 - t2.rating)}
        </span>
      ),
    },
    {
      key: "priority",
      header: t.colPriority,
      render: (t2: RecoveryTicket) => (
        <Badge variant={PRIORITY_BADGE[t2.priority] ?? "default"}>
          {t.priorityLabels[t2.priority] ?? t2.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t.colStatus,
      render: (t2: RecoveryTicket) => (
        <Badge variant={STATUS_BADGE[t2.status] ?? "default"}>
          <span className="flex items-center gap-1">
            {STATUS_ICON[t2.status]}
            {t.statusLabels[t2.status] ?? t2.status}
          </span>
        </Badge>
      ),
    },
    {
      key: "assignedTo",
      header: t.colAssignedTo,
      render: (t2: RecoveryTicket) => (
        <span className="text-gray-600">{t2.assignedTo ?? t.unassigned}</span>
      ),
    },
    {
      key: "createdAt",
      header: t.colCreated,
      render: (t2: RecoveryTicket) => (
        <span className="text-gray-500">{formatDate(t2.createdAt, locale)}</span>
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
      <RecoveryLifecycleBanner t={t} />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3">
          <Select
            label={t.statusLabel}
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[{ value: "all", label: t.allStatuses }, ...statusOptions]}
          />
          <Select
            label={t.priorityLabel}
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={[
              { value: "all", label: t.allPriorities },
              { value: "URGENT", label: t.priorityLabels.URGENT },
              { value: "HIGH", label: t.priorityLabels.HIGH },
              { value: "MEDIUM", label: t.priorityLabels.MEDIUM },
              { value: "LOW", label: t.priorityLabels.LOW },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <HeartHandshake className="h-4 w-4" />
          {t.openTickets(tickets.filter((t2) => t2.status === "OPEN").length)}
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyDescription}
            icon={<HeartHandshake className="h-12 w-12" />}
          />
        ) : (
          <DataTable<RecoveryTicket & Record<string, unknown>>
            columns={columns}
            data={tickets as (RecoveryTicket & Record<string, unknown>)[]}
            keyField="id"
            onRowClick={(t2) => openDetail(t2 as unknown as RecoveryTicket)}
            emptyMessage={t.emptyTitle}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!detailTicket}
        onClose={() => setDetailTicket(null)}
        title={t.modalTitle}
        className="max-w-xl"
      >
        {detailTicket && (
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">{t.customerLabel}</p>
                <p className="text-sm font-medium text-gray-900">
                  {detailTicket.customerName}
                </p>
                {detailTicket.customerEmail && (
                  <p className="text-xs text-gray-500">
                    {detailTicket.customerEmail}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.ratingLabel}</p>
                <p className="text-sm font-semibold text-red-500">
                  {"★".repeat(detailTicket.rating)}
                  {"☆".repeat(5 - detailTicket.rating)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.priorityLabel}</p>
                <Badge
                  variant={PRIORITY_BADGE[detailTicket.priority] ?? "default"}
                  className="mt-1"
                >
                  {t.priorityLabels[detailTicket.priority] ?? detailTicket.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.createdLabel}</p>
                <p className="text-sm text-gray-900">
                  {formatDate(detailTicket.createdAt, locale)}
                </p>
              </div>
            </div>

            {detailTicket.comment && (
              <div>
                <p className="text-sm text-gray-500">{t.commentLabel}</p>
                <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {detailTicket.comment}
                </p>
              </div>
            )}

            <Select
              label={t.statusLabel}
              id="ticket-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={statusOptions}
            />

            <Textarea
              label={t.notesLabel}
              id="ticket-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={4}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailTicket(null)}
              >
                {t.cancel}
              </Button>
              <Button type="submit" loading={updating}>
                {t.updateTicket}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
