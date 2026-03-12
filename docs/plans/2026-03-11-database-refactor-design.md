# Database Refactor — Schema Cleanup & Standardization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove unused/premature schemas, inline standalone enums, add Zod validators and PGlite tests to dashboards/insights/webhooks, and review services/financial-goals alignment.

**Architecture:** Delete-first approach — remove schemas that don't belong yet, then standardize what remains. Database-only scope (no consumer updates).

**Tech Stack:** Drizzle ORM, Zod (v4), PGlite, Vitest

---

## Decisions

### Schemas to Remove (8)

| Schema                 | Repo                                                    | Reason                          |
| ---------------------- | ------------------------------------------------------- | ------------------------------- |
| `personal-api-key`     | `personal-api-key-repository`                           | No current use                  |
| `product-settings`     | `product-settings-repository`                           | Will be redesigned              |
| `resource-permissions` | `resource-permission-repository` + `permission-helpers` | Future RBAC                     |
| `roles`                | —                                                       | Future RBAC                     |
| `sso`                  | —                                                       | Future                          |
| `activity-logs`        | —                                                       | Future audit module             |
| `addons`               | —                                                       | Stripe manages this             |
| `assets`               | —                                                       | Will become a materialized view |

### Enum Inlining (eliminate `enums.ts`)

| Enum                                                  | Destination          | Importers to Update |
| ----------------------------------------------------- | -------------------- | ------------------- |
| `serviceSourceEnum` + type                            | `contacts.ts`        | `services.ts`       |
| `billingCycleEnum` + `subscriptionStatusEnum` + types | `subscriptions.ts`   | None                |
| `goalMovementTypeEnum` + type                         | `financial-goals.ts` | None                |

### Schemas to Refactor

**Dashboards (`dashboards.ts`):**

- Create Zod schemas for each JSONB type: `dashboardTileSchema`, `dashboardDateRangeSchema`, `dashboardFilterSchema`
- Replace manual TypeScript interfaces with `z.infer<>` from Zod schemas
- Add `createDashboardSchema` and `updateDashboardSchema`
- Add `validateInput` to repo create/update
- Full PGlite test coverage (CRUD, isDefault constraint, tiles update, JSONB validation)

**Insights (`insights.ts`):**

- Create `insightConfigSchema` Zod schema for the config JSONB
- Add `createInsightSchema` and `updateInsightSchema`
- Replace `$type<>` with `z.infer<>`
- Add `validateInput` to repo create/update
- Full PGlite test coverage (CRUD, list by type, get by ids, config validation)

**Webhooks (`webhooks.ts`):**

- Add `createWebhookEndpointSchema` and `updateWebhookEndpointSchema`
- No validator for `webhookDeliveries` (system-created, never user input)
- Add `validateInput` to repo create/update of endpoints
- Full PGlite test coverage (endpoint CRUD, toggle active, deliveries create/list)

**Services (`services.ts`):**

- Review validators follow `drizzle-orm/zod` (not `drizzle-zod`)
- Ensure repo uses `validateInput` consistently
- Update `serviceSourceEnum` import from `contacts.ts`

**Financial Goals (`financial-goals.ts`):**

- Move `goalMovementTypeEnum` from `enums.ts` into schema
- Review validators and `validateInput` in repo

### Cleanup

**`relations.ts`:**

- Remove relation blocks for all 8 deleted schemas
- Keep OAuth relations (Better Auth managed)

**`schema.ts`:**

- Remove re-exports for 8 deleted schemas + `enums.ts`

### Out of Scope

- **Consumer updates** (routers, worker, server, packages) — next phase
- **events, event-catalog, event-views** — active billing infra, don't touch
- **auth** — Better Auth managed
- **bank-accounts, credit-cards, credit-card-statements, credit-card-statement-totals** — already refactored with tests
- **transactions, bills, contacts, categories, tags** — just refactored
- **budget-goals, inventory, subscriptions** — already on new pattern with tests
