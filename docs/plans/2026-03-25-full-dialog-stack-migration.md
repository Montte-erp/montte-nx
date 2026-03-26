# Full Dialog Stack Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate every Credenza-based dialog on the platform to use `DialogStack`, making DialogStack the single dialog system.

**Architecture:** Two-phase migration. Phase 1: update every form component file — either rename `*-credenza.tsx` → `*-dialog-stack.tsx` with new export names, or in-place update `*-form.tsx` files that use `Credenza*` internally. Phase 2: update all call sites to use `openDialogStack`/`closeDialogStack` and the new component names. Phase 3: delete `use-credenza.tsx` and remove `GlobalCredenza`.

**Tech Stack:** `DialogStack` from `@packages/ui/components/dialog-stack`, TanStack Store via `useDialogStack` from `@/hooks/use-dialog-stack`

---

## Migration Pattern Reference

Every form component follows the same mechanical substitution:

### Imports
```tsx
// Remove:
import { CredenzaBody, CredenzaClose, CredenzaDescription, CredenzaFooter, CredenzaHeader, CredenzaTitle } from "@packages/ui/components/credenza";

// Add:
import {
  DialogStackContent,
  DialogStackDescription,
  DialogStackFooter,
  DialogStackHeader,
  DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
```

### Component substitutions
| Old | New |
|-----|-----|
| `<CredenzaHeader>` | `<DialogStackHeader>` |
| `<CredenzaTitle>` | `<DialogStackTitle>` |
| `<CredenzaDescription>` | `<DialogStackDescription>` |
| `<CredenzaBody>` | `<div className="flex-1 overflow-y-auto px-4 py-4">` |
| `</CredenzaBody>` | `</div>` |
| `<CredenzaFooter>` | `<div className="border-t px-4 py-4">` |
| `</CredenzaFooter>` | `</div>` |
| `<CredenzaClose ...>` | `<button type="button" onClick={onClose} ...>` (add `onClose?: () => void` prop) |

### Wrapping
All return content must be wrapped in `<DialogStackContent index={0}>...</DialogStackContent>`.

### For `*-credenza.tsx` → `*-dialog-stack.tsx` renames
- Create the new file alongside the old one (do NOT delete the old file yet)
- Rename the export: `FooCredenza` → `FooDialogStack`
- Old file stays until Task 8 (call sites)

### For `*-form.tsx` in-place updates
- Edit the file in place (no rename)
- Keep the same export name

---

## Task 1: Migrate small dedicated credenza files

**Files (create new alongside old):**
- `apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx` → `bill-from-transaction-dialog-stack.tsx` (export: `BillFromTransactionDialogStack`)
- `apps/web/src/features/bills/ui/bill-pay-credenza.tsx` → `bill-pay-dialog-stack.tsx` (export: `BillPayDialogStack`)
- `apps/web/src/features/budget-goals/ui/budget-goal-credenza.tsx` → `budget-goal-dialog-stack.tsx` (export: `BudgetGoalDialogStack`)
- `apps/web/src/features/analytics/ui/insight-edit-credenza.tsx` → `insight-edit-dialog-stack.tsx` (export: `InsightEditDialogStack`)

**Steps:**

1. Read each source file in full
2. Create the new `*-dialog-stack.tsx` file applying the Migration Pattern (wrap in `DialogStackContent index={0}`, swap all Credenza* components)
3. Keep all form logic, mutations, props identical — only change wrapper components
4. Run `bun run typecheck` from `/home/yorizel/Documents/montte-nx`
5. Fix any errors
6. Commit:
```bash
git add apps/web/src/features/bills/ui/bill-from-transaction-dialog-stack.tsx \
        apps/web/src/features/bills/ui/bill-pay-dialog-stack.tsx \
        apps/web/src/features/budget-goals/ui/budget-goal-dialog-stack.tsx \
        apps/web/src/features/analytics/ui/insight-edit-dialog-stack.tsx
git commit -m "feat(ui): migrate small credenza forms to dialog-stack"
```

---

