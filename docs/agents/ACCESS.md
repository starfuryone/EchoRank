# Least-Privilege Access — spec (2026-07-26)

Verified: Role enum OWNER/ADMIN/MEMBER; requireRole guards team/tenants/
admin/compliance correctly (erase=OWNER-only, self-role-change blocked,
OWNER shielded from ADMIN). AuditLog model + createAuditLog helper exist,
used only by feedback/team. Gap: ~20 mutating routes check tenant but not
role — MEMBER == ADMIN for all business data today.

## LP1 — Central permission map + enforcement sweep
Create src/lib/permissions.ts — single source of truth:

  export const PERMISSIONS = {
    // destructive on business data → ADMIN+
    "customers.delete": ["OWNER","ADMIN"],
    "campaigns.delete": ["OWNER","ADMIN"],
    "templates.delete": ["OWNER","ADMIN"],
    "review_links.delete": ["OWNER","ADMIN"],
    "monitoring.sources.delete": ["OWNER","ADMIN"],
    "compliance.erase": ["OWNER"],
    "compliance.export": ["OWNER","ADMIN"],
    "team.manage": ["OWNER","ADMIN"],
    "tenant.settings": ["OWNER","ADMIN"],
    "billing.manage": ["OWNER"],
    "api_keys.manage": ["OWNER","ADMIN"],
    // create/update on business data → any member (day-to-day work)
    "customers.write": ["OWNER","ADMIN","MEMBER"],
    "campaigns.write": ["OWNER","ADMIN","MEMBER"],
    // ...complete during implementation from the route list below
  } as const;
  export async function requirePermission(p: keyof typeof PERMISSIONS)

Sweep list (mutating, tenant-auth'd, currently role-unchecked): feedback,
campaigns(+[id]), templates(+[id]), monitoring/report+sources(+[id]),
onboarding, customers(+[id]), review-links(+[id]), seo/v1/keywords/overview,
ai/analyze, ai/respond, ai/alerts, ai/visibility/{attribute,audit,remediate}
(+ re-run the recon grep for the tail cut at head -20).
Policy default: DELETE → ADMIN+; POST/PATCH → MEMBER ok unless it spends
money or touches config (seo routes = MEMBER ok, they're the product;
ai/remediate → ADMIN+ if it mutates external state — decide on read).
Existing requireRole call sites migrate to requirePermission for one vocab.

## LP2 — Audit coverage for privileged + destructive actions
createAuditLog on: every DELETE, role changes (done), API key issue/revoke,
billing changes, compliance ops (verify), login already logged via pino.
Cheap: the helper exists; add ~15 call sites during the LP1 sweep.

## LP3 — Access review, quarterly, artifact-producing
scripts/access-review.ts (tsx): per tenant — members w/ role + user email +
last login (from pino logs or add lastLoginAt to User in I1), API keys w/
age + last-used, dormant flags (>90d no login), OWNER count (=1 warn if 0
or many). Output markdown to docs/reviews/YYYY-QN.md; review = read it,
deactivate dormants (needs I1), rotate stale keys, commit the report.

## LP4 — API key scopes (with I-phases or after)
ApiKey gets scopes[] (read / write / per-feature); public/v1 + MCP auth
checks scope before handler. Default new keys read-only.

Dependencies: I1 (deactivation) is the enforcement lever for LP3 findings.
Sequencing: LP1+LP2 one session (mechanical, testable: MEMBER gets 403 on
delete, ADMIN succeeds, audit row written). LP3 30 min. LP4 with identity.
