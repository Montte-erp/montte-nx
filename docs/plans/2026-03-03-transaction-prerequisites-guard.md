# Transaction Prerequisites Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Block transaction creation when required prerequisites (bank accounts) don't exist, showing a blocking credenza that explains the issue and links to setup.

**Architecture:** A reusable prerequisites hook (`useTransactionPrerequisites`) reads cached bank accounts via `useQuery` (not suspense — page component has no Suspense boundary). `handleCreate` in `TransactionsPage` checks the count before opening the form, and opens a blocker credenza instead if empty. The blocker navigates to `/bank-accounts` on action.

**Tech Stack:** React, TanStack Query (`useQuery`), TanStack Router (`useNavigate`, `Route.useParams`), `useCredenza`, Lucide icons, `@packages/ui` credenza primitives.

---

### Task 1: Create the prerequisites hook

**Files:**
- Create: `apps/web/src/features/transactions/hooks/use-transaction-prerequisites.ts`

**What it does:** Reads bank accounts count from TanStack Query cache (data is prefetched by the route loader, so no waterfall). Returns a boolean `hasBankAccounts`.

**Step 1: Create the hook file**

```typescript
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useTransactionPrerequisites() {
   const { data: bankAccounts = [] } = useQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   return {
      hasBankAccounts: bankAccounts.length > 0,
   };
}
```

**Why `useQuery` not `useSuspenseQuery`:** `TransactionsPage` is not inside a `<Suspense>` boundary, so using `useSuspenseQuery` would require wrapping the whole page in Suspense. Since the route loader already prefetches `bankAccounts.getAll`, `useQuery` returns data synchronously on the first render — no loading state is shown.

**Step 2: Verify TypeScript — no separate run needed**, just move to Task 2.

---

### Task 2: Create the blocker credenza content component

**Files:**
- Create: `apps/web/src/features/transactions/ui/transaction-prerequisites-blocker.tsx`

**What it does:** Renders the credenza body explaining that a bank account is required, with a CTA button that calls `onAction` (which navigates to the bank accounts page and closes the credenza).

**Step 1: Create the file**

```tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Landmark } from "lucide-react";

interface TransactionPrerequisitesBlockerProps {
   onAction: () => void;
   onCancel: () => void;
}

export function TransactionPrerequisitesBlocker({
   onAction,
   onCancel,
}: TransactionPrerequisitesBlockerProps) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Conta bancária necessária</CredenzaTitle>
            <CredenzaDescription>
               Para criar uma transação, você precisa ter pelo menos uma conta
               bancária cadastrada.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col items-center gap-4 py-4 text-center">
               <div className="rounded-full bg-muted p-4">
                  <Landmark className="size-8 text-muted-foreground" />
               </div>
               <p className="text-sm text-muted-foreground max-w-xs">
                  Cadastre uma conta bancária primeiro. Você poderá criar
                  transações logo após.
               </p>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="flex-col gap-2">
            <Button className="w-full" onClick={onAction}>
               Cadastrar conta bancária
            </Button>
            <Button className="w-full" onClick={onCancel} variant="outline">
               Cancelar
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

---

### Task 3: Wire the guard into `TransactionsPage`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

**What changes:**
1. Import `useTransactionPrerequisites`, `TransactionPrerequisitesBlocker`, `useNavigate` from `@tanstack/react-router`
2. Call the hook in `TransactionsPage`
3. Update `handleCreate` to check `hasBankAccounts` before opening the form

**Step 1: Add imports**

At the top of the file, add these imports alongside existing ones:

```typescript
import { useNavigate } from "@tanstack/react-router";
import { useTransactionPrerequisites } from "@/features/transactions/hooks/use-transaction-prerequisites";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
```

**Step 2: Update `TransactionsPage` component**

Inside `TransactionsPage`, add the hook call and navigate, then update `handleCreate`:

```typescript
function TransactionsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const { currentView, setView, views } = useViewSwitch(
      "finance:transactions:view",
      TRANSACTION_VIEWS,
   );

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openCredenza({
            children: (
               <TransactionPrerequisitesBlocker
                  onAction={() => {
                     closeCredenza();
                     navigate({
                        to: "/$slug/$teamSlug/bank-accounts",
                        params: { slug, teamSlug },
                     });
                  }}
                  onCancel={closeCredenza}
               />
            ),
         });
         return;
      }
      openCredenza({
         children: (
            <TransactionSheet mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

   // ... rest of component unchanged
```

**Note:** `Route.useParams()` is already available since the file defines `export const Route = createFileRoute(...)`. The `slug` and `teamSlug` params come from the route definition `/_authenticated/$slug/$teamSlug/_dashboard/transactions`.

**Step 3: Verify the route path for bank accounts**

The bank accounts route file is at:
`apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`

So the TanStack Router path is `/$slug/$teamSlug/bank-accounts` — matching what's in the navigate call above. Confirm by checking the `Route` definition inside that file.

---

### Task 4: Quick smoke test

**Step 1: Start dev server**
```bash
bun dev
```

**Step 2: Manually test the guard**
1. Log in with a fresh team that has no bank accounts
2. Click "Nova Transação" — should open the blocker credenza with the Landmark icon
3. Click "Cadastrar conta bancária" — should close credenza and navigate to `/bank-accounts`
4. Click "Cancelar" — should close credenza and stay on transactions page
5. After creating a bank account, go back to transactions and click "Nova Transação" — should open the real form

**Step 3: Also verify sidebar quick-create**

The `useEffect` listener on `sidebar:quick-create` calls `handleCreate` too — so the guard fires for the sidebar shortcut as well (no extra change needed, it's wired automatically).

---

### Notes

- **No DB changes needed** for this task — schema change (`bankAccountId notNull`) is handled separately via `bun run db:push` when ready.
- **Other prerequisites**: Only bank accounts are guarded here. Categories, tags, contacts are all optional per the form and DB schema analysis. The pattern can be extended to other features (e.g., `inventoryMovements` → requires products) by adding more checks to the hook and more blocker variants.
- **`useQuery` vs `useSuspenseQuery`**: Using `useQuery` with `= []` default is safe here because the route loader prefetches the data. If the cache is somehow cold, the button simply won't show the blocker (hasBankAccounts defaults to `false` then `true` after load) — acceptable UX tradeoff vs adding a whole Suspense boundary to the page.
