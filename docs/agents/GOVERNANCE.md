# Application & Integration Governance — spec (2026-07-26)

Right-sized for a single-operator SaaS: a living inventory with owner, data
shared, and review date — not a CASB. The review IS the quarterly access
review (ACCESS.md LP3) extended with a vendor pass.

## G1 — Third-party inventory (living table, complete from recon)
| Vendor | Purpose | Data shared | Auth artifact | Risk notes |
|---|---|---|---|---|
| Cloudflare | DNS, TLS, email routing, (R2 planned) | traffic metadata, inbound mail | account + API tokens | critical path; MFA the account |
| Brevo | transactional email/SMS | customer emails/phones, content | API key in .env | webhook unsigned = H1 |
| DataForSEO | SEO data | keywords/domains queried (tenant-attributed internally only) | login+password .env | cost-capped, metered |
| Google (GSC OAuth) | Search Console data | per-tenant GSC metrics | encrypted refresh tokens | narrowest scopes verified |
| Google Places | competitor data | competitor names/places | API key .env | |
| S3 (datacleanupbucket) | backups (dead) | db dumps | dead keys | replace or retire → R2 |
| Tailscale | box access? | network | node key | confirm who's on the tailnet |
| (billing provider — from recon) | payments | PII + payment status | keys .env | webhook signature? |
Plus internal-but-shared: agoraiq services co-tenant on box/postgres/pm2
(SECURITY H2/D5 covers isolation).

## G2 — Outbound data map (what leaves the building)
For each vendor above: exactly which fields cross. Rule: PII crosses only to
Brevo (mail delivery necessity); DataForSEO/Places receive queries, never
customer identities; backups (once off-box) encrypted per DATA DP2b.

## G3 — Inbound surface (who can reach in)
Webhooks: Brevo (unsigned = H1), billing (verify signature exists).
Public API: /api/public/v1/* keyed, scopes pending LP4.
MCP server: exposes tenant SEO data to AI assistants via API key — same key
governance as public API; document tool list + confirm read-only.

## G4 — Review cadence + intake
Quarterly (with LP3 review): walk G1 — key still needed? rotate stale (>12mo)?
scopes minimal? vendor breach news? Update table, commit.
Intake rule for new vendors: add the row BEFORE the key enters .env; note
data shared + why. A vendor without a row is unapproved.

## G5 — Env-key hygiene (the enforcement hook)
scripts/access-review.ts (LP3) also diffs `grep -oE "^[A-Z_]+" .env` against
G1's auth-artifact column — any key in .env with no inventory row gets
flagged. Keeps the inventory honest automatically.

## G6 — Vendor risk assessments (2026-07-26; re-verify at quarterly review)

Method per vendor: certifications (from their trust page, not marketing),
data-shared tier (DATA.md DP1), incident history, contractual artifacts
(DPA signed?), and the compensating controls WE hold if they fail.

| Vendor | Certs (verify on trust page) | Tier shared | Incident history notes | Contract/DPA | Our compensating controls |
|---|---|---|---|---|---|
| Cloudflare | SOC 2 II, ISO 27001/27701, PCI (well-established) | traffic metadata, inbound mail | occasional global outages (availability, not breach) | self-serve ToS; DPA available — CONFIRM accepted | DNS exportable; MX re-pointable in minutes; not a data custodian for us |
| Brevo | ISO 27001; GDPR-native (FR) — VERIFY current | PII (emails/phones/content) | check their status page quarterly | DPA required (PII processor) — CONFIRM signed in account | highest-tier vendor: they hold customer PII; H1 webhook signing reduces inbound abuse; exportable contact data |
| Google (GSC/Places) | full suite (SOC/ISO/FedRAMP) | per-tenant GSC metrics; competitor queries | n/a at our scale | standard API terms + Cloud DPA | tokens encrypted our side; scopes minimal; revocable per tenant |
| DataForSEO | NO prominent SOC2/ISO found (2026-07) — ask support for security docs | queries only, never PII/identities | none known; small vendor | standard ToS; no DPA needed (no personal data) | tenant caps + metering; queries carry no customer identity; trivially replaceable (SERP data is commodity) |
| S3 bucket (current) | n/a — dead keys | encrypted dumps (planned) | — | — | replacing with R2 (consolidates onto Cloudflare assessment) |
| Tailscale (if in use) | SOC 2 II — VERIFY | network access to box | — | — | confirm tailnet membership at each review |
| Anthropic (Claude Code) | SOC 2 II, ISO 27001 | source code, .env-adjacent context during sessions | — | Commercial terms | least-context habit: secrets never pasted into prompts; this engagement's transcripts DID carry one burnt password — treat chat transcripts as a log tier (rotate anything pasted) |

Ranking by blast-radius if compromised: Brevo (PII) > Cloudflare (traffic
+ mail path) > Google (tenant metrics) > DataForSEO (queries) > rest.
Review actions each quarter: re-check each trust page, confirm DPAs, scan
for breach news, and prune any vendor whose row hasn't earned its keep.
