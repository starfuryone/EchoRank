// /admin/users — every user across every tenant, cancel requests, and
// data-deletion requests. Staff only (PLATFORM_ADMIN_EMAILS): anyone else gets
// a 404, like every page under /admin. Signed-out visitors never reach it:
// /admin is behind the proxy's auth gate and is not a public path. Not linked
// from the app's sidebar; the /admin overview lists it.
//
// Two tabs (?tab=users | cancel). Users: search by email, name or tenant,
// filter by plan and billing status, 50 a page, CSV of the same filters
// (/api/admin/users/export). Cancel requests: subscriptions set to cancel at
// period end, and the data-deletion requests, read-only, FAILED first.
// Each row's Cancel button reuses cancelTenantSubscription through
// POST /api/admin/users/cancel. English only, the dashboard's light theme.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import {
  PLAN_FILTERS,
  STATUS_FILTERS,
  listAdminUsers,
  listCancelRequests,
  listDeletionRequests,
  parseAdminUserFilters,
  type AdminUserFilters,
} from "@/lib/admin/users";
import { CancelRequestsTable, UsersTable } from "./users-tables";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users · Admin", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

function query(f: AdminUserFilters, over: Partial<AdminUserFilters> & { tab?: string } = {}): string {
  const p = new URLSearchParams();
  const v = { ...f, ...over };
  if (over.tab) p.set("tab", over.tab);
  if (v.q) p.set("q", v.q);
  if (v.plan) p.set("plan", v.plan);
  if (v.status) p.set("status", v.status);
  if (v.page && v.page > 1) p.set("page", String(v.page));
  return p.toString();
}

const tabClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`;
const fieldClass = "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900";
const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) : "—");

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await platformAdmin())) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "cancel" ? "cancel" : "users";
  const filters = parseAdminUserFilters(sp);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">
              <Link href="/admin" className="hover:text-gray-700">
                Admin
              </Link>{" "}
              / Users
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          </div>
          <nav className="flex gap-2" aria-label="Tabs">
            <Link href={`/admin/users?${query(filters, { tab: "users", page: 1 })}`} className={tabClass(tab === "users")} aria-current={tab === "users" ? "page" : undefined}>
              Users
            </Link>
            <Link href="/admin/users?tab=cancel" className={tabClass(tab === "cancel")} aria-current={tab === "cancel" ? "page" : undefined}>
              Cancel requests
            </Link>
          </nav>
        </div>

        {tab === "users" ? <UsersTab filters={filters} /> : <CancelTab />}
      </div>
    </main>
  );
}

async function UsersTab({ filters }: { filters: AdminUserFilters }) {
  const { rows, total, page, pageSize } = await listAdminUsers(filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const exportQuery = query({ ...filters, page: 1 });

  return (
    <section className="space-y-4">
      <form method="get" action="/admin/users" className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4" role="search">
        <input type="hidden" name="tab" value="users" />
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Email, name or tenant
          <input name="q" defaultValue={filters.q ?? ""} className={`${fieldClass} w-72`} placeholder="ada@example.com or acme" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Plan
          <select name="plan" defaultValue={filters.plan ?? ""} className={fieldClass}>
            <option value="">Any</option>
            {PLAN_FILTERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Billing status
          <select name="status" defaultValue={filters.status ?? ""} className={fieldClass}>
            <option value="">Any</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Search
        </button>
        <a href={`/api/admin/users/export${exportQuery ? `?${exportQuery}` : ""}`} className="ml-auto rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" data-testid="admin-users-csv">
          Export CSV
        </a>
      </form>

      <p className="text-sm text-gray-600" data-testid="admin-users-count">
        {total.toLocaleString("en-US")} {total === 1 ? "membership" : "memberships"} · page {page} of {pages}
      </p>

      <UsersTable key={`${exportQuery}:${page}`} rows={rows} />

      {pages > 1 && (
        <nav className="flex items-center gap-3 text-sm" aria-label="Pages">
          {page > 1 && (
            <Link href={`/admin/users?${query(filters, { tab: "users", page: page - 1 })}`} className="text-blue-600 hover:text-blue-700">
              ← Previous
            </Link>
          )}
          {page < pages && (
            <Link href={`/admin/users?${query(filters, { tab: "users", page: page + 1 })}`} className="text-blue-600 hover:text-blue-700">
              Next →
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}

async function CancelTab() {
  const [requests, deletions] = await Promise.all([listCancelRequests(), listDeletionRequests()]);
  const failed = deletions.filter((d) => d.status === "FAILED").length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Subscriptions set to cancel ({requests.length})</h2>
        <p className="text-sm text-gray-600">The customer (or someone in the Stripe portal) asked to cancel; access lasts until the date shown.</p>
        <CancelRequestsTable rows={requests} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Data-deletion requests ({deletions.length}
          {failed > 0 && <span className="text-red-700">, {failed} failed</span>})
        </h2>
        <p className="text-sm text-gray-600">Read-only. Newest 200, failed first.</p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm" data-testid="admin-deletion-requests">
            <thead className="bg-gray-50">
              <tr>
                {["Status", "Scope", "Tenant", "User", "Requested", "Runs after", "Completed", "Error"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deletions.map((d) => (
                <tr key={d.id} className={d.status === "FAILED" ? "bg-red-50" : undefined} data-status={d.status}>
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${d.status === "FAILED" ? "text-red-700" : "text-gray-800"}`}>{d.status}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{d.scope}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{d.tenantName ?? d.tenantId ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-600">{d.userId ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{date(d.requestedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{date(d.runAfter)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{d.cancelledAt ? `cancelled ${date(d.cancelledAt)}` : date(d.completedAt)}</td>
                  <td className="max-w-md truncate px-3 py-2 text-red-700" title={d.error ?? undefined}>
                    {d.error ?? ""}
                  </td>
                </tr>
              ))}
              {deletions.length === 0 && (
                <tr>
                  <td className="px-3 py-2 text-gray-600" colSpan={8}>
                    No data-deletion requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
