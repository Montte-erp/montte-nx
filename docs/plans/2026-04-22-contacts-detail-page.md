# Contacts Detail Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full CRM-style contact detail page with inline field editing, subscriptions (services purchased), and transaction history.

**Architecture:** Route `contacts/$contactId.tsx` with two-column layout: tabbed main area (Dados · Assinaturas · Transações) + compact right sidebar (Info + quick stats). Inline editing on Dados tab (field-level, no modal). Subscriptions tab shows contact's service subscriptions enriched with service + variant names, with a credenza to add new ones.

**Tech Stack:** TanStack Router, oRPC, TanStack Query (`useSuspenseQuery`/`useSuspenseQueries`), Drizzle ORM, `@packages/ui`, `@f-o-t/money`, Tailwind.

---

## Layout Overview

```
┌─────────────────────────────────────────┬───────────────────┐
│  ← Nome do Contato           [Cliente]  │  Info             │
│  [Editar inline per field]              │  Tipo: Cliente    │
│                                         │  Criado: 01/01/25 │
│  [Dados] [Assinaturas] [Transações]     │  Origem: Manual   │
│                                         │                   │
│  Dados tab:                             │  Stats            │
│  Nome       João Silva  ✏              │  2 assinaturas    │
│  Email      joao@...   ✏              │  ativas           │
│  Telefone   (11) 9...  ✏              │                   │
│  Documento  CPF 123... ✏              │                   │
│  Obs.       ...        ✏              │                   │
│                                         │                   │
│  Resumo financeiro                      │                   │
│  Receitas: R$ 5.000   Despesas: R$ 200 │                   │
└─────────────────────────────────────────┴───────────────────┘
```

---

## Task 1: Add `contacts.getById` oRPC procedure

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/contacts.ts`

`ensureContactOwnership(db, id, teamId)` already exists and returns the contact or throws 404.

**Step 1: Add procedure**

```typescript
export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return ensureContactOwnership(context.db, input.id, context.teamId);
   });
```

**Step 2: Verify**

```bash
bun run typecheck 2>&1 | grep contacts | head -5
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/contacts.ts
git commit -m "feat(contacts): add getById oRPC procedure"
```

---

## Task 2: Enrich subscription repository + add `contacts.getStats` procedure

**Files:**
- Modify: `core/database/src/repositories/subscriptions-repository.ts`
- Modify: `core/database/src/repositories/contacts-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/contacts.ts`

### 2a — Enrich `listSubscriptionsByContact` with service + variant names

Current bare query returns only subscription columns. Add a join to get `serviceName` and `variantName`.

Replace the existing `listSubscriptionsByContact` function:

```typescript
import { services, serviceVariants } from "@core/database/schemas/services";

