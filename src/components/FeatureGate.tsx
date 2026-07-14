// components/FeatureGate.tsx
'use client';

import type { ReactNode } from 'react';
import { hasFeature, minPlanFor, type Feature, type Plan } from '@/lib/entitlements';

interface FeatureGateProps {
  plan: Plan | null | undefined;
  feature: Feature;
  children: ReactNode;
  /** Rendered when locked. Defaults to an upsell card in brand dark/gold. */
  fallback?: ReactNode;
}

export function FeatureGate({ plan, feature, children, fallback }: FeatureGateProps) {
  if (hasFeature(plan, feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  const needed = minPlanFor(feature);
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
        Upgrade to <strong>{needed}</strong> to unlock this feature.
      </p>
      <a
        href="/pricing"
        style={{ display: 'inline-block', marginTop: '0.75rem', fontWeight: 600 }}
      >
        View plans →
      </a>
    </div>
  );
}
