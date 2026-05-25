# Code Context

## Files Retrieved
1. `README.md` (lines 6-10, 63-121, 132-140) - canonical product/current-state summary says Montte is Autumn+Rillet-inspired, pre-launch, current app surface, and notes billing package is absent.
2. `PRODUCT.md` (lines 17-24, 55) - product direction: billing layer for Brazilian SaaS, Autumn/Rillet mental model, recurrence as system.
3. `CONTRIBUTING.md` (lines 108-112) - repo rule: official integrations are PostHog and Twenty; no new official integration without product decision.
4. `core/database/src/schema.ts` (lines 1-17) - actual source schema exports; important because billing/inventory schemas are not exported from source.
5. `core/database/src/schemas/relationships.ts` (lines 15-67, 324-407) - current customers/suppliers schema and validation.
6. `modules/relationships/src/router/index.ts` (lines 95-125, 172-185, 216-310, 395-566) - current relationships procedures, financial-link guard, archive/restore, CNPJ lookup.
7. `apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-nav-items.ts` (lines 36-138) - product route groups currently exposed in sidebar.
8. `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/customers.tsx` (lines 1-70) - customers route uses shared relationships table.
9. `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/suppliers.tsx` (lines 1-70) - suppliers route uses shared relationships table.
10. `apps/web/src/integrations/tanstack-db/relationships.ts` (lines 1-210) - frontend live/optimistic collection for relationships.
11. `apps/web/src/integrations/orpc/router/index.ts` (lines 1-66) - oRPC aggregator; shows which modules are currently product APIs.
12. `core/database/src/schemas/transactions.ts` (lines 31-120, 187-205) - existing finance transaction primitive with payment methods, relationship link, line items.
13. `core/database/src/schemas/workflows.ts` (lines 16-190) - current automation schema: fixed schedule trigger + create-report action and runs.
14. `modules/workflows/PLAN.md` (lines 7-20, 152-181, 386-414, 441) - workflow v1 scope/non-goals and intended DBOS runtime; clarifies what automation does not do yet.
15. `modules/workflows/src/router.ts` (lines 1-260) - current workflows oRPC implementation entry, templates/create/update/run/list behavior.
16. `modules/workflows/src/runtime.ts` (lines 1-220) - current DBOS/runtime helpers for loading workflows/runs and report execution.
17. `apps/worker/README.md` (lines 1-20, 44-56) - worker runs DBOS background workflows, currently categorization-focused; env shape.
18. `modules/agents/src/agent.ts` (lines 1-207) - current TanStack AI runtime, tools, PostHog prompt loading, json-render primer, OTel metadata.
19. `modules/agents/src/skills.ts` (lines 1-27) - current skill catalog has only `financeiro`.
20. `modules/agents/src/tools/registry.ts` (lines 1-65) - current agent tools are read-only finance/classification/cards/reports via oRPC client.
21. `core/database/src/schemas/agents.ts` (lines 1-34) - agent settings include data source toggles for transactions, contacts, services.
22. `core/database/src/schemas/messages.ts` (lines 15-25, 30-57) - thread message metadata has page context and `skillHint`.
23. `apps/web/src-tauri/tauri.conf.json` (lines 1-36) - desktop shell exists via Tauri, currently basic web shell config.
24. `apps/web/package.json` (lines 5-16, 52-60, 68-77, 120-125) - web scripts/deps include Tauri, AI, modules; no billing module dependency.
25. `package.json` (lines 31-52, 70-78, 102-104, 207-218, 241-242, 269) - root catalogs/scripts include Stripe catalog, OFX parser, Tauri, TanStack AI, DBOS, pg-boss.
26. `core/environment/src/web.ts` (lines 1-35) and `core/environment/src/worker.ts` (lines 1-25) - env schemas have database/PostHog/Resend/OpenRouter/Redis; no active Stripe/Abacate/Open Finance provider env in source.
27. `core/database/dist/schemas/{services,subscriptions,meters,usage-events,invoices,inventory}.d.ts` (lines 1-160 each sampled) - generated/stale declarations mention service/billing/inventory primitives, but corresponding `core/database/src/schemas/*.ts` files are absent.

## Key Code

### Product thesis already points at billing + AI-native finance