export async function listSubscriptionsByContact(
   db: DatabaseInstance,
   contactId: string,
) {
   try {
      return await db
         .select({
            id: contactSubscriptions.id,
            teamId: contactSubscriptions.teamId,
            contactId: contactSubscriptions.contactId,
            variantId: contactSubscriptions.variantId,
            startDate: contactSubscriptions.startDate,
            endDate: contactSubscriptions.endDate,
            negotiatedPrice: contactSubscriptions.negotiatedPrice,
            notes: contactSubscriptions.notes,
            status: contactSubscriptions.status,
            source: contactSubscriptions.source,
            externalId: contactSubscriptions.externalId,
            currentPeriodStart: contactSubscriptions.currentPeriodStart,
            currentPeriodEnd: contactSubscriptions.currentPeriodEnd,
            cancelAtPeriodEnd: contactSubscriptions.cancelAtPeriodEnd,
            canceledAt: contactSubscriptions.canceledAt,
            createdAt: contactSubscriptions.createdAt,
            updatedAt: contactSubscriptions.updatedAt,
            serviceName: services.name,
            variantName: serviceVariants.name,
            billingCycle: serviceVariants.billingCycle,
            serviceId: services.id,
         })
         .from(contactSubscriptions)
         .leftJoin(
            serviceVariants,
            eq(contactSubscriptions.variantId, serviceVariants.id),
         )
         .leftJoin(services, eq(serviceVariants.serviceId, services.id))
         .where(eq(contactSubscriptions.contactId, contactId))
         .orderBy(desc(contactSubscriptions.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list subscriptions by contact");
   }
}
```

> Add `desc` to drizzle-orm imports. Add `services`, `serviceVariants` imports from schemas.

### 2b — Add `getContactTransactionStats` to contacts-repository

```typescript
import { sum } from "drizzle-orm";
import { transactions } from "@core/database/schemas/transactions";

export async function getContactTransactionStats(
   db: DatabaseInstance,
   contactId: string,
   teamId: string,
) {
   try {
      const where = and(
         eq(transactions.contactId, contactId),
         eq(transactions.teamId, teamId),
      );
      const [incomeResult] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(and(where, eq(transactions.type, "income")));
      const [expenseResult] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(and(where, eq(transactions.type, "expense")));
      return {
         totalIncome: incomeResult?.total ?? "0",
         totalExpense: expenseResult?.total ?? "0",
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao buscar estatísticas do contato.");
   }
}
```

> `sum` and `transactions` are already imported in this file (used by `contactHasLinks`).

### 2c — Add `contacts.getStats` oRPC procedure

In `apps/web/src/integrations/orpc/router/contacts.ts`:

```typescript
import { getContactTransactionStats } from "@core/database/repositories/contacts-repository";

export const getStats = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(context.db, input.id, context.teamId);
      return getContactTransactionStats(context.db, input.id, context.teamId);
   });
```

**Step: Verify**

```bash
bun run typecheck 2>&1 | grep -E "subscription|contact" | head -10
```

**Step: Commit**

```bash
git add core/database/src/repositories/subscriptions-repository.ts \
        core/database/src/repositories/contacts-repository.ts \
        apps/web/src/integrations/orpc/router/contacts.ts
git commit -m "feat(contacts): enrich subscriptions with service info, add getStats procedure"
```

---

## Task 3: Add paginated `contacts.getTransactions` procedure

**Files:**
- Modify: `core/database/src/repositories/contacts-repository.ts`
- Modify: `apps/web/src/integrations/orpc/router/contacts.ts`

### 3a — Repository function

```typescript
import { desc, count } from "drizzle-orm";

export async function getContactTransactions(
   db: DatabaseInstance,
   contactId: string,
   teamId: string,
   options: { page: number; limit: number },
) {
   try {
      const { page, limit } = options;
      const where = and(
         eq(transactions.contactId, contactId),
         eq(transactions.teamId, teamId),
      );
      const [totalResult] = await db
         .select({ value: count() })
         .from(transactions)
         .where(where);
      const total = totalResult?.value ?? 0;
      const items = await db
         .select()
         .from(transactions)
         .where(where)
         .orderBy(desc(transactions.date))
         .limit(limit)
         .offset((page - 1) * limit);
      return { items, total };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao buscar transações do contato.");
   }
}
```

### 3b — oRPC procedure

```typescript
import { getContactTransactions } from "@core/database/repositories/contacts-repository";

export const getTransactions = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         page: z.number().int().min(1).default(1),
         pageSize: z.number().int().min(1).max(100).default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(context.db, input.id, context.teamId);
      return getContactTransactions(context.db, input.id, context.teamId, {
         page: input.page,
         limit: input.pageSize,
      });
   });
```

**Step: Verify + commit**

```bash
bun run typecheck 2>&1 | grep contact | head -5
git add core/database/src/repositories/contacts-repository.ts \
        apps/web/src/integrations/orpc/router/contacts.ts
git commit -m "feat(contacts): add paginated getTransactions procedure"
```

---

## Task 4: Create detail route scaffold

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId.tsx`

