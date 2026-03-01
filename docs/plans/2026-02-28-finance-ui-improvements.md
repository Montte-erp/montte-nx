# Finance UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the finance module with DB schema additions, improved form components (date picker, money input, color picker, icon picker), credenza modals, quick-start task modals, and free-tier switcher hiding.

**Architecture:** DB-first — schema changes flow upward through repositories → routers → UI. New components (SwatchColorPicker, MoneyInput) are created in `apps/web/src/components/` and reused across feature sheets. All create/edit forms switch from sheet (`openSheet`) to modal (`openCredenza`) with Credenza header/body/footer structure.

**Tech Stack:** Drizzle ORM (schema/repos), oRPC (routers), React (UI), TanStack Query (mutations), Radix+Tailwind (components), date-fns / DatePicker from `@packages/ui/components/date-picker`, Lucide icons

---

## Task 1: DB Schema — Add Fields to Categories and Transactions

**Files:**
- Modify: `packages/database/src/schemas/categories.ts`
- Modify: `packages/database/src/schemas/transactions.ts`

**Step 1: Add color, icon, type columns to categories schema**

In `packages/database/src/schemas/categories.ts`, replace the current `categories` table definition:

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
   "categories",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      isDefault: boolean("is_default").notNull().default(false),
      color: text("color"),
      icon: text("icon"),
      type: text("type"), // "income" | "expense" | null (null = both)
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("categories_team_id_idx").on(table.teamId),
      uniqueIndex("categories_team_id_name_unique").on(
         table.teamId,
         table.name,
      ),
   ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
```

**Step 2: Add name column to transactions schema**

In `packages/database/src/schemas/transactions.ts`, add `name: text("name"),` after the `teamId` field (before `type`):

```typescript
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
   teamId: uuid("team_id").notNull(),
   name: text("name"),  // ← ADD THIS
   type: transactionTypeEnum("type").notNull(),
   // ... rest unchanged
```

**Step 3: Push schema to database**

```bash
bun run db:push
```

Expected: schema pushed successfully, no data loss (new columns are nullable).

**Step 4: Commit**

```bash
git add packages/database/src/schemas/categories.ts packages/database/src/schemas/transactions.ts
git commit -m "feat(db): add color/icon/type to categories, name to transactions"
```

---

## Task 2: Update Repositories

**Files:**
- Modify: `packages/database/src/repositories/categories-repository.ts`
- Modify: `packages/database/src/repositories/transactions-repository.ts`

**Step 1: categories-repository — pass through new fields**

The `createCategory`, `updateCategory` functions already use `NewCategory` type which will now include `color`, `icon`, `type` via Drizzle inference — no code changes needed for basic pass-through.

But update `seedDefaultCategories` to be explicit (it only passes `name` and `isDefault`, which is fine — new fields default to null).

No code changes needed in the repository — Drizzle's `NewCategory` type automatically picks up the new columns as optional fields.

**Step 2: transactions-repository — verify name flows through**

Open `packages/database/src/repositories/transactions-repository.ts`. The `createTransaction` and `updateTransaction` functions accept `NewTransaction` / `Partial<NewTransaction>` which will include `name` automatically. No code changes needed.

**Step 3: Commit**

```bash
git commit -m "chore: verify repositories pass through new fields (no changes needed)"
```

> **Note:** If typecheck fails after schema changes, run `bun run typecheck` and fix any TS errors in repos.

---

## Task 3: Update oRPC Routers

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/categories.ts`
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Step 1: Update categories router**

Replace the schema and update/create procedures in `categories.ts`:

```typescript
import { ORPCError } from "@orpc/server";
import {
   categoryHasTransactions,
   createCategory,
   deleteCategory,
   getCategory,
   listCategories,
   updateCategory,
} from "@packages/database/repositories/categories-repository";
import { categories } from "@packages/database/schemas/categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const categorySchema = createInsertSchema(categories)
   .pick({ name: true })
   .extend({
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
      icon: z.string().max(50).nullable().optional(),
      type: z.enum(["income", "expense"]).nullable().optional(),
   });

export const create = protectedProcedure
   .input(categorySchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createCategory(db, {
         teamId,
         name: input.name,
         isDefault: false,
         color: input.color ?? null,
         icon: input.icon ?? null,
         type: input.type ?? null,
      });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listCategories(db, teamId);
});

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(categorySchema))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Categoria não encontrada." });
      }
      if (category.isDefault) {
         throw new ORPCError("BAD_REQUEST", { message: "Categorias padrão não podem ser editadas." });
      }
      return updateCategory(db, input.id, {
         name: input.name,
         color: input.color ?? null,
         icon: input.icon ?? null,
         type: input.type ?? null,
      });
   });

// remove procedure unchanged — copy from existing file
```

**Step 2: Update transactions router — add name field**

In `apps/web/src/integrations/orpc/router/transactions.ts`, update `transactionSchema`:

```typescript
const transactionSchema = createInsertSchema(transactions)
   .pick({
      type: true,
      amount: true,
      description: true,
      date: true,
      bankAccountId: true,
      destinationBankAccountId: true,
      categoryId: true,
      subcategoryId: true,
      attachmentUrl: true,
   })
   .extend({
      name: z.string().max(200).nullable().optional(),  // ← ADD THIS
      amount: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
            message: "Valor deve ser maior que zero.",
         }),
      tagIds: z.array(z.string().uuid()).optional().default([]),
   });
```

No other changes needed — `name` will flow through `createTransaction`/`updateTransaction` via the spread.

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/categories.ts apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(api): add color/icon/type to categories router, name to transactions router"
```

---

## Task 4: Create SwatchColorPicker Component

**Files:**
- Create: `apps/web/src/components/swatch-color-picker.tsx`

**Step 1: Create the component**

```tsx
// apps/web/src/components/swatch-color-picker.tsx
import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { useCallback, useState } from "react";

