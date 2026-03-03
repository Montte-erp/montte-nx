# Sheets → Credenzas Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all `useSheet`/`GlobalSheet` usage and replace every sheet with a credenza.

**Architecture:** Every call to `openSheet()` becomes `openCredenza()`. Sheet subcomponents (`SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`) inside form components are replaced with their Credenza equivalents (`CredenzaHeader`, `CredenzaTitle`, `CredenzaDescription`, `CredenzaFooter`, `CredenzaBody`). After all callers are migrated, `GlobalSheet` is removed from the root and `use-sheet.tsx` is deleted.

**Tech Stack:** React, TanStack Store, `@packages/ui/components/credenza` (`CredenzaHeader`, `CredenzaTitle`, `CredenzaDescription`, `CredenzaBody`, `CredenzaFooter`), `@/hooks/use-credenza`

---

## Reference: Credenza subcomponent imports

```typescript
import {
  CredenzaBody,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useCredenza } from "@/hooks/use-credenza";
// or import { closeCredenza } from "@/hooks/use-credenza";
```

---

## Task 1: Migrate `create-team-form.tsx`

**Files:**
- Modify: `apps/web/src/features/organization/ui/create-team-form.tsx`

**Step 1: Replace Sheet imports and subcomponents**

Remove:
```typescript
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
import { useSheet } from "@/hooks/use-sheet";
```

Add:
```typescript
import {
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useCredenza } from "@/hooks/use-credenza";
```

**Step 2: Replace hook usage**

In `CreateTeamFormContent`:
- `const { closeSheet } = useSheet();` → `const { closeCredenza: closeSheet } = useCredenza();`

(Alias to `closeSheet` to minimize diff across the component body, or rename all occurrences)

**Step 3: Replace subcomponents in JSX**

In `CreateTeamFormContent`:
- `<SheetFooter>` → `<CredenzaFooter>` (and closing tag)

In `CreateTeamForm`:
- `<SheetHeader>` → `<CredenzaHeader>` (and closing tag)
- `<SheetTitle ...>` → `<CredenzaTitle ...>`
- `<SheetDescription>` → `<CredenzaDescription>`

**Step 4: Verify no Sheet imports remain**

Run: `grep -n "Sheet" apps/web/src/features/organization/ui/create-team-form.tsx`
Expected: no output

---

## Task 2: Migrate `manage-organization-form.tsx`

**Files:**
- Modify: `apps/web/src/features/organization/ui/manage-organization-form.tsx`

**Step 1: Replace imports**

Remove:
```typescript
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
import { useSheet } from "@/hooks/use-sheet";
```

Add:
```typescript
import {
  CredenzaBody,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useCredenza } from "@/hooks/use-credenza";
```

**Step 2: Replace hook and subcomponents**

- `const { closeSheet } = useSheet();` → `const { closeCredenza: closeSheet } = useCredenza();`
- `<SheetHeader>` → `<CredenzaHeader>` (and closing tag)
- `<SheetTitle>` → `<CredenzaTitle>`
- `<SheetDescription>` → `<CredenzaDescription>`
- `<SheetFooter>` → `<CredenzaFooter>` (and closing tag)
- Wrap the `<div className="grid gap-4 px-4">` in `<CredenzaBody>` (remove the `px-4` since `CredenzaBody` adds its own padding)

**Step 3: Verify**

Run: `grep -n "Sheet" apps/web/src/features/organization/ui/manage-organization-form.tsx`
Expected: no output

---

## Task 3: Migrate `session-details-form.tsx`

**Files:**
- Modify: `apps/web/src/features/settings/ui/session-details-form.tsx`

**Step 1: Replace imports**

Remove:
```typescript
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
import { useSheet } from "@/hooks/use-sheet";
```

Add:
```typescript
import {
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useCredenza } from "@/hooks/use-credenza";
```

**Step 2: Replace hook and subcomponents**

- `const { closeSheet } = useSheet();` → `const { closeCredenza: closeSheet } = useCredenza();`
- Both `<SheetHeader>` → `<CredenzaHeader>` (there are two in this component)
- Both `<SheetTitle>` → `<CredenzaTitle>`
- Both `<SheetDescription>` → `<CredenzaDescription>`

**Step 3: Verify**