```typescript
import { Skeleton } from "@packages/ui/components/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";

const searchSchema = z.object({
   tab: z
      .enum(["dados", "assinaturas", "transacoes"])
      .catch("dados")
      .default("dados"),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId",
)({
   validateSearch: searchSchema,
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, params, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.contacts.getById.queryOptions({ input: { id: params.contactId } }),
      );
      context.queryClient.prefetchQuery(
         orpc.contacts.getStats.queryOptions({ input: { id: params.contactId } }),
      );
      context.queryClient.prefetchQuery(
         orpc.contacts.getTransactions.queryOptions({
            input: { id: params.contactId, page: deps.page, pageSize: deps.pageSize },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.services.getContactSubscriptions.queryOptions({
            input: { contactId: params.contactId },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: ContactDetailSkeleton,
   head: () => ({ meta: [{ title: "Contato — Montte" }] }),
   component: ContactDetailPage,
});

function ContactDetailSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <Skeleton className="h-10 w-64" />
         <div className="flex gap-4">
            <Skeleton className="h-96 flex-1" />
            <Skeleton className="h-96 w-72" />
         </div>
      </div>
   );
}

function ContactDetailPage() {
   return (
      <QueryBoundary
         fallback={<ContactDetailSkeleton />}
         errorTitle="Erro ao carregar contato"
      >
         <ContactDetailContent />
      </QueryBoundary>
   );
}

function ContactDetailContent() {
   // implemented in Task 7
   return <div />;
}
```

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId.tsx
git commit -m "feat(contacts): scaffold detail route with prefetch"
```

---

## Task 5: Build `ContactDetailHeader`

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-detail-header.tsx`

Header: back arrow + contact name + type badge + actions dropdown (Excluir).

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";

type Contact = Outputs["contacts"]["getById"];

