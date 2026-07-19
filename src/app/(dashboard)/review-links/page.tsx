import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ReviewLinksPageClient } from "./page-client";

export default async function ReviewLinksPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <ReviewLinksPageClient locale={locale} />;
}
