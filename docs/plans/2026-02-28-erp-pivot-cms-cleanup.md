# ERP Pivot — CMS Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all CMS-specific features (content, editor, writers, clusters, experiments, forms, assets) from the app, leaving a clean foundation for the ERP pivot with transactions, categories, and bank accounts. Also rename all user-facing "Contentta" references to "Montte".

**Architecture:** Pure deletion + minimal modifications. The analytics/dashboards/insights/data-management structure is kept and repurposed. Settings, billing, org management, and all AI features (chat, agents) are preserved untouched.

**Tech Stack:** Nx monorepo, Bun, TanStack Router (file-based), oRPC, Drizzle ORM, React

---

## What We're Deleting vs Keeping

**DELETE (CMS stuff):**
- Feature folders: `content`, `editor`, `clusters`, `experiments`, `forms`, `writers`
- **`file-upload` is KEPT** (needed for ERP file attachments)
- **`context-panel` is KEPT** (needed for AI features)
- Routes: `content/`, `writers/`, `clusters/`, `experiments/`, `forms/`, `assets/`, `home/_components/` (all 4 cards)
- Settings product pages: `content.tsx`, `forms.tsx`, `clusters.tsx`, `asset-bank.tsx`
- oRPC routers: `content`, `content-analytics`, `related-content`, `clusters`, `experiments`, `forms`, `writer`, `assets`, `sdk-usage`
- DB schemas: `content`, `writer`, `related-content`, `experiments`, `forms`, `assets`
- DB repositories: `content-repository`, `writer-repository`, `writer-instructions-repository`, `related-content-repository`, `experiments-repository`, `form-repository`, `asset-repository`
- **`discussions` oRPC router, schema, and repository are KEPT** (repurposed for ERP collaboration)

**KEEP (everything else):**
- Analytics (insights, dashboards, data-management, charts)
- AI features (teco-chat, agents, chat routes)
- Settings & org management
- Billing & plans
- Feedback, webhooks, roles, SSO, activity-logs, access-control
- oRPC: `account`, `actions`, `activity-logs`, `agent`, `analytics`, `annotations`, `api-keys`, `billing`, `chat`, `dashboards`, `data-sources`, `event-catalog`, `feedback`, `insights`, `onboarding`, `organization`, `personal-api-key`, `property-definitions`, `roles`, `session`, `sso`, `team`, `usage`, `webhooks`

**MODIFY (not delete):**
- `sidebar-nav-items.ts` — remove CMS nav groups ("Conteudo", "Ferramentas", "Biblioteca")
- `router/index.ts` — remove CMS router imports/registrations
- `schema.ts` — remove CMS schema exports
- `router/product-settings.ts` — remove `updateContentDefaults` and `updateFormsDefaults` procedures (keep `getSettings` + `updateAiDefaults`)

---

## Task 1: Delete CMS Feature Folders

**Files to delete (entire directories):**
- `apps/web/src/features/clusters/`
- `apps/web/src/features/content/`
- `apps/web/src/features/context-panel/`
- `apps/web/src/features/editor/`
- `apps/web/src/features/experiments/`
- `apps/web/src/features/file-upload/`
- `apps/web/src/features/forms/`
- `apps/web/src/features/writers/`

**Step 1: Delete feature directories**
```bash
rm -rf apps/web/src/features/clusters
rm -rf apps/web/src/features/content
rm -rf apps/web/src/features/editor
rm -rf apps/web/src/features/experiments
rm -rf apps/web/src/features/forms
rm -rf apps/web/src/features/writers
# NOTE: file-upload and context-panel are KEPT
```

**Step 2: Commit**
```bash
git add -A
git commit -m "chore: remove CMS feature folders (content, editor, writers, clusters, experiments, forms)"
```

---

## Task 2: Delete CMS Routes

**Files to delete:**

Content routes:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/content/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/content/$contentId.tsx`

Writers routes:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/writers/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/writers/new.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/writers/$writerId.tsx`