const TYPE_LABELS: Record<Contact["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};
const TYPE_VARIANTS: Record<Contact["type"], "default" | "secondary" | "outline"> = {
   cliente: "default",
   fornecedor: "secondary",
   ambos: "outline",
};

export function ContactDetailHeader({ contact }: { contact: Contact }) {
   const navigate = useNavigate();
   const { openAlertDialog } = useAlertDialog();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído.");
            navigate({
               to: "/$slug/$teamSlug/_dashboard/contacts",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function handleDelete() {
      openAlertDialog({
         title: "Excluir contato",
         description: `Excluir "${contact.name}"? Lançamentos vinculados impedirão a exclusão — arquive em vez disso.`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: contact.id });
         },
      });
   }

   return (
      <div className="flex items-center gap-4">
         <Button
            size="icon"
            variant="ghost"
            onClick={() =>
               navigate({
                  to: "/$slug/$teamSlug/_dashboard/contacts",
                  params: { slug, teamSlug },
               })
            }
         >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
         </Button>

         <div className="flex flex-1 items-center gap-2">
            <h1 className="text-xl font-semibold">{contact.name}</h1>
            <Badge variant={TYPE_VARIANTS[contact.type]}>
               {TYPE_LABELS[contact.type]}
            </Badge>
            {contact.isArchived && (
               <Badge variant="outline">Arquivado</Badge>
            )}
         </div>

         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button size="icon" variant="outline">
                  <MoreHorizontal className="size-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
               <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
               >
                  <Trash2 className="size-4" />
                  Excluir
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}
```

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-detail-header.tsx
git commit -m "feat(contacts): add contact detail header with delete action"
```

---

## Task 6: Build inline-editable `ContactDadosTab`

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-dados-tab.tsx`

Each field is read-only by default with a pencil icon. Clicking activates an inline input/select. On blur or Enter, calls `orpc.contacts.update`. Uses local `editingField` state.

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "@f-o-t/money";
import { of } from "@f-o-t/money";
import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Contact = Outputs["contacts"]["getById"];
type EditableField = "name" | "email" | "phone" | "document" | "notes" | "type";

interface ContactDadosTabProps {
   contact: Contact;
}

export function ContactDadosTab({ contact }: ContactDadosTabProps) {
   const [editingField, setEditingField] = useState<EditableField | null>(null);
   const [draft, setDraft] = useState<string>("");
   const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

   const { data: stats } = useSuspenseQuery(
      orpc.contacts.getStats.queryOptions({ input: { id: contact.id } }),
   );

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onSuccess: () => {
            setEditingField(null);
         },
         onError: (e) => {
            toast.error(e.message);
            setEditingField(null);
         },
      }),
   );

   function startEdit(field: EditableField, currentValue: string) {
      setEditingField(field);
      setDraft(currentValue ?? "");
   }

   function commitEdit(field: EditableField) {
      if (draft === (contact[field] ?? "")) {
         setEditingField(null);
         return;
      }
      updateMutation.mutate({ id: contact.id, [field]: draft || null });
   }

   function handleKeyDown(e: React.KeyboardEvent, field: EditableField) {
      if (e.key === "Enter" && field !== "notes") commitEdit(field);
      if (e.key === "Escape") setEditingField(null);
   }

   return (
      <div className="flex flex-col gap-4">
         {/* Editable fields */}
         <div className="rounded-lg border">
            <EditRow
               label="Nome"
               value={contact.name}
               isEditing={editingField === "name"}
               onEdit={() => startEdit("name", contact.name)}
            >
               {editingField === "name" ? (
                  <Input
                     autoFocus
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     onBlur={() => commitEdit("name")}
                     onKeyDown={(e) => handleKeyDown(e, "name")}
                  />
               ) : (
                  <span className="text-sm">{contact.name}</span>
               )}
            </EditRow>

            <EditRow
               label="Tipo"
               value={contact.type}
               isEditing={editingField === "type"}
               onEdit={() => startEdit("type", contact.type)}
            >
               {editingField === "type" ? (
                  <Select
                     value={draft}
                     onValueChange={(v) => {
                        setDraft(v);
                        updateMutation.mutate({ id: contact.id, type: v as Contact["type"] });
                     }}
                  >
                     <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                     </SelectContent>
                  </Select>
               ) : (
                  <Badge variant="outline">{contact.type}</Badge>
               )}
            </EditRow>

            <EditRow
               label="Email"
               value={contact.email}
               isEditing={editingField === "email"}
               onEdit={() => startEdit("email", contact.email ?? "")}
            >
               {editingField === "email" ? (
                  <Input
                     autoFocus
                     type="email"
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     onBlur={() => commitEdit("email")}
                     onKeyDown={(e) => handleKeyDown(e, "email")}
                  />
               ) : (
                  <span className="text-sm">{contact.email ?? <span className="text-muted-foreground">—</span>}</span>
               )}
            </EditRow>

            <EditRow
               label="Telefone"
               value={contact.phone}
               isEditing={editingField === "phone"}
               onEdit={() => startEdit("phone", contact.phone ?? "")}
            >
               {editingField === "phone" ? (
                  <Input
                     autoFocus
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     onBlur={() => commitEdit("phone")}
                     onKeyDown={(e) => handleKeyDown(e, "phone")}
                  />
               ) : (
                  <span className="text-sm">{contact.phone ?? <span className="text-muted-foreground">—</span>}</span>
               )}
            </EditRow>

            <EditRow
               label="Documento"
               value={contact.document}
               isEditing={editingField === "document"}
               onEdit={() => startEdit("document", contact.document ?? "")}
            >
               {editingField === "document" ? (
                  <Input
                     autoFocus
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     onBlur={() => commitEdit("document")}
                     onKeyDown={(e) => handleKeyDown(e, "document")}
                     placeholder="CPF ou CNPJ"
                  />
               ) : (
                  <span className="text-sm">
                     {contact.document
                        ? `${contact.documentType?.toUpperCase()} ${contact.document}`
                        : <span className="text-muted-foreground">—</span>
                     }
                  </span>
               )}
            </EditRow>

            <EditRow
               label="Observações"
               value={contact.notes}
               isEditing={editingField === "notes"}
               onEdit={() => startEdit("notes", contact.notes ?? "")}
               isLast
            >
               {editingField === "notes" ? (
                  <Textarea
                     autoFocus
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     onBlur={() => commitEdit("notes")}
                     onKeyDown={(e) => handleKeyDown(e, "notes")}
                     rows={3}
                  />
               ) : (
                  <span className="text-sm">
                     {contact.notes ?? <span className="text-muted-foreground">—</span>}
                  </span>
               )}
            </EditRow>
         </div>

         {/* Financial summary */}
         <div className="rounded-lg border p-4">
            <span className="mb-4 block text-sm font-semibold">Resumo financeiro</span>
            <div className="flex gap-4">
               <div className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Total recebido</span>
                  <span className="text-sm font-semibold text-emerald-600">
                     {format(of(stats.totalIncome, "BRL"), "pt-BR")}
                  </span>
               </div>
               <div className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Total pago</span>
                  <span className="text-sm font-semibold text-rose-600">
                     {format(of(stats.totalExpense, "BRL"), "pt-BR")}
                  </span>
               </div>
            </div>
         </div>
      </div>
   );
}

function EditRow({
   label,
   value,
   isEditing,
   onEdit,
   children,
   isLast = false,
}: {
   label: string;
   value: string | null | undefined;
   isEditing: boolean;
   onEdit: () => void;
   children: React.ReactNode;
   isLast?: boolean;
}) {
   return (
      <div
         className={`flex items-start gap-4 p-4 ${!isLast ? "border-b" : ""}`}
      >
         <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground pt-1">
            {label}
         </span>
         <div className="flex-1">{children}</div>
         {!isEditing && (
            <Button
               size="icon"
               variant="ghost"
               className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
               onClick={onEdit}
            >
               <Pencil className="size-3" />
               <span className="sr-only">Editar {label}</span>
            </Button>
         )}
      </div>
   );
}
```

> Wrap the outer border div with `group` class so pencil icon hover works: `<div className="rounded-lg border group">`.

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-dados-tab.tsx
git commit -m "feat(contacts): add inline-editable dados tab"
```

---

## Task 7: Build `ContactAssinaturasTab`

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-assinaturas-tab.tsx`

Shows subscriptions enriched with service + variant names. "Adicionar assinatura" button opens a credenza with a form to pick service → variant → set price/dates.

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "@f-o-t/money";
import { of } from "@f-o-t/money";
import dayjs from "dayjs";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { AddSubscriptionForm } from "./add-subscription-form";

const STATUS_LABELS = {
   active: "Ativa",
   completed: "Concluída",
   cancelled: "Cancelada",
} as const;
const STATUS_VARIANTS = {
   active: "default",
   completed: "secondary",
   cancelled: "outline",
} as const;
const CYCLE_LABELS = {
   hourly: "Por hora",
   monthly: "Mensal",
   annual: "Anual",
   one_time: "Único",
} as const;

export function ContactAssinaturasTab({ contactId }: { contactId: string }) {
   const { openCredenza } = useCredenza();
   const { data: subscriptions } = useSuspenseQuery(
      orpc.services.getContactSubscriptions.queryOptions({
         input: { contactId },
      }),
   );

   function handleAddSubscription() {
      openCredenza({
         title: "Adicionar assinatura",
         content: <AddSubscriptionForm contactId={contactId} />,
      });
   }

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
               {subscriptions.length} assinatura{subscriptions.length !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={handleAddSubscription}>
               <Plus className="size-4" />
               Adicionar
            </Button>
         </div>

         {subscriptions.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <RefreshCw className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma assinatura</EmptyTitle>
                  <EmptyDescription>
                     Vincule este contato a um serviço para acompanhar assinaturas e cobranças.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="flex flex-col gap-2">
               {subscriptions.map((sub) => (
                  <div key={sub.id} className="rounded-lg border p-4">
                     <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                           <span className="text-sm font-medium">
                              {sub.serviceName ?? "Serviço removido"}
                           </span>
                           <span className="text-xs text-muted-foreground">
                              {sub.variantName} · {sub.billingCycle ? CYCLE_LABELS[sub.billingCycle] : "—"}
                           </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <Badge variant={STATUS_VARIANTS[sub.status] as "default" | "secondary" | "outline"}>
                              {STATUS_LABELS[sub.status]}
                           </Badge>
                           <span className="text-sm font-semibold">
                              {format(of(sub.negotiatedPrice, "BRL"), "pt-BR")}
                           </span>
                        </div>
                     </div>
                     <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>Início: {dayjs(sub.startDate).format("DD/MM/YYYY")}</span>
                        {sub.endDate && <span>Fim: {dayjs(sub.endDate).format("DD/MM/YYYY")}</span>}
                     </div>
                     {sub.currentPeriodEnd && (
                        <div className="mt-1 text-xs text-muted-foreground">
                           Período atual: {dayjs(sub.currentPeriodStart).format("DD/MM")} – {dayjs(sub.currentPeriodEnd).format("DD/MM/YYYY")}
                        </div>
                     )}
                  </div>
               ))}
            </div>
         )}
      </div>
   );
}
```

**Step: Also create `AddSubscriptionForm` component**

```typescript
// add-subscription-form.tsx
// Form to select service, then variant, then set price/startDate
// Uses orpc.services.getAll + orpc.services.getVariants + orpc.services.createSubscription
// Pattern: two-step inline select → date + price fields → submit
```

Full implementation: use `useSuspenseQuery(orpc.services.getAll.queryOptions({}))` to list services. On service select, load variants via `useSuspenseQuery(orpc.services.getVariants.queryOptions({ input: { serviceId } }))`. Then show negotiatedPrice (pre-filled with variant.basePrice) + startDate fields. On submit: `useMutation(orpc.services.createSubscription.mutationOptions(...))`.

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-assinaturas-tab.tsx \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/add-subscription-form.tsx
git commit -m "feat(contacts): add subscriptions tab with add subscription form"
```