const PRESET_COLORS = [
   "#ef4444", "#f97316", "#f59e0b", "#eab308",
   "#84cc16", "#22c55e", "#10b981", "#14b8a6",
   "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
   "#a855f7", "#ec4899", "#f43f5e", "#64748b",
];

interface SwatchColorPickerProps {
   value: string;
   onChange: (color: string) => void;
}

export function SwatchColorPicker({ value, onChange }: SwatchColorPickerProps) {
   const [hexInput, setHexInput] = useState(value);

   const handleSwatchClick = useCallback(
      (color: string) => {
         setHexInput(color);
         onChange(color);
      },
      [onChange],
   );

   const handleHexChange = useCallback(
      (raw: string) => {
         setHexInput(raw);
         if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
            onChange(raw);
         }
      },
      [onChange],
   );

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map((color) => (
               <button
                  className={cn(
                     "size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                     value === color
                        ? "border-foreground scale-110"
                        : "border-transparent",
                  )}
                  key={color}
                  onClick={() => handleSwatchClick(color)}
                  style={{ backgroundColor: color }}
                  title={color}
                  type="button"
               />
            ))}
         </div>
         <div className="flex items-center gap-2">
            <span
               className="size-7 rounded-full border shrink-0"
               style={{ backgroundColor: value }}
            />
            <Input
               className="font-mono"
               maxLength={7}
               onChange={(e) => handleHexChange(e.target.value)}
               placeholder="#6366f1"
               value={hexInput}
            />
         </div>
      </div>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/swatch-color-picker.tsx
git commit -m "feat(ui): add SwatchColorPicker component"
```

---

## Task 5: Create MoneyInput Component

**Files:**
- Create: `apps/web/src/components/money-input.tsx`

**Step 1: Create the component**

```tsx
// apps/web/src/components/money-input.tsx
import { Input } from "@packages/ui/components/input";
import { useCallback, useRef } from "react";

interface MoneyInputProps {
   value: string; // stored as decimal string "1234.56"
   onChange: (value: string) => void;
   placeholder?: string;
   disabled?: boolean;
   id?: string;
}

/**
 * Formats a raw decimal string to BRL display string.
 * "1234.56" → "1.234,56"
 */
function formatBRL(raw: string): string {
   const num = Number(raw);
   if (Number.isNaN(num)) return raw;
   return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
   }).format(num);
}

/**
 * Strips BRL formatting to raw decimal string.
 * "1.234,56" → "1234.56"
 */
function parseBRL(formatted: string): string {
   // Remove thousand separators (.), replace comma with dot
   return formatted.replace(/\./g, "").replace(",", ".");
}

export function MoneyInput({
   value,
   onChange,
   placeholder = "0,00",
   disabled,
   id,
}: MoneyInputProps) {
   const inputRef = useRef<HTMLInputElement>(null);

   const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
         const raw = e.target.value;
         // Allow only digits and comma/dot separators
         const cleaned = raw.replace(/[^\d.,]/g, "");
         const decimal = parseBRL(cleaned);
         onChange(decimal);
      },
      [onChange],
   );

   const handleBlur = useCallback(() => {
      if (value && !Number.isNaN(Number(value))) {
         // Format on blur
         if (inputRef.current) {
            inputRef.current.value = formatBRL(value);
         }
      }
   }, [value]);

   const handleFocus = useCallback(() => {
      // Show raw value on focus for editing
      if (inputRef.current && value) {
         inputRef.current.value = value;
      }
   }, [value]);

   const displayValue = document.activeElement === inputRef.current
      ? value
      : value
      ? formatBRL(value)
      : "";

   return (
      <div className="relative">
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            R$
         </span>
         <Input
            className="pl-9"
            disabled={disabled}
            id={id}
            inputMode="decimal"
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            ref={inputRef}
            value={displayValue}
         />
      </div>
   );
}
```

> **Note:** The `displayValue` computation with `document.activeElement` check is a client-side-only pattern. This is fine since the forms only render in the browser.

**Step 2: Commit**

```bash
git add apps/web/src/components/money-input.tsx
git commit -m "feat(ui): add MoneyInput BRL currency component"
```

---

## Task 6: Update TransactionSheet → Credenza Form

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-sheet.tsx`

**Step 1: Rewrite the file**

Replace the entire file with the following (key changes: CredenzaHeader/Body/Footer, DatePicker, MoneyInput, name field, transfer label):