`README.md` says Montte is a Brazilian SaaS billing layer and uses the internal mental model “Autumn + Rillet”: Autumn for dev-facing billing/customer state, Rillet for finance/accounting/ops AI-native. It also says the main surface today is the web dashboard with finance, classification, inbox, reports, settings, API keys and Montte AI (`README.md` lines 6-10).

`PRODUCT.md` makes the same direction more explicit: recurrence is not just checkout; it includes customer, service, usage, benefit, contract, finance, delinquency and action (`PRODUCT.md` lines 17-24, 55).

### Source modules that actually exist today

Current `modules/` source packages are:

```text
account
agents
cards
cashbook
classification
inbox
insights
relationships
workflows
```

There is no source package named `billing`, `services`, `products`, `inventory`, `payments`, `vault`, `certificates`, `nfe`, `open-finance`, `integrations`, or `desktop` under `modules/`.

The app API aggregator exposes these modules today:

```ts
// apps/web/src/integrations/orpc/router/index.ts lines 37-66
export default {
   account,
   agentSettings,
   apiKeys,
   bankAccounts,
   creditCards,
   categories,
   categoriesBulk,
   cnpj,
   financialSettings,
   inbox,
   reports,
   onboarding,
   session,
   statements,
   tags,
   team,
   relationships,
   transactions,
   workflows,
   organization,
   threads: { create, chat, getById, list, remove, ... },
};
```

### Relationships: customers/suppliers exist, but are shallow

The relationships schema is one table: `relationships.parties` with role `customer | supplier`, kind `person | company`, name, document, email, phone, archive timestamps, and team scope (`core/database/src/schemas/relationships.ts` lines 15-67).

Validation supports CPF/CNPJ and discriminates person/company (`core/database/src/schemas/relationships.ts` lines 324-407).

The router supports list/create/update/delete/archive/restore and CNPJ lookup. Delete is blocked when a transaction references the party (`modules/relationships/src/router/index.ts` lines 172-185, 395-417). CNPJ lookup uses BrasilAPI and requires active status (`modules/relationships/src/router/index.ts` lines 524-563).

Gaps for the requested roadmap:

- no contracts schema/module;
- no customer state aggregate like `customers.state`;
- no relationship events/timeline;
- no contacts/address/representatives beyond email/phone;
- no Twenty sync in code yet;
- no service/subscription/invoice linkage from party in active source.

### Contracts do not exist as first-class source code

No source schema/router/module named contracts was found. Current party records can link to transactions only via `transactions.relationshipId` (`core/database/src/schemas/transactions.ts` lines 112-114). Contracts would need a new domain primitive, likely after stabilizing customer/service/subscription primitives.

### Billing/services/products/stock: mostly absent in active source

Important nuance: `README.md` says a billing base exists in schemas like `services`, `meters`, `prices`, `subscriptions`, `subscription-items`, `coupons`, `benefits`, `invoices`, `usage-events` (`README.md` lines 114-116). However, active source exports in `core/database/src/schema.ts` only include agents/auth/bank/accounts/categories/cards/inbox/reports/relationships/workflows/settings/tags/threads/messages/transactions (`core/database/src/schema.ts` lines 1-17). There are no matching source files under `core/database/src/schemas/` for services/meters/prices/subscriptions/invoices/usage-events/inventory.

Generated declarations under `core/database/dist/schemas/` do contain old/stale-looking types for `services`, `contact_subscriptions`, `meters`, `usage_events`, `invoices`, and `inventory_products`. Treat these as evidence of a prior or uncommitted direction, not active source of truth, until source schemas are restored/added.

Current active primitives that can support future billing:

- `transactions.paymentMethod` enum includes `pix`, `boleto`, cards, transfer, cash, etc. (`core/database/src/schemas/transactions.ts` lines 31-41).
- transactions support status `pending | paid | cancelled`, `dueDate`, `paidAt`, installments/recurrence fields, relationship link, attachments, and line items (`core/database/src/schemas/transactions.ts` lines 65-120, 187-205).
- dependencies include Stripe catalog only (`package.json` lines 102-104), but no active provider integration/router/env is present.

Gaps:

