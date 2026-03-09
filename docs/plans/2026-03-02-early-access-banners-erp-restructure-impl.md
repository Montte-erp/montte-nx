# Early Access Banners + ERP Route Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move finance routes up one level, replace the `insights/new` page with inline empty-insight creation, and add `EarlyAccessBanner` to all early access screens.

**Architecture:** Three independent task groups. Finance restructure first (route files + nav + task-definitions), then insight flow change (index.tsx mutation + delete new.tsx), then banner additions. `routeTree.gen.ts` is auto-generated — do NOT edit it manually; it regenerates on `bun dev`.

**Tech Stack:** TanStack Router (file-based), oRPC + TanStack Query, React, `EarlyAccessBanner` from `@/features/billing/ui/early-access-banner`

---

## Task 1: Move finance route files up one level

**Files:**

- Move: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/` → `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/`
- Modify (createFileRoute string only in each): all 8 files listed below

No `finance.tsx` layout file exists — nothing to delete there.

**Step 1: Move + update `contacts.tsx`**

Move file from `finance/contacts.tsx` to `contacts.tsx`. Update the route id at the top:

```ts
// OLD
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/contacts",
)({ ... });

// NEW
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({ ... });
```

Run: `mv apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/finance/contacts.tsx apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/contacts.tsx`

**Step 2: Move + update the remaining 7 route files**

For each file, move it up one directory and update its `createFileRoute` string (remove `finance/` from the path). Do them one at a time:

| File                        | Old route id fragment              | New route id fragment      |
| --------------------------- | ---------------------------------- | -------------------------- |
| `finance/bank-accounts.tsx` | `_dashboard/finance/bank-accounts` | `_dashboard/bank-accounts` |
| `finance/tags.tsx`          | `_dashboard/finance/tags`          | `_dashboard/tags`          |
| `finance/credit-cards.tsx`  | `_dashboard/finance/credit-cards`  | `_dashboard/credit-cards`  |
| `finance/transactions.tsx`  | `_dashboard/finance/transactions`  | `_dashboard/transactions`  |
| `finance/bills.tsx`         | `_dashboard/finance/bills`         | `_dashboard/bills`         |
| `finance/categories.tsx`    | `_dashboard/finance/categories`    | `_dashboard/categories`    |
| `finance/goals.tsx`         | `_dashboard/finance/goals`         | `_dashboard/goals`         |

Run the same `mv` command for each, then open each file and change the `createFileRoute(...)` string identically to Step 1.

**Step 3: Delete the now-empty finance directory**

```bash
rmdir apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/finance
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: move finance routes up one level (remove finance/ prefix)"
```

---

## Task 2: Update sidebar nav items

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Remove `finance` group, keep items — move into a new unlabeled or ERP group**

The current structure has a `finance` group (labeled "Finanças") and an `erp` group (labeled "ERP"). Remove the `finance` group label and merge all items (including contacts from `erp`) into a single group, updating all `finance/` route prefixes:

```ts
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
            label: "Montte AI",
            icon: Sparkles,
            route: "/$slug/$teamSlug/chat",
         },
         {
            id: "dashboards",
            label: "Dashboards",
            icon: LayoutDashboard,
            route: "/$slug/$teamSlug/analytics/dashboards",
            earlyAccessFlag: "advanced-analytics",
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            route: "/$slug/$teamSlug/analytics/insights",
            earlyAccessFlag: "advanced-analytics",
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            route: "/$slug/$teamSlug/analytics/data-management",
            subPanel: "data-management",
            earlyAccessFlag: "advanced-analytics",
         },
      ],
   },
   {
      id: "erp",
      items: [
         {
            id: "transactions",
            label: "Transações",
            icon: ArrowLeftRight,
            route: "/$slug/$teamSlug/transactions",
            quickAction: { type: "create", target: "sheet" },
            configurable: true,
         },
         {
            id: "bank-accounts",
            label: "Contas Bancárias",
            icon: Building2,
            route: "/$slug/$teamSlug/bank-accounts",
            configurable: true,
         },
         {
            id: "credit-cards",
            label: "Cartões de Crédito",
            icon: CreditCard,
            route: "/$slug/$teamSlug/credit-cards",
            configurable: true,
         },
         {
            id: "categories",
            label: "Categorias",
            icon: Tag,
            route: "/$slug/$teamSlug/categories",
            configurable: true,
         },
         {
            id: "tags",
            label: "Tags",
            icon: Tags,
            route: "/$slug/$teamSlug/tags",
            configurable: true,
         },
         {
            id: "goals",
            label: "Metas",
            icon: Target,
            route: "/$slug/$teamSlug/goals",
            configurable: true,
         },
         {
            id: "bills",
            label: "Contas",
            icon: Receipt,
            route: "/$slug/$teamSlug/bills",
            configurable: true,
         },
         {
            id: "contacts",
            label: "Contatos",
            icon: Users,
            route: "/$slug/$teamSlug/contacts",
            earlyAccessFlag: "contacts",
         },
      ],
   },
];
```

**Step 2: Update `task-definitions.ts`**

File: `apps/web/src/features/onboarding/task-definitions.ts`

Change the 3 `route` strings that reference `finance/`:

```ts
// Line 38 — was: "/$slug/$teamSlug/finance/bank-accounts"
route: "/$slug/$teamSlug/bank-accounts",