```tsx
import { MoneyInput } from "@/components/money-input";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";

type TransactionType = "income" | "expense" | "transfer";

interface TransactionFormProps {
   mode: "create" | "edit";
   transaction?: TransactionRow;
   onSuccess: () => void;
}

interface TagCheckboxListProps {
   selectedTagIds: string[];
   onToggle: (tagId: string) => void;
}

function TagCheckboxList({ selectedTagIds, onToggle }: TagCheckboxListProps) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   if (tags.length === 0) {
      return <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>;
   }

   return (
      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
         {tags.map((tag) => {
            const checked = selectedTagIds.includes(tag.id);
            return (
               <label key={tag.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(tag.id)} />
                  {tag.color ? (
                     <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  ) : null}
                  <span className="text-sm">{tag.name}</span>
               </label>
            );
         })}
      </div>
   );
}

function TransactionFormContent({ mode, transaction, onSuccess }: TransactionFormProps) {
   const isCreate = mode === "create";

   const { data: bankAccounts } = useSuspenseQuery(orpc.bankAccounts.getAll.queryOptions({}));
   const { data: categories } = useSuspenseQuery(orpc.categories.getAll.queryOptions({}));

   const [type, setType] = useState<TransactionType>(transaction?.type ?? "income");
   const [name, setName] = useState(transaction?.name ?? "");
   const [amount, setAmount] = useState(transaction?.amount ?? "");
   const [date, setDate] = useState<Date | undefined>(
      transaction?.date ? new Date(`${transaction.date}T12:00:00`) : undefined,
   );
   const [bankAccountId, setBankAccountId] = useState(transaction?.bankAccountId ?? "");
   const [destinationBankAccountId, setDestinationBankAccountId] = useState(
      transaction?.destinationBankAccountId ?? "",
   );
   const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
   const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategoryId ?? "");
   const [tagIds, setTagIds] = useState<string[]>(transaction?.tagIds ?? []);
   const [description, setDescription] = useState(transaction?.description ?? "");

   const selectedCategory = categories.find((c) => c.id === categoryId);
   const subcategoryOptions = selectedCategory?.subcategories ?? [];

   const handleCategoryChange = useCallback((value: string) => {
      setCategoryId(value);
      setSubcategoryId("");
   }, []);

   const handleTagToggle = useCallback((tagId: string) => {
      setTagIds((prev) =>
         prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
      );
   }, []);

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => { toast.success("Transação criada com sucesso."); onSuccess(); },
         onError: (error) => { toast.error(error.message || "Erro ao criar transação."); },
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onSuccess: () => { toast.success("Transação atualizada com sucesso."); onSuccess(); },
         onError: (error) => { toast.error(error.message || "Erro ao atualizar transação."); },
      }),
   );

   const isPending = createMutation.isPending || updateMutation.isPending;

   const dateStr = date ? date.toISOString().split("T")[0] : "";

   const isValid =
      type.length > 0 &&
      amount.length > 0 &&
      Number(amount) > 0 &&
      dateStr.length > 0 &&
      bankAccountId.length > 0 &&
      (type !== "transfer" || destinationBankAccountId.length > 0);

   const handleSubmit = useCallback(() => {
      if (!isValid) return;

      const payload = {
         type,
         name: name.trim() || null,
         amount,
         date: dateStr,
         bankAccountId,
         destinationBankAccountId: type === "transfer" ? destinationBankAccountId : null,
         categoryId: categoryId || null,
         subcategoryId: subcategoryId || null,
         attachmentUrl: null as string | null,
         tagIds,
         description: description || null,
      };

      if (isCreate) {
         createMutation.mutate(payload);
      } else if (transaction) {
         updateMutation.mutate({ id: transaction.id, ...payload });
      }
   }, [isValid, isCreate, type, name, amount, dateStr, bankAccountId, destinationBankAccountId, categoryId, subcategoryId, tagIds, description, createMutation, updateMutation, transaction]);

   const accountLabel = type === "transfer" ? "Conta de Origem" : "Conta";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{isCreate ? "Nova Transação" : "Editar Transação"}</CredenzaTitle>
            <CredenzaDescription>
               {isCreate ? "Registre uma nova transação financeira." : "Atualize os dados da transação."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            {/* Nome */}
            <div className="space-y-2">
               <Label htmlFor="transaction-name">Nome</Label>
               <Input
                  id="transaction-name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Almoço, Salário"
                  value={name}
               />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
               <Label htmlFor="transaction-type">Tipo</Label>
               <Select onValueChange={(v) => setType(v as TransactionType)} value={type}>
                  <SelectTrigger id="transaction-type">
                     <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="income">Receita</SelectItem>
                     <SelectItem value="expense">Despesa</SelectItem>
                     <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {/* Valor */}
            <div className="space-y-2">
               <Label htmlFor="transaction-amount">Valor</Label>
               <MoneyInput
                  disabled={isPending}
                  id="transaction-amount"
                  onChange={setAmount}
                  value={amount}
               />
            </div>

            {/* Data */}
            <div className="space-y-2">
               <Label>Data</Label>
               <DatePicker
                  className="w-full"
                  date={date}
                  onSelect={setDate}
                  placeholder="Selecione a data"
               />
            </div>

            {/* Conta (Origem) */}
            <div className="space-y-2">
               <Label htmlFor="transaction-account">{accountLabel}</Label>
               <Select onValueChange={setBankAccountId} value={bankAccountId}>
                  <SelectTrigger id="transaction-account">
                     <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                     {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Conta de Destino (transfer only) */}
            {type === "transfer" && (
               <div className="space-y-2">
                  <Label htmlFor="transaction-dest-account">Conta de Destino</Label>
                  <Select onValueChange={setDestinationBankAccountId} value={destinationBankAccountId}>
                     <SelectTrigger id="transaction-dest-account">
                        <SelectValue placeholder="Selecione a conta de destino" />
                     </SelectTrigger>
                     <SelectContent>
                        {bankAccounts.map((account) => (
                           <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            )}

            {/* Categoria */}
            <div className="space-y-2">
               <Label htmlFor="transaction-category">Categoria</Label>
               <Select onValueChange={handleCategoryChange} value={categoryId}>
                  <SelectTrigger id="transaction-category">
                     <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                     {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Subcategoria */}
            {categoryId && subcategoryOptions.length > 0 && (
               <div className="space-y-2">
                  <Label htmlFor="transaction-subcategory">Subcategoria</Label>
                  <Select onValueChange={setSubcategoryId} value={subcategoryId}>
                     <SelectTrigger id="transaction-subcategory">
                        <SelectValue placeholder="Selecione a subcategoria" />
                     </SelectTrigger>
                     <SelectContent>
                        {subcategoryOptions.map((sub) => (
                           <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
               <Label>Tags</Label>
               <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando tags...</p>}>
                  <TagCheckboxList selectedTagIds={tagIds} onToggle={handleTagToggle} />
               </Suspense>
            </div>

            {/* Observações */}
            <div className="space-y-2">
               <Label htmlFor="transaction-description">Observações</Label>
               <Textarea
                  id="transaction-description"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observações sobre a transação (opcional)"
                  rows={3}
                  value={description}
               />
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button className="w-full" disabled={!isValid || isPending} onClick={handleSubmit}>
               {isPending ? <Spinner className="size-4 mr-2" /> : null}
               {isCreate ? "Criar transação" : "Salvar alterações"}
            </Button>
         </CredenzaFooter>
      </>
   );
}

export function TransactionSheet({ mode, transaction, onSuccess }: TransactionFormProps) {
   return (
      <Suspense
         fallback={
            <>
               <CredenzaHeader>
                  <CredenzaTitle>{mode === "create" ? "Nova Transação" : "Editar Transação"}</CredenzaTitle>
               </CredenzaHeader>
               <CredenzaBody className="flex items-center justify-center py-8">
                  <Spinner className="size-6" />
               </CredenzaBody>
            </>
         }
      >
         <TransactionFormContent mode={mode} transaction={transaction} onSuccess={onSuccess} />
      </Suspense>
   );
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/features/transactions/ui/transactions-sheet.tsx
git commit -m "feat(transactions): use credenza, date picker, money input, name field, transfer labels"
```

