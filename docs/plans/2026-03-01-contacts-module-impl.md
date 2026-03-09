# Contacts Module (Clientes & Fornecedores) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified Contatos module (clientes/fornecedores) with CRUD, team-scoping, optional transaction linkage, and alpha early access gating.

**Architecture:** New `contacts` schema + repository → oRPC router → React route following the same pattern as `tags`. Transactions gain an optional `contactId` FK. Sidebar entry gated by `contacts` PostHog early access flag.

**Tech Stack:** Drizzle ORM, oRPC + TanStack Query, TanStack Form, Radix UI, Sonner toasts, PostHog early access.

**Parallelism notes:**

- Tasks 1→2→3 are sequential (schema → repo → router)
- Tasks 4, 6, 7 can run in parallel after Task 3
- Task 5 runs after Task 4
- Task 8 (PostHog) is fully independent — run any time

---

## Task 1: Database Schema

**Files:**

- Create: `packages/database/src/schemas/contacts.ts`
- Modify: `packages/database/src/schemas/transactions.ts`
- Modify: `packages/database/src/schema.ts`

**Step 1: Create contacts schema**

```typescript
// packages/database/src/schemas/contacts.ts
import { relations, sql } from "drizzle-orm";
import {
   index,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { transactions } from "./transactions";

export const contactTypeEnum = pgEnum("contact_type", [
   "cliente",
   "fornecedor",
   "ambos",
]);

export const contactDocumentTypeEnum = pgEnum("contact_document_type", [
   "cpf",
   "cnpj",
]);

export const contacts = pgTable(
   "contacts",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: contactTypeEnum("type").notNull(),
      email: text("email"),
      phone: text("phone"),
      document: text("document"),
      documentType: contactDocumentTypeEnum("document_type"),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contacts_team_id_idx").on(table.teamId),
      uniqueIndex("contacts_team_id_name_unique").on(table.teamId, table.name),
   ],
);

export const contactsRelations = relations(contacts, ({ many }) => ({
   transactions: many(transactions),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactType = (typeof contactTypeEnum.enumValues)[number];
export type ContactDocumentType =
   (typeof contactDocumentTypeEnum.enumValues)[number];
```

**Step 2: Add `contactId` FK to transactions schema**

In `packages/database/src/schemas/transactions.ts`:

1. Add import at the top (after existing imports):

```typescript
import { contacts } from "./contacts";
```

2. Add `contactId` field inside the `transactions` pgTable columns object (after `attachmentUrl`):

```typescript
contactId: uuid("contact_id").references(() => contacts.id, {
   onDelete: "set null",
}),
```

3. Add contact relation inside `transactionsRelations` (after `transactionTags: many(transactionTags)`):

```typescript
contact: one(contacts, {
   fields: [transactions.contactId],
   references: [contacts.id],
}),
```

4. Import `one` from `drizzle-orm` is already present — verify it's in the destructured import.

**Step 3: Export from schema.ts**

Add to `packages/database/src/schema.ts` under the `// Finance` comment block:

```typescript
export * from "./schemas/contacts";
```

**Step 4: Notify user to run db:push**

⚠️ Stop here and ask the user to run: `bun run db:push`

---

## Task 2: Database Repository

**Files:**

- Create: `packages/database/src/repositories/contacts-repository.ts`

**Step 1: Write the repository**

```typescript
// packages/database/src/repositories/contacts-repository.ts
import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type ContactType, type NewContact, contacts } from "../schema";
import { transactions } from "../schema";

export async function createContact(db: DatabaseInstance, data: NewContact) {
   try {
      const [contact] = await db.insert(contacts).values(data).returning();
      return contact;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create contact");
   }
}

export async function listContacts(
   db: DatabaseInstance,
   teamId: string,
   type?: ContactType,
) {
   try {
      const conditions = [eq(contacts.teamId, teamId)];
      if (type) conditions.push(eq(contacts.type, type));
      return await db
         .select()
         .from(contacts)
         .where(and(...conditions))
         .orderBy(contacts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list contacts");
   }
}

export async function getContact(db: DatabaseInstance, id: string) {
   try {
      const [contact] = await db
         .select()
         .from(contacts)
         .where(eq(contacts.id, id));
      return contact ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get contact");
   }
}

export async function updateContact(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewContact>,
) {
   try {
      const [updated] = await db
         .update(contacts)
         .set(data)
         .where(eq(contacts.id, id))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update contact");
   }
}

export async function deleteContact(db: DatabaseInstance, id: string) {
   try {
      await db.delete(contacts).where(eq(contacts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete contact");
   }
}

export async function contactHasTransactions(
   db: DatabaseInstance,
   id: string,
): Promise<boolean> {
   try {
      const [result] = await db
         .select({ total: count() })
         .from(transactions)
         .where(eq(transactions.contactId, id));
      return (result?.total ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check contact transactions");
   }
}
```