- no `@modules/billing`;
- no active services/products/prices/meters/subscriptions/invoices source schemas;
- no stock/inventory source module;
- no entitlement/benefit state;
- no usage ingestion API;
- no invoice generation workflow;
- no customer portal/checkout/payment provider abstraction;
- no AbacatePay integration.

### Payments/vault

Active source has no `payments` or `vault` module. Root package catalog contains `stripe` (`package.json` lines 102-104) and Better Auth has a Stripe package in catalog (`package.json` lines 31-37), but env schemas for web/worker do not define Stripe keys or any AbacatePay keys (`core/environment/src/web.ts` lines 1-35; `core/environment/src/worker.ts` lines 1-25). `apps/worker/README.md` still mentions `STRIPE_SECRET_KEY` (`apps/worker/README.md` lines 44-56), which appears stale relative to current `core/environment/src/worker.ts`.

Gaps:

- no provider abstraction;
- no vault/token storage for provider credentials;
- no webhook ingestion module;
- no payment lifecycle state machine;
- no Pix/Boleto provider integration;
- no reconciliation link from provider events to transactions.

### Certificates, NFe, CNPJ

CNPJ exists only as lookup/enrichment:

- account-level `fetchCnpjData` in `modules/account/src/router/cnpj.ts` validates 14 digits, calls BrasilAPI, requires active Receita status.
- relationships-level `cnpjLookup` mirrors this behavior (`modules/relationships/src/router/index.ts` lines 524-563).

No source code found for:

- digital certificate storage/validation/rotation;
- NFe/NFSe emission;
- DFe inbound/manifestação;
- SEFAZ/municipal provider adapters;
- CNPJ monitoring jobs;
- fiscal document schemas.

### Open Finance

No Pluggy/Polp/Open Finance module or provider code found. Existing related finance ingestion is file import-oriented: `@f-o-t/ofx` appears in root catalog and web deps (`package.json` lines 70-78; `apps/web/package.json` line 45), and cashbook has import routes/services. This is not Open Finance.

Gaps:

- no bank connector accounts/items/consents schema;
- no Pluggy/Polp adapter;
- no transaction sync job;
- no consent lifecycle UI;
- no provider webhook handling;
- no reconciliation pipeline from Open Finance transactions into cashbook.

### Workflows/automation exist, but v1 is narrow

Current schema supports only a fixed graph: schedule trigger -> create report action (`core/database/src/schemas/workflows.ts` lines 71-105). Tables are `platform.workflows` and `platform.workflow_runs` (`core/database/src/schemas/workflows.ts` lines 110-176).

The plan explicitly says v1 has a single schedule trigger and single create-report action, and excludes event-based triggers, webhooks, HTTP actions, email, Slack, branches, loops, parallel, free builder, versioning, and multi-step workflows (`modules/workflows/PLAN.md` lines 7-20). It also documents future/implemented DBOS scheduled poller intent (`modules/workflows/PLAN.md` lines 175-181).

Gaps for AI-native ERP/billing:

- no customer/subscription/payment/invoice events as triggers;
- no email/WhatsApp/payment reminder actions;
- no provider/webhook triggers;
- no approval gates;
- no workflow versioning/audit for business-critical automations;
- no PostHog/Twenty workflow integration implemented.

### Integrations

Official integrations are product-approved as PostHog and Twenty only (`CONTRIBUTING.md` line 112). Current code has PostHog packages and integration files, but no source Twenty integration found. Landing/blog/product docs mention Twenty as planned/internal, not implemented.

Gaps:

- no `modules/integrations`;
- no Twenty API client/sync/webhooks;
- no PostHog workflow action bridge;
- no integration credential vault;
- no generic webhook/event bus for external systems.

### Desktop/Tauri exists as a shell, not device integration yet

Tauri config exists at `apps/web/src-tauri/tauri.conf.json`: product name Montte, desktop identifier, dev URL, build command, single main window, bundle config (`apps/web/src-tauri/tauri.conf.json` lines 1-36). Scripts exist for `desktop:dev` and `desktop:build` in `apps/web/package.json` lines 5-16 and root scripts in `package.json` lines 241, 269.

Gaps:

- no Tauri Rust command source observed beyond config;
- no device integrations/printer/certificate store/local file watcher;
- CSP is null in config (`apps/web/src-tauri/tauri.conf.json` lines 24-26), worth revisiting before physical-device integrations.

