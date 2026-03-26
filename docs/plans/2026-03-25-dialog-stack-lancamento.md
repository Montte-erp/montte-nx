# Dialog Stack — Lançamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `TransactionCredenza` (Credenza-based modal) with a `DialogStack`-based flow where the transaction form is the base layer and secondary creation forms (Nova Conta, Novo Contato, Nova Categoria, Tags, Novo Cartão, Parcelamento, Recorrência) push on top as stacked dialogs.

**Architecture:** Global `useDialogStack` hook backed by TanStack Store (mirrors `useCredenza` exactly). Always 2 layers — index 0 is the main transaction form, index 1 is the active secondary form determined by local `secondaryForm` state. The `+` buttons in the main form set `secondaryForm` and call `DialogStackNext`. The back button in secondary forms calls `DialogStackPrevious` and clears `secondaryForm`.

**Tech Stack:** `DialogStack` from `@packages/ui/components/dialog-stack`, TanStack Store, TanStack Form, oRPC mutations, React `useState`

---

### Task 1: Create `use-dialog-stack.tsx` global hook

**Files:**
- Create: `apps/web/src/hooks/use-dialog-stack.tsx`

**Step 1: Create the hook file**

```tsx
import {
   DialogStack,
   DialogStackBody,
   DialogStackOverlay,
} from "@packages/ui/components/dialog-stack";
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";

const dialogStackStore = new Store({
   children: null as React.ReactNode | null,
   isOpen: false,
});

export const openDialogStack = ({
   children,
}: {
   children: React.ReactNode;
}) =>
   dialogStackStore.setState((state) => ({
      ...state,
      children,
      isOpen: true,
   }));

export const closeDialogStack = () =>
   dialogStackStore.setState((state) => ({
      ...state,
      children: null,
      isOpen: false,
   }));

export const useDialogStack = () => ({
   openDialogStack,
   closeDialogStack,
});

export function GlobalDialogStack() {
   const { children, isOpen } = useStore(dialogStackStore, (s) => s);

   return (
      <DialogStack
         clickable
         onOpenChange={(open) => {
            dialogStackStore.setState((state) => ({ ...state, isOpen: open }));
         }}
         open={isOpen}
      >
         <DialogStackOverlay />
         <DialogStackBody>{children as React.ReactElement}</DialogStackBody>
      </DialogStack>
   );
}
```

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: no new errors

**Step 3: Commit**

```bash
git add apps/web/src/hooks/use-dialog-stack.tsx
git commit -m "feat(ui): add useDialogStack global hook"
```

---

### Task 2: Register `GlobalDialogStack` in root layout

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Add import**

Find the import for `GlobalCredenza` and add `GlobalDialogStack` alongside it:

```tsx
import { GlobalCredenza } from "@/hooks/use-credenza";
import { GlobalDialogStack } from "@/hooks/use-dialog-stack";
```

**Step 2: Add to render**

Find line 86 where `<GlobalCredenza />` is rendered and add `<GlobalDialogStack />` after it:

```tsx
<GlobalCredenza />
<GlobalAlertDialog />
<GlobalDialogStack />
```

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/__root.tsx
git commit -m "feat(ui): register GlobalDialogStack in root layout"
```

---

### Task 3: Create `transaction-dialog-stack.tsx`

This is the main task. Create a new file that replaces `transaction-credenza.tsx`. The entire form content stays the same — only the wrapper components change (`CredenzaHeader/Body/Footer` → `DialogStackHeader/Content/Footer`) and the inline `Combobox.onCreate` callbacks are replaced with secondary-form triggers.

**Files:**
- Create: `apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx`

**Step 1: Define the `SecondaryForm` type and secondary form components at the top of the file**

```tsx
type SecondaryForm =
   | { type: "bankAccount" }
   | { type: "creditCard" }
   | { type: "contact" }
   | { type: "category"; transactionType: "income" | "expense" }
   | { type: "tag" }
   | null;