**Step 2: Commit**

```bash
git add packages/database/src/schemas/contacts.ts packages/database/src/schemas/transactions.ts packages/database/src/schema.ts packages/database/src/repositories/contacts-repository.ts
git commit -m "feat(contacts): add contacts schema and repository"
```

---

## Task 3: oRPC Router

**Files:**

- Create: `apps/web/src/integrations/orpc/router/contacts.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Create contacts router**

```typescript
// apps/web/src/integrations/orpc/router/contacts.ts
import { ORPCError } from "@orpc/server";
import {
   contactHasTransactions,
   createContact,
   deleteContact,
   getContact,
   listContacts,
   updateContact,
} from "@packages/database/repositories/contacts-repository";
import { contacts } from "@packages/database/schemas/contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const contactSchema = createInsertSchema(contacts).pick({
   name: true,
   type: true,
   email: true,
   phone: true,
   document: true,
   documentType: true,
   notes: true,
});

// =============================================================================
// Contact Procedures
// =============================================================================

export const create = protectedProcedure
   .input(contactSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createContact(db, { ...input, teamId });
   });

export const getAll = protectedProcedure
   .input(
      z
         .object({
            type: z.enum(["cliente", "fornecedor", "ambos"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listContacts(db, teamId, input?.type);
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(contactSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const contact = await getContact(db, input.id);
      if (!contact || contact.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }
      const { id, ...data } = input;
      return updateContact(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const contact = await getContact(db, input.id);
      if (!contact || contact.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }
      const hasTransactions = await contactHasTransactions(db, input.id);
      if (hasTransactions) {
         throw new ORPCError("CONFLICT", {
            message:
               "Não é possível excluir um contato com transações vinculadas.",
         });
      }
      await deleteContact(db, input.id);
      return { success: true };
   });
```

**Step 2: Register in router index**

In `apps/web/src/integrations/orpc/router/index.ts`:

Add import (alphabetically after `categoriesRouter`):

```typescript
import * as contactsRouter from "./contacts";
```

Add to the export object (alphabetically after `categories`):

```typescript
contacts: contactsRouter,
```

**Step 3: Add `contactId` to transactions router**

In `apps/web/src/integrations/orpc/router/transactions.ts`:

1. Add `contactId` to the `transactionSchema` `.pick()` call:

```typescript
const transactionSchema = createInsertSchema(transactions).pick({
   type: true,
   amount: true,
   description: true,
   date: true,
   bankAccountId: true,
   destinationBankAccountId: true,
   categoryId: true,
   subcategoryId: true,
   attachmentUrl: true,
   contactId: true, // ADD THIS
});
// ...rest unchanged
```

2. Add `contactId` to the `getAll` filter input schema:

```typescript
contactId: z.string().uuid().optional(),
```

3. Pass `contactId` through to `listTransactions` — it's already spread via `...input`, so no other change needed in the handler.

4. In `packages/database/src/repositories/transactions-repository.ts`, add `contactId` support to `ListTransactionsFilter` and `listTransactions`:

Add to `ListTransactionsFilter` interface:

```typescript
contactId?: string;
```

Add condition inside `listTransactions` (after the `categoryId` filter):

```typescript
if (filter.contactId)
   conditions.push(eq(transactions.contactId, filter.contactId));
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/contacts.ts apps/web/src/integrations/orpc/router/index.ts apps/web/src/integrations/orpc/router/transactions.ts packages/database/src/repositories/transactions-repository.ts
git commit -m "feat(contacts): add contacts oRPC router and contactId filter on transactions"
```

---

## Task 4: Contacts Feature UI

**Files:**

- Create: `apps/web/src/features/contacts/ui/contacts-columns.tsx`
- Create: `apps/web/src/features/contacts/ui/contacts-form.tsx`

**Step 1: Create columns**

```typescript
// apps/web/src/features/contacts/ui/contacts-columns.tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type ContactRow = {
   id: string;
   name: string;
   type: "cliente" | "fornecedor" | "ambos";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cpf" | "cnpj" | null;
};

const TYPE_LABELS: Record<ContactRow["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

const TYPE_VARIANTS: Record<
   ContactRow["type"],
   "default" | "secondary" | "outline"
> = {
   cliente: "default",
   fornecedor: "secondary",
   ambos: "outline",
};

export function buildContactColumns(
   onEdit: (contact: ContactRow) => void,
   onDelete: (contact: ContactRow) => void,
): ColumnDef<ContactRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => (
            <Badge variant={TYPE_VARIANTS[row.original.type]}>
               {TYPE_LABELS[row.original.type]}
            </Badge>
         ),
      },
      {
         accessorKey: "document",
         header: "Documento",
         cell: ({ row }) => {
            const { document, documentType } = row.original;
            if (!document) return <span className="text-muted-foreground">—</span>;
            return (
               <span className="text-sm">
                  {documentType?.toUpperCase()} {document}
               </span>
            );
         },
      },
      {
         accessorKey: "email",
         header: "Email",
         cell: ({ row }) =>
            row.original.email ? (
               <span className="text-sm">{row.original.email}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "phone",
         header: "Telefone",
         cell: ({ row }) =>
            row.original.phone ? (
               <span className="text-sm">{row.original.phone}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
            <div
               className="flex items-center justify-end gap-1"
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => e.stopPropagation()}
            >
               <Button
                  onClick={() => onEdit(row.original)}
                  size="icon"
                  variant="ghost"
               >
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar</span>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original)}
                  size="icon"
                  variant="ghost"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      },
   ];
}
```

**Step 2: Create form**

```typescript
// apps/web/src/features/contacts/ui/contacts-form.tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ContactRow } from "./contacts-columns";

interface ContactFormProps {
   mode: "create" | "edit";
   contact?: ContactRow;
   onSuccess: () => void;
}

export function ContactForm({ mode, contact, onSuccess }: ContactFormProps) {
   const isCreate = mode === "create";

   const createMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Contato criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar contato.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onSuccess: () => {
            toast.success("Contato atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar contato.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: contact?.name ?? "",
         type: contact?.type ?? ("cliente" as ContactRow["type"]),
         email: contact?.email ?? "",
         phone: contact?.phone ?? "",
         document: contact?.document ?? "",
         documentType: contact?.documentType ?? ("" as "" | "cpf" | "cnpj"),
         notes: "",
      },
      onSubmit: async ({ value }) => {
         const payload = {
            name: value.name.trim(),
            type: value.type,
            email: value.email?.trim() || null,
            phone: value.phone?.trim() || null,
            document: value.document?.trim() || null,
            documentType: (value.documentType || null) as
               | "cpf"
               | "cnpj"
               | null,
            notes: value.notes?.trim() || null,
         };
         if (isCreate) {
            createMutation.mutate(payload);
         } else if (contact) {
            updateMutation.mutate({ id: contact.id, ...payload });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Contato" : "Editar Contato"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Cadastre um cliente ou fornecedor."
                  : "Atualize as informações do contato."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Name */}
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome *</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Empresa XYZ"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Type */}
               <form.Field name="type">
                  {(field) => (
                     <Field>
                        <FieldLabel>Tipo *</FieldLabel>
                        <Select
                           onValueChange={(v) =>
                              field.handleChange(
                                 v as ContactRow["type"],
                              )
                           }
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="cliente">Cliente</SelectItem>
                              <SelectItem value="fornecedor">
                                 Fornecedor
                              </SelectItem>
                              <SelectItem value="ambos">Ambos</SelectItem>
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               </form.Field>

               {/* Document */}
               <div className="grid grid-cols-3 gap-2">
                  <form.Field name="documentType">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tipo Doc.</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(v as "" | "cpf" | "cnpj")
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="cpf">CPF</SelectItem>
                                 <SelectItem value="cnpj">CNPJ</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="document">
                     {(field) => (
                        <Field className="col-span-2">
                           <FieldLabel>Número</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="000.000.000-00"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </div>

               {/* Email */}
               <form.Field name="email">
                  {(field) => (
                     <Field>
                        <FieldLabel>Email</FieldLabel>
                        <Input
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="contato@empresa.com"
                           type="email"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>

               {/* Phone */}
               <form.Field name="phone">
                  {(field) => (
                     <Field>
                        <FieldLabel>Telefone</FieldLabel>
                        <Input
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="(11) 99999-9999"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>

               {/* Notes */}
               <form.Field name="notes">
                  {(field) => (
                     <Field>
                        <FieldLabel>Observações</FieldLabel>
                        <Textarea
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Informações adicionais..."
                           rows={3}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit || state.isSubmitting || isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     {isCreate ? "Criar contato" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/contacts/
git commit -m "feat(contacts): add contacts-columns and contacts-form UI components"
```

---

## Task 5: Contacts Route Page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/contacts.tsx`

**Step 1: Create the route**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/contacts.tsx
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, LayoutList, Plus, Trash2, Users } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   buildContactColumns,
   type ContactRow,
} from "@/features/contacts/ui/contacts-columns";
import { ContactForm } from "@/features/contacts/ui/contacts-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/contacts",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.contacts.getAll.queryOptions({}),
      );
   },
   component: ContactsPage,
});

const CONTACT_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function ContactsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
               className="h-12 w-full"
               key={`skeleton-${index + 1}`}
            />
         ))}
      </div>
   );
}

// =============================================================================
// Type filter
// =============================================================================

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
   all: "Todos",
   cliente: "Clientes",
   fornecedor: "Fornecedores",
   ambos: "Ambos",
};

// =============================================================================
// List
// =============================================================================

interface ContactsListProps {
   view: "table" | "card";
   typeFilter: TypeFilter;
}

function ContactsList({ view, typeFilter }: ContactsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({
         input:
            typeFilter !== "all"
               ? { type: typeFilter }
               : {},
      }),
   );

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir contato.");
         },
      }),
   );

   const handleEdit = useCallback(
      (contact: ContactRow) => {
         openCredenza({
            children: (
               <ContactForm
                  contact={contact}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (contact: ContactRow) => {
         openAlertDialog({
            title: "Excluir contato",
            description: `Tem certeza que deseja excluir "${contact.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: contact.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "contato" : "contatos"}`,
         description:
            "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await Promise.all(
               selectedIds.map((id) =>
                  deleteMutation.mutateAsync({ id }),
               ),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedCount, selectedIds, deleteMutation, onClear]);

   if (contacts.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Users className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum contato</EmptyTitle>
               <EmptyDescription>
                  Cadastre clientes e fornecedores para organizar suas
                  transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((contact) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-2"
                  key={contact.id}
               >
                  <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0">
                        <p className="font-medium truncate">{contact.name}</p>
                        {contact.email && (
                           <p className="text-sm text-muted-foreground truncate">
                              {contact.email}
                           </p>
                        )}
                        {contact.document && (
                           <p className="text-xs text-muted-foreground">
                              {contact.documentType?.toUpperCase()}{" "}
                              {contact.document}
                           </p>
                        )}
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(contact as ContactRow)}
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(contact as ContactRow)}
                        size="sm"
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
            ))}
         </div>
      );
   }

   const columns = buildContactColumns(
      handleEdit,
      handleDelete,
   );

   return (
      <>
         <DataTable
            columns={columns}
            data={contacts as ContactRow[]}
            enableRowSelection
            getRowId={(row) => row.id}
            onRowSelectionChange={onRowSelectionChange}
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-2">
                  <p className="font-medium">{row.original.name}</p>
                  {row.original.email && (
                     <p className="text-sm text-muted-foreground">
                        {row.original.email}
                     </p>
                  )}
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(row.original)}
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        size="sm"
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
            )}
            rowSelection={rowSelection}
         />
         <SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

