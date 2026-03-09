# Credit Cards Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a full credit cards (cartão de crédito) module following the bank accounts pattern, with `closingDay`, `dueDay`, and `creditLimit` fields, and a dedicated `creditCardId` FK on transactions.

**Architecture:** New `credit_cards` table (separate from `bank_accounts`). Transactions get a nullable `creditCardId` FK and `bankAccountId` becomes nullable — exactly one must be set per transaction. Full CRUD via oRPC + DataTable UI with Credenza form, identical structure to bank accounts.

**Tech Stack:** Drizzle ORM, oRPC, TanStack Query, TanStack Form, TanStack Router, Radix UI / @packages/ui, Sonner toasts, @f-o-t/money

---

### Task 1: Create credit_cards schema

**Files:**

- Create: `packages/database/src/schemas/credit-cards.ts`
- Modify: `packages/database/src/schema.ts`

**Step 1: Create the schema file**

```typescript
// packages/database/src/schemas/credit-cards.ts
import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

export const creditCards = pgTable(
   "credit_cards",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      creditLimit: numeric("credit_limit", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      closingDay: integer("closing_day").notNull(),
      dueDay: integer("due_day").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("credit_cards_team_id_idx").on(table.teamId)],
);

export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;
```

**Step 2: Export from schema.ts**

In `packages/database/src/schema.ts`, add after the bank-accounts line (under `// Finance`):

```typescript
export * from "./schemas/credit-cards";
```

**Step 3: Commit**

```bash
git add packages/database/src/schemas/credit-cards.ts packages/database/src/schema.ts
git commit -m "feat(database): add credit_cards schema"
```

---

### Task 2: Update transactions schema — add creditCardId, make bankAccountId nullable

**Files:**

- Modify: `packages/database/src/schemas/transactions.ts`

**Step 1: Update the transactions table**

Add the import for `creditCards` at the top:

```typescript
import { creditCards } from "./credit-cards";
```

Change `bankAccountId` from `.notNull()` to nullable:

```typescript
bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
   onDelete: "restrict",
}),
```

Add `creditCardId` after `destinationBankAccountId`:

```typescript
creditCardId: uuid("credit_card_id").references(() => creditCards.id, {
   onDelete: "restrict",
}),
```

Add index after existing indexes:

```typescript
index("transactions_credit_card_id_idx").on(table.creditCardId),
```

**Step 2: Update the relations**

In `transactionsRelations`, add:

```typescript
creditCard: one(creditCards, {
   fields: [transactions.creditCardId],
   references: [creditCards.id],
}),
```

**Step 3: Commit**

```bash
git add packages/database/src/schemas/transactions.ts
git commit -m "feat(database): add creditCardId to transactions, make bankAccountId nullable"
```

---

### Task 3: Push schema to database

**Step 1: Push**

```bash
bun run db:push
```

Expected: Drizzle applies migration — creates `credit_cards` table, adds `credit_card_id` column to `transactions`, makes `bank_account_id` nullable.

---

### Task 4: Create credit cards repository

**Files:**

- Create: `packages/database/src/repositories/credit-cards-repository.ts`

**Step 1: Create the repository**

```typescript
// packages/database/src/repositories/credit-cards-repository.ts
import { AppError, propagateError } from "@packages/utils/errors";
import { desc, eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { creditCards, type NewCreditCard } from "../schema";

export async function createCreditCard(
   db: DatabaseInstance,
   data: NewCreditCard,
) {
   try {
      const [card] = await db.insert(creditCards).values(data).returning();
      return card;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create credit card");
   }
}

export async function listCreditCards(db: DatabaseInstance, teamId: string) {
   try {
      return await db
         .select()
         .from(creditCards)
         .where(eq(creditCards.teamId, teamId))
         .orderBy(desc(creditCards.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list credit cards");
   }
}

export async function getCreditCard(db: DatabaseInstance, id: string) {
   try {
      const [card] = await db
         .select()
         .from(creditCards)
         .where(eq(creditCards.id, id));
      return card ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get credit card");
   }
}

export async function updateCreditCard(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewCreditCard>,
) {
   try {
      const [updated] = await db
         .update(creditCards)
         .set(data)
         .where(eq(creditCards.id, id))
         .returning();
      if (!updated) {
         throw AppError.database("Credit card not found");
      }
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update credit card");
   }
}

export async function deleteCreditCard(db: DatabaseInstance, id: string) {
   try {
      await db.delete(creditCards).where(eq(creditCards.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete credit card");
   }
}
```