---

## Task 8: Build `ContactTransacoesTab`

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx`

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "@f-o-t/money";
import { of } from "@f-o-t/money";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Route } from "../contacts/$contactId";
import { orpc } from "@/integrations/orpc/client";

const TYPE_LABELS = {
   income: "Receita",
   expense: "Despesa",
   transfer: "Transferência",
} as const;
const STATUS_LABELS = {
   paid: "Pago",
   pending: "Pendente",
   cancelled: "Cancelado",
} as const;
const STATUS_VARIANTS = {
   paid: "default",
   pending: "secondary",
   cancelled: "outline",
} as const;

export function ContactTransacoesTab({ contactId }: { contactId: string }) {
   const { page, pageSize } = Route.useSearch();
   const navigate = Route.useNavigate();

   const { data } = useSuspenseQuery(
      orpc.contacts.getTransactions.queryOptions({
         input: { id: contactId, page, pageSize },
      }),
   );

   if (data.items.length === 0 && page === 1) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon"><Receipt className="size-6" /></EmptyMedia>
               <EmptyTitle>Nenhuma transação</EmptyTitle>
               <EmptyDescription>
                  Este contato ainda não possui transações vinculadas.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const totalPages = Math.ceil(data.total / pageSize);

   return (
      <div className="flex flex-col gap-4">
         <div className="rounded-lg border">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                     <th className="p-4 font-medium">Descrição</th>
                     <th className="p-4 font-medium">Data</th>
                     <th className="p-4 font-medium">Tipo</th>
                     <th className="p-4 font-medium">Status</th>
                     <th className="p-4 text-right font-medium">Valor</th>
                  </tr>
               </thead>
               <tbody>
                  {data.items.map((tx) => (
                     <tr key={tx.id} className="border-b last:border-0">
                        <td className="p-4">{tx.description ?? "—"}</td>
                        <td className="p-4">{dayjs(tx.date).format("DD/MM/YYYY")}</td>
                        <td className="p-4">{TYPE_LABELS[tx.type]}</td>
                        <td className="p-4">
                           <Badge variant={STATUS_VARIANTS[tx.status] as "default" | "secondary" | "outline"}>
                              {STATUS_LABELS[tx.status]}
                           </Badge>
                        </td>
                        <td className="p-4 text-right font-semibold">
                           {format(of(tx.amount, "BRL"), "pt-BR")}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
               <span className="text-muted-foreground">
                  {data.total} transações · página {page} de {totalPages}
               </span>
               <div className="flex gap-2">
                  <Button
                     size="sm"
                     variant="outline"
                     disabled={page <= 1}
                     onClick={() =>
                        navigate({ search: (p) => ({ ...p, page: p.page - 1 }), replace: true })
                     }
                  >
                     <ChevronLeft className="size-4" />
                     Anterior
                  </Button>
                  <Button
                     size="sm"
                     variant="outline"
                     disabled={page >= totalPages}
                     onClick={() =>
                        navigate({ search: (p) => ({ ...p, page: p.page + 1 }), replace: true })
                     }
                  >
                     Próxima
                     <ChevronRight className="size-4" />
                  </Button>
               </div>
            </div>
         )}
      </div>
   );
}
```

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-transacoes-tab.tsx
git commit -m "feat(contacts): add paginated transactions tab"
```

---

## Task 9: Build `ContactInfoSidebar`

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-info-sidebar.tsx`