## Task 2: Migrate medium credenza files

**Files (create new alongside old):**
- `apps/web/src/features/categories/ui/category-import-credenza.tsx` → `category-import-dialog-stack.tsx` (export: `CategoryImportDialogStack`)
- `apps/web/src/features/inventory/ui/inventory-movement-credenza.tsx` → `inventory-movement-dialog-stack.tsx` (export: `InventoryMovementDialogStack`)

Note: `inventory-movement-credenza.tsx` uses only `CredenzaHeader`, `CredenzaTitle`, `CredenzaDescription` (no Body/Footer) — wrap the full return in `<DialogStackContent index={0}>` and substitute the header components only.

**Steps:**

1. Read each source file in full
2. Create the new `*-dialog-stack.tsx` files applying the Migration Pattern
3. Run `bun run typecheck`
4. Fix any errors
5. Commit:
```bash
git add apps/web/src/features/categories/ui/category-import-dialog-stack.tsx \
        apps/web/src/features/inventory/ui/inventory-movement-dialog-stack.tsx
git commit -m "feat(ui): migrate medium credenza forms to dialog-stack"
```

---

## Task 3: Migrate large credenza files

**Files (create new alongside old):**
- `apps/web/src/features/services/ui/service-import-credenza.tsx` → `service-import-dialog-stack.tsx` (export: `ServiceImportDialogStack`) — ~779 lines
- `apps/web/src/features/transactions/ui/transaction-export-credenza.tsx` → `transaction-export-dialog-stack.tsx` (export: `TransactionExportDialogStack`) — ~437 lines, uses `CredenzaClose`
- `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx` → `transaction-import-dialog-stack.tsx` (export: `TransactionImportDialogStack`) — ~1534 lines

For `CredenzaClose` in `transaction-export-credenza.tsx`: replace with a plain `<button>` that calls an `onClose` prop. Add `onClose?: () => void` to the component props. The call site will pass `closeDialogStack` as `onClose`.

**Steps:**

1. Read each source file in chunks (they are large)
2. Create the new files applying the Migration Pattern
3. Run `bun run typecheck`
4. Fix errors
5. Commit:
```bash
git add apps/web/src/features/services/ui/service-import-dialog-stack.tsx \
        apps/web/src/features/transactions/ui/transaction-export-dialog-stack.tsx \
        apps/web/src/features/transactions/ui/transaction-import-dialog-stack.tsx
git commit -m "feat(ui): migrate large credenza forms to dialog-stack"
```

---

## Task 4: Migrate generic form components — batch 1 (entity forms)

These are **in-place edits** (no rename). Apply the Migration Pattern directly to each file.

**Files to edit:**
- `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`
- `apps/web/src/features/bills/ui/bills-form.tsx`
- `apps/web/src/features/categories/ui/categories-form.tsx`
- `apps/web/src/features/contacts/ui/contacts-form.tsx`
- `apps/web/src/features/credit-cards/ui/credit-cards-form.tsx`

**Steps:**

1. Read each file
2. Replace all `Credenza*` imports and components with `DialogStack*` equivalents
3. Wrap return content in `<DialogStackContent index={0}>...</DialogStackContent>`
4. Run `bun run typecheck`
5. Fix errors
6. Commit:
```bash
git add apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx \
        apps/web/src/features/bills/ui/bills-form.tsx \
        apps/web/src/features/categories/ui/categories-form.tsx \
        apps/web/src/features/contacts/ui/contacts-form.tsx \
        apps/web/src/features/credit-cards/ui/credit-cards-form.tsx
git commit -m "feat(ui): migrate entity form components to dialog-stack"
```

---

## Task 5: Migrate generic form components — batch 2

**Files to edit (in-place):**
- `apps/web/src/features/inventory/ui/inventory-product-form.tsx`
- `apps/web/src/features/services/ui/services-form.tsx`
- `apps/web/src/features/services/ui/subscription-form.tsx`
- `apps/web/src/features/tags/ui/tags-form.tsx`
- `apps/web/src/features/webhooks/ui/webhook-form.tsx`
- `apps/web/src/features/webhooks/ui/webhook-secret-dialog.tsx`

