# HyprPay SDK neverthrow + API Keys Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the neverthrow rewrite of the HyprPay SDK, fix the `fromStatusCode` bug in `errors.ts`, create an oRPC `list` query for API keys, and rewrite the API keys settings page to use DataTable + oRPC query + `authClient` mutations + `useCredenza` for the create action.

**Architecture:** The HyprPay SDK already has `client.ts` returning `ResultAsync<T, HyprPayError>` — the remaining SDK work is fixing the broken `fromStatusCode` method and re-exporting neverthrow types so consumers don't need to install neverthrow themselves. On the frontend, a new oRPC `api-keys` router exposes only a `list` query (queries → oRPC, mutations → `authClient` directly per project conventions). The settings page switches from `authClient.apiKey.list()` in `useSuspenseQuery` to `orpc.apiKeys.list.queryOptions()`, replaces the manual list with `DataTable`, moves `create` and `delete` to `authClient` with `startTransition`, and adds a "Nova chave" button that opens the create form via `useCredenza`.

**Tech Stack:** neverthrow, @orpc/server, @tanstack/react-query (useSuspenseQuery), DataTable, useCredenza, TanStack Form, Better Auth `authClient` (mutations only), `auth.api` (server-side list query)

---

### Task 1: Fix `errors.ts` `fromStatusCode` method

The `fromStatusCode` static method has dead code — every `return` after the first is unreachable. Fix it to an if-chain.

**Files:**
- Modify: `libraries/hyprpay/src/errors.ts`

**Step 1: Read the file**

```
libraries/hyprpay/src/errors.ts
```

**Step 2: Replace the broken method body**

Current (broken) — all returns after the first are unreachable:
```typescript
static fromStatusCode(statusCode: number, message: string): HyprPayError {
   return HyprPayError.unauthorized(message);
   return HyprPayError.forbidden(message);
   // ...
}
```

Replace the body with:
```typescript
static fromStatusCode(statusCode: number, message: string): HyprPayError {
   if (statusCode === 401) return HyprPayError.unauthorized(message);
   if (statusCode === 403) return HyprPayError.forbidden(message);
   if (statusCode === 404) return HyprPayError.notFound(message);
   if (statusCode === 400) return HyprPayError.badRequest(message);
   if (statusCode === 409) return HyprPayError.conflict(message);
   if (statusCode === 429) return HyprPayError.tooManyRequests(message);
   return HyprPayError.internal(message);
}
```

**Step 3: Typecheck**

```bash
cd libraries/hyprpay && bun run typecheck
```
Expected: no errors.

**Step 4: Commit**

```bash
git add libraries/hyprpay/src/errors.ts
git commit -m "fix(hyprpay): fix fromStatusCode dead code — restore if-chain"
```

---

### Task 2: Re-export neverthrow types from `index.ts`

Consumers return `ResultAsync<T, HyprPayError>` from every client method. They need neverthrow types without installing neverthrow themselves.

**Files:**
- Modify: `libraries/hyprpay/src/index.ts`

**Step 1: Read the current index.ts**

**Step 2: Add neverthrow re-exports**

Add after the existing export lines:
```typescript
export type { Result, ResultAsync } from "neverthrow";
export { ok, err, okAsync, errAsync } from "neverthrow";
```

**Step 3: Typecheck**

```bash
cd libraries/hyprpay && bun run typecheck
```

**Step 4: Commit**

```bash
git add libraries/hyprpay/src/index.ts
git commit -m "feat(hyprpay): re-export neverthrow Result types from index"
```

---

### Task 3: Create oRPC `api-keys` router — `list` only

Per project conventions: **queries → oRPC, mutations → `authClient` directly**. The router exposes only the `list` procedure. `create` and `delete` stay on `authClient`.

**Files:**
- Create: `apps/web/src/integrations/orpc/router/api-keys.ts`

**Step 1: Create the file**

