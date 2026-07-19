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
import { CUSTOMERS_COPY, type DashLocale, type CustomersCopy } from "@/lib/i18n/dashboard";

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

function CustomerLifecycleBanner({ t }: { t: CustomersCopy }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <style>{`
        @keyframes erLifeTravel {
          0%   { offset-distance: 0%; opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .er-life-dot {
          offset-path: path('M150,100 L205,100');
          animation: erLifeTravel 2.6s ease-in-out infinite;
        }
        .er-life-dot2 {
          offset-path: path('M330,92 C380,92 388,55 440,55');
          animation: erLifeTravel 2.6s ease-in-out infinite;
          animation-delay: 1.3s;
        }
        @media (prefers-reduced-motion: reduce) {
          .er-life-dot, .er-life-dot2 { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t.lifecycle.title}</h3>
        <span className="text-xs text-gray-500">
          {t.lifecycle.subtitle}
        </span>
      </div>
      <svg
        viewBox="0 0 720 210"
        className="w-full max-w-3xl"
        role="img"
        aria-label={t.lifecycle.ariaLabel}
      >
        <defs>
          <marker id="erLifeAh" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <line x1="150" y1="100" x2="205" y2="100" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erLifeAh)" />
        <path d="M330,92 C380,92 388,55 440,55" fill="none" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erLifeAh)" />
        <path d="M330,108 C380,108 388,165 440,165" fill="none" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erLifeAh)" />
        <line x1="600" y1="165" x2="650" y2="165" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erLifeAh)" />
        <rect x="30" y="78" width="120" height="48" rx="12" fill="#2563eb" />
        <text x="90" y="107" textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">{t.lifecycle.nodeNew}</text>
        <rect x="210" y="78" width="120" height="48" rx="12" fill="#475569" />
        <text x="270" y="107" textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">{t.lifecycle.nodeContacted}</text>
        <rect x="440" y="33" width="150" height="48" rx="12" fill="#16a34a" />
        <text x="515" y="62" textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">{t.lifecycle.nodeSatisfied}</text>
        <rect x="440" y="141" width="160" height="48" rx="12" fill="#d97706" />
        <text x="520" y="170" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">{t.lifecycle.nodeNeedsFollowUp}</text>
        <rect x="650" y="141" width="64" height="48" rx="12" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        <text x="682" y="162" textAnchor="middle" fontSize="11" fontWeight="700" fill="#15803d">{t.lifecycle.nodeRecovered1}</text>
        <text x="682" y="176" textAnchor="middle" fontSize="11" fontWeight="700" fill="#15803d">{t.lifecycle.nodeRecovered2}</text>
        <circle className="er-life-dot" r="7" fill="#fbbf24" />
        <circle className="er-life-dot2" r="7" fill="#fbbf24" />
      </svg>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {t.lifecycle.p1a}
        <span className="font-medium text-green-700">{t.lifecycle.p1strong1}</span>
        {t.lifecycle.p1b}
        <span className="font-medium text-amber-700">{t.lifecycle.p1strong2}</span>
        {t.lifecycle.p1c}
      </p>
    </div>
  );
}

export function CustomersPageClient({ locale }: { locale: DashLocale }) {
  const t = CUSTOMERS_COPY[locale];
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
      if (!res.ok) throw new Error(t.loadFailed);
      const json = await res.json();
      setCustomers(json.customers ?? json.data ?? []);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setLoading(false);
    }
  }, [page, search, t.loadFailed, t.somethingWrong]);

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
      if (!res.ok) throw new Error(t.createFailed);
      setModalOpen(false);
      setForm({ name: "", email: "", phone: "", location: "" });
      fetchCustomers();
    } catch {
      alert(t.createAlert);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t.fields.name,
      render: (c: Customer) => (
        <span className="font-medium text-gray-900">{c.name}</span>
      ),
    },
    {
      key: "email",
      header: t.fields.email,
      render: (c: Customer) => (
        <span className="text-gray-600">{c.email ?? "--"}</span>
      ),
    },
    {
      key: "phone",
      header: t.fields.phone,
      render: (c: Customer) => (
        <span className="text-gray-600">{c.phone ?? "--"}</span>
      ),
    },
    {
      key: "status",
      header: t.fields.status,
      render: (c: Customer) => (
        <Badge variant={STATUS_BADGE[c.status] ?? "default"}>
          {t.statusLabels[c.status] ?? c.status}
        </Badge>
      ),
    },
    {
      key: "location",
      header: t.fields.location,
      render: (c: Customer) => (
        <span className="text-gray-600">{c.location ?? "--"}</span>
      ),
    },
    {
      key: "createdAt",
      header: t.fields.created,
      render: (c: Customer) => (
        <span className="text-gray-500">{formatDate(c.createdAt, locale)}</span>
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
      <CustomerLifecycleBanner t={t} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            {t.searchButton}
          </Button>
        </form>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.addCustomer}
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
            title={t.emptyTitle}
            description={search ? t.emptyFilteredDescription : t.emptyDescription}
            actionLabel={!search ? t.addCustomer : undefined}
            onAction={!search ? () => setModalOpen(true) : undefined}
          />
        ) : (
          <>
            <DataTable<Customer & Record<string, unknown>>
              columns={columns}
              data={customers as (Customer & Record<string, unknown>)[]}
              keyField="id"
              emptyMessage={t.emptyTitle}
            />
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
                <p className="text-sm text-gray-500">
                  {t.pageOf(page, totalPages)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t.previous}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t.next}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Customer Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t.addCustomer}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label={t.fields.name}
            id="customer-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.namePlaceholder}
          />
          <Input
            label={t.fields.email}
            id="customer-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={t.emailPlaceholder}
          />
          <Input
            label={t.fields.phone}
            id="customer-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder={t.phonePlaceholder}
          />
          <Input
            label={t.fields.location}
            id="customer-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t.locationPlaceholder}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {t.addCustomer}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