Clusters routes:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/clusters/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/clusters/new.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/clusters/$clusterId.tsx`

Experiments routes:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/experiments/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/experiments/new.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/experiments/$experimentId.tsx`

Forms routes:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/forms/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/forms/$formId.tsx`

Assets route:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/assets/index.tsx`

Home CMS components:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/_components/home-recent-content-section.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/_components/home-content-analytics-card.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/_components/home-content-stats-card.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/_components/home-sdk-usage-card.tsx`

Settings product pages:
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/content.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/forms.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/clusters.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/asset-bank.tsx`

**Step 1: Delete route files**
```bash
# Content
rm apps/web/src/routes/_authenticated/'$slug'/'$teamSlug'/_dashboard/content/index.tsx
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/content/\$contentId.tsx"
# (use file manager or individual rm for each file with special chars)
```

> NOTE: TanStack Router file-based routing uses `$` in filenames. Use the file manager or rm with proper quoting. The safest approach is using the shell glob:
```bash
BASE="apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard"

rm -rf "$BASE/content"
rm -rf "$BASE/writers"
rm -rf "$BASE/clusters"
rm -rf "$BASE/experiments"
rm -rf "$BASE/forms"
rm -rf "$BASE/assets"
rm -f "$BASE/home/_components/home-recent-content-section.tsx"
rm -f "$BASE/home/_components/home-content-analytics-card.tsx"
rm -f "$BASE/home/_components/home-content-stats-card.tsx"
rm -f "$BASE/home/_components/home-sdk-usage-card.tsx"
rm -f "$BASE/settings/project/products/content.tsx"
rm -f "$BASE/settings/project/products/forms.tsx"
rm -f "$BASE/settings/project/products/clusters.tsx"
rm -f "$BASE/settings/project/products/asset-bank.tsx"
```

**Step 2: Commit**
```bash
git add -A
git commit -m "chore: remove CMS routes (content, writers, clusters, experiments, forms, assets)"
```

---

## Task 3: Delete CMS oRPC Routers

**Files to delete:**
- `apps/web/src/integrations/orpc/router/content.ts`
- `apps/web/src/integrations/orpc/router/content-analytics.ts`
- `apps/web/src/integrations/orpc/router/related-content.ts`
- `apps/web/src/integrations/orpc/router/clusters.ts`
- `apps/web/src/integrations/orpc/router/experiments.ts`
- `apps/web/src/integrations/orpc/router/forms.ts`
- `apps/web/src/integrations/orpc/router/writer.ts`
- `apps/web/src/integrations/orpc/router/discussions.ts`
- `apps/web/src/integrations/orpc/router/assets.ts`
- `apps/web/src/integrations/orpc/router/sdk-usage.ts`

**Step 1: Delete router files**
```bash
cd apps/web/src/integrations/orpc/router
rm content.ts content-analytics.ts related-content.ts clusters.ts experiments.ts forms.ts writer.ts assets.ts sdk-usage.ts
# NOTE: discussions.ts is KEPT
```

**Step 2: Update `router/index.ts`**