**Steps:**

1. Read each file
2. Apply the Migration Pattern (in-place)
3. Run `bun run typecheck`
4. Fix errors
5. Commit:
```bash
git add apps/web/src/features/inventory/ui/inventory-product-form.tsx \
        apps/web/src/features/services/ui/services-form.tsx \
        apps/web/src/features/services/ui/subscription-form.tsx \
        apps/web/src/features/tags/ui/tags-form.tsx \
        apps/web/src/features/webhooks/ui/webhook-form.tsx \
        apps/web/src/features/webhooks/ui/webhook-secret-dialog.tsx
git commit -m "feat(ui): migrate service/tag/webhook form components to dialog-stack"
```

---

## Task 6: Migrate feedback, organization, and layout forms

**Files to edit (in-place):**
- `apps/web/src/features/feedback/ui/bug-report-form.tsx`
- `apps/web/src/features/feedback/ui/feature-feedback-form.tsx`
- `apps/web/src/features/feedback/ui/feature-request-form.tsx`
- `apps/web/src/features/organization/ui/create-team-form.tsx`
- `apps/web/src/features/organization/ui/manage-organization-form.tsx`
- `apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx`

**Steps:**

1. Read each file
2. Apply the Migration Pattern (in-place)
3. Run `bun run typecheck`
4. Fix errors
5. Commit:
```bash
git add apps/web/src/features/feedback/ui/bug-report-form.tsx \
        apps/web/src/features/feedback/ui/feature-feedback-form.tsx \
        apps/web/src/features/feedback/ui/feature-request-form.tsx \
        apps/web/src/features/organization/ui/create-team-form.tsx \
        apps/web/src/features/organization/ui/manage-organization-form.tsx \
        apps/web/src/layout/dashboard/ui/sidebar-nav-config-form.tsx
git commit -m "feat(ui): migrate feedback/org/layout form components to dialog-stack"
```

---

## Task 7: Migrate remaining form components

**Files to edit (in-place):**
- `apps/web/src/features/settings/ui/session-details-form.tsx`
- `apps/web/src/features/transactions/ui/bulk-categorize-form.tsx`
- `apps/web/src/features/transactions/ui/bulk-move-account-form.tsx`
- `apps/web/src/features/transactions/ui/transaction-prerequisites-blocker.tsx`
- `apps/web/src/hooks/use-reauthenticate.tsx`

**Files with inline Credenza JSX to edit (in-place):**
- `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx` — has inline Credenza* JSX passed as children to openCredenza; replace those inline usages
- `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx` — has inline Credenza* JSX; replace inline usages
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx` — has inline Credenza* JSX; replace inline usages

Also check `apps/web/src/features/inventory/ui/inventory-history-sheet.tsx` — uses Credenza* inside a Sheet; apply Migration Pattern.

**Steps:**

1. Read each file
2. Apply the Migration Pattern (in-place); for inline JSX, wrap the inline children in `<DialogStackContent index={0}>` and swap `Credenza*` → `DialogStack*`
3. Run `bun run typecheck`
4. Fix errors
5. Commit:
```bash
git add -p
git commit -m "feat(ui): migrate remaining form components to dialog-stack"
```

---

## Task 8: Update all call sites

Replace every `openCredenza` → `openDialogStack`, `closeCredenza` → `closeDialogStack`, and update component import names where files were renamed.

**Component name changes (for imports in call sites):**
| Old import | New import |
|---|---|
| `BillFromTransactionCredenza` | `BillFromTransactionDialogStack` |
| `BillPayCredenza` | `BillPayDialogStack` |
| `BudgetGoalCredenza` | `BudgetGoalDialogStack` |
| `InsightEditCredenza` | `InsightEditDialogStack` |
| `CategoryImportCredenza` | `CategoryImportDialogStack` |
| `InventoryMovementCredenza` | `InventoryMovementDialogStack` |
| `ServiceImportCredenza` | `ServiceImportDialogStack` |
| `TransactionExportCredenza` | `TransactionExportDialogStack` |
| `TransactionImportCredenza` | `TransactionImportDialogStack` |

**Import path changes:**
| Old path | New path |
|---|---|
| `.../bill-from-transaction-credenza` | `.../bill-from-transaction-dialog-stack` |
| `.../bill-pay-credenza` | `.../bill-pay-dialog-stack` |
| `.../budget-goal-credenza` | `.../budget-goal-dialog-stack` |
| `.../insight-edit-credenza` | `.../insight-edit-dialog-stack` |
| `.../category-import-credenza` | `.../category-import-dialog-stack` |
| `.../inventory-movement-credenza` | `.../inventory-movement-dialog-stack` |
| `.../service-import-credenza` | `.../service-import-dialog-stack` |
| `.../transaction-export-credenza` | `.../transaction-export-dialog-stack` |
| `.../transaction-import-credenza` | `.../transaction-import-dialog-stack` |

**Hook change in every call site file:**
```tsx
// Remove:
import { useCredenza } from "@/hooks/use-credenza";
const { openCredenza, closeCredenza } = useCredenza();

