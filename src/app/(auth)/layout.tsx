import Link from "next/link";
import { AUTH_CONTENT } from "@/lib/i18n/auth-content";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { CONTENT } from "@/lib/i18n/content";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveRequestLocale();
  const c = AUTH_CONTENT[locale].layout;
  const foot = CONTENT[locale].footer;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      {/* Branding — same mark as the homepage */}
      <Link href="/" className="mb-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/echorank-logo-light.svg"
          alt="ECHORANK 360"
          className="h-10 w-auto"
        />
      </Link>

      {/* Auth card */}
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-white p-8 shadow-xl">
        {children}
      </div>

      <p className="mt-8 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} EchoRank. {c.rights}
      </p>
      <p className="mt-2 text-center text-[11px] tracking-wide text-zinc-600">
        {foot.links.map((l) => (
          <Link key={l.label} href={`/${locale}${l.href}`} className="mx-2 hover:text-zinc-400">
            {l.label}
          </Link>
        ))}
      </p>
    </div>
  );
}
