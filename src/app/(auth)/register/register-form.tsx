"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthContent } from "@/lib/i18n/auth-content";
import { postSignupRedirect } from "@/lib/plan-routing";

export default function RegisterForm({
  c,
  plan,
  brand,
}: {
  c: AuthContent["register"];
  plan?: string;
  brand?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, businessName, plan, brand }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || c.errFallback);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(c.errCreatedSigninFailed);
      } else {
        // AI_VISIBILITY signups land on /visibility; everyone else /dashboard.
        router.push(postSignupRedirect(data.planType ?? plan));
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
          id="name"
          label={c.nameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={c.namePh}
          required
        />

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
          id="businessName"
          label={c.businessLabel}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={c.businessPh}
          required
        />

        <Input
          id="password"
          label={c.passwordLabel}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={c.passwordPh}
          minLength={8}
          required
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {c.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {c.haveAccount}{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          {c.signIn}
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-gray-400">
        {c.trialNote}
      </p>
    </div>
  );
}
