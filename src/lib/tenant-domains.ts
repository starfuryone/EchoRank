// ---------------------------------------------------------------------------
// Tenant Domain Services – domain-specific views of the Tenant model
//
// Instead of splitting the Tenant table (which would break queries), this
// module provides focused accessors that select only the fields needed for
// each domain concern.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { PlanType, BillingStatus } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Domain Interfaces
// ---------------------------------------------------------------------------

export interface TenantIdentity {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface TenantBranding {
  logo: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  supportEmail: string | null;
  whitelabel: boolean;
  customDomain: string | null;
}

export interface TenantBilling {
  planType: PlanType;
  billingStatus: BillingStatus;
  monthlyRequestLimit: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface TenantReviewConfig {
  googleReviewLink: string | null;
  facebookReviewLink: string | null;
  trustpilotLink: string | null;
  defaultLanguage: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Accessor Functions
// ---------------------------------------------------------------------------

/**
 * Fetch only the identity fields for a tenant (fast query with select).
 */
export async function getTenantIdentity(
  tenantId: string,
): Promise<TenantIdentity | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });
}

/**
 * Fetch only the branding fields for a tenant.
 */
export async function getTenantBranding(
  tenantId: string,
): Promise<TenantBranding | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      logo: true,
      brandPrimaryColor: true,
      brandSecondaryColor: true,
      supportEmail: true,
      whitelabel: true,
      customDomain: true,
    },
  });
}

/**
 * Fetch only the billing fields for a tenant.
 */
export async function getTenantBilling(
  tenantId: string,
): Promise<TenantBilling | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      planType: true,
      billingStatus: true,
      monthlyRequestLimit: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
}

/**
 * Fetch only the review configuration fields for a tenant.
 */
export async function getTenantReviewConfig(
  tenantId: string,
): Promise<TenantReviewConfig | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      googleReviewLink: true,
      facebookReviewLink: true,
      trustpilotLink: true,
      defaultLanguage: true,
      timezone: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Update Functions
// ---------------------------------------------------------------------------

/**
 * Update only the branding fields for a tenant.
 */
export async function updateTenantBranding(
  tenantId: string,
  data: Partial<TenantBranding>,
): Promise<TenantBranding> {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.brandPrimaryColor !== undefined && {
        brandPrimaryColor: data.brandPrimaryColor,
      }),
      ...(data.brandSecondaryColor !== undefined && {
        brandSecondaryColor: data.brandSecondaryColor,
      }),
      ...(data.supportEmail !== undefined && { supportEmail: data.supportEmail }),
      ...(data.whitelabel !== undefined && { whitelabel: data.whitelabel }),
      ...(data.customDomain !== undefined && { customDomain: data.customDomain }),
    },
    select: {
      logo: true,
      brandPrimaryColor: true,
      brandSecondaryColor: true,
      supportEmail: true,
      whitelabel: true,
      customDomain: true,
    },
  });
}

/**
 * Update only the billing fields for a tenant.
 */
export async function updateTenantBilling(
  tenantId: string,
  data: Partial<TenantBilling>,
): Promise<TenantBilling> {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(data.planType !== undefined && { planType: data.planType }),
      ...(data.billingStatus !== undefined && {
        billingStatus: data.billingStatus,
      }),
      ...(data.monthlyRequestLimit !== undefined && {
        monthlyRequestLimit: data.monthlyRequestLimit,
      }),
      ...(data.stripeCustomerId !== undefined && {
        stripeCustomerId: data.stripeCustomerId,
      }),
      ...(data.stripeSubscriptionId !== undefined && {
        stripeSubscriptionId: data.stripeSubscriptionId,
      }),
    },
    select: {
      planType: true,
      billingStatus: true,
      monthlyRequestLimit: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
}
