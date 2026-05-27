# EchoRank — Reputation Management & Customer Feedback Automation

Turn real customer feedback into more honest reviews, fewer public complaints, and better reputation intelligence.

## Overview

EchoRank is a multi-tenant B2B SaaS platform that helps businesses:

- **Collect feedback** — Send feedback requests by email or SMS after service
- **Route responses** — Satisfied customers (4-5 stars) get honest review requests; unhappy customers (1-3 stars) trigger recovery tickets
- **Recover customers** — Fix problems before they become public complaints
- **Track reputation** — Analytics across locations, campaigns, and customer sentiment
- **Manage at scale** — Multi-location support, team management, white-label for agencies

### Compliance

EchoRank does not create fake reviews, pressure customers, offer incentives for positive reviews, or block unhappy customers from reviewing. All feedback is authentic.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database URL and auth secret

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page.

### Demo Login

After seeding: `demo@echorank.io` / `password123`

## Architecture

### Multi-Tenant Model

Each tenant represents one business or agency client. All data is scoped by `tenantId`. Users can be members of multiple tenants with role-based access (Owner, Admin, Member).

### Customer Flow

1. Business adds a customer
2. System sends feedback request (email/SMS)
3. Customer clicks link, rates 1-5 with optional comment
4. **4-5 stars**: Polite honest review request sent
5. **1-3 stars**: Recovery ticket created, business alerted

### Database Schema

14 core tables: users, tenants, tenant_members, customers, feedback, review_links, review_requests, email_templates, sms_templates, recovery_tickets, email_logs, sms_logs, campaigns, subscriptions, audit_logs.

### API Routes

20 API endpoints covering authentication, customers, feedback, campaigns, recovery, analytics, templates, team management, review links, billing, webhooks, and tenant settings.

### Dashboard Pages

11 pages: Dashboard overview, Customers, Feedback inbox, Campaigns, Recovery tickets, Analytics, Templates, Review links, Team, Settings, Billing.

## Pricing Plans

| Feature | Starter ($29/mo) | Growth ($79/mo) | Agency ($199/mo) |
|---------|:-:|:-:|:-:|
| Locations | 1 | 3 | 20 |
| Requests/month | 300 | 2,000 | 10,000 |
| Email | Yes | Yes | Yes |
| SMS | - | Yes | Yes |
| Templates | - | Yes | Yes |
| Analytics | Basic | Full | Full |
| White-label | - | - | Yes |

## Project Structure

```
src/
  app/
    (auth)/          # Login and registration pages
    (dashboard)/     # All dashboard pages
    api/             # API routes
    f/[id]/          # Public feedback form
    layout.tsx       # Root layout
    page.tsx         # Landing page
  components/
    layout/          # Sidebar, header, shell
    ui/              # Reusable UI components
  lib/               # Core utilities and services
  types/             # TypeScript declarations
```