```typescript
import { protectedProcedure } from "../server";

export const list = protectedProcedure.handler(async ({ context }) => {
   const result = await context.auth.api.listApiKeys({
      headers: context.headers,
   });
   const allKeys = Array.isArray(result) ? result : [];
   return allKeys.filter(
      (k: { metadata?: Record<string, unknown> | null }) =>
         k.metadata?.teamId === context.teamId,
   );
});
```

> **Type note:** `auth.api.listApiKeys` return type may vary by Better Auth version. If TypeScript complains, inspect the actual return — it might be `{ apiKeys: ApiKey[] }` instead of an array. Adjust the `Array.isArray` branch accordingly. Do NOT use `as` casts; fix the branch logic instead.

**Step 2: Typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | head -40
```
Expected: no new errors. If `listApiKeys` return type errors, read the Better Auth type and adjust the destructuring.

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/api-keys.ts
git commit -m "feat(orpc): add api-keys list query router"
```

---

### Task 4: Register `api-keys` router in the oRPC index

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Read the file**

**Step 2: Add import (keep alphabetical — after `accountRouter`)**

```typescript
import * as apiKeysRouter from "./api-keys";
```

**Step 3: Add to exported object (after `account: accountRouter,`)**

```typescript
apiKeys: apiKeysRouter,
```

**Step 4: Typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/router/index.ts
git commit -m "chore(orpc): register api-keys router"
```

---

### Task 5: Create api-keys column definitions (colocated)

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/-api-keys/api-keys-columns.tsx`

**Step 1: Create the file**

```typescript
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Trash2 } from "lucide-react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";

export type ApiKeyRow = {
   id: string;
   name: string;
   createdAt: string;
   prefix?: string | null;
};

export function buildApiKeysColumns(
   onRevoke: (keyId: string) => void,
   isPending: boolean,
): ColumnDef<ApiKeyRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "prefix",
         header: "Prefixo",
         cell: ({ row }) =>
            row.original.prefix ? (
               <Badge variant="outline" className="font-mono text-xs">
                  {row.original.prefix}***
               </Badge>
            ) : null,
      },
      {
         accessorKey: "createdAt",
         header: "Criada em",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
            </span>
         ),
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <Button
               size="sm"
               variant="ghost"
               onClick={() => onRevoke(row.original.id)}
               disabled={isPending}
            >
               <Trash2 className="size-4 text-destructive" />
            </Button>
         ),
      },
   ];
}
```

**Step 2: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/project/-api-keys/api-keys-columns.tsx"
git commit -m "feat(settings): add api-keys DataTable column definitions"
```

---

### Task 6: Create `CreateApiKeyForm` — uses `authClient` mutation

Create the colocated form component that the sheet will render. Mutation uses `authClient.apiKey.create()` with `startTransition` (never `useMutation`). After success, manually invalidate the oRPC list query via `useQueryClient`.

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/-api-keys/create-api-key-form.tsx`

**Step 1: Create the file**