Replace the entire file with:
```typescript
import * as accountRouter from "./account";
import * as actionsRouter from "./actions";
import * as activityLogsRouter from "./activity-logs";
import * as agentRouter from "./agent";
import * as analyticsRouter from "./analytics";
import * as annotationsRouter from "./annotations";
import * as apiKeysRouter from "./api-keys";
import * as billingRouter from "./billing";
import * as chatRouter from "./chat";
import * as dashboardsRouter from "./dashboards";
import * as dataSourcesRouter from "./data-sources";
import * as discussionsRouter from "./discussions";
import * as eventCatalogRouter from "./event-catalog";
import * as feedbackRouter from "./feedback";
import * as insightsRouter from "./insights";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as personalApiKeyRouter from "./personal-api-key";
import * as productSettingsRouter from "./product-settings";
import * as propertyDefinitionsRouter from "./property-definitions";
import * as rolesRouter from "./roles";
import * as sessionRouter from "./session";
import * as ssoRouter from "./sso";
import * as teamRouter from "./team";
import * as usageRouter from "./usage";
import * as webhooksRouter from "./webhooks";

export default {
   account: accountRouter,
   actions: actionsRouter,
   activityLogs: activityLogsRouter,
   agent: agentRouter,
   analytics: analyticsRouter,
   annotations: annotationsRouter,
   apiKeys: apiKeysRouter,
   billing: billingRouter,
   chat: chatRouter,
   dashboards: dashboardsRouter,
   dataSources: dataSourcesRouter,
   discussions: discussionsRouter,
   eventCatalog: eventCatalogRouter,
   feedback: feedbackRouter,
   insights: insightsRouter,
   onboarding: onboardingRouter,
   personalApiKey: personalApiKeyRouter,
   productSettings: productSettingsRouter,
   propertyDefinitions: propertyDefinitionsRouter,
   roles: rolesRouter,
   session: sessionRouter,
   sso: ssoRouter,
   team: teamRouter,
   organization: organizationRouter,
   usage: usageRouter,
   webhooks: webhooksRouter,
};
```

**Step 3: Update `product-settings.ts`** — Remove `updateContentDefaults` and `updateFormsDefaults` procedures (lines 42-78). Keep only `getSettings` and `updateAiDefaults`.

Also update the imports at the top — remove `updateContentDefaults as updateContentDefaultsRepo` and `updateFormsDefaults as updateFormsDefaultsRepo` from the repository import, and remove `ContentDefaultsSchema` and `FormsDefaultsSchema` from the schemas import.

**Step 4: Commit**
```bash
git add -A
git commit -m "chore: remove CMS oRPC routers and update router index"
```

---

## Task 4: Delete CMS Database Schemas

**Files to delete:**
- `packages/database/src/schemas/content.ts`
- `packages/database/src/schemas/writer.ts`
- `packages/database/src/schemas/discussions.ts`
- `packages/database/src/schemas/related-content.ts`
- `packages/database/src/schemas/experiments.ts`
- `packages/database/src/schemas/forms.ts`
- `packages/database/src/schemas/assets.ts`

**Step 1: Delete schema files**
```bash
cd packages/database/src/schemas
rm content.ts writer.ts related-content.ts experiments.ts forms.ts assets.ts
# NOTE: discussions.ts is KEPT
```

**Step 2: Update `packages/database/src/schema.ts`**

Remove these lines:
```typescript
export * from "./schemas/assets";
export * from "./schemas/content";
export * from "./schemas/experiments";
export * from "./schemas/forms";
export * from "./schemas/related-content";
export * from "./schemas/writer";
```
> `discussions` stays — keep `export * from "./schemas/discussions"` in `schema.ts`.

Final `schema.ts` should contain only:
```typescript
export * from "./schemas/actions";
export * from "./schemas/activity-logs";
export * from "./schemas/addons";
export * from "./schemas/annotations";
export * from "./schemas/auth";
export * from "./schemas/dashboards";
export * from "./schemas/data-sources";
export * from "./schemas/discussions";
export * from "./schemas/event-catalog";
export * from "./schemas/event-views";
export * from "./schemas/events";
export * from "./schemas/export-log";
export * from "./schemas/insights";
export * from "./schemas/instruction-memory";
export * from "./schemas/personal-api-key";
export * from "./schemas/product-settings";
export * from "./schemas/property-definitions";
export * from "./schemas/resource-permissions";
export * from "./schemas/roles";
export * from "./schemas/sso";
export * from "./schemas/webhooks";
```

**Step 3: Commit**
```bash
git add -A
git commit -m "chore: remove CMS database schemas (content, writer, discussions, experiments, forms, assets)"
```

---

## Task 5: Delete CMS Database Repositories