---

## Task 7: Update TransactionColumns

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-columns.tsx`

**Step 1: Add `name` to TransactionRow type and update columns**

Replace the entire file:

```tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type TransactionRow = {
   id: string;
   teamId: string;
   type: "income" | "expense" | "transfer";
   name: string | null;
   amount: string;
   description: string | null;
   date: string;
   bankAccountId: string;
   destinationBankAccountId: string | null;
   categoryId: string | null;
   subcategoryId: string | null;
   attachmentUrl: string | null;
   tagIds?: string[];
   createdAt: Date | string;
   updatedAt: Date | string;
};

function formatBRL(value: string | number): string {
   const num = typeof value === "string" ? Number(value) : value;
   return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function formatDate(dateStr: string): string {
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

export function buildTransactionColumns(
   onEdit: (transaction: TransactionRow) => void,
   onDelete: (transaction: TransactionRow) => void,
): ColumnDef<TransactionRow>[] {
   return [
      {
         accessorKey: "date",
         header: "Data",
         cell: ({ row }) => (
            <span className="text-sm tabular-nums">{formatDate(row.original.date)}</span>
         ),
      },
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name, description } = row.original;
            const label = name || description;
            if (!label) return <span className="text-sm text-muted-foreground">—</span>;
            return <span className="text-sm font-medium truncate max-w-[200px] block">{label}</span>;
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income") return <Badge variant="outline" className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500">Receita</Badge>;
            if (type === "expense") return <Badge variant="destructive">Despesa</Badge>;
            return <Badge variant="secondary">Transferência</Badge>;
         },
      },
      {
         accessorKey: "amount",
         header: "Valor",
         cell: ({ row }) => {
            const { type, amount } = row.original;
            if (type === "income") return <span className="text-sm font-medium text-green-600 dark:text-green-500">{formatBRL(amount)}</span>;
            if (type === "expense") return <span className="text-sm font-medium text-destructive">- {formatBRL(amount)}</span>;
            return <span className="text-sm font-medium text-muted-foreground">{formatBRL(amount)}</span>;
         },
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
               <Button onClick={() => onEdit(row.original)} size="icon" variant="ghost">
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
git add apps/web/src/features/transactions/ui/transactions-columns.tsx
git commit -m "feat(transactions): add name column, move delete to actions column"
```

---

## Task 8: Update Transactions Page (Credenza + DatePicker Filters + Remove Sub-rows)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx`

**Step 1: Update the page**

Key changes:
1. Use `openCredenza` instead of `openSheet`
2. Import `DatePicker` for filter bar
3. Remove `renderSubComponent` from DataTable
4. Simplify `renderMobileCard` (remove expand buttons)

Replace the imports section and update affected sections:

```tsx
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@packages/ui/components/empty";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Label } from "@packages/ui/components/label";
import {
   Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
   type TransactionRow,
   buildTransactionColumns,
} from "@/features/transactions/ui/transactions-columns";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
```

FilterBar — replace both date inputs with DatePicker:

```tsx
function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
   const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T12:00:00`) : undefined;
   const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T12:00:00`) : undefined;

   return (
      <div className="flex flex-wrap items-end gap-3">
         <div className="space-y-1 min-w-[160px]">
            <Label htmlFor="filter-type">Tipo</Label>
            <Select
               onValueChange={(v) =>
                  onFiltersChange({
                     ...filters,
                     type: v === "all" ? undefined : (v as TransactionFilters["type"]),
                  })
               }
               value={filters.type ?? "all"}
            >
               <SelectTrigger id="filter-type" className="h-8 text-sm">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
               </SelectContent>
            </Select>
         </div>

         <div className="space-y-1">
            <Label>De</Label>
            <DatePicker
               className="h-8 text-sm w-[160px]"
               date={dateFrom}
               onSelect={(d) =>
                  onFiltersChange({
                     ...filters,
                     dateFrom: d ? d.toISOString().split("T")[0] : undefined,
                  })
               }
               placeholder="Data inicial"
            />
         </div>

         <div className="space-y-1">
            <Label>Até</Label>
            <DatePicker
               className="h-8 text-sm w-[160px]"
               date={dateTo}
               onSelect={(d) =>
                  onFiltersChange({
                     ...filters,
                     dateTo: d ? d.toISOString().split("T")[0] : undefined,
                  })
               }
               placeholder="Data final"
            />
         </div>

         {(filters.type || filters.dateFrom || filters.dateTo) && (
            <Button className="h-8 text-sm" onClick={() => onFiltersChange({})} size="sm" variant="ghost">
               Limpar filtros
            </Button>
         )}
      </div>
   );
}
```

TransactionsList — use credenza, remove renderSubComponent:

```tsx
function TransactionsList({ filters }: TransactionsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: transactions } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({ input: filters }),
   );

   const deleteMutation = useMutation(
      orpc.transactions.remove.mutationOptions({
         onSuccess: () => { toast.success("Transação excluída com sucesso."); },
         onError: (error) => { toast.error(error.message || "Erro ao excluir transação."); },
      }),
   );

   const handleEdit = useCallback(
      (transaction: TransactionRow) => {
         openCredenza({
            children: (
               <TransactionSheet
                  mode="edit"
                  transaction={transaction}
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (transaction: TransactionRow) => {
         openAlertDialog({
            title: "Excluir transação",
            description: "Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: transaction.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () => buildTransactionColumns(handleEdit, handleDelete),
      [handleEdit, handleDelete],
   );

   if (transactions.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon"><ArrowLeftRight className="size-6" /></EmptyMedia>
               <EmptyTitle>Nenhuma transação</EmptyTitle>
               <EmptyDescription>Registre uma nova transação para começar a controlar suas finanças.</EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={transactions}
         getRowId={(row) => row.id}
         renderMobileCard={({ row }) => (
            <div className="rounded-lg border bg-background p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                     <p className="text-sm font-medium tabular-nums">
                        {row.original.date.split("-").reverse().join("/")}
                     </p>
                     {(row.original.name || row.original.description) && (
                        <p className="text-xs text-muted-foreground truncate">
                           {row.original.name || row.original.description}
                        </p>
                     )}
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Button onClick={() => handleEdit(row.original)} size="sm" variant="outline">Editar</Button>
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
      />
   );
}
```

TransactionsPage — use credenza:

```tsx
function TransactionsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const [filters, setFilters] = useState<TransactionFilters>({});

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <PageHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Transação
               </Button>
            }
            description="Gerencie suas receitas, despesas e transferências"
            title="Transações"
         />
         <FilterBar filters={filters} onFiltersChange={setFilters} />
         <Suspense fallback={<TransactionsSkeleton />}>
            <TransactionsList filters={filters} />
         </Suspense>
      </main>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx
git commit -m "feat(transactions): use credenza, date picker filters, remove expandable rows"
```

---

## Task 9: Update CategorySheet → Credenza Form with Color/Icon/Type

**Files:**
- Modify: `apps/web/src/features/categories/ui/categories-sheet.tsx`

**Step 1: Define preset icons**

At the top of the file, define a preset icon set:

```tsx
import {
   Baby, BookOpen, Briefcase, Car, Coffee, CreditCard,
   Dumbbell, Fuel, Gift, Heart, Home, Music,
   Package, Plane, ShoppingCart, Smartphone, Utensils, Wallet, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: { name: string; Icon: LucideIcon }[] = [
   { name: "wallet", Icon: Wallet },
   { name: "credit-card", Icon: CreditCard },
   { name: "home", Icon: Home },
   { name: "car", Icon: Car },
   { name: "shopping-cart", Icon: ShoppingCart },
   { name: "utensils", Icon: Utensils },
   { name: "plane", Icon: Plane },
   { name: "heart", Icon: Heart },
   { name: "book-open", Icon: BookOpen },
   { name: "briefcase", Icon: Briefcase },
   { name: "package", Icon: Package },
   { name: "music", Icon: Music },
   { name: "coffee", Icon: Coffee },
   { name: "smartphone", Icon: Smartphone },
   { name: "dumbbell", Icon: Dumbbell },
   { name: "baby", Icon: Baby },
   { name: "gift", Icon: Gift },
   { name: "zap", Icon: Zap },
   { name: "fuel", Icon: Fuel },
];
```

**Step 2: Rewrite the CategorySheet**

```tsx
import { SwatchColorPicker } from "@/components/swatch-color-picker";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
// ... CATEGORY_ICONS definition from Step 1

interface CategoryFormProps {
   mode: "create" | "edit";
   category?: {
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      type?: string | null;
   };
   onSuccess: () => void;
}

export function CategorySheet({ mode, category, onSuccess }: CategoryFormProps) {
   const [name, setName] = useState(category?.name ?? "");
   const [color, setColor] = useState(category?.color ?? "#6366f1");
   const [icon, setIcon] = useState(category?.icon ?? "");
   const [categoryType, setCategoryType] = useState<"income" | "expense" | "">(
      (category?.type as "income" | "expense") ?? "",
   );

   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => { toast.success("Categoria criada com sucesso."); onSuccess(); },
         onError: (error) => { toast.error(error.message || "Erro ao criar categoria."); },
      }),
   );

   const updateMutation = useMutation(
      orpc.categories.update.mutationOptions({
         onSuccess: () => { toast.success("Categoria atualizada com sucesso."); onSuccess(); },
         onError: (error) => { toast.error(error.message || "Erro ao atualizar categoria."); },
      }),
   );

   const isPending = createMutation.isPending || updateMutation.isPending;
   const isValid = name.trim().length > 0;
   const isCreate = mode === "create";

   const handleSubmit = useCallback(() => {
      if (!isValid) return;

      const payload = {
         name: name.trim(),
         color: color || null,
         icon: icon || null,
         type: (categoryType || null) as "income" | "expense" | null | undefined,
      };

      if (mode === "create") {
         createMutation.mutate(payload);
      } else if (category) {
         updateMutation.mutate({ id: category.id, ...payload });
      }
   }, [isValid, mode, name, color, icon, categoryType, category, createMutation, updateMutation]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{isCreate ? "Nova Categoria" : "Editar Categoria"}</CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione uma nova categoria para organizar suas transações."
                  : "Atualize as informações da categoria."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            {/* Nome */}
            <div className="space-y-2">
               <Label htmlFor="category-name">Nome</Label>
               <Input
                  id="category-name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Alimentação, Transporte"
                  value={name}
               />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
               <Label htmlFor="category-type">Tipo</Label>
               <Select
                  onValueChange={(v) => setCategoryType(v as "income" | "expense" | "")}
                  value={categoryType}
               >
                  <SelectTrigger id="category-type">
                     <SelectValue placeholder="Sem restrição" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="">Sem restrição</SelectItem>
                     <SelectItem value="income">Receita</SelectItem>
                     <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {/* Ícone */}
            <div className="space-y-2">
               <Label>Ícone</Label>
               <div className="grid grid-cols-10 gap-1.5">
                  {CATEGORY_ICONS.map(({ name: iconName, Icon }) => (
                     <button
                        className={cn(
                           "flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent",
                           icon === iconName && "border-primary bg-accent",
                        )}
                        key={iconName}
                        onClick={() => setIcon(icon === iconName ? "" : iconName)}
                        title={iconName}
                        type="button"
                     >
                        <Icon className="size-4" />
                     </button>
                  ))}
               </div>
            </div>

            {/* Cor */}
            <div className="space-y-2">
               <Label>Cor</Label>
               <SwatchColorPicker onChange={setColor} value={color} />
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button className="w-full" disabled={!isValid || isPending} onClick={handleSubmit}>
               {isPending ? <Spinner className="size-4 mr-2" /> : null}
               {isCreate ? "Criar categoria" : "Salvar alterações"}
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/categories/ui/categories-sheet.tsx
git commit -m "feat(categories): add color/icon/type fields, use credenza, icon picker"
```

---

## Task 10: Update CategoryColumns

**Files:**
- Modify: `apps/web/src/features/categories/ui/categories-columns.tsx`

**Step 1: Update CategoryRow type and add icon/color/type display**

Add `color`, `icon`, `type` to `CategoryRow`, show color dot + icon in name cell, type badge, and delete button in actions:

```tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Baby, BookOpen, Briefcase, Car, Coffee, CreditCard,
   Dumbbell, Fuel, Gift, Heart, Home, Music,
   Package, Plane, ShoppingCart, Smartphone, Utensils, Wallet, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pencil, Trash2 } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
   wallet: Wallet, "credit-card": CreditCard, home: Home, car: Car,
   "shopping-cart": ShoppingCart, utensils: Utensils, plane: Plane,
   heart: Heart, "book-open": BookOpen, briefcase: Briefcase,
   package: Package, music: Music, coffee: Coffee, smartphone: Smartphone,
   dumbbell: Dumbbell, baby: Baby, gift: Gift, zap: Zap, fuel: Fuel,
};

export type CategoryRow = {
   id: string;
   name: string;
   isDefault: boolean;
   color: string | null;
   icon: string | null;
   type: string | null;
   subcategories: { id: string; name: string }[];
};

export function buildCategoryColumns(
   onEdit: (category: CategoryRow) => void,
   onDelete: (category: CategoryRow) => void,
): ColumnDef<CategoryRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name, color, icon, isDefault } = row.original;
            const IconComponent = icon ? ICON_MAP[icon] : null;
            return (
               <div className="flex items-center gap-2 min-w-0">
                  {color || IconComponent ? (
                     <span
                        className="size-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color ?? "#6366f1" }}
                     >
                        {IconComponent && <IconComponent className="size-3.5 text-white" />}
                     </span>
                  ) : null}
                  <span className="font-medium truncate">{name}</span>
                  {isDefault && <Badge variant="outline">Padrão</Badge>}
               </div>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income") return <Badge variant="outline" className="border-green-600 text-green-600">Receita</Badge>;
            if (type === "expense") return <Badge variant="destructive">Despesa</Badge>;
            return <span className="text-sm text-muted-foreground">—</span>;
         },
      },
      {
         id: "subcategories",
         header: "Subcategorias",
         cell: ({ row }) => {
            const subs = row.original.subcategories;
            if (subs.length === 0) return <span className="text-sm text-muted-foreground">Nenhuma</span>;
            return <span className="text-sm text-muted-foreground">{subs.map((s) => s.name).join(", ")}</span>;
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => {
            if (row.original.isDefault) return null;
            return (
               // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
               <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
               >
                  <Button onClick={() => onEdit(row.original)} size="icon" variant="ghost">
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
            );
         },
      },
   ];
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/categories/ui/categories-columns.tsx
git commit -m "feat(categories): show icon/color/type in columns, delete in actions"
```

---

## Task 11: Update Categories Page (Credenza + Remove Sub-rows)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx`

**Step 1: Update the page**

Key changes: use `openCredenza`, pass `color`/`icon`/`type` to `CategorySheet`, remove `renderSubComponent`:

```tsx
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
   type CategoryRow,
   buildCategoryColumns,
} from "@/features/categories/ui/categories-columns";
import { CategorySheet } from "@/features/categories/ui/categories-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/categories",
)({ component: CategoriesPage });

function CategoriesSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

function CategoriesList() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: categories } = useSuspenseQuery(orpc.categories.getAll.queryOptions({}));

   const deleteMutation = useMutation(
      orpc.categories.remove.mutationOptions({
         onSuccess: () => { toast.success("Categoria excluída com sucesso."); },
         onError: (error) => { toast.error(error.message || "Erro ao excluir categoria."); },
      }),
   );

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         openCredenza({
            children: (
               <CategorySheet
                  category={{
                     id: category.id,
                     name: category.name,
                     color: category.color,
                     icon: category.icon,
                     type: category.type,
                  }}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Excluir categoria",
            description: `Tem certeza que deseja excluir a categoria "${category.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: category.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = buildCategoryColumns(handleEdit, handleDelete);

   if (categories.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon"><FolderOpen className="size-6" /></EmptyMedia>
               <EmptyTitle>Nenhuma categoria</EmptyTitle>
               <EmptyDescription>Adicione uma categoria para organizar suas transações.</EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={categories}
         getRowId={(row) => row.id}
         renderMobileCard={({ row }) => (
            <div className="rounded-lg border bg-background p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                     {row.original.color && (
                        <span
                           className="size-4 rounded-full shrink-0"
                           style={{ backgroundColor: row.original.color }}
                        />
                     )}
                     <p className="font-medium truncate">{row.original.name}</p>
                  </div>
               </div>
               {!row.original.isDefault && (
                  <div className="flex items-center gap-2">
                     <Button onClick={() => handleEdit(row.original)} size="sm" variant="outline">Editar</Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        size="sm"
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               )}
            </div>
         )}
      />
   );
}

