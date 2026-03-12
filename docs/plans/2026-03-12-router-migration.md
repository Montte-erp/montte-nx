# oRPC Router Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all oRPC routers to the new pattern: no try/catch, no inline `ORPCError`, ownership checks in repositories, schemas from database package, comprehensive Vitest tests.

**Architecture:** The `withErrorHandling` middleware (already in `server.ts`) catches `AppError` from repositories and converts to `WebAppError` automatically. Routers become thin delegation layers. Each router migration follows: add `ensureOwnership` to repo → rewrite router → write tests → commit.

**Tech Stack:** oRPC, Zod, Vitest, Drizzle ORM, `@core/logging/errors` (AppError, WebAppError, propagateError, validateInput)

**Reference implementation:** `apps/web/src/integrations/orpc/router/bank-accounts.ts` + `apps/web/__tests__/integrations/orpc/router/bank-accounts.test.ts`

---

## New Pattern Rules

1. **Router throws nothing** — no `ORPCError`, no `WebAppError`, no try/catch
2. **Repository throws `AppError`** — middleware converts to `WebAppError` for the client
3. **Ownership = repository function** — `ensureXxxOwnership(id, teamId)` returns entity or throws `AppError.notFound()`
4. **Schemas from database** — import `createXxxSchema`/`updateXxxSchema` from `@core/database/schemas/*`
5. **Tests mock repositories** — `vi.mock("@core/database/repositories/xxx-repository")` + `vi.mock("@core/database/client")` + `vi.mock("@core/arcjet/protect")` + `vi.mock("@core/posthog/server")`
6. **Exception:** Better Auth routers (account, session, organization, team) keep try/catch for `auth.api.*` calls — these throw non-AppError objects that the middleware can't handle. Convert inline to `WebAppError` static factories.

## Test Boilerplate

Every router test starts with:

```typescript
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/xxx-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));
```

Run command: `cd apps/web && npx vitest run __tests__/integrations/orpc/router/<name>.test.ts`

---

## Tier 1 — Simple CRUD (parallel-safe, no dependencies between them)

These routers follow the exact same pattern as bank-accounts. Each has a repository, simple ownership checks, and no special logic.

### Task 1: categories

**Files:**
- Modify: `core/database/src/repositories/categories-repository.ts` — add `ensureCategoryOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/categories.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/categories.test.ts`

**Procedures:** create, getAll, update, remove, exportAll, importBatch, archive

**Notes:**
- Has 7 inline ownership checks → all become `ensureCategoryOwnership`
- `exportAll` and `importBatch` are special — no ownership check needed (team-scoped queries)
- Schemas: use `createCategorySchema`/`updateCategorySchema` from `@core/database/schemas/categories`

**Steps:**
1. Read `core/database/src/repositories/categories-repository.ts` and `core/database/src/schemas/categories.ts`
2. Add `ensureCategoryOwnership` to repository
3. Rewrite router — remove all `ORPCError`, remove ownership checks, use schema imports
4. Write test file covering all 7 procedures (happy path + NOT_FOUND for update/remove/archive)
5. Run tests: `cd apps/web && npx vitest run __tests__/integrations/orpc/router/categories.test.ts`
6. Commit: `refactor(router): migrate categories to new pattern`

---

### Task 2: credit-cards

**Files:**
- Modify: `core/database/src/repositories/credit-cards-repository.ts` — add `ensureCreditCardOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/credit-cards.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/credit-cards.test.ts`

**Procedures:** create, getAll, getById, update, remove

**Notes:**
- 3 inline ownership checks → `ensureCreditCardOwnership`
- Schemas: use `createCreditCardSchema`/`updateCreditCardSchema` from `@core/database/schemas/credit-cards`

**Steps:**
1. Read repository and schema files
2. Add `ensureCreditCardOwnership` to repository
3. Rewrite router
4. Write tests (5 procedures, happy + NOT_FOUND)
5. Run tests
6. Commit: `refactor(router): migrate credit-cards to new pattern`

---

### Task 3: tags

**Files:**
- Modify: `core/database/src/repositories/tags-repository.ts` — add `ensureTagOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/tags.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/tags.test.ts`

**Procedures:** create, getAll, update, remove, archive

