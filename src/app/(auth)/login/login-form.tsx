"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthContent } from "@/lib/i18n/auth-content";

export default function LoginForm({
  c,
  callbackUrl,
}: {
  c: AuthContent["login"];
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(c.errInvalid);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError(c.errUnexpected);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        {c.h2}
      </h2>
      <p className="text-gray-500 text-center mb-8">{c.sub}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          id="email"
          label={c.emailLabel}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={c.emailPh}
          required
        />

        <Input
          id="password"
          label={c.passwordLabel}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={c.passwordPh}
          required
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {c.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {c.noAccount}{" "}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
          {c.startTrial}
        </Link>
      </p>
    </div>
  );
}