function CategoriesPage() {
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <CategorySheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <PageHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Categoria
               </Button>
            }
            description="Gerencie as categorias das suas transações"
            title="Categorias"
         />
         <Suspense fallback={<CategoriesSkeleton />}>
            <CategoriesList />
         </Suspense>
      </main>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx
git commit -m "feat(categories): use credenza, remove expandable rows"
```

---

## Task 12: Update Tags Sheet with SwatchColorPicker

**Files:**
- Modify: `apps/web/src/features/tags/ui/tags-sheet.tsx`

**Step 1: Replace native color input with SwatchColorPicker**

Replace the "Cor" section. Import `SwatchColorPicker` and remove `colorHex` state + `handleColorHexChange`. The color state simplifies to just `color`:

```tsx
import { SwatchColorPicker } from "@/components/swatch-color-picker";
// Remove: import { Input } from "@packages/ui/components/input"; (still needed for Name field)

// Remove state:
// const [colorHex, setColorHex] = useState(tag?.color ?? "#6366f1");
// Remove handleColorPickerChange and handleColorHexChange
// Simplify to:
const [color, setColor] = useState(tag?.color ?? "#6366f1");

// Replace the "Cor" section div with:
<div className="space-y-2 px-1">
   <Label>Cor</Label>
   <SwatchColorPicker onChange={setColor} value={color} />
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/features/tags/ui/tags-sheet.tsx
git commit -m "feat(tags): use SwatchColorPicker"
```

---

## Task 13: Update BankAccount Sheet with SwatchColorPicker

**Files:**
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-sheet.tsx`

