import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PlanType } from "@/generated/prisma";
import { PLAN_CONFIGS } from "./plan-config";
import { hasFeature } from "./feature-flags";

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

export interface PlanLimit {
  locations: number;
  requests: number;
  sms: boolean;
  whitelabel: boolean;
  aiAnalysis: boolean;
  monitoring: boolean;
}

// Derived from plan-config.ts (the single source of truth for plan limits) and
// the feature matrix, so there is exactly one place these numbers live.
const PLAN_TYPES = Object.keys(PLAN_CONFIGS) as PlanType[];

export const PLAN_LIMITS: Record<PlanType, PlanLimit> = Object.fromEntries(
  PLAN_TYPES.map((plan) => {
    const q = PLAN_CONFIGS[plan].quotaDefaults;
    return [
      plan,
      {
        locations: q.maxLocations,
        requests: q.maxRequestsPerMonth,
        sms: q.maxSmsPerMonth > 0,
        whitelabel: hasFeature(plan, "whitelabel"),
        aiAnalysis: hasFeature(plan, "ai_analysis"),
        monitoring: hasFeature(plan, "reputation_monitoring"),
      } satisfies PlanLimit,
    ];
  }),
) as Record<PlanType, PlanLimit>;

export const PLAN_PRICES: Record<PlanType, number> = Object.fromEntries(
  PLAN_TYPES.map((plan) => [plan, PLAN_CONFIGS[plan].monthlyPrice]),
) as Record<PlanType, number>;
