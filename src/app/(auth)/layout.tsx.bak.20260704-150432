import { Megaphone } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Branding */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-gray-900">
          EchoRank
        </span>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {children}
      </div>

      <p className="mt-8 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} EchoRank. All rights reserved.
      </p>
    </div>
  );
}
