import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export const PLAN_LIMITS = {
  STARTER: { locations: 1, requests: 300, sms: false, whitelabel: false },
  GROWTH: { locations: 3, requests: 2000, sms: true, whitelabel: false },
  AGENCY: { locations: 20, requests: 10000, sms: true, whitelabel: true },
} as const;

export const PLAN_PRICES = {
  STARTER: 29,
  GROWTH: 79,
  AGENCY: 199,
} as const;
