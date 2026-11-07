import Link from "next/link";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";

/**
 * "Need higher limits? Talk to us" under an in-app limit-reached message:
 * the sales form, with ?src= naming the tool. Beside the "See plans" link,
 * not instead of it.
 */
export function SalesContactLink({ locale, src }: { locale: DashLocale; src: string }) {
  return (
    <Link
      href={salesContactHref(locale, src)}
      className="mt-2 block text-sm font-medium text-blue-600 hover:text-blue-700"
      data-testid="sales-contact-link"
    >
      {SALES_COPY[locale].links.higherLimits}
    </Link>
  );
}
