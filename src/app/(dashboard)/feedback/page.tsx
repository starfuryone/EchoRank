"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Star,
  Send,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";

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

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-sm text-gray-400">No rating</span>;
  const color =
    rating >= 4
      ? "text-green-500"
      : rating === 3
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? `${color} fill-current` : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function FeedbackLifecycleBanner() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <style>{`
        @keyframes erFbTravel {
          0%   { offset-distance: 0%; opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .er-fb-dot {
          offset-path: path('M150,100 L200,100');
          animation: erFbTravel 2.4s ease-in-out infinite;
        }
        .er-fb-dot2 {
          offset-path: path('M330,100 L380,100');
          animation: erFbTravel 2.4s ease-in-out infinite;
          animation-delay: .8s;
        }
        .er-fb-dot3 {
          offset-path: path('M510,92 C540,92 548,55 580,55');
          animation: erFbTravel 2.4s ease-in-out infinite;
          animation-delay: 1.6s;
        }
        @media (prefers-reduced-motion: reduce) {
          .er-fb-dot, .er-fb-dot2, .er-fb-dot3 { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">How a feedback request flows</h3>
        <span className="text-xs text-gray-500">
          Every response gets a public review invite
        </span>
      </div>
      <svg
        viewBox="0 0 760 200"
        className="w-full max-w-3xl"
        role="img"
        aria-label="Feedback request lifecycle: Send request, then Pending, then Submitted, then a public review invite, with a recovery follow-up if the rating is low."
      >
        <defs>
          <marker id="erFbAh" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <line x1="150" y1="100" x2="200" y2="100" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erFbAh)" />
        <line x1="330" y1="100" x2="380" y2="100" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erFbAh)" />
        <path d="M510,92 C540,92 548,55 580,55" fill="none" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erFbAh)" />
        <path d="M510,108 C540,108 548,150 580,150" fill="none" stroke="#cbd5e1" strokeWidth="3" markerEnd="url(#erFbAh)" />
        <rect x="30" y="76" width="120" height="48" rx="12" fill="#2563eb" />
        <text x="90" y="105" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">Send request</text>
        <rect x="200" y="76" width="130" height="48" rx="12" fill="#d97706" />
        <text x="265" y="105" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">Pending</text>
        <rect x="380" y="76" width="130" height="48" rx="12" fill="#16a34a" />
        <text x="445" y="105" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">Submitted</text>
        <rect x="580" y="31" width="150" height="48" rx="12" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        <text x="655" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="#15803d">Review invite</text>
        <rect x="580" y="126" width="150" height="48" rx="12" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
        <text x="655" y="148" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b45309">Recovery</text>
        <text x="655" y="163" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b45309">if needed</text>
        <circle className="er-fb-dot" r="7" fill="#fbbf24" />
        <circle className="er-fb-dot2" r="7" fill="#fbbf24" />
        <circle className="er-fb-dot3" r="7" fill="#fbbf24" />
      </svg>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        You send a request; it stays{" "}
        <span className="font-medium text-amber-700">Pending</span> until the
        customer responds, then becomes{" "}
        <span className="font-medium text-green-700">Submitted</span>. Every
        response &mdash; whatever the rating &mdash; gets a public review invite;
        a low rating also opens a recovery follow-up for your team.
      </p>
    </div>
  );
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
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
      if (!res.ok) throw new Error("Failed to load feedback");
      const json = await res.json();
      setFeedback(json.feedback ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ratingFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

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
      if (!res.ok) throw new Error("Failed to send request");
      setSendModalOpen(false);
      setSelectedCustomerId("");
      fetchFeedback();
    } catch {
      alert("Failed to send feedback request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to load feedback</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeedbackLifecycleBanner />

      {/* Filters and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3">
          <Select
            label="Status"
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "SUBMITTED", label: "Submitted" },
              { value: "EXPIRED", label: "Expired" },
            ]}
          />
          <Select
            label="Rating"
            id="rating-filter"
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
            }}
            options={[
              { value: "all", label: "All Ratings" },
              { value: "5", label: "5 Stars" },
              { value: "4", label: "4 Stars" },
              { value: "3", label: "3 Stars" },
              { value: "2", label: "2 Stars" },
              { value: "1", label: "1 Star" },
            ]}
          />
        </div>
        <Button onClick={openSendModal}>
          <Send className="mr-2 h-4 w-4" />
          Send Feedback Request
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
        ) : feedback.length === 0 ? (
          <EmptyState
            title="No feedback found"
            description="Send your first feedback request to start collecting reviews."
            actionLabel="Send Feedback Request"
            onAction={openSendModal}
            icon={<Star className="h-12 w-12" />}
          />
        ) : (
          <ul className="divide-y divide-gray-200">
            {feedback.map((fb) => (
              <li
                key={fb.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setDetailItem(fb)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {fb.customerName}
                    </p>
                    <Badge variant={STATUS_BADGE[fb.status] ?? "default"}>
                      {fb.status}
                    </Badge>
                  </div>
                  {fb.comment && (
                    <p className="mt-1 text-sm text-gray-500 truncate max-w-xl">
                      {fb.comment}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <StarRating rating={fb.rating} />
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(fb.createdAt)}
                  </span>
                  <Eye className="h-4 w-4 text-gray-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="Feedback Details"
      >
        {detailItem && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="text-sm font-medium text-gray-900">
                {detailItem.customerName}
              </p>
              {detailItem.customerEmail && (
                <p className="text-sm text-gray-500">{detailItem.customerEmail}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Rating</p>
              <div className="mt-1">
                <StarRating rating={detailItem.rating} />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={STATUS_BADGE[detailItem.status] ?? "default"} className="mt-1">
                {detailItem.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Comment</p>
              <p className="mt-1 text-sm text-gray-900">
                {detailItem.comment || "No comment provided"}
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm text-gray-900">
                  {formatDateTime(detailItem.createdAt)}
                </p>
              </div>
              {detailItem.submittedAt && (
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="text-sm text-gray-900">
                    {formatDateTime(detailItem.submittedAt)}
                  </p>
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
        title="Send Feedback Request"
      >
        <form onSubmit={handleSendRequest} className="space-y-4">
          <div>
            <Input
              label="Search customers"
              id="customer-search"
              placeholder="Search by name or email..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
            {filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No customers found
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredCustomers.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      selectedCustomerId === c.id
                        ? "bg-blue-50 border-l-2 border-l-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.name}
                      </p>
                      {c.email && (
                        <p className="text-xs text-gray-500">{c.email}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={sending}
              disabled={!selectedCustomerId}
            >
              Send Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