**Step 2: Commit**

```bash
git add packages/database/src/repositories/credit-cards-repository.ts
git commit -m "feat(database): add credit cards repository"
```

---

### Task 5: Create oRPC credit-cards router

**Files:**

- Create: `apps/web/src/integrations/orpc/router/credit-cards.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Create the router**

```typescript
// apps/web/src/integrations/orpc/router/credit-cards.ts
import { ORPCError } from "@orpc/server";
import {
   createCreditCard,
   deleteCreditCard,
   getCreditCard,
   listCreditCards,
   updateCreditCard,
} from "@packages/database/repositories/credit-cards-repository";
import { creditCards } from "@packages/database/schemas/credit-cards";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const creditCardSchema = createInsertSchema(creditCards)
   .pick({
      name: true,
      color: true,
      iconUrl: true,
      creditLimit: true,
      closingDay: true,
      dueDay: true,
   })
   .extend({
      color: z
         .string()
         .refine((v) => /^#[0-9a-fA-F]{6}$/.test(v), {
            message: "Cor inválida. Use formato hex (#RRGGBB).",
         })
         .optional(),
      creditLimit: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
            message: "Limite de crédito inválido.",
         })
         .optional(),
      closingDay: z
         .number()
         .int()
         .min(1, "Dia inválido.")
         .max(31, "Dia inválido."),
      dueDay: z.number().int().min(1, "Dia inválido.").max(31, "Dia inválido."),
   });

export const create = protectedProcedure
   .input(creditCardSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createCreditCard(db, { ...input, teamId });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listCreditCards(db, teamId);
});

export const getById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      return card;
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(creditCardSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      const { id, ...data } = input;
      return updateCreditCard(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      await deleteCreditCard(db, input.id);
      return { success: true };
   });
```

**Step 2: Register in router index**

In `apps/web/src/integrations/orpc/router/index.ts`, add import after bankAccountsRouter:

```typescript
import * as creditCardsRouter from "./credit-cards";
```

Add to the export object after `bankAccounts`:

```typescript
creditCards: creditCardsRouter,
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/credit-cards.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(orpc): add credit cards router"
```

---

### Task 6: Create credit-cards-columns UI component

**Files:**

- Create: `apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx`

**Step 1: Create the columns file**

```typescript
// apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Pencil, Trash2 } from "lucide-react";

export type CreditCardRow = {
   id: string;
   teamId: string;
   name: string;
   color: string;
   iconUrl?: string | null;
   creditLimit: string;
   closingDay: number;
   dueDay: number;
   createdAt: Date | string;
   updatedAt: Date | string;
};

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

