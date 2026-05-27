"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  location: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  NEW: "info",
  CONTACTED: "default",
  SATISFIED: "success",
  NEEDS_FOLLOWUP: "warning",
  RECOVERED: "success",
  LOST: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SATISFIED: "Satisfied",
  NEEDS_FOLLOWUP: "Needs Follow-up",
  RECOVERED: "Recovered",
  LOST: "Lost",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "" });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error("Failed to load customers");
      const json = await res.json();
      setCustomers(json.customers ?? json.data ?? []);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      setModalOpen(false);
      setForm({ name: "", email: "", phone: "", location: "" });
      fetchCustomers();
    } catch {
      alert("Failed to create customer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (c: Customer) => (
        <span className="font-medium text-gray-900">{c.name}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (c: Customer) => (
        <span className="text-gray-600">{c.email ?? "--"}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (c: Customer) => (
        <span className="text-gray-600">{c.phone ?? "--"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c: Customer) => (
        <Badge variant={STATUS_BADGE[c.status] ?? "default"}>
          {STATUS_LABELS[c.status] ?? c.status}
        </Badge>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (c: Customer) => (
        <span className="text-gray-600">{c.location ?? "--"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (c: Customer) => (
        <span className="text-gray-500">{formatDate(c.createdAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to load customers</h2>
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
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={
              search
                ? "Try adjusting your search terms."
                : "Add your first customer to get started."
            }
            actionLabel={!search ? "Add Customer" : undefined}
            onAction={!search ? () => setModalOpen(true) : undefined}
          />
        ) : (
          <>
            <DataTable<Customer & Record<string, unknown>>
              columns={columns}
              data={customers as (Customer & Record<string, unknown>)[]}
              keyField="id"
            />
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Customer Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Customer">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            id="customer-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Doe"
          />
          <Input
            label="Email"
            id="customer-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@example.com"
          />
          <Input
            label="Phone"
            id="customer-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
          />
          <Input
            label="Location"
            id="customer-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="New York, NY"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
