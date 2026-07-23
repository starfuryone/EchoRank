// Yellow "New" badge for product-nav items — dark readable text on the
// gold-compatible palette, with a localized screen-reader announcement
// ("Bot Analytics, new feature") carried by visually-hidden text.
import { PRODUCT_NAV_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function NewBadge({ locale }: { locale: DashLocale }) {
  const copy = PRODUCT_NAV_COPY[locale];
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
      <span aria-hidden="true">{copy.newBadge}</span>
      <span className="sr-only">{copy.newBadgeSr}</span>
    </span>
  );
}