export function buildCreditCardColumns(
   onEdit: (card: CreditCardRow) => void,
   onDelete: (card: CreditCardRow) => void,
): ColumnDef<CreditCardRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
               <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: row.original.color }}
               />
               <span className="font-medium truncate">{row.original.name}</span>
            </div>
         ),
      },
      {
         accessorKey: "creditLimit",
         header: "Limite",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {formatBRL(row.original.creditLimit)}
            </span>
         ),
      },
      {
         accessorKey: "closingDay",
         header: "Fechamento",
         cell: ({ row }) => (
            <Badge variant="secondary">
               <CreditCard className="size-3 mr-1" />
               Dia {row.original.closingDay}
            </Badge>
         ),
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         cell: ({ row }) => (
            <Badge variant="outline">Dia {row.original.dueDay}</Badge>
         ),
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
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

**Step 2: Commit**

```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-columns.tsx
git commit -m "feat(ui): add credit cards columns"
```

---

### Task 7: Create credit-cards-form UI component

**Files:**

- Create: `apps/web/src/features/credit-cards/ui/credit-cards-form.tsx`

**Step 1: Create the form**

```typescript
// apps/web/src/features/credit-cards/ui/credit-cards-form.tsx
import { Button } from "@packages/ui/components/button";
import {
   ColorPicker,
   ColorPickerAlpha,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
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
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface CreditCardFormProps {
   mode: "create" | "edit";
   card?: {
      id: string;
      name: string;
      color: string;
      iconUrl?: string | null;
      creditLimit: string;
      closingDay: number;
      dueDay: number;
   };
   onSuccess: () => void;
}

export function CreditCardForm({ mode, card, onSuccess }: CreditCardFormProps) {
   const isCreate = mode === "create";

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar cartão de crédito.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.creditCards.update.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar cartão de crédito.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: card?.name ?? "",
         color: card?.color ?? "#6366f1",
         creditLimit: card?.creditLimit ?? "0",
         closingDay: card?.closingDay ?? 1,
         dueDay: card?.dueDay ?? 10,
      },
      onSubmit: async ({ value }) => {
         if (isCreate) {
            createMutation.mutate({
               name: value.name.trim(),
               color: value.color,
               creditLimit: value.creditLimit,
               closingDay: value.closingDay,
               dueDay: value.dueDay,
            });
         } else if (card) {
            updateMutation.mutate({
               id: card.id,
               name: value.name.trim(),
               color: value.color,
               closingDay: value.closingDay,
               dueDay: value.dueDay,
            });
         }
      },
   });

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
               {isCreate ? "Novo Cartão de Crédito" : "Editar Cartão de Crédito"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione um cartão de crédito para controlar seus gastos."
                  : "Atualize as informações do cartão de crédito."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Nome */}
               <form.Field
                  name="name"
                  validators={{
                     onBlur: ({ value }) =>
                        !value.trim() ? "Nome é obrigatório" : undefined,
                  }}
               >
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Ex: Nubank, Itaú Visa"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors as any} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Cor */}
               <form.Field name="color">
                  {(field) => (
                     <Field>
                        <FieldLabel>Cor</FieldLabel>
                        <Popover>
                           <PopoverTrigger asChild>
                              <Button
                                 className="w-full flex gap-2 justify-start"
                                 type="button"
                                 variant="outline"
                              >
                                 <div
                                    className="w-4 h-4 rounded border border-border shrink-0"
                                    style={{ backgroundColor: field.state.value }}
                                 />
                                 {field.state.value}
                              </Button>
                           </PopoverTrigger>
                           <PopoverContent align="start" className="rounded-md border bg-background">
                              <ColorPicker
                                 className="flex flex-col gap-4"
                                 onChange={(rgba) => {
                                    if (Array.isArray(rgba)) {
                                       field.handleChange(
                                          Color.rgb(rgba[0], rgba[1], rgba[2]).hex(),
                                       );
                                    }
                                 }}
                                 value={field.state.value || "#000000"}
                              >
                                 <div className="h-24">
                                    <ColorPickerSelection />
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <ColorPickerEyeDropper />
                                    <div className="grid w-full gap-1">
                                       <ColorPickerHue />
                                       <ColorPickerAlpha />
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <ColorPickerOutput />
                                    <ColorPickerFormat />
                                 </div>
                              </ColorPicker>
                           </PopoverContent>
                        </Popover>
                     </Field>
                  )}
               </form.Field>

               {/* Limite de crédito — só no create */}
               {isCreate && (
                  <form.Field name="creditLimit">
                     {(field) => (
                        <Field>
                           <FieldLabel>Limite de Crédito</FieldLabel>
                           <MoneyInput
                              onChange={(v) => field.handleChange(String(v ?? 0))}
                              value={field.state.value}
                              valueInCents={false}
                           />
                        </Field>
                     )}
                  </form.Field>
               )}

               {/* Dia de fechamento */}
               <form.Field
                  name="closingDay"
                  validators={{
                     onBlur: ({ value }) =>
                        value < 1 || value > 31 ? "Dia deve ser entre 1 e 31" : undefined,
                  }}
               >
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Dia de Fechamento</FieldLabel>
                           <Input
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              placeholder="Ex: 25"
                              type="number"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors as any} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Dia de vencimento */}
               <form.Field
                  name="dueDay"
                  validators={{
                     onBlur: ({ value }) =>
                        value < 1 || value > 31 ? "Dia deve ser entre 1 e 31" : undefined,
                  }}
               >
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Dia de Vencimento</FieldLabel>
                           <Input
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              placeholder="Ex: 5"
                              type="number"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors as any} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createMutation.isPending ||
                        updateMutation.isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting ||
                        createMutation.isPending ||
                        updateMutation.isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     {isCreate ? "Criar cartão" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/credit-cards/ui/credit-cards-form.tsx
git commit -m "feat(ui): add credit cards form"
```

---

### Task 8: Create credit-cards route page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/credit-cards.tsx`

**Step 1: Create the route file**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/credit-cards.tsx
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
import { CreditCard, LayoutGrid, LayoutList, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   type CreditCardRow,
   buildCreditCardColumns,
} from "@/features/credit-cards/ui/credit-cards-columns";
import { CreditCardForm } from "@/features/credit-cards/ui/credit-cards-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/credit-cards",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
   },
   component: CreditCardsPage,
});

