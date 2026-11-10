"use client";

// Re-renders the server page every `seconds`, so /admin/crawl-metrics is a live view.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