**Files to delete:**
- `packages/database/src/repositories/content-repository.ts`
- `packages/database/src/repositories/writer-repository.ts`
- `packages/database/src/repositories/writer-instructions-repository.ts`
- `packages/database/src/repositories/discussion-repository.ts`
- `packages/database/src/repositories/related-content-repository.ts`
- `packages/database/src/repositories/experiments-repository.ts`
- `packages/database/src/repositories/form-repository.ts`
- `packages/database/src/repositories/asset-repository.ts`

**Step 1: Delete repository files**
```bash
cd packages/database/src/repositories
rm content-repository.ts writer-repository.ts writer-instructions-repository.ts related-content-repository.ts experiments-repository.ts form-repository.ts asset-repository.ts
# NOTE: discussion-repository.ts is KEPT
```

**Step 2: Commit**
```bash
git add -A
git commit -m "chore: remove CMS database repositories"
```

---

## Task 6: Update Sidebar Nav Items

**File:** `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Remove CMS nav groups**

Delete the entire `"conteudo"` group (lines 94-125), the `"ferramentas"` group (lines 126-148), and the `"biblioteca"` group (lines 149-163).

Also remove the unused icon imports: `ClipboardList`, `FileText`, `FlaskConical`, `ImageIcon`, `Library`, `Network`, `PenLine`.

Final file should have only one import from lucide-react:
```typescript
import { Database, House, LayoutDashboard, Lightbulb, Sparkles } from "lucide-react";
```

And `navGroups` should contain only the `"main"` group:
```typescript
export const navGroups: NavGroupDef[] = [
   {
      id: "main",
      items: [
         {
            id: "home",
            label: "Inicio",
            icon: House,
            route: "/$slug/$teamSlug/home",
         },
         {
            id: "chat",
            label: "Contentta AI",
            icon: Sparkles,
            route: "/$slug/$teamSlug/chat",
         },
         {
            id: "dashboards",
            label: "Dashboards",
            icon: LayoutDashboard,
            route: "/$slug/$teamSlug/analytics/dashboards",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "dashboards",
            earlyAccessFlag: "dashboards",
            earlyAccessStage: "beta" as const,
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            route: "/$slug/$teamSlug/analytics/insights",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "insights",
            earlyAccessFlag: "insights",
            earlyAccessStage: "beta" as const,
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            route: "/$slug/$teamSlug/analytics/data-management",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "data-management",
            earlyAccessFlag: "data-management",
            earlyAccessStage: "beta" as const,
         },
      ],
   },
];
```

**Step 2: Commit**
```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git commit -m "chore: remove CMS sidebar nav groups (conteudo, ferramentas, biblioteca)"
```

---

## Task 7: Verify No Broken Imports

After all deletions and modifications, run the TypeScript type checker to catch any remaining broken imports.

**Step 1: Run typecheck**
```bash
bun run typecheck
```

**Step 2: Fix any errors**

Common sources of remaining broken imports:
- Any file still importing from `@/features/content`, `@/features/editor`, `@/features/writers`, etc.
- Any file still importing from deleted oRPC routers via `orpc.content.*`, `orpc.clusters.*`, etc.
- The `search` feature may reference content — check `apps/web/src/features/search/`
- Onboarding tasks may reference CMS products — check `apps/web/src/features/onboarding/task-definitions.ts`
- Billing overview may reference CMS feature flags — check `apps/web/src/features/billing/ui/billing-overview.tsx`
- The `sdk-server` app may import from deleted schemas — check `apps/sdk-server/`
- The `worker` app may have CMS-specific jobs — check `apps/worker/`

Fix each broken import by either removing the reference or replacing with a placeholder (e.g., empty array, null check).

**Step 3: Commit all fixes**
```bash
git add -A
git commit -m "fix: resolve remaining broken imports after CMS cleanup"
```

---

## Task 8: Rename "Contentta" → "Montte" (User-Facing & Functional Code)

**Scope:** All functional references. Skip `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, docs, and git history — those are documentation only.

### 8a — Web app UI text

**`apps/web/src/routes/__root.tsx` line ~38:**
Change `title: "Contentta"` → `title: "Montte"`