// Add:
import { useDialogStack } from "@/hooks/use-dialog-stack";
const { openDialogStack, closeDialogStack } = useDialogStack();
```

**Call sites to update (24 files):**
- `apps/web/src/features/analytics/ui/dashboard-tile.tsx`
- `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx`
- `apps/web/src/features/billing/ui/early-access-banner.tsx`
- `apps/web/src/features/feedback/ui/feedback-fab.tsx`
- `apps/web/src/features/onboarding/ui/quick-start-task.tsx`
- `apps/web/src/features/transactions/ui/transactions-list.tsx`
- `apps/web/src/hooks/use-reauthenticate.tsx`
- `apps/web/src/layout/dashboard/ui/app-sidebar.tsx`
- `apps/web/src/layout/dashboard/ui/dashboard-layout.tsx`
- `apps/web/src/layout/dashboard/ui/sidebar-nav.tsx`
- `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bills.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/goals.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/webhooks.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/security.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

**Steps:**

1. For each file: read it, replace `useCredenza` → `useDialogStack`, `openCredenza` → `openDialogStack`, `closeCredenza` → `closeDialogStack`, update renamed component imports and paths
2. Run `bun run typecheck`
3. Fix all errors
4. Commit in batches:
```bash
git add apps/web/src/features/ apps/web/src/hooks/use-reauthenticate.tsx \
        apps/web/src/layout/ apps/web/src/routes/
git commit -m "feat(ui): update all call sites from useCredenza to useDialogStack"
```

---

## Task 9: Final cleanup

**Steps:**

1. Delete old credenza-specific files:
```bash
rm apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx
rm apps/web/src/features/bills/ui/bill-pay-credenza.tsx
rm apps/web/src/features/budget-goals/ui/budget-goal-credenza.tsx
rm apps/web/src/features/analytics/ui/insight-edit-credenza.tsx
rm apps/web/src/features/categories/ui/category-import-credenza.tsx
rm apps/web/src/features/inventory/ui/inventory-movement-credenza.tsx
rm apps/web/src/features/services/ui/service-import-credenza.tsx
rm apps/web/src/features/transactions/ui/transaction-export-credenza.tsx
rm apps/web/src/features/transactions/ui/transaction-import-credenza.tsx
rm apps/web/src/features/transactions/ui/transaction-credenza.tsx
```

2. Delete `apps/web/src/hooks/use-credenza.tsx`

3. Remove `GlobalCredenza` import and render from `apps/web/src/routes/__root.tsx`

4. Run `bun run typecheck` — must be clean

5. Verify no remaining `Credenza` references:
```bash
grep -r "Credenza\|useCredenza\|openCredenza\|closeCredenza" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules\|dist\|.nitro\|.output"
```
Expected: no output (zero matches)

6. Commit:
```bash
git add -A
git commit -m "feat(ui): remove use-credenza and all legacy credenza files"
```