const CREDIT_CARD_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

function CreditCardsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

interface CreditCardsListProps {
   view: "table" | "card";
}

function CreditCardsList({ view }: CreditCardsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: cards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.creditCards.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartão de crédito.");
         },
      }),
   );

   const handleEdit = useCallback(
      (card: CreditCardRow) => {
         openCredenza({
            children: (
               <CreditCardForm card={card} mode="edit" onSuccess={closeCredenza} />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (card: CreditCardRow) => {
         openAlertDialog({
            title: "Excluir cartão de crédito",
            description: `Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "cartão" : "cartões"}`,
         description:
            "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await Promise.all(
               selectedIds.map((id) => deleteMutation.mutateAsync({ id })),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedCount, selectedIds, deleteMutation, onClear]);

   const columns = buildCreditCardColumns(handleEdit, handleDelete);

   if (cards.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <CreditCard className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
               <EmptyDescription>
                  Adicione um cartão de crédito para controlar seus gastos.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-3"
                  key={card.id}
               >
                  <div className="flex items-center gap-2 min-w-0">
                     <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: card.color }}
                     />
                     <p className="font-medium truncate">{card.name}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                     Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                  </p>
                  <div className="flex items-center gap-2">
                     <Button onClick={() => handleEdit(card)} size="sm" variant="outline">
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(card)}
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

   return (
      <>
         <DataTable
            columns={columns}
            data={cards}
            enableRowSelection
            getRowId={(row) => row.id}
            onRowSelectionChange={onRowSelectionChange}
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="flex items-center gap-2 min-w-0">
                     <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: row.original.color }}
                     />
                     <p className="font-medium truncate">{row.original.name}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                     Fecha dia {row.original.closingDay} · Vence dia {row.original.dueDay}
                  </p>
                  <div className="flex items-center gap-2">
                     <Button onClick={() => handleEdit(row.original)} size="sm" variant="outline">
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

function CreditCardsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:credit-cards:view",
      CREDIT_CARD_VIEWS,
   );

   function handleCreate() {
      openCredenza({
         children: <CreditCardForm mode="create" onSuccess={closeCredenza} />,
      });
   }

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Novo Cartão
               </Button>
            }
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <Suspense fallback={<CreditCardsSkeleton />}>
            <CreditCardsList view={currentView} />
         </Suspense>
      </main>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/finance/credit-cards.tsx
git commit -m "feat(routes): add credit cards page"
```

---

### Task 9: Add credit cards to sidebar navigation

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Add CreditCard icon import and nav item**

Add `CreditCard` to the lucide-react import:

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
} from "lucide-react";
```

Add after the `bank-accounts` item in the `finance` group:

```typescript
{
   id: "credit-cards",
   label: "Cartões de Crédito",
   icon: CreditCard,
   route: "/$slug/$teamSlug/finance/credit-cards",
},
```

**Step 2: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git commit -m "feat(nav): add credit cards to sidebar"
```

---

### Task 10: Typecheck

**Step 1: Run typecheck**

```bash
bun run typecheck
```

Fix any TypeScript errors before proceeding. Common issues:

- `bankAccountId` references that assumed non-null (add null checks or `??`)
- Missing `creditCardId` handling in transaction-related queries/forms

**Step 2: Commit fixes if any**

```bash
git add -p
git commit -m "fix(types): resolve typecheck errors after credit cards module"
```