Right panel with compact key/value rows + active subscription count.

```typescript
import { Badge } from "@packages/ui/components/badge";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Contact = Outputs["contacts"]["getById"];

export function ContactInfoSidebar({ contact }: { contact: Contact }) {
   const { data: subscriptions } = useSuspenseQuery(
      orpc.services.getContactSubscriptions.queryOptions({
         input: { contactId: contact.id },
      }),
   );
   const activeCount = subscriptions.filter((s) => s.status === "active").length;

   return (
      <aside className="flex w-64 shrink-0 flex-col gap-4">
         <div className="rounded-lg border p-4">
            <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
               Info
            </span>
            <div className="flex flex-col gap-2">
               <InfoRow label="Tipo">
                  <Badge variant="outline" className="text-xs">{contact.type}</Badge>
               </InfoRow>
               <InfoRow label="Criado em">
                  {dayjs(contact.createdAt).format("DD/MM/YYYY")}
               </InfoRow>
               <InfoRow label="Atualizado">
                  {dayjs(contact.updatedAt).format("DD/MM/YYYY")}
               </InfoRow>
            </div>
         </div>

         {activeCount > 0 && (
            <div className="rounded-lg border p-4">
               <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Assinaturas
               </span>
               <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{activeCount}</span>
                  <span className="text-xs text-muted-foreground">ativa{activeCount !== 1 ? "s" : ""}</span>
               </div>
            </div>
         )}
      </aside>
   );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
   return (
      <div className="flex items-center justify-between gap-2">
         <span className="text-xs text-muted-foreground">{label}</span>
         <span className="text-xs font-medium">{children}</span>
      </div>
   );
}
```

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contact-info-sidebar.tsx
git commit -m "feat(contacts): add contact info sidebar"
```

---

## Task 10: Wire full detail page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId.tsx`