### AI agent infrastructure is real but finance-only/read-heavy

`modules/agents/src/agent.ts` uses TanStack AI `chat`, converts UI messages, adds an advisor tool + read tools, loads PostHog prompts, includes page context, disables parallel tool calls, caps loop with `maxIterations(8)`, and attaches OTel metadata (`modules/agents/src/agent.ts` lines 90-207).

Skill catalog has only one skill, `financeiro` (`modules/agents/src/skills.ts` lines 8-16). Tool registry builds read tools for bank accounts, categories, credit cards, reports, statements, tags, and transactions (`modules/agents/src/tools/registry.ts` lines 20-65). Agent settings already anticipate `dataSourceContacts` and `dataSourceServices` toggles (`core/database/src/schemas/agents.ts` lines 19-23), but no services source module exists.

Gaps:

- no billing/relationships/contracts/Open Finance/NFe skills;
- no write/approval tool governance for billing actions;
- no tool discovery/lazy loading in active source;
- no harness/evals directory in active source;
- no AI-native OpenUI component registry beyond json-render primer;
- no async job/workflow tools exposed to agent yet.

## Architecture

Current Montte is a Postgres/Drizzle/oRPC/TanStack Start app with domain modules. The strongest active foundations for the requested AI-native ERP/billing roadmap are:

1. **Finance ledger/cashbook base** — transactions, accounts, cards, categories, tags, reports, status/due dates, line items, relationship linkage.
2. **Relationships base** — parties table for customers/suppliers with document validation and CNPJ lookup.
3. **Workflow base** — DBOS-backed workflow module and worker process, but currently only scheduled report generation/categorization-style jobs.
4. **Agent base** — TanStack AI runtime, thread/message persistence, PostHog prompt loading, read tools over existing oRPC procedures.
5. **Desktop base** — Tauri shell exists, but no native device integration yet.

The requested roadmap domains mostly need new first-class modules/schemas, not just polishing:

```text
relationships today
  parties(customer/supplier) -> transactions.relationshipId

needed next
  customers/suppliers -> contracts -> services/products -> prices/meters -> subscriptions -> invoices -> payments -> fiscal docs -> reconciliation -> AI/native workflows
```

Postgres-only is compatible with this repo: all active schemas are Drizzle/Postgres, DBOS is PostgreSQL-backed per worker README, and no separate datastore is needed.

## Start Here

Start with `PRODUCT.md` lines 17-24 and `README.md` lines 6-10, then open `core/database/src/schema.ts` lines 1-17. These show the intended product direction versus the actual active source boundary. After that, open `core/database/src/schemas/relationships.ts` and `core/database/src/schemas/transactions.ts` to design the first real bridge: customer/supplier -> contract/service/subscription -> financial transaction.

## Likely Gaps / Roadmap Implications

1. **Resolve source-of-truth mismatch first.** README claims billing schemas exist, but source exports do not. Decide whether to restore old `dist` schemas into source or redesign cleanly.
2. **Create a real `@modules/billing`.** It should own customers state, services/products, prices, meters, subscriptions, usage events, invoice generation, payment provider abstraction, webhooks, and billing workflows.
3. **Add contracts before advanced billing automation.** Contracts connect customer/supplier + service/product + pricing + obligations + fiscal/payment preferences.
4. **Add provider vault before AbacatePay.** Provider credentials/webhook secrets need encrypted storage, rotation, audit, and tenant/team scoping.
5. **Add fiscal module after customer/company/provider foundation.** Certificates/NFe need stricter vault/audit and provider abstraction than CNPJ lookup.
6. **Add Open Finance after provider-webhook/job patterns exist.** It needs connector consents, sync jobs, provider event handling, and reconciliation into cashbook.
7. **Expand workflows from report-only to event/action automation.** Billing needs triggers/actions/approvals; current workflow v1 explicitly excludes these.
8. **Expand Montte AI by domain skills.** Add relationships/contracts/billing/fiscal/open-finance skills only after deterministic procedures and approval policies exist.
9. **Use desktop later for physical-world integrations.** Tauri shell is present, but native command/security/device integration has not started.

## Supervisor coordination

No blocker. This is repo-state scouting only; no implementation decisions were required.