Run: `grep -n "Sheet" apps/web/src/features/settings/ui/session-details-form.tsx`
Expected: no output

---

## Task 4: Migrate `webhook-form.tsx`

**Files:**
- Modify: `apps/web/src/features/webhooks/ui/webhook-form.tsx`

**Step 1: Replace imports**

Remove:
```typescript
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
```

Add:
```typescript
import {
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
```

**Step 2: Replace subcomponents in JSX**

- `<SheetHeader>` → `<CredenzaHeader>` (and closing tag)
- `<SheetTitle>` → `<CredenzaTitle>`
- `<SheetDescription>` → `<CredenzaDescription>`

(No `useSheet` in this file — it uses `onSuccess` prop)

**Step 3: Verify**

Run: `grep -n "Sheet" apps/web/src/features/webhooks/ui/webhook-form.tsx`
Expected: no output

---

## Task 5: Migrate `create-key-form.tsx`

**Files:**
- Modify: `apps/web/src/features/personal-api-keys/ui/create-key-form.tsx`

**Step 1: Replace imports**

Remove:
```typescript
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
```

Add:
```typescript
import {
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
```

**Step 2: Replace subcomponents in JSX**

- `<SheetHeader>` → `<CredenzaHeader>` (and closing tag)
- `<SheetTitle>` → `<CredenzaTitle>`
- `<SheetDescription>` → `<CredenzaDescription>`

**Step 3: Verify**

Run: `grep -n "Sheet" apps/web/src/features/personal-api-keys/ui/create-key-form.tsx`
Expected: no output

---

## Task 6: Migrate `members.tsx` (InviteMemberSheetContent + caller)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx`

**Step 1: Replace imports**

Remove:
```typescript
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@packages/ui/components/sheet";
import { useSheet } from "@/hooks/use-sheet";
```

Add:
```typescript
import {
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useCredenza } from "@/hooks/use-credenza";
```

**Step 2: Update `InviteMemberSheetContent` subcomponents**

- `<SheetHeader>` → `<CredenzaHeader>` (and closing tag)
- `<SheetTitle>` → `<CredenzaTitle>`
- `<SheetDescription>` → `<CredenzaDescription>`

**Step 3: Update `MembersContent` caller**

In `MembersContent`:

Before:
```typescript
const { openSheet, closeSheet } = useSheet();
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
```

In `handleOpenInviteSheet`:
```typescript
function handleOpenInviteSheet() {
  openCredenza({
    children: (
      <InviteMemberSheetContent
        onSuccess={closeCredenza}
        organizationId={organizationId}
      />
    ),
  });
}
```

**Step 4: Verify**

Run: `grep -n "Sheet\|useSheet" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/organization/members.tsx`
Expected: no output

---

## Task 7: Migrate `inventory/index.tsx`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`

**Step 1: Update imports in `InventoryList`**

In `InventoryList` component, remove `useSheet` usage. The component already uses `useCredenza` — just consolidate:

Before:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
const { openSheet, closeSheet } = useSheet();
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
```

Remove: `import { useSheet } from "@/hooks/use-sheet";`

**Step 2: Update `handleHistory`**

Before:
```typescript
const handleHistory = useCallback(
  (product: InventoryProductRow) => {
    openSheet({
      children: <InventoryHistorySheet product={product} />,
    });
  },
  [openSheet],
);
```
After:
```typescript
const handleHistory = useCallback(
  (product: InventoryProductRow) => {
    openCredenza({
      children: <InventoryHistorySheet product={product} />,
    });
  },
  [openCredenza],
);
```

**Step 3: Update `handleEdit`**

Before:
```typescript
const handleEdit = useCallback(
  (product: InventoryProductRow) => {
    openSheet({
      children: (
        <InventoryProductForm
          mode="edit"
          defaultValues={{...}}
          onSuccess={closeSheet}
        />
      ),
    });
  },
  [openSheet, closeSheet],
);
```
After:
```typescript
const handleEdit = useCallback(
  (product: InventoryProductRow) => {
    openCredenza({
      children: (
        <InventoryProductForm
          mode="edit"
          defaultValues={{...}}
          onSuccess={closeCredenza}
        />
      ),
    });
  },
  [openCredenza, closeCredenza],
);
```

**Step 4: Update `InventoryPage` (handleCreate)**

In `InventoryPage`:

Before:
```typescript
const { openSheet, closeSheet } = useSheet();
// ...
const handleCreate = useCallback(() => {
  openSheet({
    children: <InventoryProductForm mode="create" onSuccess={closeSheet} />,
  });
}, [openSheet, closeSheet]);
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
// ...
const handleCreate = useCallback(() => {
  openCredenza({
    children: <InventoryProductForm mode="create" onSuccess={closeCredenza} />,
  });
}, [openCredenza, closeCredenza]);
```

**Step 5: Verify**

Run: `grep -n "Sheet\|useSheet" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/index.tsx`
Expected: only `InventoryHistorySheet` import (the component name, not the hook)

---

## Task 8: Add CredenzaHeader to `inventory-history-sheet.tsx`

**Files:**
- Modify: `apps/web/src/features/inventory/ui/inventory-history-sheet.tsx`

The component renders content without a header. Add a `CredenzaHeader` with the product name as title so it looks correct in a credenza.

**Step 1: Add import**

Add:
```typescript
import {
  CredenzaHeader,
  CredenzaTitle,
} from "@packages/ui/components/credenza";
```

**Step 2: Add header**

Before:
```tsx
export function InventoryHistorySheet({ product }: InventoryHistorySheetProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Histórico de movimentos de <strong>{product.name}</strong>.
      </p>
```

After:
```tsx
export function InventoryHistorySheet({ product }: InventoryHistorySheetProps) {
  return (
    <div className="space-y-4">
      <CredenzaHeader>
        <CredenzaTitle>Histórico de {product.name}</CredenzaTitle>
      </CredenzaHeader>
```

(Remove the old `<p>` description since the title now conveys the context)

---

## Task 9: Migrate `personal-api-keys.tsx`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/personal-api-keys.tsx`

**Step 1: Remove `useSheet` import**

Remove: `import { useSheet } from "@/hooks/use-sheet";`

**Step 2: Update `PersonalApiKeysContent`**

Before:
```typescript
const { openSheet, closeSheet } = useSheet();
const { openCredenza, closeCredenza } = useCredenza();
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
```

**Step 3: Update `handleCreateKey`**

Before:
```typescript
function handleCreateKey() {
  openSheet({
    children: (
      <Suspense fallback={...}>
        <CreateKeyForm
          onSuccess={(result) => {
            closeSheet();
            openCredenza({
              children: (
                <KeyRevealDialog
                  label={result.label}
                  onClose={closeCredenza}
                  plaintextKey={result.plaintextKey}
                />
              ),
            });
          }}
        />
      </Suspense>
    ),
  });
}
```
After:
```typescript
function handleCreateKey() {
  openCredenza({
    children: (
      <Suspense fallback={...}>
        <CreateKeyForm
          onSuccess={(result) => {
            closeCredenza();
            openCredenza({
              children: (
                <KeyRevealDialog
                  label={result.label}
                  onClose={closeCredenza}
                  plaintextKey={result.plaintextKey}
                />
              ),
            });
          }}
        />
      </Suspense>
    ),
  });
}
```

**Step 4: Verify**

Run: `grep -n "Sheet\|useSheet" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/personal-api-keys.tsx`
Expected: no output

---

## Task 10: Migrate `security.tsx`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/security.tsx`

**Step 1: Replace import**

Remove: `import { useSheet } from "@/hooks/use-sheet";`
Add: `import { useCredenza } from "@/hooks/use-credenza";`

**Step 2: Update `SecuritySectionContent`**

Before:
```typescript
const { openSheet } = useSheet();
// ...
<SessionsSection
  openSheet={openSheet}
  ...
/>
```
After:
```typescript
const { openCredenza } = useCredenza();
// ...
<SessionsSection
  openCredenza={openCredenza}
  ...
/>
```

**Step 3: Update `SessionsSection` prop type and usage**

Before:
```typescript
function SessionsSection({
  sessions,
  currentSessionId,
  currentSessionLoginMethod,
  openSheet,
}: {
  ...
  openSheet: (options: { children: React.ReactNode }) => void;
}) {
```
After:
```typescript
function SessionsSection({
  sessions,
  currentSessionId,
  currentSessionLoginMethod,
  openCredenza,
}: {
  ...
  openCredenza: (options: { children: React.ReactNode }) => void;
}) {
```

Inside the component, replace all `openSheet({` → `openCredenza({`

**Step 4: Verify**

Run: `grep -n "Sheet\|useSheet" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/security.tsx`
Expected: no output

---

## Task 11: Migrate `webhooks.tsx`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/webhooks.tsx`

**Step 1: Remove `useSheet` import**

Remove: `import { useSheet } from "@/hooks/use-sheet";`

**Step 2: Update `WebhooksContent`**

Before:
```typescript
const { openSheet, closeSheet } = useSheet();
const { openCredenza, closeCredenza } = useCredenza();
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
```

**Step 3: Update `handleCreateWebhook`**

```typescript
function handleCreateWebhook() {
  openCredenza({
    children: (
      <WebhookForm
        eventCatalog={eventCatalog}
        mode="create"
        onSuccess={(result) => {
          closeCredenza();
          if (result?.plaintextSecret && result.url) {
            openCredenza({
              children: (
                <WebhookSecretDialog
                  onClose={closeCredenza}
                  plaintextSecret={result.plaintextSecret}
                  url={result.url}
                />
              ),
            });
          }
        }}
      />
    ),
  });
}
```

**Step 4: Update `handleEditWebhook`**

```typescript
function handleEditWebhook(webhook: WebhookEndpoint) {
  openCredenza({
    children: (
      <WebhookForm
        eventCatalog={eventCatalog}
        mode="edit"
        onSuccess={() => closeCredenza()}
        webhook={webhook}
      />
    ),
  });
}
```

**Step 5: Verify**

Run: `grep -n "Sheet\|useSheet" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/project/webhooks.tsx`
Expected: no output

---

## Task 12: Migrate `sidebar-scope-switcher.tsx`

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx`

**Step 1: Remove `useSheet` import**

Remove: `import { useSheet } from "@/hooks/use-sheet";`

**Step 2: Update `SidebarScopeSwitcherContent`**

Before:
```typescript
const { openSheet } = useSheet();
const { openCredenza, closeCredenza } = useCredenza();
```
After:
```typescript
const { openCredenza, closeCredenza } = useCredenza();
```

**Step 3: Update `handleNewProject`**

Replace `openSheet({ children: <CreateTeamForm /> });` with:
```typescript
openCredenza({ children: <CreateTeamForm /> });
```

Update the `useCallback` deps array: remove `openSheet`, keep `openCredenza`.

**Step 4: Update `handleNewOrganization`**

Replace `openSheet({ children: <ManageOrganizationForm /> });` with:
```typescript
openCredenza({ children: <ManageOrganizationForm /> });
```

Update deps: remove `openSheet`.

**Step 5: Verify**

Run: `grep -n "useSheet\|openSheet" apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx`
Expected: no output

---

## Task 13: Remove `GlobalSheet` from root layout

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Remove import and usage**

Remove: `import { GlobalSheet } from "@/hooks/use-sheet";`

Remove: `<GlobalSheet />` from the JSX (it was at line ~87)

**Step 2: Verify**

Run: `grep -n "GlobalSheet\|useSheet" apps/web/src/routes/__root.tsx`
Expected: no output

---

## Task 14: Delete `use-sheet.tsx`

**Files:**
- Delete: `apps/web/src/hooks/use-sheet.tsx`

**Step 1: Confirm no remaining usages**

Run: `grep -rn "useSheet\|GlobalSheet\|use-sheet" apps/web/src/ --include="*.tsx" --include="*.ts"`
Expected: only the test file mock (if any) and the hook file itself

**Step 2: Delete the file**

```bash
rm apps/web/src/hooks/use-sheet.tsx
```

**Step 3: Update test mock if needed**

If `apps/web/__tests__/layout/dashboard/sidebar-scope-switcher.test.tsx` mocks `useSheet`, update it to mock `useCredenza` instead:

Before:
```typescript
vi.mock("@/hooks/use-sheet", () => ({
  useSheet: () => ({ openSheet: vi.fn(), closeSheet: vi.fn() }),
}));
```
After:
```typescript
vi.mock("@/hooks/use-credenza", () => ({
  useCredenza: () => ({ openCredenza: vi.fn(), closeCredenza: vi.fn() }),
}));
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```
Expected: 0 errors

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): migrate all sheets to credenzas, remove useSheet hook"
```