**Notes:**
- 4 inline ownership checks → `ensureTagOwnership`
- Schemas from `@core/database/schemas/tags`

**Steps:**
1. Read repository and schema
2. Add `ensureTagOwnership`
3. Rewrite router
4. Write tests (5 procedures)
5. Run tests
6. Commit: `refactor(router): migrate tags to new pattern`

---

### Task 4: contacts

**Files:**
- Modify: `core/database/src/repositories/contacts-repository.ts` — add `ensureContactOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/contacts.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/contacts.test.ts`

**Procedures:** create, getAll, update, remove

**Notes:**
- 2 inline ownership checks → `ensureContactOwnership`
- Schemas from `@core/database/schemas/contacts`

**Steps:**
1. Read repository and schema
2. Add `ensureContactOwnership`
3. Rewrite router
4. Write tests (4 procedures)
5. Run tests
6. Commit: `refactor(router): migrate contacts to new pattern`

---

### Task 5: budget-goals

**Files:**
- Modify: `core/database/src/repositories/budget-goals-repository.ts` — add `ensureBudgetGoalOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/budget-goals.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/budget-goals.test.ts`

**Procedures:** getAll, create, update, remove, copyFromPreviousMonth

**Notes:**
- 2 inline ownership checks → `ensureBudgetGoalOwnership`
- `copyFromPreviousMonth` is special — calls repository with teamId directly
- Schemas from `@core/database/schemas/budget-goals`

**Steps:**
1. Read repository and schema
2. Add `ensureBudgetGoalOwnership`
3. Rewrite router
4. Write tests (5 procedures)
5. Run tests
6. Commit: `refactor(router): migrate budget-goals to new pattern`

---

## Tier 2 — Medium CRUD (has reference verification or multi-entity logic)

### Task 6: bills

**Files:**
- Modify: `core/database/src/repositories/bills-repository.ts` — add `ensureBillOwnership(id, teamId)` + move `verifyBillRefs` logic to repository
- Rewrite: `apps/web/src/integrations/orpc/router/bills.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/bills.test.ts`

**Procedures:** getAll, create, update, pay, unpay, cancel, remove, createFromTransaction

**Notes:**
- 12+ inline ownership checks — the router has a `verifyBillRefs()` helper that checks bankAccountId, categoryId, contactId belong to team
- Move `verifyBillRefs` into repository as `validateBillReferences(teamId, refs)` — throws `AppError.validation()` if any ref is invalid
- `pay`/`unpay`/`cancel` are state transitions on existing bills
- `createFromTransaction` creates a bill linked to a transaction
- Schemas from `@core/database/schemas/bills`

**Steps:**
1. Read router, repository, and schema files thoroughly
2. Add `ensureBillOwnership` and `validateBillReferences` to repository
3. Rewrite router — `create` calls `validateBillReferences` then `createBill`, `update` calls `ensureBillOwnership` + `validateBillReferences` + `updateBill`
4. Write tests (8 procedures, include ref validation errors)
5. Run tests
6. Commit: `refactor(router): migrate bills to new pattern`

---

### Task 7: transactions

**Files:**
- Modify: `core/database/src/repositories/transactions-repository.ts` — add `ensureTransactionOwnership(id, teamId)` + move ref verification
- Rewrite: `apps/web/src/integrations/orpc/router/transactions.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/transactions.test.ts`

**Procedures:** create, getAll, getSummary, getById, update, remove, importBulk

**Notes:**
- 10+ inline ownership checks with `verifyTransactionRefs()` helper
- Same pattern as bills — move ref verification to repository
- `importBulk` is batch — calls createTransaction in a loop
- `getSummary` is a read-only aggregation
- Schemas from `@core/database/schemas/transactions`

**Steps:**
1. Read router, repository, schema
2. Add `ensureTransactionOwnership` and `validateTransactionReferences` to repository
3. Rewrite router
4. Write tests (7 procedures)
5. Run tests
6. Commit: `refactor(router): migrate transactions to new pattern`

---

### Task 8: services

**Files:**
- Modify: `core/database/src/repositories/services-repository.ts` — add `ensureServiceOwnership(id, teamId)`, `ensureVariantOwnership(id, teamId)`
- Modify: `core/database/src/repositories/subscriptions-repository.ts` — add `ensureSubscriptionOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/services.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/services.test.ts`