// Line 48 — was: "/$slug/$teamSlug/finance/categories"
route: "/$slug/$teamSlug/categories",

// Line 59 — was: "/$slug/$teamSlug/finance/transactions"
route: "/$slug/$teamSlug/transactions",
```

**Step 3: Start dev server to regenerate routeTree.gen.ts**

```bash
bun dev
```

Wait for it to start successfully (the route tree will auto-regenerate). Then stop it (`Ctrl+C`).

**Step 4: Verify no remaining `finance/` references**

```bash
grep -r "finance/" apps/web/src --include="*.ts" --include="*.tsx" | grep -v routeTree.gen.ts | grep -v ".md"
```

Expected: no output.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove finance group from sidebar, update nav routes to top-level"
```

---

## Task 3: Replace `insights/new` with inline empty-insight creation

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/index.tsx`
- Modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts`
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/new.tsx`

**Step 1: Export `DEFAULT_KPI_CONFIG` from `use-insight-config.ts`**

In `apps/web/src/features/analytics/hooks/use-insight-config.ts`, change line 12 from:

```ts
const DEFAULT_KPI_CONFIG: KpiConfig = {
```

to:

```ts
export const DEFAULT_KPI_CONFIG: KpiConfig = {
```

**Step 2: Update `insights/index.tsx` — replace navigation with create mutation**

Replace the entire `InsightsListPage` function. Key changes:

1. Import `DEFAULT_KPI_CONFIG` and add `useTransition`
2. Replace `navigate to new` with a `createMutation` + `startTransition` pattern
3. Update both the page header button and the context panel action

Full updated `InsightsListPage`:

```tsx
function InsightsListPage() {
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const [isCreating, startCreateTransition] = useTransition();

   const createMutation = useMutation(
      orpc.insights.create.mutationOptions({
         onSuccess: (data) => {
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
            navigate({
               to: "/$slug/$teamSlug/analytics/insights/$insightId",
               params: { slug, teamSlug, insightId: data.id },
            });
         },
         onError: () => {
            toast.error("Erro ao criar insight");
         },
      }),
   );

   const handleCreate = () => {
      startCreateTransition(async () => {
         await createMutation.mutateAsync({
            name: "Novo insight",
            type: "kpi",
            config: DEFAULT_KPI_CONFIG,
         });
      });
   };

   useContextPanelInfo(
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Ações</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
            <ContextPanelAction
               icon={Plus}
               label="Novo insight"
               onClick={handleCreate}
            />
         </ContextPanelContent>
      </ContextPanel>,
   );

   const {
      data: insights,
      isLoading,
      error,
   } = useQuery(orpc.insights.list.queryOptions({}));

   // ... columns definition stays the same ...

   return (
      <main className="flex flex-col gap-6">
         <PageHeader
            actions={
               <Button disabled={isCreating} onClick={handleCreate}>
                  {isCreating ? (
                     <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                     <Plus className="size-4 mr-1" />
                  )}
                  Novo insight
               </Button>
            }
            description="Analise eventos, funis e retenção com consultas personalizadas."
            title="Insights"
         />
         {/* ... rest of JSX unchanged ... */}
      </main>
   );
}
```

Add `useTransition` to the React import. Add `Loader2` to the lucide-react import. Import `DEFAULT_KPI_CONFIG` from `@/features/analytics/hooks/use-insight-config`. Remove the `Link` import (no longer needed in this file).

**Step 3: Delete `insights/new.tsx`**

```bash
rm apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/analytics/insights/new.tsx
```

**Step 4: Regenerate route tree**

```bash
bun dev
```

Wait for it to start, then stop it.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(insights): create empty insight on click instead of navigating to new page"
```

---

## Task 4: Add `EarlyAccessBanner` to analytics screens

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/index.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/$dashboardId.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/index.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/$insightId.tsx`

The same banner template is used across all 4 analytics files. Define it as a file-level `const` in each file (no shared module — YAGNI):

```ts
const ANALYTICS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Analytics Avançado",
   message: "Esta funcionalidade está em fase beta.",
   ctaLabel: "Deixar feedback",
   bullets: [
      "Crie dashboards personalizados com seus insights",
      "Analise tendências, funis e retenção de usuários",
      "Seu feedback nos ajuda a melhorar",
   ],
};
```

Import in each file:

```ts
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
```

**Step 1: Update `dashboards/index.tsx`**

Add the banner const after the imports. In `DashboardsPage`, insert `<EarlyAccessBanner template={ANALYTICS_BANNER} />` immediately after `<PageHeader ... />`:

```tsx
return (
   <main className="flex flex-col gap-4">
      <PageHeader ... />
      <EarlyAccessBanner template={ANALYTICS_BANNER} />
      <Suspense fallback={<DashboardsPageSkeleton />}>
         <DashboardsList />
      </Suspense>
   </main>
);
```

**Step 2: Update `dashboards/$dashboardId.tsx`**

Add the banner const after imports. Wrap `DashboardViewPage` in a `<main>` with the banner above the `<Suspense>`:

```tsx
function DashboardViewPage() {
   return (
      <main className="flex flex-col gap-4">
         <EarlyAccessBanner template={ANALYTICS_BANNER} />
         <Suspense fallback={<DashboardSkeleton />}>
            <DashboardViewPageContent />
         </Suspense>
      </main>
   );
}
```

**Step 3: Update `insights/index.tsx`**

Add the banner const after imports. In `InsightsListPage`, insert `<EarlyAccessBanner template={ANALYTICS_BANNER} />` immediately after `<PageHeader ... />`:

```tsx
return (
   <main className="flex flex-col gap-6">
      <PageHeader ... />
      <EarlyAccessBanner template={ANALYTICS_BANNER} />
      {isLoading && <ListSkeleton />}
      {/* ... rest unchanged ... */}
   </main>
);
```

**Step 4: Update `insights/$insightId.tsx`**

Add the banner const after imports. In the final `return` of `EditInsightPage` (the one returning `<InsightBuilder>`), wrap in a fragment with the banner above:

```tsx
return (
   <>
      <EarlyAccessBanner template={ANALYTICS_BANNER} />
      <InsightBuilder
         config={config}
         {/* ... all props unchanged ... */}
      />
   </>
);
```

Do NOT add the banner to the loading skeleton or error state returns.

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/analytics/
git commit -m "feat: add early access feedback banner to analytics screens"
```

---

## Task 5: Add `EarlyAccessBanner` to contacts screen

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx` (new path from Task 1)

**Step 1: Add banner to `ContactsPage`**

Add the banner const after imports:

```ts
const CONTACTS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Contatos",
   message: "Esta funcionalidade está em fase alpha.",
   ctaLabel: "Deixar feedback",
   bullets: [
      "Cadastre clientes e fornecedores",
      "Vincule contatos a transações e cobranças",
      "Seu feedback nos ajuda a melhorar",
   ],
};
```

Import:

```ts
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
```

In `ContactsPage`, insert `<EarlyAccessBanner template={CONTACTS_BANNER} />` immediately after `<DefaultHeader ... />`:

```tsx
return (
   <main className="flex flex-col gap-4">
      <DefaultHeader ... />
      <EarlyAccessBanner template={CONTACTS_BANNER} />

      {/* Type filter tabs */}
      <div className="flex gap-2 flex-wrap">
         {/* ... unchanged ... */}
      </div>

      <Suspense fallback={<ContactsSkeleton />}>
         <ContactsList typeFilter={typeFilter} view={currentView} />
      </Suspense>
   </main>
);
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/contacts.tsx
git commit -m "feat: add early access feedback banner to contacts screen"
```

---

## Final verification

```bash
bun run typecheck
```

Expected: no errors. Fix any type errors before considering the work done.

```bash
git log --oneline -5
```

Should show the 5 commits from this plan.