```typescript
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const createKeySchema = z.object({
   name: z.string().min(1, "Nome obrigatório"),
});

interface CreateApiKeyFormProps {
   organizationId: string;
   teamId: string;
   onSuccess: () => void;
}

export function CreateApiKeyForm({
   organizationId,
   teamId,
   onSuccess,
}: CreateApiKeyFormProps) {
   const queryClient = useQueryClient();
   const [createdKey, setCreatedKey] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const form = useForm({
      defaultValues: { name: "" },
      validators: { onSubmit: createKeySchema },
      onSubmit: ({ value }) => {
         startTransition(async () => {
            const result = await authClient.apiKey.create({
               name: value.name,
               metadata: {
                  organizationId,
                  teamId,
                  plan: "metered",
                  sdkMode: "static",
                  apiKeyType: "private",
               },
            });
            if (result.error) {
               toast.error("Erro ao criar chave de API");
               return;
            }
            setCreatedKey(result.data?.key ?? null);
            await queryClient.invalidateQueries(
               orpc.apiKeys.list.queryOptions(),
            );
            toast.success("Chave criada — copie agora, não será exibida novamente");
         });
      },
   });

   function handleCopy(value: string) {
      navigator.clipboard.writeText(value);
      toast.success("Copiado para a área de transferência");
   }

   if (createdKey) {
      return (
         <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">
               Copie sua chave — ela não será exibida novamente:
            </p>
            <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-4">
               <code className="flex-1 break-all font-mono text-sm text-green-800">
                  {createdKey}
               </code>
               <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(createdKey)}
               >
                  <Copy className="size-4" />
               </Button>
            </div>
            <Button onClick={onSuccess}>Fechar</Button>
         </div>
      );
   }

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
         }}
         className="flex flex-col gap-4"
      >
         <form.Field
            name="name"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <div className="flex flex-col gap-2">
                     <FieldLabel htmlFor={field.name}>Nome da chave</FieldLabel>
                     <Input
                        id={field.name}
                        name={field.name}
                        aria-invalid={isInvalid}
                        placeholder="Ex: Produção"
                        value={field.state.value}
                        onInput={(e) =>
                           field.handleChange(e.currentTarget.value)
                        }
                     />
                  </div>
               );
            }}
         />
         <Button type="submit" disabled={isPending}>
            Criar chave
         </Button>
      </form>
   );
}
```

**Step 2: Typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "create-api-key"
```

**Step 3: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/project/-api-keys/create-api-key-form.tsx"
git commit -m "feat(settings): add CreateApiKeyForm using authClient mutation"
```

---

### Task 7: Rewrite `api-keys.tsx` — DataTable + oRPC list + authClient mutations + useCredenza

Replace the entire page. Query uses oRPC. Revoke uses `authClient.apiKey.delete()` with `startTransition`. Create button opens `CreateApiKeyForm` via `useCredenza`.

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys.tsx`

**Step 1: Read the current file**

**Step 2: Replace the entire file**

```typescript
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { KeyRound, Plus } from "lucide-react";
import { Suspense, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { z } from "zod";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Button } from "@packages/ui/components/button";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-sheet";
import { buildApiKeysColumns } from "./-api-keys/api-keys-columns";
import { CreateApiKeyForm } from "./-api-keys/create-api-key-form";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .optional()
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .optional()
         .default([]),
   }),
   component: ApiKeysPage,
});

const useTableState = createLocalStorageState<DataTableStoredState | null>(
   "montte:datatable:api-keys",
   null,
);

function ApiKeysSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="h-8 w-48 animate-pulse rounded bg-muted" />
         <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
   );
}

