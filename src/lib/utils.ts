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
  STARTER: { locations: 1, requests: 500, sms: false, whitelabel: false, aiAnalysis: false, monitoring: false },
  GROWTH: { locations: 5, requests: 5000, sms: true, whitelabel: false, aiAnalysis: true, monitoring: false },
  AGENCY: { locations: 25, requests: 15000, sms: true, whitelabel: true, aiAnalysis: true, monitoring: false },
  ENTERPRISE: { locations: -1, requests: -1, sms: true, whitelabel: true, aiAnalysis: true, monitoring: true },
} as const;

export const PLAN_PRICES = {
  STARTER: 49,
  GROWTH: 149,
  AGENCY: 349,
  ENTERPRISE: 999,
} as const;
