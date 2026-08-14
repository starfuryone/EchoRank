// Turning a stored notification into the two strings a row displays.
//
// The stored title/body are English, written by whichever worker emitted the
// alert. They are used ONLY when `type` is absent from the catalog — a row
// written before its copy shipped, or by a source added ahead of its
// translations. Everything else renders from the typed payload, which is why a
// French dashboard does not show English alert text.

import { NOTIFICATIONS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { isNotificationType, type NotificationDto } from "./types";

/** What an absent or null payload value renders as. Never "undefined". */
const MISSING = "—";

/**
 * Payload values are formatted for reading, not for JSON: a probability is a
 * 0..1 float that has to reach the page as a percentage, and `bots` is an array
 * that has to become a list.
 */
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return MISSING;
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : MISSING;
  }
  if (key === "probability" && typeof value === "number") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

/** Replaces every {key} with its formatted payload value. */
export function interpolate(
  template: string,
  payload: Record<string, unknown> | null,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    formatValue(key, payload?.[key]),
  );
}

export interface RenderedNotification {
  title: string;
  body: string | null;
  /** The translated type label, for the filter chip on the row. */
  label: string | null;
}

export function renderNotification(
  notification: NotificationDto,
  locale: DashLocale,
): RenderedNotification {
  const copy = NOTIFICATIONS_COPY[locale];

  // An unknown type is not an error — it is an older row, or a source that
  // shipped ahead of its copy. Fall back to what the worker wrote rather than
  // showing the user a blank row or a raw type key.
  if (!isNotificationType(notification.type)) {
    return { title: notification.title, body: notification.body, label: null };
  }

  const template = copy.types[notification.type];
  const body = interpolate(template.body, notification.payload);

  return {
    title: interpolate(template.title, notification.payload),
    // A body that interpolated to nothing but the placeholder is noise; drop it.
    body: body.replace(/[—.\s#:]/g, "").length > 0 ? body : null,
    label: template.label,
  };
}

/** Translated severity label, falling back to the raw value for an unknown one. */
export function severityLabel(severity: string, locale: DashLocale): string {
  const labels = NOTIFICATIONS_COPY[locale].severities as Record<string, string>;
  return labels[severity] ?? severity;
}
