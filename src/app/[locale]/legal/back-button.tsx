"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  locale,
  label,
  className,
}: {
  locale: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(`/${locale}`);
      }}
    >
      {label}
    </button>
  );
}
