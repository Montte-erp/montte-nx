# Remove DialogStack — Migrate to useCredenza Stack

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all `DialogStack` / `dialog-stack` infrastructure and replace with `useCredenza` stack pattern.

**Architecture:** `DialogStack` component (`packages/ui`) is only used by `use-dialog-stack.tsx` which is dead code (`openDialogStack` is never called). All `*-dialog-stack.tsx` feature files already use `CredenzaBody/Header/etc` — they're just misnamed. The `TransactionDialogStack` uses a `secondaryForm` state to swap credenza content in-place; migrate this to `openCredenza` / `closeTopCredenza` for proper visual stacking. All other files need renaming only.

**Tech Stack:** React, TanStack Store, `useCredenza` hook at `apps/web/src/hooks/use-credenza.tsx`

---

## Context: File Inventory

### Files to DELETE
- `packages/ui/src/components/dialog-stack.tsx`
- `apps/web/src/hooks/use-dialog-stack.tsx`

### Files to RENAME (`*-dialog-stack.tsx` → `*-credenza.tsx`)

| Old path | New path |
|---|---|
| `apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx` | `apps/web/src/features/transactions/ui/transaction-credenza.tsx` |
| `apps/web/src/features/transactions/ui/transaction-import-dialog-stack.tsx` | `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx` |
| `apps/web/src/features/bills/ui/bill-pay-dialog-stack.tsx` | `apps/web/src/features/bills/ui/bill-pay-credenza.tsx` |
| `apps/web/src/features/bills/ui/bill-from-transaction-dialog-stack.tsx` | `apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx` |
| `apps/web/src/features/budget-goals/ui/budget-goal-dialog-stack.tsx` | `apps/web/src/features/budget-goals/ui/budget-goal-credenza.tsx` |
| `apps/web/src/features/services/ui/service-import-dialog-stack.tsx` | `apps/web/src/features/services/ui/service-import-credenza.tsx` |
| `apps/web/src/features/analytics/ui/insight-edit-dialog-stack.tsx` | `apps/web/src/features/analytics/ui/insight-edit-credenza.tsx` |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-dialog-stack.tsx` | `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx` |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-movement-dialog-stack.tsx` | `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-movement-credenza.tsx` |

### Files that import the above (need import path updates)

| File | What changes |
|---|---|
| `apps/web/src/routes/__root.tsx` | Remove `GlobalDialogStack` import + render |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx` | `TransactionDialogStack` → `TransactionCredenza` from new path |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bills.tsx` | `BillPayDialogStack` → `BillPayCredenza` from new path |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/goals.tsx` | `BudgetGoalDialogStack` → `BudgetGoalCredenza` from new path |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx` | `CategoryImportDialogStack` → `CategoryImportCredenza` from new path |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx` | `InventoryMovementDialogStack` → `InventoryMovementCredenza` from new path |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx` | `ServiceImportDialogStack` → `ServiceImportCredenza` from new path |
| `apps/web/src/features/analytics/ui/dashboard-tile.tsx` | `InsightEditDialogStack` → `InsightEditCredenza` from new path |
| `apps/web/src/features/transactions/ui/transactions-list.tsx` | Both `TransactionDialogStack` and `BillFromTransactionDialogStack` → new names/paths |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/-home/quick-start-task.tsx` | `TransactionDialogStack` → `TransactionCredenza` |

---

## Task 1: Delete dead code — `use-dialog-stack.tsx` + `GlobalDialogStack`

**Files:**
- Delete: `apps/web/src/hooks/use-dialog-stack.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Remove GlobalDialogStack from `__root.tsx`**

In `apps/web/src/routes/__root.tsx`:
- Remove import: `import { GlobalDialogStack } from "@/hooks/use-dialog-stack";`
- Remove render: `<GlobalDialogStack />` (line ~100)

**Step 2: Delete the hook file**

```bash
rm apps/web/src/hooks/use-dialog-stack.tsx
```

**Step 3: Delete the UI component**

```bash
rm packages/ui/src/components/dialog-stack.tsx
```

**Step 4: Verify typecheck passes**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

Expected: no errors related to `dialog-stack`.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead dialog-stack infrastructure"
```

---

## Task 2: Rename `transaction-dialog-stack.tsx` → `transaction-credenza.tsx` (rename only, no logic changes yet)

**Files:**
- Rename: `apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx` → `transaction-credenza.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`
- Modify: `apps/web/src/features/transactions/ui/transactions-list.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/-home/quick-start-task.tsx`

**Step 1: Rename file**

```bash
mv apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx \
   apps/web/src/features/transactions/ui/transaction-credenza.tsx