Replace `ContactDetailContent` with full layout:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { ContactDetailHeader } from "../-contacts/contact-detail-header";
import { ContactDadosTab } from "../-contacts/contact-dados-tab";
import { ContactInfoSidebar } from "../-contacts/contact-info-sidebar";
import { ContactAssinaturasTab } from "../-contacts/contact-assinaturas-tab";
import { ContactTransacoesTab } from "../-contacts/contact-transacoes-tab";

function ContactDetailContent() {
   const { contactId } = Route.useParams();
   const { tab } = Route.useSearch();
   const navigate = Route.useNavigate();

   const { data: contact } = useSuspenseQuery(
      orpc.contacts.getById.queryOptions({ input: { id: contactId } }),
   );

   return (
      <main className="flex flex-col gap-4">
         <ContactDetailHeader contact={contact} />

         <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
               <Tabs
                  value={tab}
                  onValueChange={(v) =>
                     navigate({
                        search: (p) => ({
                           ...p,
                           tab: v as "dados" | "assinaturas" | "transacoes",
                        }),
                        replace: true,
                     })
                  }
               >
                  <TabsList>
                     <TabsTrigger value="dados">Dados</TabsTrigger>
                     <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
                     <TabsTrigger value="transacoes">Transações</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactDadosTab contact={contact} />
                     </QueryBoundary>
                  </TabsContent>

                  <TabsContent value="assinaturas" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactAssinaturasTab contactId={contactId} />
                     </QueryBoundary>
                  </TabsContent>

                  <TabsContent value="transacoes" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactTransacoesTab contactId={contactId} />
                     </QueryBoundary>
                  </TabsContent>
               </Tabs>
            </div>

            <ContactInfoSidebar contact={contact} />
         </div>
      </main>
   );
}
```

**Step: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "contact|Contact" | head -15
```

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId.tsx
git commit -m "feat(contacts): wire full contact detail page with tabs and sidebar"
```

---

## Task 11: Add row-click navigation from contacts list

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx`