**Step 1: Replace native color input with SwatchColorPicker**

Same pattern as tags-sheet. Remove `colorHex` state and both handlers. Import and use `SwatchColorPicker`:

```tsx
import { SwatchColorPicker } from "@/components/swatch-color-picker";

// Simplify color state:
const [color, setColor] = useState(account?.color ?? "#6366f1");

// Replace the Cor section:
<div className="space-y-2 px-1">
   <Label>Cor</Label>
   <SwatchColorPicker onChange={setColor} value={color} />
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bank-accounts/ui/bank-accounts-sheet.tsx
git commit -m "feat(bank-accounts): use SwatchColorPicker"
```

---

## Task 14: Update QuickStartTask — Open Modals Instead of Navigating

**Files:**
- Modify: `apps/web/src/features/onboarding/ui/quick-start-task.tsx`

**Step 1: Update the component**

Import the form components and hooks. Map task IDs to modal actions:

```tsx
import { Checkbox } from "@packages/ui/components/checkbox";
import { cn } from "@packages/ui/lib/utils";
import { useParams } from "@tanstack/react-router";
import { CheckCircle2, Lock } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import { BankAccountSheet } from "@/features/bank-accounts/ui/bank-accounts-sheet";
import { CategorySheet } from "@/features/categories/ui/categories-sheet";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import type { TaskDefinition } from "../task-definitions";

// Remove: import { useNavigate } from "@tanstack/react-router";

interface QuickStartTaskProps {
   task: TaskDefinition;
   isCompleted: boolean;
   isLocked: boolean;
   isAutoDetected: boolean;
   onComplete: (taskId: string) => void;
}

export function QuickStartTask({
   task,
   isCompleted,
   isLocked,
   isAutoDetected,
   onComplete,
}: QuickStartTaskProps) {
   const { openSheet, closeSheet } = useSheet();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleClick = useCallback(() => {
      if (isLocked || isCompleted) return;

      if (task.id === "connect_bank_account") {
         openSheet({
            children: <BankAccountSheet mode="create" onSuccess={closeSheet} />,
         });
      } else if (task.id === "create_category") {
         openCredenza({
            children: <CategorySheet mode="create" onSuccess={closeCredenza} />,
         });
      } else if (task.id === "add_transaction") {
         openCredenza({
            children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
         });
      }
      // explore tasks don't have an action (they're auto-detected)
   }, [isLocked, isCompleted, task.id, openSheet, closeSheet, openCredenza, closeCredenza]);

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
         }
      },
      [handleClick],
   );

   const handleCheckboxChange = useCallback(
      (checked: boolean | "indeterminate") => {
         if (checked === true && !isCompleted && !isLocked) {
            onComplete(task.id);
         }
      },
      [isCompleted, isLocked, onComplete, task.id],
   );

   return (
      // biome-ignore lint/a11y/useSemanticElements: Div used for flexible layout with conditional interactions
      <div
         aria-disabled={isLocked}
         className={cn(
            "flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors w-full",
            isLocked && "opacity-50 cursor-not-allowed",
            !isLocked && !isCompleted && "hover:bg-accent cursor-pointer",
            isCompleted && "opacity-60",
         )}
         onClick={handleClick}
         onKeyDown={handleKeyDown}
         role="button"
         tabIndex={isLocked ? -1 : 0}
      >
         <div className="mt-0.5 shrink-0">
            {isLocked ? (
               <Lock className="size-4 text-muted-foreground" />
            ) : isCompleted ? (
               <CheckCircle2 className="size-4 text-primary" />
            ) : isAutoDetected ? (
               <div className="size-4 rounded-full border-2 border-muted-foreground/40" />
            ) : (
               <Checkbox
                  checked={isCompleted}
                  onCheckedChange={handleCheckboxChange}
                  onClick={(e) => e.stopPropagation()}
               />
            )}
         </div>

         <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium leading-tight", isCompleted && "line-through text-muted-foreground")}>
               {task.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{task.description}</p>
         </div>
      </div>
   );
}
```