**`apps/web/src/routes/auth.tsx`:**
- `alt="Contentta"` → `alt="Montte"` (×2)
- `<span>Contentta</span>` → `<span>Montte</span>` (×2)
- `© ... Contentta. Todos os direitos` → `© ... Montte. Todos os direitos`

**`apps/web/src/routes/oauth/consent.tsx` line ~171:**
Change `"conta Contentta"` → `"conta Montte"`

**`apps/web/src/routes/auth/sign-up.tsx`:**
- `href="https://contentta.co/terms-of-service"` → `href="https://montte.co/terms-of-service"`
- `href="https://contentta.co/privacy-policy"` → `href="https://montte.co/privacy-policy"`

**`apps/web/src/routes/auth/sign-in/index.tsx`:**
Same two link hrefs as sign-up.

**`apps/web/src/features/onboarding/ui/onboarding-wizard.tsx`:**
- `alt="Contentta"` → `alt="Montte"`
- `app.contentta.co` → `app.montte.co`

**`apps/web/src/features/onboarding/ui/quick-start-checklist.tsx` line ~153:**
Change `"Contentta"` → `"Montte"` in the description text.

**`apps/web/src/features/personal-api-keys/ui/create-key-form.tsx` line ~125:**
Change `"API do Contentta"` → `"API do Montte"`

**`apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/personal-api-keys.tsx` line ~205:**
Change `"Contentta programaticamente"` → `"Montte programaticamente"`

**`apps/web/src/features/webhooks/ui/webhook-secret-dialog.tsx` line ~60:**
Change `"pelo Contentta"` → `"pelo Montte"`

**`apps/web/src/features/feedback/ui/feedback-fab.tsx` line 19:**
Change `DOCS_URL = "https://docs.contentta.com"` → `"https://docs.montte.co"`

**`apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts` line 58:** (already handled in Task 6 step — change `"Contentta AI"` → `"Montte AI"`)

### 8b — LocalStorage keys (web app)

> Changing storage keys resets user preferences on next load — acceptable for a brand rename.

**`apps/web/src/layout/dashboard/ui/dashboard-layout.tsx` line ~58:**
`"contentta:sidebar-collapsed"` → `"montte:sidebar-collapsed"`

**`apps/web/src/layout/dashboard/hooks/use-sidebar-nav.ts` line 6:**
`"contentta:sidebar-pinned"` → `"montte:sidebar-pinned"`

**`apps/web/src/hooks/use-early-access.tsx`:**
- `"contentta:early-access-banner-dismissed"` → `"montte:early-access-banner-dismissed"`
- `"contentta:enrolled-features"` → `"montte:enrolled-features"`

**`apps/web/src/hooks/use-last-organization.ts` line 3:**
`"contentta:last-organization-slug"` → `"montte:last-organization-slug"`

**`apps/web/src/features/onboarding/ui/quick-start-checklist.tsx` line 25:**
`"contentta:checklist_hidden"` → `"montte:checklist_hidden"`

### 8c — Worker

**`apps/worker/src/index.ts` line 9:**
`"[Worker] Starting Contentta Worker..."` → `"[Worker] Starting Montte Worker..."`

**`apps/worker/src/jobs/deliver-webhook.ts`:**
- `"X-Contentta-Signature"` → `"X-Montte-Signature"`
- `"X-Contentta-Event"` → `"X-Montte-Event"`
- `"X-Contentta-Delivery-Id"` → `"X-Montte-Delivery-Id"`
- `"X-Contentta-Attempt"` → `"X-Montte-Attempt"`
- `"Contentta-Webhooks/1.0"` → `"Montte-Webhooks/1.0"` (User-Agent)

### 8d — Packages

**`packages/agents/src/mastra/index.ts` line ~59:**
`serviceName: "contentta-agents"` → `"montte-agents"`

**`packages/logging/src/server.ts` line ~15:**
`name: "contentta-server"` → `"montte-server"`

