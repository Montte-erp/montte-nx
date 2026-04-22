# Contacts Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing assinaturas tab into the contact detail page, add archive/reactivate actions, and allow creating transactions directly from a contact.

**Architecture:** All backend repo functions already exist (`archiveContact`, `reactivateContact`). The `ContactAssinaturasTab` component is fully built. Work is mostly wiring existing pieces together — two new router procedures and three UI changes.

**Tech Stack:** TanStack Router, TanStack Query, oRPC, React, Tailwind, `@packages/ui/components/tabs`

---

### Task 1: Add archive/reactivate router procedures

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/contacts.ts`

Repo functions `archiveContact` and `reactivateContact` exist in `@core/database/repositories/contacts-repository` but have no router procedures. Add them.

**Step 1: Add imports**

In `contacts.ts`, add to the existing import from `contacts-repository`:
```ts
import {
   archiveContact,
   bulkDeleteContacts,
   createContact,
   deleteContact,
   ensureContactOwnership,
   getContactTransactionStats,
   getContactTransactions,
   listContacts,
   reactivateContact,
   updateContact,
} from "@core/database/repositories/contacts-repository";
```

**Step 2: Add archive procedure**

```ts
export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (await archiveContact(context.db, input.id)).match(
         (contact) => contact,
         (e) => { throw WebAppError.fromAppError(e); },
      );
   });
```

**Step 3: Add reactivate procedure**

```ts
export const reactivate = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (await reactivateContact(context.db, input.id)).match(
         (contact) => contact,
         (e) => { throw WebAppError.fromAppError(e); },
      );
   });
```

**Step 4: Verify the router barrel**

Check `apps/web/src/integrations/orpc/router/services.ts` (or wherever contacts procedures are registered) to confirm `archive` and `reactivate` will be auto-picked up. If procedures are manually registered, add them there.

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/router/contacts.ts
git commit -m "feat(contacts): add archive and reactivate router procedures"
```

---

### Task 2: Wire tabs in contact detail page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId.tsx`

**Step 1: Add imports**

```ts
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@packages/ui/components/tabs";
import { ContactAssinaturasTab } from "../-contacts/contact-assinaturas-tab";
```

**Step 2: Replace the main content area**

In `ContactDetailContent`, replace:
```tsx
<QueryBoundary fallback={null}>
   <ContactTransacoesTab contactId={contactId} contact={contact} />
</QueryBoundary>
```

With:
```tsx
<Tabs defaultValue="transacoes">
   <TabsList>
      <TabsTrigger value="transacoes">Transações</TabsTrigger>
      <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
   </TabsList>
   <TabsContent value="transacoes">
      <QueryBoundary fallback={null}>
         <ContactTransacoesTab contactId={contactId} contact={contact} />
      </QueryBoundary>
   </TabsContent>
   <TabsContent value="assinaturas">
      <QueryBoundary fallback={null}>
         <ContactAssinaturasTab contactId={contactId} />
      </QueryBoundary>
   </TabsContent>
</Tabs>
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/\$contactId.tsx
git commit -m "feat(contacts): add Transações/Assinaturas tabs to detail page"
```

---

### Task 3: Add archive/reactivate button to detail toolbar

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx`

The `contact` prop is already passed in. `contact.isArchived` tells the current state.

**Step 1: Add imports**

```ts
import { Archive, ArchiveRestore } from "lucide-react";
```

**Step 2: Add mutations**

After the existing `deleteMutation`, add:
```ts
const archiveMutation = useMutation(
   orpc.contacts.archive.mutationOptions({
      onSuccess: () => {
         toast.success("Contato arquivado.");
         globalNavigate({
            to: "/$slug/$teamSlug/contacts",
            params: { slug, teamSlug },
         });
      },
      onError: (e) => toast.error(e.message),
   }),
);