// =============================================================================
// Page
// =============================================================================

function ContactsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:contacts:view",
      CONTACT_VIEWS,
   );
   const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

   const handleCreate = useCallback(() => {
      openCredenza({
         children: (
            <ContactForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Novo Contato
               </Button>
            }
            description="Gerencie clientes e fornecedores"
            title="Contatos"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />

         {/* Type filter tabs */}
         <div className="flex gap-2 flex-wrap">
            {(
               Object.keys(TYPE_FILTER_LABELS) as TypeFilter[]
            ).map((key) => (
               <Button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  size="sm"
                  variant={typeFilter === key ? "default" : "outline"}
               >
                  {TYPE_FILTER_LABELS[key]}
               </Button>
            ))}
         </div>

         <Suspense fallback={<ContactsSkeleton />}>
            <ContactsList typeFilter={typeFilter} view={currentView} />
         </Suspense>
      </main>
   );
}
```

**Step 2: Regenerate route tree**

After adding the route file, TanStack Router auto-generates the route tree on next `bun dev`. No manual step needed — the file path defines the route.

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/finance/contacts.tsx
git commit -m "feat(contacts): add contacts route page"
```

---

## Task 6: Update Transactions Sheet (Contact Picker)

**Files:**

- Modify: `apps/web/src/features/transactions/ui/transactions-sheet.tsx`

**Step 1: Add contact combobox to the transactions form**

At the top of the file, add the Combobox import from UI:

```typescript
import {
   Combobox,
   ComboboxContent,
   ComboboxEmpty,
   ComboboxInput,
   ComboboxItem,
   ComboboxTrigger,
} from "@packages/ui/components/combobox";
```

Add `contactId` to the form's `defaultValues`:

```typescript
contactId: transaction?.contactId ?? null,
```

Add `contactId` to the form payload in `onSubmit` (same pattern as `categoryId`).

Add a `ContactCombobox` sub-component (place it alongside the existing `TagCheckboxList` pattern):

```typescript
function ContactCombobox({
   value,
   onChange,
}: {
   value: string | null;
   onChange: (id: string | null) => void;
}) {
   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({}),
   );

   if (contacts.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            Nenhum contato cadastrado.
         </p>
      );
   }

   const selected = contacts.find((c) => c.id === value);

   return (
      <Combobox
         onValueChange={(v) => onChange(v || null)}
         value={value ?? ""}
      >
         <ComboboxTrigger className="w-full">
            {selected ? selected.name : "Selecionar contato..."}
         </ComboboxTrigger>
         <ComboboxContent>
            <ComboboxInput placeholder="Buscar contato..." />
            <ComboboxEmpty>Nenhum contato encontrado.</ComboboxEmpty>
            {contacts.map((c) => (
               <ComboboxItem key={c.id} value={c.id}>
                  {c.name}
               </ComboboxItem>
            ))}
         </ComboboxContent>
      </Combobox>
   );
}
```

Add a `form.Field` for `contactId` in the form body, wrapped in `<Suspense>`:

```tsx
<form.Field name="contactId">
   {(field) => (
      <Field>
         <FieldLabel>Contato</FieldLabel>
         <Suspense fallback={<Skeleton className="h-9 w-full" />}>
            <ContactCombobox
               onChange={field.handleChange}
               value={field.state.value}
            />
         </Suspense>
      </Field>
   )}
</form.Field>
```

Also add `contactId` to the `TransactionRow` type in `transactions-columns.tsx`:

```typescript
contactId: string | null;
contactName?: string | null;
```

**Step 2: Commit**

```bash
git add apps/web/src/features/transactions/
git commit -m "feat(contacts): add contact picker to transactions form"
```

---

## Task 7: Sidebar Navigation + Early Access Config

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Add Contatos to sidebar nav**

1. Add `Users` to the lucide-react import:

```typescript
import {
   ArrowLeftRight,
   Building2,
   CreditCard,
   Database,
   House,
   LayoutDashboard,
   Lightbulb,
   Sparkles,
   Tag,
   Tags,
   Target,
   Users, // ADD THIS
} from "lucide-react";
```

2. Add the contacts nav item to the `finance` group items array (after `goals`):

```typescript
{
   id: "contacts",
   label: "Contatos",
   icon: Users,
   route: "/$slug/$teamSlug/finance/contacts",
   earlyAccessFlag: "contacts",
},
```

**Step 2: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git commit -m "feat(contacts): add Contatos to sidebar nav with early access gate"
```

---

## Task 8: PostHog Feature Flag (Independent)

**This task is fully independent — can run at any time.**

**Step 1: Create early access feature flag in PostHog**

Use the PostHog MCP tool to create the feature flag:

- **Flag key:** `contacts`
- **Name:** `Contacts - Clientes & Fornecedores`
- **Type:** Early access feature (beta/alpha)
- **Stage:** `alpha`
- **Description:** Alpha access to the Contacts module for managing clients and suppliers

Use the MCP posthog tool: `mcp__posthog__create-feature-flag` with key `contacts`.

Then register it as an early access feature via the PostHog UI or MCP.

**Step 2: Verify**

Confirm the flag `contacts` appears in PostHog early access features list.

---

## Final Verification

After all tasks:

```bash
bun run typecheck
bun run check
```

Fix any type errors before considering this complete.