**Step 1: Check if DataTable has `onRowClick`**

```bash
grep -n "onRowClick" /home/yorizel/Documents/montte-nx/packages/ui/src/components/data-table/data-table.tsx | head -5
```

**Step 2a — If `onRowClick` exists:** Add to `ContactsList`:

```typescript
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";

// inside ContactsList:
const { slug, teamSlug } = useDashboardSlugs();

// DataTable prop:
onRowClick={(row) =>
   navigate({
      to: "/$slug/$teamSlug/_dashboard/contacts/$contactId",
      params: { slug, teamSlug, contactId: row.original.id },
   })
}
```

**Step 2b — If `onRowClick` doesn't exist:** In `contacts-columns.tsx`, wrap the name cell in a `Link`:

```typescript
import { Link } from "@tanstack/react-router";

// in name column cell:
cell: ({ row }) => (
   <Link
      to="/$slug/$teamSlug/_dashboard/contacts/$contactId"
      params={{ slug: "$slug", teamSlug: "$teamSlug", contactId: row.original.id }}
      className="font-medium hover:underline"
   >
      {row.original.name}
   </Link>
),
```

> Note: `$slug`/`$teamSlug` are inherited from parent route params via TanStack Router's param inheritance — use `useParams()` or `Route.useParams()` inside the column builder if needed, or pass them as builder args.

**Step: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-contacts/contacts-columns.tsx
git commit -m "feat(contacts): navigate to contact detail on row click"
```

---

## Summary

| Task | What | Key files |
|------|------|-----------|
| 1 | `contacts.getById` | `router/contacts.ts` |
| 2 | Enrich subscription join + `getStats` | `subscriptions-repository.ts`, `contacts-repository.ts`, router |
| 3 | `contacts.getTransactions` paginated | `contacts-repository.ts`, router |
| 4 | Detail route scaffold | `contacts/$contactId.tsx` |
| 5 | `ContactDetailHeader` | `-contacts/contact-detail-header.tsx` |
| 6 | Inline-editable `ContactDadosTab` | `-contacts/contact-dados-tab.tsx` |
| 7 | `ContactAssinaturasTab` + `AddSubscriptionForm` | 2 new files |
| 8 | `ContactTransacoesTab` paginated | `-contacts/contact-transacoes-tab.tsx` |
| 9 | `ContactInfoSidebar` | `-contacts/contact-info-sidebar.tsx` |
| 10 | Wire full layout | `contacts/$contactId.tsx` |
| 11 | Row-click nav from list | `contacts.tsx` |