```

**Step 2: Create the secondary form components**

Each is a small self-contained form component. They accept `onSuccess(id: string)` and `onBack()` props.

```tsx
function NovaConta({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   // useSuspenseQuery for bank accounts not needed here — just a creation form
   // fields: name (text), type (select: checking | savings | investment)
   // mutation: orpc.bankAccounts.create
   // on success: onSuccess(data.id)
}

function NovoCartao({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   // fields: name (text), lastDigits (text, optional, maxLength 4)
   // mutation: orpc.creditCards.create
}

function NovoContato({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   // fields: name (text), role (select: client | supplier)
   // mutation: orpc.contacts.create
}

function NovaCategoria({
   transactionType,
   onSuccess,
   onBack,
}: {
   transactionType: "income" | "expense";
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   // fields: name (text) — type is derived from transactionType prop
   // mutation: orpc.categories.create
}

function NovaTag({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   // fields: name (text), color (optional color picker or text)
   // mutation: orpc.tags.create
}
```

Use `useForm` from `@tanstack/react-form`, `useMutation` from `@tanstack/react-query`, `Field`, `FieldLabel`, `FieldError`, `Input`, `Select` from the existing UI imports. Each secondary form has a header with title + back chevron button using `DialogStackPrevious asChild`, a body with the fields, and a footer with submit button.

**Step 3: Create `TransactionDialogStackContent` component**

Copy the entire `TransactionFormContent` function from `transaction-credenza.tsx` as the starting point, then:

1. Add `const [secondaryForm, setSecondaryForm] = useState<SecondaryForm>(null)` at the top
2. Replace `<CredenzaHeader>` with `<DialogStackHeader>`
3. Replace `<CredenzaBody>` with a scrollable `<div className="flex-1 overflow-y-auto px-4 py-4">`
4. Replace `<CredenzaFooter>` with `<div className="border-t px-4 py-4">`
5. Replace `<CredenzaTitle>` with `<DialogStackTitle>`
6. Replace `<CredenzaDescription>` with `<DialogStackDescription>`
7. For each `Combobox` with an `onCreate` prop, replace `onCreate` with a `DialogStackNext asChild` button that sets `secondaryForm` before advancing:

```tsx
// Replace onCreate on bank account Combobox:
// Remove: onCreate={(name) => createBankAccountMutation.mutate({ name, type: "checking" })}
// Add a "+" button next to the Combobox label:
<div className="flex items-center justify-between">
   <FieldLabel>Conta <span className="text-destructive">*</span></FieldLabel>
   <DialogStackNext asChild>
      <button
         className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
         onClick={() => setSecondaryForm({ type: "bankAccount" })}
         type="button"
      >
         <Plus className="size-3" /> Nova conta
      </button>
   </DialogStackNext>
</div>
```

Do the same pattern for: credit card (`{ type: "creditCard" }`), contact (`{ type: "contact" }`), category (`{ type: "category", transactionType: type }`), tag (`{ type: "tag" }`).

Keep the Combobox `onCreate` removed — creation only happens via the stacked form now.

8. Wrap the entire return in `<>...</>` with TWO `DialogStackContent` children at the TOP LEVEL (not nested):

```tsx
return (
   <>
      <DialogStackContent index={0}>
         {/* DialogStackHeader, form, footer all here */}
      </DialogStackContent>

      <DialogStackContent index={1}>
         <div className="flex flex-col h-full">
            {secondaryForm?.type === "bankAccount" && (
               <NovaConta
                  onBack={() => setSecondaryForm(null)}
                  onSuccess={(id) => {
                     form.setFieldValue("bankAccountId", id);
                     setSecondaryForm(null);
                  }}
               />
            )}
            {secondaryForm?.type === "creditCard" && (
               <NovoCartao
                  onBack={() => setSecondaryForm(null)}
                  onSuccess={(id) => {
                     form.setFieldValue("creditCardId", id);
                     setSecondaryForm(null);
                  }}
               />
            )}
            {secondaryForm?.type === "contact" && (
               <NovoContato
                  onBack={() => setSecondaryForm(null)}
                  onSuccess={(id) => {
                     form.setFieldValue("contactId", id);
                     setSecondaryForm(null);
                  }}
               />
            )}
            {secondaryForm?.type === "category" && (
               <NovaCategoria
                  onBack={() => setSecondaryForm(null)}
                  onSuccess={(id) => {
                     form.setFieldValue("categoryId", id);
                     setSecondaryForm(null);
                  }}
                  transactionType={secondaryForm.transactionType}
               />
            )}
            {secondaryForm?.type === "tag" && (
               <NovaTag
                  onBack={() => setSecondaryForm(null)}
                  onSuccess={(id) => {
                     form.setFieldValue("tagIds", [
                        ...form.getFieldValue("tagIds"),
                        id,
                     ]);
                     setSecondaryForm(null);
                  }}
               />
            )}
         </div>
      </DialogStackContent>
   </>
);
```

9. Export:

```tsx
export function TransactionDialogStack({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   return (
      <Suspense fallback={<div className="p-6"><Spinner className="size-6" /></div>}>
         <TransactionDialogStackContent
            mode={mode}
            onSuccess={onSuccess}
            transaction={transaction}
         />
      </Suspense>
   );
}
```

**Step 4: Verify TypeScript compiles**

```bash
bun run typecheck
```

Fix any type errors.

**Step 5: Commit**

```bash
git add apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx
git commit -m "feat(transactions): add TransactionDialogStack replacing TransactionCredenza"
```

---

### Task 4: Update call sites

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`
- Modify: `apps/web/src/features/transactions/ui/transactions-list.tsx`

**Step 1: Update `transactions.tsx`**

Replace `useCredenza` import with `useDialogStack`:

```tsx
// Remove:
import { useCredenza } from "@/hooks/use-credenza";
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";

// Add:
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
```

Replace usage in `handleCreate`:

```tsx
// Before:
const { openCredenza, closeCredenza } = useCredenza();
// ...
openCredenza({
   children: (
      <TransactionCredenza mode="create" onSuccess={closeCredenza} />
   ),
});

// After:
const { openDialogStack, closeDialogStack } = useDialogStack();
// ...
openDialogStack({
   children: (
      <TransactionDialogStack mode="create" onSuccess={closeDialogStack} />
   ),
});
```

Keep the remaining `openCredenza` calls for `TransactionPrerequisitesBlocker`, `TransactionImportCredenza`, and `TransactionExportCredenza` — those stay as credenza.

So `transactions.tsx` will import BOTH `useCredenza` (for import/export/blocker) and `useDialogStack` (for create).

**Step 2: Update `transactions-list.tsx`**

Replace the `handleEdit` callback:

```tsx
// Remove:
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
// (keep useCredenza for other handlers)

// Add:
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";

// In component:
const { openDialogStack, closeDialogStack } = useDialogStack();

// Replace handleEdit:
const handleEdit = useCallback(
   (transaction: TransactionRow) => {
      openDialogStack({
         children: (
            <TransactionDialogStack
               mode="edit"
               onSuccess={closeDialogStack}
               transaction={transaction}
            />
         ),
      });
   },
   [openDialogStack, closeDialogStack],
);
```

Keep all other `openCredenza` calls in `transactions-list.tsx` unchanged (bulk actions, recurring, etc.).

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx
git add apps/web/src/features/transactions/ui/transactions-list.tsx
git commit -m "feat(transactions): wire TransactionDialogStack to create/edit call sites"
```

---

### Task 5: Manual smoke test

**Step 1:** Run dev server

```bash
bun dev
```

**Step 2:** Verify create flow
- Click "Novo Lançamento" button → DialogStack opens with main form at index 0
- Click "+ Nova conta" → secondary form slides in at index 1
- Fill name + type → submit → back to index 0 with new account selected
- Repeat for contact, category, tag, credit card

**Step 3:** Verify edit flow
- Click edit on a transaction row → DialogStack opens with pre-filled form
- Submit → dialog closes, list refreshes

**Step 4:** Verify existing credenza flows still work
- Import, Export, TransactionPrerequisitesBlocker, bulk actions — all still use Credenza as before

**Step 5:** Final commit if any minor fixes were needed

```bash
git add -p
git commit -m "fix(transactions): dialog-stack smoke test fixes"
```
