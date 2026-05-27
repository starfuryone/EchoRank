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

export default function RecoveryPage() {
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
      if (!res.ok) throw new Error("Failed to load recovery tickets");
      const json = await res.json();
      setTickets(json.tickets ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

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
      if (!res.ok) throw new Error("Failed to update ticket");
      setDetailTicket(null);
      fetchTickets();
    } catch {
      alert("Failed to update ticket. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const columns = [
    {
      key: "customerName",
      header: "Customer",
      render: (t: RecoveryTicket) => (
        <div>
          <p className="font-medium text-gray-900">{t.customerName}</p>
          {t.customerEmail && (
            <p className="text-xs text-gray-500">{t.customerEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      render: (t: RecoveryTicket) => (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-500">
          {"★".repeat(t.rating)}
          {"☆".repeat(5 - t.rating)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (t: RecoveryTicket) => (
        <Badge variant={PRIORITY_BADGE[t.priority] ?? "default"}>
          {t.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t: RecoveryTicket) => (
        <Badge variant={STATUS_BADGE[t.status] ?? "default"}>
          <span className="flex items-center gap-1">
            {STATUS_ICON[t.status]}
            {t.status.replace("_", " ")}
          </span>
        </Badge>
      ),
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (t: RecoveryTicket) => (
        <span className="text-gray-600">{t.assignedTo ?? "Unassigned"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (t: RecoveryTicket) => (
        <span className="text-gray-500">{formatDate(t.createdAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load recovery tickets
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
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3">
          <Select
            label="Status"
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "OPEN", label: "Open" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
          <Select
            label="Priority"
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={[
              { value: "all", label: "All Priorities" },
              { value: "URGENT", label: "Urgent" },
              { value: "HIGH", label: "High" },
              { value: "MEDIUM", label: "Medium" },
              { value: "LOW", label: "Low" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <HeartHandshake className="h-4 w-4" />
          {tickets.filter((t) => t.status === "OPEN").length} open tickets
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
            title="No recovery tickets"
            description="Recovery tickets are created automatically when customers leave low ratings."
            icon={<HeartHandshake className="h-12 w-12" />}
          />
        ) : (
          <DataTable<RecoveryTicket & Record<string, unknown>>
            columns={columns}
            data={tickets as (RecoveryTicket & Record<string, unknown>)[]}
            keyField="id"
            onRowClick={(t) => openDetail(t as unknown as RecoveryTicket)}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!detailTicket}
        onClose={() => setDetailTicket(null)}
        title="Recovery Ticket"
        className="max-w-xl"
      >
        {detailTicket && (
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
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
                <p className="text-sm text-gray-500">Rating</p>
                <p className="text-sm font-semibold text-red-500">
                  {"★".repeat(detailTicket.rating)}
                  {"☆".repeat(5 - detailTicket.rating)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <Badge
                  variant={PRIORITY_BADGE[detailTicket.priority] ?? "default"}
                  className="mt-1"
                >
                  {detailTicket.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm text-gray-900">
                  {formatDate(detailTicket.createdAt)}
                </p>
              </div>
            </div>

            {detailTicket.comment && (
              <div>
                <p className="text-sm text-gray-500">Customer Comment</p>
                <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {detailTicket.comment}
                </p>
              </div>
            )}

            <Select
              label="Status"
              id="ticket-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />

            <Textarea
              label="Notes"
              id="ticket-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about the recovery effort..."
              rows={4}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailTicket(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Update Ticket
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