> **Note:** `useParams` is no longer needed since we removed navigation. Remove it from imports.

**Step 2: Commit**

```bash
git add apps/web/src/features/onboarding/ui/quick-start-task.tsx
git commit -m "feat(onboarding): open modals from quick-start tasks instead of navigating"
```

---

## Task 15: Hide Project/Org Switcher for Free Users

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx`

**Step 1: Hide project and org sub-menus when projectLimit === 1**

In `SidebarScopeSwitcherContent`, `projectLimit` is already available from `useActiveOrganization()`.

Add `const isFree = projectLimit === 1;` after the destructuring, then wrap the relevant sections:

```tsx
const { activeOrganization, projectLimit, projectCount } = useActiveOrganization();
// ...
const isFree = projectLimit === 1;
```

In the dropdown content, conditionally render:

**PROJECT section** — hide the sub-menu trigger (keep the label text, "Convidar membros", "Configurações do projeto"):

```tsx
{/* ── PROJECT ── */}
<DropdownMenuLabel className="flex items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
   Projeto
   {!isFree && (
      <button
         className="rounded p-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
         onClick={handleNewProject}
         title="Novo projeto"
         type="button"
      >
         <Plus className="size-3.5" />
      </button>
   )}
</DropdownMenuLabel>

{!isFree && (
   <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
         <span className="truncate font-medium">{activeTeam?.name ?? "Sem projeto"}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-52">
         {teams.map((team, index) => (
            <DropdownMenuItem key={`team-${index + 1}`} onSelect={() => handleTeamSwitch(team)}>
               {team.id === activeTeam?.id ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
               <span className="truncate">{team.name}</span>
            </DropdownMenuItem>
         ))}
         <DropdownMenuSeparator />
         <DropdownMenuItem onSelect={() => handleNewProject()}>
            <Plus className="size-4" />
            <span>
               {projectLimit !== null && projectLimit !== Number.POSITIVE_INFINITY
                  ? `Novo projeto (${projectCount}/${projectLimit})`
                  : "Novo projeto"}
            </span>
         </DropdownMenuItem>
      </DropdownMenuSubContent>
   </DropdownMenuSub>
)}

<DropdownMenuItem asChild>
   <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/organization/members">
      <UserPlus className="size-4" />
      Convidar membros
   </Link>
</DropdownMenuItem>

<DropdownMenuItem asChild>
   <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings/project/general">
      <Settings className="size-4" />
      Configurações do projeto
   </Link>
</DropdownMenuItem>

<DropdownMenuSeparator />

{/* ── ORGANIZATION ── */}
<DropdownMenuLabel className="flex items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
   Organização
   {!isFree && (
      <button
         className="rounded p-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
         onClick={handleNewOrganization}
         title="Nova organização"
         type="button"
      >
         <Plus className="size-3.5" />
      </button>
   )}
</DropdownMenuLabel>

{!isFree && (
   <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
         <OrgAvatar logo={activeOrganization.logo} name={activeOrganization.name} />
         <span className="truncate font-medium">{activeOrganization.name}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-52">
         {organizationList.map((org, index) => (
            <DropdownMenuItem key={`org-${index + 1}`} onSelect={() => handleOrganizationSwitch(org)}>
               {org.id === activeOrganization.id ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
               <OrgAvatar logo={org.logo} name={org.name} size="md" />
               <span className="truncate">{org.name}</span>
               {org.role && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{org.role}</span>}
            </DropdownMenuItem>
         ))}
         <DropdownMenuSeparator />
         <DropdownMenuItem onSelect={() => handleNewOrganization()}>
            <Plus className="size-4" />
            Nova organização
         </DropdownMenuItem>
      </DropdownMenuSubContent>
   </DropdownMenuSub>
)}

{/* rest of org items (billing, settings) stay unchanged */}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx
git commit -m "feat(sidebar): hide project/org switcher sub-menus for free plan users"
```

---

## Final Verification

```bash
bun run typecheck
bun run check
bun dev
```

Check:
1. `/finance/transactions` — "Nova Transação" opens credenza, has name field, date picker, money input, "Conta de Origem" label for transfer
2. `/finance/categories` — "Nova Categoria" opens credenza, has icon grid, color swatches, type select
3. Tags sheet — SwatchColorPicker working
4. Bank accounts sheet — SwatchColorPicker working
5. Quick start checklist — task clicks open modals directly
6. Sidebar switcher (free user, projectLimit=1) — no project/org sub-menus visible