```

**Step 2: Rename exports inside the new file**

In `apps/web/src/features/transactions/ui/transaction-credenza.tsx`:
- `TransactionDialogStackContent` → `TransactionCredenzaContent` (internal, line ~717)
- `TransactionDialogStack` → `TransactionCredenza` (exported, line ~2012)

**Step 3: Update imports in callers**

In `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`:
```typescript
// Before
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
// After
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
```
Also update the JSX: `<TransactionDialogStack` → `<TransactionCredenza`

In `apps/web/src/features/transactions/ui/transactions-list.tsx`:
```typescript
// Before
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
// After
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
```
Also update the JSX.

In `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/-home/quick-start-task.tsx`:
```typescript
// Before
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
// After
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
```
Also update the JSX.

**Step 4: Verify typecheck**

```bash
bun run typecheck 2>&1 | head -50
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename TransactionDialogStack → TransactionCredenza"
```

---

## Task 3: Refactor `TransactionCredenza` — replace `secondaryForm` with `openCredenza` stack

This is the main logic change. Currently, when the user clicks "+ Nova Conta" etc., a `secondaryForm` state is set and the ENTIRE credenza content is swapped for the secondary form. We replace this with `openCredenza` to push a new credenza on the stack.

**File:** `apps/web/src/features/transactions/ui/transaction-credenza.tsx`

**Step 1: Read the current secondary form section**

Read lines 870–934 of `transaction-credenza.tsx` to see the `if (secondaryForm)` block and the 5 secondary form components: `NovaConta`, `NovoCartao`, `NovoContato`, `NovaCategoria`, `NovaTag`.

Also read lines ~1160–1670 to see where `setSecondaryForm(...)` is called.

**Step 2: Update imports — add `openCredenza`, `closeTopCredenza`**

The `TransactionCredenzaContent` component needs `openCredenza` and `closeTopCredenza`. These come from `use-credenza.tsx`:

```typescript
import { closeTopCredenza, openCredenza } from "@/hooks/use-credenza";
```

**Step 3: Remove `secondaryForm` state and `SecondaryForm` type**

Remove:
```typescript
type SecondaryForm =
   | { type: "bankAccount" }
   | { type: "creditCard" }
   | { type: "contact" }
   | { type: "category"; transactionType: "income" | "expense" }
   | { type: "tag" }
   | null;
```

Remove from `TransactionCredenzaContent`:
```typescript
const [secondaryForm, setSecondaryForm] = useState<SecondaryForm>(null);
```

**Step 4: Remove the `if (secondaryForm) { return (...) }` block (lines ~874–934)**

Delete the entire block:
```typescript
if (secondaryForm) {
   return (
      <>
         {secondaryForm.type === "bankAccount" && ...}
         {secondaryForm.type === "creditCard" && ...}
         {secondaryForm.type === "contact" && ...}
         {secondaryForm.type === "category" && ...}
         {secondaryForm.type === "tag" && ...}
      </>
   );
}
```

**Step 5: Update each `setSecondaryForm` call site → `openCredenza`**

Find each `setSecondaryForm(...)` call using grep, then replace:

**BankAccount** (previously `setSecondaryForm({ type: "bankAccount" })`):
```typescript
openCredenza({
   children: (
      <NovaConta
         onSuccess={(id) => {
            form.setFieldValue("bankAccountId", id);
            closeTopCredenza();
         }}
      />
   ),
});
```

**CreditCard** (previously `setSecondaryForm({ type: "creditCard" })`):
```typescript
openCredenza({
   children: (
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
         <NovoCartao
            onSuccess={(id) => {
               form.setFieldValue("creditCardId", id);
               closeTopCredenza();
            }}
         />
      </Suspense>
   ),
});
```

**Contact** (previously `setSecondaryForm({ type: "contact" })`):
```typescript
openCredenza({
   children: (
      <NovoContato
         onSuccess={(id) => {
            form.setFieldValue("contactId", id);
            closeTopCredenza();
         }}
      />
   ),
});
```

**Category** (previously `setSecondaryForm({ type: "category", transactionType: ... })`):
```typescript
openCredenza({
   children: (
      <NovaCategoria
         transactionType={currentTransactionType}
         onSuccess={(id) => {
            form.setFieldValue("categoryId", id);
            closeTopCredenza();
         }}
      />
   ),
});
```

Where `currentTransactionType` is the current `form.getFieldValue("type")` as `"income" | "expense"`.

**Tag** (previously `setSecondaryForm({ type: "tag" })`):
```typescript
openCredenza({
   children: (
      <NovaTag
         onSuccess={(id) => {
            form.setFieldValue("tagIds", [...form.getFieldValue("tagIds"), id]);
            form.setFieldMeta("tagIds", (prev) => ({ ...prev, isTouched: true }));
            closeTopCredenza();
         }}
      />
   ),
});
```

**Step 6: Remove `onBack` props from secondary form components**

The components `NovaConta`, `NovoCartao`, `NovoContato`, `NovaCategoria`, `NovaTag` all accept `onBack: () => void`. Since closing the top credenza is now handled by the user pressing the credenza close button (or `closeTopCredenza` after success), remove `onBack` from:
- Their prop interface definitions
- Their internal usage (the back `<Button onClick={onBack}>` in the header)
- The `onBack` props passed at call sites (no longer needed)

Note: Review each secondary form to check if the back button is the only use of `onBack`. If any component has a back button rendered in its header, remove that button — the credenza's own close/dismiss gesture replaces it.

**Step 7: Run typecheck**

```bash
bun run typecheck 2>&1 | head -80
```

Fix any type errors before committing.

**Step 8: Commit**

```bash
git add apps/web/src/features/transactions/ui/transaction-credenza.tsx
git commit -m "refactor(transactions): replace secondaryForm state with useCredenza stack"
```

---

## Task 4: Rename remaining `*-dialog-stack.tsx` files

For each file in this list, the operation is identical: rename file, rename exported component, update import in caller.

### 4a: `transaction-import-dialog-stack.tsx` → `transaction-import-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/transactions/ui/transaction-import-dialog-stack.tsx` → `transaction-import-credenza.tsx`
- Find callers: `grep -r "transaction-import-dialog-stack\|TransactionImportDialogStack" apps/web/src --include="*.tsx" -l`
- Update each caller's import path and component name.

Export rename: `TransactionImportDialogStack` → `TransactionImportCredenza`

### 4b: `bill-pay-dialog-stack.tsx` → `bill-pay-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/bills/ui/bill-pay-dialog-stack.tsx` → `bill-pay-credenza.tsx`
- Caller: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bills.tsx`
- Export rename: `BillPayDialogStack` → `BillPayCredenza`, `BillPayDialogStackProps` → `BillPayCredenzaProps`

