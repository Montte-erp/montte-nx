# Montte

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

**Montte** is an open source, AI-native ERP for SaaS companies and coworking spaces in Brazil. Today the product focuses on the ERP screens for finance, CRM, analytics, accounts and teams. **Montte AI** is present as the AI layer, but operational skills and automations are not available yet; future skills are planned for finance, classification, contacts, insights and onboarding.

> **Status:** pre-launch private beta. Not on production yet. Expect breaking changes.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0
- [Docker](https://docs.docker.com/get-docker/) or [Podman](https://podman.io/) with Compose

### Setup

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun dev
```

`bun dev` handles everything on first run — creates `apps/web/.env.local` from `.env.example`, installs dependencies if missing, starts the local containers, pushes the DB schema, then runs `web` (http://localhost:3000), `worker` (DBOS), and `landing` (http://localhost:3001) in parallel.

See [CONTRIBUTING.md](CONTRIBUTING.md) for staging setup and all available commands.

---

## What Montte does today

### Finance (`@modules/finance`)

- **Bank accounts** — manage multiple accounts, balances tracked per account
- **Transactions** — import (CSV/XLSX/OFX), categorize, bulk operations, smart filters; statement import auto-categorizes via AI when enabled
- **Credit cards** — track cards, statements and totals

### CRM & contacts (`@modules/account`, `@modules/classification`)

- **Contacts** — clients, suppliers and service providers
- **Categories & tags** — custom categories with subcategories; tags double as **centros de custo** (cost centers) for project-level breakdowns

### Analytics (`@modules/insights`)

- **Custom dashboards** — flexible insight tiles you arrange yourself
- **Analytics engine** — breakdowns, trends, KPIs, time series across financial data

### Montte AI — the AI layer (`@modules/agents`)

- **Chat-first UX** — Montte AI is a persistent drawer available on every page; ask in Portuguese, get answers backed by your real data
- **Tools wrap oRPC procedures** — Montte AI reads and writes through the same API your dashboard uses; no parallel implementation
- **Skills** — no operational skills are available today; `finance`, `classification`, `contacts`, `insights`, and `onboarding` are planned next
- **Multi-model via TanStack AI + OpenRouter** — model selection per call

### Account & teams (`@modules/account`)

- **Multi-tenant organizations** with team-scoped data isolation
- **Roles**: owner, admin, member with granular permissions
- **Email invitations** with pending invite management
- **Onboarding** — minimal CNPJ + profile flow today; conversational chat-onboarding via Montte AI shipping in v1

### Integrations

- **Public API** — every oRPC procedure is exposed via OpenAPI at `/api/openapi/docs` (Scalar reference). Authenticate with API keys.
- **Webhooks** — outgoing webhooks for real-time event notifications
- **API keys** — programmatic access from Settings → Project → API Keys

### Auth & security (`@core/authentication`)

- Email/password, Magic Link, Email OTP
- Two-factor authentication (2FA)
- Organization + API key plugins
- Session management with device tracking

### What's NOT in the box yet

These are tracked publicly on Linear and GitHub — they're real next, not today:

- **Pay-as-you-go billing** — landed after the HyprPay payment layer ships
- **NFe (Nota Fiscal Eletrônica)** — own implementation, no third-party SaaS
- **GED** — document management with OCR + ParadeDB BM25 search
- **E-signature** — DocuSeal self-hosted
- **Inventory** — unified SKU / service / space model (ex-`@modules/inventory` was removed and is being redesigned)

If you're seeing a feature mentioned in older docs, blog posts, or the Linear backlog that isn't here, it was either removed or hasn't shipped yet. The README is the source of truth.

---

## Tech Stack

Built as an **Nx** monorepo with **Bun**.

| Category      | Technology                                                                                                          |
| :------------ | :------------------------------------------------------------------------------------------------------------------ |
| **Frontend**  | React 19, TanStack Start (SSR), Astro landing, TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS, TypeScript |
| **AI**        | TanStack AI + `@tanstack/ai-openrouter`                                                                             |
| **Backend**   | oRPC (type-safe API + OpenAPI), Drizzle ORM, PostgreSQL (ParadeDB image)                                            |
| **Auth**      | Better Auth (Magic Link, Email OTP, 2FA, Organization, API Key plugins)                                             |
| **Workflows** | DBOS (durable workflows, queues, cron, retries) running in `apps/worker`                                            |
| **Realtime**  | `@core/sse` — scope-routed Redis pub/sub (user / team / org)                                                        |
| **Storage**   | MinIO (S3-compatible)                                                                                               |
| **Analytics** | PostHog (server + client; surveys + feature flags + early-access)                                                   |
| **Email**     | Resend (React Email templates)                                                                                      |
| **Tooling**   | Nx, oxlint, oxfmt                                                                                                   |

---

## Project Structure

```
montte-nx/
├── apps/
│   ├── landing/         # Astro public landing page
│   ├── web/             # TanStack Start (SSR) — dashboard + oRPC aggregator
│   └── worker/          # DBOS runtime — durable workflows for all modules
├── core/                # Infra packages (no domain logic)
│   ├── ai/              # AI primitives (chat, middleware, schemas)
│   ├── authentication/  # Better Auth setup (server + client)
│   ├── database/        # Drizzle schemas + client (schemas: auth, finance, crm, platform, settings, agents)
│   ├── dbos/            # DBOS factory + testing helpers
│   ├── environment/     # Zod-validated env vars (web + worker)
│   ├── files/           # MinIO file storage client
│   ├── logging/         # Pino logger + WebAppError + OTel
│   ├── orpc/            # oRPC server + procedures + context + telemetry
│   ├── posthog/         # PostHog server/client + surveys/flags config
│   ├── redis/           # Redis singleton
│   ├── sse/             # Agnostic SSE pub/sub over Redis
│   ├── transactional/   # Resend + transactional email templates
│   └── utils/           # Shared utilities
├── modules/             # Domain modules — each owns its router, services, workflows, sse
│   ├── account/         # Profile, org, team, sessions, API keys, onboarding, settings
│   ├── agents/          # Montte AI chat + threads + tools + skills
│   ├── billing/         # Services catalog, meters, prices, subscriptions, benefits, coupons, usage
│   ├── classification/  # Categories, tags, AI categorization workflows
│   ├── finance/         # Bank accounts, transactions, credit cards
│   └── insights/        # Dashboards, insights, analytics
├── packages/
│   └── ui/              # shadcn primitives + Montte components
└── tooling/
    ├── boundary/        # Import boundary rules
    ├── css/             # Tailwind config
    ├── oxc/             # oxlint + oxfmt configs
    └── typescript/      # Shared TypeScript configs
```

The web app is the host: it imports routers from each `@modules/*` package and aggregates them in `apps/web/src/integrations/orpc/router/index.ts`. Workflows run in the separate `apps/worker` process. New domains land as a new `modules/<name>` package with its own router, services, workflows and (optionally) SSE channels.

---

## Public API

Every oRPC procedure is exposed via OpenAPI when the app runs. Open the interactive reference at:

```
http://localhost:3000/api/openapi/docs
```

Authenticate with `x-api-key` (created in Settings → Project → API Keys) or with the session cookie when called from a logged-in browser.

---

## Roadmap & contributing

- The roadmap and active work are public on Linear at [linear.app/montte](https://linear.app/montte).
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before sending a PR. Code style is opinionated and enforced (oxlint + oxfmt + boundary rules).
- Bugs and feature requests welcome as GitHub issues.

## License

Apache-2.0. See [LICENSE.md](LICENSE.md).
