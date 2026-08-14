"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Check, Info, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NOTIFICATIONS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { renderNotification, severityLabel } from "@/lib/notifications/render";
import {
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  type NotificationDto,
} from "@/lib/notifications/types";

const SEVERITY_STYLES: Record<string, { row: string; chip: string; Icon: typeof Info }> = {
  info: {
    row: "border-l-4 border-l-blue-400",
    chip: "bg-blue-50 text-blue-700",
    Icon: Info,
  },
  warning: {
    row: "border-l-4 border-l-amber-400",
    chip: "bg-amber-50 text-amber-800",
    Icon: AlertTriangle,
  },
  critical: {
    row: "border-l-4 border-l-red-500",
    chip: "bg-red-50 text-red-700",
    Icon: ShieldAlert,
  },
};

function formatWhen(iso: string, locale: DashLocale): string {
  // de-CH and fr both want day-first; Intl already knows that, so the only job
  // here is handing it the right tag.
  const tag = locale === "de-CH" ? "de-CH" : locale === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function NotificationsPageClient({ locale }: { locale: DashLocale }) {
  const copy = NOTIFICATIONS_COPY[locale];

  const [items, setItems] = useState<NotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  // Loading and error are DERIVED from which query the state belongs to rather
  // than stored, so the effect below never has to setState synchronously to
  // reset them on a filter change. `loadedKey` is the query the current items
  // came from; `errorKey` is the query whose fetch failed.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (severity) params.set("severity", severity);
      if (unreadOnly) params.set("unread", "1");
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [type, severity, unreadOnly],
  );

  const queryKey = buildQuery();
  const loading = loadedKey !== queryKey && errorKey !== queryKey;
  const error = errorKey === queryKey;

  // Refetches from the top whenever a filter changes. Deliberately not merged
  // with loadMore: a filter change must replace the list, not append to it.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/notifications?${queryKey}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { items: NotificationDto[]; nextCursor: string | null; unreadCount: number }) => {
        if (cancelled) return;
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setUnreadCount(data.unreadCount);
        setMoreFailed(false);
        setLoadedKey(queryKey);
      })
      .catch(() => {
        if (!cancelled) setErrorKey(queryKey);
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const res = await fetch(`/api/notifications?${buildQuery(nextCursor)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        items: NotificationDto[];
        nextCursor: string | null;
        unreadCount: number;
      };
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed page-two does not discard page one — the rows already on
      // screen stay, and the message sits next to the button that failed.
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, buildQuery]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic: the row is already on screen and the user just acted on it.
      // The server response replaces the count, so a failed call self-corrects
      // on the next fetch rather than leaving a wrong badge forever.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          const data = (await res.json()) as { unreadCount: number };
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Swallowed: the optimistic state stands until the next load.
      }
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Same as above.
    }
    if (unreadOnly) {
      // The unread-only view is now empty by definition; refetch so the empty
      // state appears instead of a list of rows that no longer match.
      setItems([]);
    }
  }, [unreadOnly]);

  const typeOptions = [
    { value: "", label: copy.allTypes },
    ...NOTIFICATION_TYPES.map((t) => ({ value: t, label: copy.types[t].label })),
  ];
  const severityOptions = [
    { value: "", label: copy.allSeverities },
    ...NOTIFICATION_SEVERITIES.map((s) => ({
      value: s,
      label: severityLabel(s, locale),
    })),
  ];

  const filtered = type !== "" || severity !== "" || unreadOnly;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-600">{copy.subtitle}</p>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {copy.unreadBadge.replace("{count}", String(unreadCount))}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="shrink-0"
        >
          <Check className="mr-2 h-4 w-4" />
          {copy.markAllRead}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-64">
          <Select
            options={typeOptions}
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label={copy.allTypes}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={severityOptions}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label={copy.allSeverities}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {copy.unreadOnly}
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {copy.loading}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-600">
            {copy.error}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="mx-auto h-10 w-10" aria-hidden="true" />}
          title={filtered ? copy.emptyFiltered : copy.empty}
          description=""
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const rendered = renderNotification(n, locale);
            const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info!;
            const { Icon } = style;

            return (
              <li key={n.id}>
                <Card className={`${style.row} ${n.read ? "" : "bg-blue-50/40"}`}>
                  <CardContent className="flex items-start gap-3 py-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />

                    <div className="min-w-0 flex-1">
                      <Link
                        href={n.href}
                        className="block hover:underline"
                        // Following the link is reading it. Marking here rather
                        // than only on the button means the common path — click
                        // the alert, go look at it — clears the badge.
                        onClick={() => {
                          if (!n.read) void markRead(n.id);
                        }}
                      >
                        <span
                          className={`block truncate text-sm ${
                            n.read ? "text-gray-700" : "font-bold text-gray-900"
                          }`}
                        >
                          {rendered.title}
                        </span>
                      </Link>

                      {rendered.body && (
                        <p className="mt-0.5 text-sm text-gray-600">{rendered.body}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${style.chip}`}>
                          {severityLabel(n.severity, locale)}
                        </span>
                        {rendered.label && <span>{rendered.label}</span>}
                        <span>{formatWhen(n.createdAt, locale)}</span>
                      </div>
                    </div>

                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label={copy.markRead}
                        title={copy.markRead}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && !loading && !error && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.loading}
              </>
            ) : (
              copy.loadMore
            )}
          </Button>
          {moreFailed && <p className="text-sm text-red-600">{copy.error}</p>}
        </div>
      )}
    </div>
  );
}