function ApiKeysContent() {
   const { sorting, columnFilters } = Route.useSearch();
   const navigate = Route.useNavigate();
   const { data: session } = authClient.useSession();
   const queryClient = useQueryClient();
   const { openSheet, closeSheet } = useCredenza();
   const [isPending, startTransition] = useTransition();
   const [tableState, setTableState] = useTableState();

   const { data: keys } = useSuspenseQuery(orpc.apiKeys.list.queryOptions());

   const organizationId = session?.session.activeOrganizationId ?? "";
   const teamId = session?.session.activeTeamId ?? "";

   function handleRevoke(keyId: string) {
      startTransition(async () => {
         const result = await authClient.apiKey.delete({ keyId });
         if (result.error) {
            toast.error("Erro ao revogar chave");
            return;
         }
         await queryClient.invalidateQueries(orpc.apiKeys.list.queryOptions());
         toast.success("Chave revogada");
      });
   }

   function handleOpenCreate() {
      openSheet({
         title: "Nova chave de API",
         children: (
            <CreateApiKeyForm
               organizationId={organizationId}
               teamId={teamId}
               onSuccess={closeSheet}
            />
         ),
      });
   }

   const columns = buildApiKeysColumns(handleRevoke, isPending);

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <h2 className="text-lg font-semibold">Chaves de API — HyprPay</h2>
               <p className="text-sm text-muted-foreground">
                  Use estas chaves para autenticar o SDK{" "}
                  <code className="font-mono text-xs">@montte/hyprpay</code> neste
                  espaço.
               </p>
            </div>
            <Button onClick={handleOpenCreate} disabled={!organizationId || !teamId}>
               <Plus className="size-4" />
               Nova chave
            </Button>
         </div>

         {keys.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <KeyRound />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma chave de API</EmptyTitle>
                  <EmptyDescription>
                     Crie uma chave para integrar o SDK HyprPay.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <DataTable
               data={keys}
               columns={columns}
               getRowId={(row) => row.id}
               sorting={sorting}
               onSortingChange={(updater) => {
                  const next =
                     typeof updater === "function" ? updater(sorting) : updater;
                  navigate({ search: (prev) => ({ ...prev, sorting: next }) });
               }}
               columnFilters={columnFilters}
               onColumnFiltersChange={(updater) => {
                  const next =
                     typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                  navigate({
                     search: (prev) => ({ ...prev, columnFilters: next }),
                  });
               }}
               tableState={tableState}
               onTableStateChange={setTableState}
            />
         )}
      </div>
   );
}

function ApiKeysPage() {
   return (
      <ErrorBoundary
         FallbackComponent={createErrorFallback({
            errorTitle: "Erro ao carregar chaves de API",
         })}
      >
         <Suspense fallback={<ApiKeysSkeleton />}>
            <ApiKeysContent />
         </Suspense>
      </ErrorBoundary>
   );
}
```

> **`useCredenza` import path:** Check how other pages import `useCredenza` — search for `use-sheet` in the codebase to find the correct import. It may be `@/hooks/use-sheet` or a different path.

**Step 3: Typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | head -40
```
Expected: no errors. Common issues:
- `useCredenza` not found — grep the codebase for the correct import path
- `orpc.apiKeys.list.queryOptions()` type mismatch with `DataTable` — inspect what the list returns and adjust `ApiKeyRow` in the columns file if needed

**Step 4: Verify in browser**
- List renders in DataTable
- "Nova chave" opens a sheet with the create form
- After creating, the one-time key is shown in the sheet
- Closing the sheet refreshes the table
- Revoke button calls `authClient.apiKey.delete` and refreshes

**Step 5: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/project/api-keys.tsx"
git commit -m "feat(settings): rewrite api-keys — DataTable, oRPC list, authClient mutations, useCredenza"
```

---

## Key Conventions Applied

| Convention | Application |
|-----------|-------------|
| Queries → oRPC | Only `list` in oRPC router |
| Mutations → `authClient` directly | `create` and `delete` use `authClient` + `startTransition` |
| Never wrap authClient in `useMutation` | Raw `await authClient.*` inside `startTransition` |
| Manual query invalidation after authClient mutations | `queryClient.invalidateQueries(orpc.apiKeys.list.queryOptions())` |
| Creating records → `useCredenza` | "Nova chave" button opens sheet (not credenza) |
| `useCredenza` only for selection flows | Not used here |

## Summary of Files

| File | Change |
|------|--------|
| `libraries/hyprpay/src/errors.ts` | Fix `fromStatusCode` dead code |
| `libraries/hyprpay/src/index.ts` | Re-export neverthrow types |
| `apps/web/src/integrations/orpc/router/api-keys.ts` | New: `list` query only |
| `apps/web/src/integrations/orpc/router/index.ts` | Register `apiKeys` |
| `.../-api-keys/api-keys-columns.tsx` | DataTable column defs |
| `.../-api-keys/create-api-key-form.tsx` | Form using `authClient` mutation |
| `.../settings/project/api-keys.tsx` | Full rewrite |
