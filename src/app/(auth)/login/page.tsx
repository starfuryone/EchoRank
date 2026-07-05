import { AUTH_CONTENT } from "@/lib/i18n/auth-content";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await resolveRequestLocale();
  const sp = await searchParams;

  // Honor the proxy's callbackUrl, same-origin paths only (no open redirect).
  const raw = sp.callbackUrl;
  const callbackUrl =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/dashboard";

  return <LoginForm c={AUTH_CONTENT[locale].login} callbackUrl={callbackUrl} />;
}
