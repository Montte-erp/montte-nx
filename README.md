# Montte

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

**Montte** is an AI-first ERP built to solve the financial management pain points of SaaS companies and coworking spaces. It combines traditional financial controls — bank accounts, transactions, bills, credit cards, budgets — with AI-powered analytics and an intelligent assistant (Rubi) that helps you understand your finances through natural language.

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

`bun dev` handles everything on first run — creates `apps/web/.env.local`, starts containers, pushes the DB schema, seeds the event catalog, and starts the app at `http://localhost:3000`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for staging setup and all available commands.

---

## Key Features

### Financial Management

- **Bank Accounts**: Connect and manage multiple bank accounts in one place
- **Transactions**: Import, categorize, and track all financial transactions with bulk operations and smart filters
- **Bills (Contas a Pagar)**: Manage payables, create bills from transactions, and track due dates
- **Credit Cards**: Track credit card spending and statements
- **Categories & Tags**: Organize finances with custom categories, subcategories, and cost centers (centros de custo)
- **Contacts**: Manage suppliers, clients, and service providers

### Budget & Goals

- **Budget Goals**: Set spending limits by category and track progress in real-time
- **Budget Alerts**: Automated notifications when spending approaches or exceeds thresholds (powered by background workers)

### Services & Inventory

- **Services**: Manage recurring and one-time services with analytics
- **Inventory**: Basic inventory tracking

### Analytics & Dashboards

- **Custom Dashboards**: Build dashboards with flexible insight tiles
- **Analytics Engine**: Breakdown and trend analysis across financial data
- **Event Catalog**: Track and analyze platform events with property definitions
- **Data Management**: Define and manage event definitions and properties

### AI Assistant (Rubi)

- **Chat Interface**: Natural language financial assistant accessible from any screen
- **Agent Network**: Multi-agent system powered by Mastra for intelligent routing and specialized tasks
- **Context-Aware**: Understands your financial data and provides relevant insights

### Integrations & Webhooks

- **Webhooks**: Configure outgoing webhooks for real-time event notifications
- **API Keys**: Programmatic access for external integrations

### Team Collaboration

- **Multi-tenant Organizations**: Isolated workspaces for each company
- **Teams**: Create teams within organizations with scoped access
- **Role-Based Access**: Owner, Admin, and Member roles with granular permissions
- **Invitations**: Invite members via email with pending invitation management

### Billing

Usage-based billing powered by Stripe meter events. Each billable event (AI chat, transactions, webhooks, etc.) has a free tier — usage above the free tier is metered and billed automatically. Optional addon subscriptions (Boost, Scale, Enterprise) unlock additional features.

### Security & Authentication

- Email/password, Google OAuth, Magic Link, Email OTP
- Two-factor authentication (2FA)
- Session management with device tracking
- Rate limiting and bot detection via Arcjet

---

## Tech Stack

Built as an **Nx** monorepo with **Bun**.

| Category      | Technology                                                                           |
| :------------ | :----------------------------------------------------------------------------------- |
| **Frontend**  | React 19, TanStack Start (SSR), TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS, TypeScript |
| **AI**        | Mastra (Agent orchestration)                                                         |
| **Backend**   | oRPC (type-safe API), ElysiaJS (SDK server), Drizzle ORM, PostgreSQL                 |
| **Auth**      | Better Auth                                                                          |
| **Jobs**      | BullMQ, Redis                                                                        |
| **Storage**   | MinIO (S3-compatible)                                                                |
| **Security**  | Arcjet (Rate limiting & bot detection)                                               |
| **Analytics** | PostHog                                                                              |
| **Email**     | Resend (React Email templates)                                                       |
| **Payments**  | Stripe                                                                               |
| **Tooling**   | Nx, oxlint, oxfmt                                                                    |

---

## Project Structure

```
montte-nx/
├── apps/
│   ├── web/             # TanStack Start (SSR) — dashboard + oRPC API routers
│   ├── server/          # Elysia API server for SDK consumers
│   └── worker/          # BullMQ background job processor
├── core/
│   ├── database/        # Drizzle ORM schemas & repositories
│   ├── authentication/  # Better Auth setup
│   ├── environment/     # Zod-validated env vars
│   ├── redis/           # Redis singleton
│   ├── logging/         # Pino logger + error classes
│   ├── files/           # MinIO file storage
│   ├── posthog/         # PostHog server/client + config
│   ├── stripe/          # Stripe singleton
│   ├── transactional/   # Resend + email templates
│   └── utils/           # Shared utilities
├── packages/
│   ├── agents/          # Mastra AI agents
│   ├── analytics/       # Analytics engine
│   ├── events/          # Event catalog, schemas, credits
│   ├── feedback/        # User feedback collection
│   └── ui/              # Radix + Tailwind component library
├── libraries/
│   ├── cli/             # @montte/cli — TanStack Intent skills + CLI tooling
│   └── hyprpay/         # @montte/hyprpay — HyprPay SDK
└── tooling/
    ├── oxc/             # oxlint + oxfmt configs
    └── typescript/      # Shared TypeScript configs
```

---

## Contributing

Contributions are welcome. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE.md](LICENSE.md) file for details.
