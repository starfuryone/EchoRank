// components/FeatureGate.tsx
'use client';

import type { ReactNode } from 'react';
import { hasFeature, getMinimumPlan, type Feature } from '@/lib/feature-flags';
import { planConfig } from '@/lib/plan-config';
import type { PlanType } from '@/generated/prisma';

interface FeatureGateProps {
  plan: PlanType | null | undefined;
  feature: Feature;
  children: ReactNode;
  /** Rendered when locked. Defaults to an upsell card in brand dark/gold. */
  fallback?: ReactNode;
}

export function FeatureGate({ plan, feature, children, fallback }: FeatureGateProps) {
  if (plan && hasFeature(plan, feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  const needed = getMinimumPlan(feature);
  const config = planConfig(needed);
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface2)',
        borderRadius: 12,
        padding: '1.5rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, opacity: 0.8 }}>
        Upgrade to <strong>{config.name}</strong> to unlock this feature.
      </p>
      <a
        href={config.ctaLink}
        style={{ display: 'inline-block', marginTop: '0.75rem', fontWeight: 600 }}
      >
        {config.cta} →
      </a>
    </div>
  );
}