**Procedures:** getAll, create, update, remove, exportAll, getVariants, createVariant, updateVariant, removeVariant, getAllSubscriptions, getContactSubscriptions, createSubscription, cancelSubscription, getExpiringSoon, getActiveCountByVariant

**Notes:**
- 14+ inline ownership checks across services, variants, and subscriptions
- Three entities: service → variant → subscription
- `exportAll` is read-only team-scoped
- Schemas from `@core/database/schemas/services`

**Steps:**
1. Read router, both repositories, schemas
2. Add ownership functions to both repos
3. Rewrite router
4. Write tests (15 procedures — group by describe blocks: services, variants, subscriptions)
5. Run tests
6. Commit: `refactor(router): migrate services to new pattern`

---

### Task 9: services-bills

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/services-bills.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/services-bills.test.ts`

**Procedures:** generateBillsForSubscription, cancelPendingBillsForSubscription

**Notes:**
- Does direct DB queries — may need new repository functions or keep inline if small
- No ORPCError usage currently — check if it needs ownership checks

**Steps:**
1. Read router thoroughly
2. Evaluate if logic should move to repository
3. Rewrite router
4. Write tests
5. Run tests
6. Commit: `refactor(router): migrate services-bills to new pattern`

---

### Task 10: inventory

**Files:**
- Modify: `core/database/src/repositories/inventory-repository.ts` — add `ensureProductOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/inventory.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/inventory.test.ts`

**Procedures:** getProducts, createProduct, updateProduct, archiveProduct, registerMovement, getMovements, getSettings, upsertSettings

**Notes:**
- 4 inline ownership checks → `ensureProductOwnership`
- `registerMovement` also verifies product ownership before creating movement
- Settings are team-scoped (no ownership check, just teamId filter)
- Schemas from `@core/database/schemas/inventory`

**Steps:**
1. Read router, repository, schema
2. Add `ensureProductOwnership`
3. Rewrite router
4. Write tests (8 procedures)
5. Run tests
6. Commit: `refactor(router): migrate inventory to new pattern`

---

## Tier 3 — Complex (multi-entity, events, analytics)

### Task 11: webhooks

**Files:**
- Modify: `core/database/src/repositories/webhook-repository.ts` — add `ensureWebhookOwnership(id, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/webhooks.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/webhooks.test.ts`

**Procedures:** create, list, getById, update, remove, deliveries

**Notes:**
- Already has tests — update them to match new pattern
- Has 9 try/catch blocks — all removable with middleware
- 6 inline ownership checks → `ensureWebhookOwnership`
- `create` and `remove` interact with Better Auth for API key management — these keep try/catch for auth.api calls but use `WebAppError` instead of `ORPCError`
- Emits events via `emitWebhookEndpointCreated`/`Deleted`

**Steps:**
1. Read router, repository, existing tests
2. Add `ensureWebhookOwnership`
3. Rewrite router — keep auth.api try/catch, remove all others
4. Update existing tests
5. Run tests
6. Commit: `refactor(router): migrate webhooks to new pattern`

---

### Task 12: dashboards

**Files:**
- Modify: `core/database/src/repositories/dashboard-repository.ts` — add `ensureDashboardOwnership(id, organizationId, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/dashboards.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/dashboards.test.ts`

**Procedures:** create, list, getById, update, updateTiles, remove, updateGlobalFilters, setAsHome

**Notes:**
- Already has tests (+ team-scoping tests)
- 8 ownership checks — uses dual check `(organizationId !== orgId || teamId !== teamId)`
- Emits events
- `updateTiles` is a batch operation on dashboard tiles
- `setAsHome` sets a dashboard as the team's home dashboard

**Steps:**
1. Read router, repository, existing tests
2. Add `ensureDashboardOwnership` (checks both orgId and teamId)
3. Rewrite router
4. Update tests
5. Run tests (both dashboards.test.ts and dashboards-team-scoping.test.ts)
6. Commit: `refactor(router): migrate dashboards to new pattern`

---

### Task 13: insights

**Files:**
- Modify: `core/database/src/repositories/insight-repository.ts` — add `ensureInsightOwnership(id, organizationId, teamId)`
- Rewrite: `apps/web/src/integrations/orpc/router/insights.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/insights.test.ts`

**Procedures:** create, list, getById, update, remove, refreshDashboard

**Notes:**
- Already has tests (+ team-scoping tests)
- 6 ownership checks with dual orgId+teamId
- `refreshDashboard` fetches all insights for a dashboard and refreshes them
- Emits events

**Steps:**
1. Read router, repository, existing tests
2. Add `ensureInsightOwnership`
3. Rewrite router
4. Update tests
5. Run both test files
6. Commit: `refactor(router): migrate insights to new pattern`

---

### Task 14: analytics

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/analytics.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/analytics.test.ts`

**Procedures:** query, getDefaultDashboard, getDashboardInsights

**Notes:**
- Extensive try/catch — uses dashboard and insight repositories
- `query` is the main analytics engine call
- No ownership checks (dashboard queries are team-scoped)
- Has direct DB queries for dashboard/insight lookups

**Steps:**
1. Read router and identify which direct queries should use existing repos
2. Rewrite router to use repository calls where possible
3. Write tests
4. Run tests
5. Commit: `refactor(router): migrate analytics to new pattern`

---

## Tier 4 — Special Routers (Better Auth, agents, external services)

These routers have unique patterns. Some can't fully follow the new pattern.

### Task 15: account

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/account.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/account.test.ts`

**Procedures:** verifyPassword, hasPassword, getLinkedAccounts, setPassword, generateAvatarUploadUrl

**Notes:**
- Uses Better Auth `auth.api.*` calls — keep try/catch but use `WebAppError` instead of `ORPCError`
- `generateAvatarUploadUrl` uses MinIO — keep try/catch for MinIO errors
- No repository — auth-only router

**Steps:**
1. Read router and existing tests
2. Rewrite: replace `ORPCError` → `WebAppError`, keep auth.api try/catch
3. Update tests
4. Run tests
5. Commit: `refactor(router): migrate account to new pattern`

---

### Task 16: session

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/session.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/session.test.ts`

**Procedures:** getSession, listSessions, revokeSessionByToken, revokeOtherSessions, revokeSessions

**Notes:**
- All Better Auth `auth.api.*` calls — keep try/catch, use `WebAppError`
- Extensive error handling for session operations

**Steps:**
1. Read router and tests
2. Rewrite: `ORPCError` → `WebAppError`, keep auth try/catch
3. Update tests
4. Run tests
5. Commit: `refactor(router): migrate session to new pattern`

---

### Task 17: organization

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/organization.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/organization.test.ts`

**Procedures:** getOrganizations, getActiveOrganization, getOrganizationTeams, getMembers, getMemberTeams, hasAddon, getAddons, generateLogoUploadUrl, updateLogo

**Notes:**
- Mix of Better Auth calls + direct DB queries + Stripe
- Extensive try/catch — keep for auth.api and Stripe, remove for simple DB queries
- `generateLogoUploadUrl` uses MinIO
- Has complex member/team enrichment logic

**Steps:**
1. Read router and tests thoroughly
2. Rewrite: `ORPCError` → `WebAppError`, keep external service try/catch
3. Move simple DB queries to repository if not already there
4. Update tests
5. Run both organization.test.ts and organization-teams.test.ts
6. Commit: `refactor(router): migrate organization to new pattern`

---

### Task 18: team

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/team.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/team.test.ts` (if exists, otherwise create)

**Procedures:** get, updateAllowedDomains, getMembers, addMember, removeMember

**Notes:**
- Mix of Better Auth + direct DB queries
- Has helper functions for team member queries
- 6 ownership/permission checks

**Steps:**
1. Read router
2. Evaluate which direct queries should become repository functions
3. Rewrite router
4. Write/update tests
5. Run tests
6. Commit: `refactor(router): migrate team to new pattern`

---

### Task 19: onboarding

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/onboarding.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/onboarding.test.ts`

**Procedures:** createWorkspace, getOnboardingStatus, fixOnboarding, completeTask, skipTask, completeOnboarding

**Notes:**
- Uses Better Auth for workspace creation
- Direct DB inserts in transactions for onboarding setup
- 4 ownership checks + 2 try/catch blocks
- Complex orchestration in `createWorkspace` (creates org, team, sets active)

**Steps:**
1. Read router and tests
2. Rewrite: `ORPCError` → `WebAppError`, keep auth try/catch
3. Update tests
4. Run tests
5. Commit: `refactor(router): migrate onboarding to new pattern`

---

### Task 20: billing

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/billing.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/billing.test.ts`

**Procedures:** getInvoices, getUpcomingInvoice, getCurrentUsage, getStorageUsage, getCategoryUsage, getPaymentStatus, getDailyUsage

**Notes:**
- Read-only router — no mutations, no ownership checks
- Direct DB queries on materialized views
- Extensive try/catch for Stripe API calls — keep those
- Uses `stripeClient` from context

**Steps:**
1. Read router and tests
2. Rewrite: `ORPCError` → `WebAppError`, keep Stripe try/catch
3. Update tests
4. Run tests
5. Commit: `refactor(router): migrate billing to new pattern`

---

### Task 21: agent

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/agent.ts`
- Update: `apps/web/__tests__/integrations/orpc/router/agent.test.ts`

**Procedures:** aiCommandStream

**Notes:**
- Streaming async generator
- Uses Mastra agents — keep try/catch for agent.stream() calls
- 1 try/catch block for stream error handling
- No ownership checks, no repository

**Steps:**
1. Read router and tests
2. Rewrite: `ORPCError` → `WebAppError` for stream errors
3. Update tests
4. Run tests
5. Commit: `refactor(router): migrate agent to new pattern`

---

### Task 22: chat

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/chat.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/chat.test.ts`

**Procedures:** listThreads, createThread, deleteThread, getThreadMessages

**Notes:**
- Uses Mastra memory for thread management
- 2 ownership checks (thread belongs to user)
- No repository — uses mastra.memory directly

**Steps:**
1. Read router
2. Rewrite: `ORPCError` → `WebAppError`
3. Write tests (mock mastra.memory)
4. Run tests
5. Commit: `refactor(router): migrate chat to new pattern`

---

### Task 23: search

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/search.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/search.test.ts`

**Procedures:** globalSearch

**Notes:**
- Direct ILIKE queries across multiple tables
- 6 try/catch blocks (one per entity search)
- Currently uses `AppError` + `propagateError` — should just let middleware handle
- No ownership checks (team-scoped queries)

**Steps:**
1. Read router
2. Evaluate if search queries should become a search repository
3. Rewrite router
4. Write tests
5. Run tests
6. Commit: `refactor(router): migrate search to new pattern`

---

### Task 24: early-access

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/early-access.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/early-access.test.ts`

**Procedures:** getEnrolledFeatures

**Notes:**
- Uses PostHog API — 1 try/catch
- No ORPCError, no ownership checks
- Simple router — just fetches feature flags

**Steps:**
1. Read router
2. Rewrite: remove try/catch (let middleware handle PostHog errors)
3. Write tests (mock posthog)
4. Run tests
5. Commit: `refactor(router): migrate early-access to new pattern`

---

### Task 25: feedback

**Files:**
- Rewrite: `apps/web/src/integrations/orpc/router/feedback.ts`
- Create: `apps/web/__tests__/integrations/orpc/router/feedback.test.ts`

**Procedures:** submitBugReport, submitFeatureRequest, submitFeatureFeedback

**Notes:**
- No ORPCError, no try/catch, no ownership checks
- Uses feedback sender package
- Already clean — just needs tests and schema cleanup

**Steps:**
1. Read router
2. Minor cleanup if needed
3. Write tests
4. Run tests
5. Commit: `refactor(router): migrate feedback to new pattern`

---

## Execution Order

**Phase 1 — Parallel (Tasks 1-5):** Simple CRUD routers, no dependencies
**Phase 2 — Parallel (Tasks 6-10):** Medium routers with ref verification
**Phase 3 — Sequential (Tasks 11-14):** Complex routers with events/analytics
**Phase 4 — Sequential (Tasks 15-25):** Special routers (auth, agents, billing)

Each phase should be committed separately. Run full test suite after each phase:

```bash
cd apps/web && npx vitest run __tests__/integrations/orpc/router/
```