**`packages/logging/src/worker.ts` line ~16:**
`name: "contentta-worker"` → `"montte-worker"`

**`packages/environment/src/server.ts` line ~44:**
`MINIO_BUCKET: z.string().optional().default("contentta")` → `.default("montte")`

**`packages/environment/src/helpers.ts` line ~9:**
`"https://app.contentta.co"` → `"https://app.montte.co"`

**`packages/environment/src/worker.ts` line ~14:**
`APP_URL: z.string().url().optional().default("https://app.contentta.co")` → `.default("https://app.montte.co")`

**`packages/transactional/src/client.tsx`:**
- `const name = "Contentta"` → `"Montte"`
- `from: "... <suporte@mail.contentta.co>"` → `"<suporte@mail.montte.co>"` (×3)
- `"equipe ${teamName} no Contentta"` → `"equipe ${teamName} no Montte"`
- `"conta Contentta"` (magic link subject) → `"conta Montte"`

**`packages/transactional/src/emails/organization-invitation.tsx`:**
- `"Contentta."` → `"Montte."` (×2 — body text and example URL)
- Example URL: `"https://app.contentta.co/..."` → `"https://app.montte.co/..."`

**`packages/transactional/src/emails/default-heading.tsx`:**
- `logoUrl = "https://app.contentta.co/email/logo.png"` → `"https://app.montte.co/email/logo.png"`
- `alt="Contentta"` → `alt="Montte"`
- `Contentta` text → `Montte`

**`packages/transactional/src/emails/magic-link.tsx`:**
- `"Seu link de acesso Contentta"` → `"Seu link de acesso Montte"`
- Example URL: `"https://app.contentta.co/..."` → `"https://app.montte.co/..."`

**`packages/transactional/src/emails/default-footer.tsx`:**
- `href="https://contentta.co"` → `href="https://montte.co"`
- `Contentta` text → `Montte`

**`packages/transactional/src/emails/default-layout.tsx`:**
- Font URL `"https://app.contentta.co/email/..."` → `"https://app.montte.co/email/..."`

**`packages/transactional/src/emails/otp.tsx`:**
- All `"... Contentta"` preview texts → `"... Montte"` (×3)

**`packages/agents/src/mastra/agents/teco-agent.ts`:**
- `"Plataforma Contentta"` → `"Plataforma Montte"` (×2)
- `"assistente de IA da Contentta"` → `"assistente de IA da Montte"`
- `"assistente completo da Contentta"` → `"assistente completo da Montte"`

**`apps/web/src/integrations/orpc/router/sso.ts` line ~80:**
`"contentta-domain-verification-"` → `"montte-domain-verification-"`

### 8e — SDK Server (functional references only)

**`apps/sdk-server/src/mcp/handler.ts` line ~21:**
`name: "contentta-mcp"` → `"montte-mcp"`

> Skip `apps/sdk-server/package.json` `"@contentta/sdk"` — that's the SDK package name which would require a separate rename task.

### 8f — Commit

```bash
git add -A
git commit -m "chore: rename Contentta → Montte across all user-facing and functional code"
```

---

## Task 9: Final Smoke Test

**Step 1: Start the dev server**
```bash
bun dev
```

**Step 2: Verify the app loads**
- Home page shows dashboard (no CMS content cards)
- Sidebar shows only: Home, Chat, Dashboards, Insights, Dados
- Settings still work (profile, org, billing)
- No console errors about missing routes or imports

**Step 3: If typecheck passes and dev server loads cleanly, you're done.**

---

## Notes

- The `packages/agents/` package is fully preserved (user wants all AI features)
- The `api/electric/$.ts` route (ElectricSQL) is preserved
- The `home/index.tsx` page already only shows a dashboard view + quick-start checklist — no CMS content, no changes needed there
- The `search` feature may need its search scope reduced (currently searches content) — defer to later
- DB migrations are NOT run as part of this cleanup — schemas are removed from code only. The actual DB tables can be dropped later when ready.