### 4c: `bill-from-transaction-dialog-stack.tsx` → `bill-from-transaction-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/bills/ui/bill-from-transaction-dialog-stack.tsx` → `bill-from-transaction-credenza.tsx`
- Caller: `apps/web/src/features/transactions/ui/transactions-list.tsx`
- Export rename: `BillFromTransactionDialogStack` → `BillFromTransactionCredenza`

### 4d: `budget-goal-dialog-stack.tsx` → `budget-goal-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/budget-goals/ui/budget-goal-dialog-stack.tsx` → `budget-goal-credenza.tsx`
- Caller: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/goals.tsx`
- Export rename: `BudgetGoalDialogStack` → `BudgetGoalCredenza`, `BudgetGoalDialogStackProps` → `BudgetGoalCredenzaProps`

### 4e: `service-import-dialog-stack.tsx` → `service-import-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/services/ui/service-import-dialog-stack.tsx` → `service-import-credenza.tsx`
- Caller: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`
- Export rename: `ServiceImportDialogStack` → `ServiceImportCredenza`

### 4f: `insight-edit-dialog-stack.tsx` → `insight-edit-credenza.tsx`

**Files:**
- Rename: `apps/web/src/features/analytics/ui/insight-edit-dialog-stack.tsx` → `insight-edit-credenza.tsx`
- Caller: `apps/web/src/features/analytics/ui/dashboard-tile.tsx`
- Export rename: `InsightEditDialogStack` → `InsightEditCredenza`

### 4g: `category-import-dialog-stack.tsx` → `category-import-credenza.tsx`

**Files:**
- Rename: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-dialog-stack.tsx` → `category-import-credenza.tsx`
- Caller: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`
- Export rename: `CategoryImportDialogStack` → `CategoryImportCredenza`

### 4h: `inventory-movement-dialog-stack.tsx` → `inventory-movement-credenza.tsx`

**Files:**
- Rename: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-movement-dialog-stack.tsx` → `inventory-movement-credenza.tsx`
- Caller: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`
- Export rename: `InventoryMovementDialogStack` → `InventoryMovementCredenza`

**After all renames, run typecheck:**

```bash
bun run typecheck 2>&1 | head -80
```

**Commit:**

```bash
git add -A
git commit -m "refactor: rename all *-dialog-stack components to *-credenza"
```

---

## Task 5: Final verification

**Step 1: Confirm no references to `dialog-stack` remain**

```bash
grep -r "dialog-stack\|DialogStack\|useDialogStack\|openDialogStack\|GlobalDialogStack" \
  apps/web/src packages/ui/src --include="*.tsx" --include="*.ts" -l
```

Expected: zero matches.

**Step 2: Full typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Lint**

```bash
bun run check
```

**Step 4: Final commit if any lint fixes**

```bash
git add -A
git commit -m "chore: final cleanup after dialog-stack removal"
```