const reactivateMutation = useMutation(
   orpc.contacts.reactivate.mutationOptions({
      onSuccess: () => toast.success("Contato reativado."),
      onError: (e) => toast.error(e.message),
   }),
);
```

**Step 3: Add handler**

```ts
function handleArchive() {
   openAlertDialog({
      title: "Arquivar contato",
      description: `Arquivar "${contact.name}"? O contato ficará oculto mas seus lançamentos serão mantidos.`,
      actionLabel: "Arquivar",
      cancelLabel: "Cancelar",
      variant: "destructive",
      onAction: async () => {
         await archiveMutation.mutateAsync({ id: contact.id });
      },
   });
}

function handleReactivate() {
   reactivateMutation.mutate({ id: contact.id });
}
```

**Step 4: Add button to toolbar**

In `DataTableToolbar`, add before the delete button:
```tsx
{contact.isArchived ? (
   <Button
      onClick={handleReactivate}
      disabled={reactivateMutation.isPending}
      tooltip="Reativar contato"
      variant="outline"
      size="icon-sm"
   >
      <ArchiveRestore />
      <span className="sr-only">Reativar contato</span>
   </Button>
) : (
   <Button
      onClick={handleArchive}
      disabled={archiveMutation.isPending}
      tooltip="Arquivar contato"
      variant="outline"
      size="icon-sm"
   >
      <Archive />
      <span className="sr-only">Arquivar contato</span>
   </Button>
)}
```

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx
git commit -m "feat(contacts): add archive/reactivate action to detail page"
```

---

### Task 4: Add "Lançar transação" inline draft row to contact detail

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx`

The transactions table already uses `buildTransactionColumns`. We just need to add draft row support and inject the `contactId` automatically so the user doesn't have to pick the contact.

**Step 1: Add imports**

```ts
import { Plus } from "lucide-react"; // already imported as ArrowRight, Receipt, RefreshCcw, Trash2 — add Plus
import dayjs from "dayjs";
```

**Step 2: Add state + create mutation**

```ts
const [isDraftActive, setIsDraftActive] = useState(false);

const createMutation = useMutation(
   orpc.transactions.create.mutationOptions({
      onSuccess: () => {
         toast.success("Lançamento criado.");
         setIsDraftActive(false);
      },
      onError: (e) => toast.error(e.message),
   }),
);
```

**Step 3: Add handler**

```ts
const handleAddTransaction = useCallback(
   async (data: Record<string, string | string[]>) => {
      const type = String(data.type || "income") as "income" | "expense" | "transfer";
      const name = String(data.name ?? "").trim() || null;
      const amount = String(data.amount || "");
      const date = String(data.date || "").trim() || dayjs().format("YYYY-MM-DD");
      const bankAccountId = String(data.bankAccountName || "") || null;
      const categoryId = String(data.categoryName || "") || null;
      const creditCardId = String(data.creditCardName || "") || null;
      const dueDate = String(data.dueDate || "").trim() || null;
      const txStatus = String(data.status || "pending") as "pending" | "paid" | "cancelled";

      await createMutation.mutateAsync({
         name,
         type,
         amount,
         date,
         bankAccountId,
         contactId,          // always inject the current contact
         categoryId,
         creditCardId: creditCardId || null,
         dueDate,
         status: txStatus,
      });
   },
   [createMutation, contactId],
);
```

**Step 4: Add "+ Lançamento" button to toolbar**

In `DataTableToolbar`, add before the subscription button:
```tsx
<Button
   onClick={() => setIsDraftActive(true)}
   tooltip="Novo lançamento"
   variant="outline"
   size="icon-sm"
>
   <Plus />
   <span className="sr-only">Novo lançamento</span>
</Button>
```

**Step 5: Wire draft row on DataTableRoot**

```tsx
<DataTableRoot
   storageKey="montte:datatable:contact-transactions"
   columns={columns}
   data={result.data}
   getRowId={(row) => row.id}
   isDraftRowActive={isDraftActive}
   onAddRow={handleAddTransaction}
   onDiscardAddRow={() => setIsDraftActive(false)}
>
```

**Step 6: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx
git commit -m "feat(contacts): add inline transaction creation from contact detail"
```

---

## Execution Order

1 → 2 → 3 → 4. Task 1 must come first (router must exist before UI references it in Task 3).
