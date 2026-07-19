import { AUTH_CONTENT } from "@/lib/i18n/auth-content";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import RegisterForm from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; brand?: string }>;
}) {
  const locale = await resolveRequestLocale();
  const { plan, brand } = await searchParams;
  return <RegisterForm c={AUTH_CONTENT[locale].register} plan={plan} brand={brand} />;
}
