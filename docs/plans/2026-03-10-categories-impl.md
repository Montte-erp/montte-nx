# Categories Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o módulo de categorias de 2 tabelas (categories + subcategories) para 1 tabela auto-referencial com até 3 níveis, validators drizzle-zod, keywords únicas por team, e campos DRE.

**Architecture:** Tabela `categories` com `parentId` auto-referencial (máx 3 níveis). Type obrigatório com pgEnum (income/expense), herdado do pai nos níveis 2/3, imutável. Validators com `createInsertSchema` do drizzle-orm/zod. Repository singleton como bank-accounts/credit-cards. Testes com PGLite.

**Tech Stack:** Drizzle ORM, drizzle-zod (`createInsertSchema` de `drizzle-orm/zod`), PGLite, Vitest

**Design doc:** `docs/plans/2026-03-10-categories-design.md`

---

## Task 1: Reescrever schema de categorias

**Files:**

- Rewrite: `core/database/src/schemas/categories.ts`

**Step 1: Rewrite the schema**

Replace the entire file with the new auto-referential schema:

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

export const categoryTypeEnum = pgEnum("category_type", ["income", "expense"]);

export const categories = pgTable(
   "categories",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      parentId: uuid("parent_id"),
      level: integer("level").notNull().default(1),
      name: text("name").notNull(),
      description: text("description"),
      type: categoryTypeEnum("type").notNull(),
      isDefault: boolean("is_default").notNull().default(false),
      color: text("color"),
      icon: text("icon"),
      keywords: text("keywords").array(),
      notes: text("notes"),
      isArchived: boolean("is_archived").notNull().default(false),
      participatesDre: boolean("participates_dre").notNull().default(false),
      dreGroupId: text("dre_group_id"),
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
      index("categories_parent_id_idx").on(table.parentId),
      uniqueIndex("categories_team_parent_type_name_unique").on(
         table.teamId,
         table.parentId,
         table.type,
         table.name,
      ),
   ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];

// =============================================================================
// Validators
// =============================================================================

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const descriptionSchema = z
   .string()
   .max(255, "Descrição deve ter no máximo 255 caracteres.")
   .nullable()
   .optional();

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).");

const keywordsSchema = z
   .array(z.string().min(1).max(60))
   .max(20, "Máximo de 20 palavras-chave.")
   .nullable()
   .optional();

const baseCategorySchema = createInsertSchema(categories).pick({
   name: true,
   type: true,
   parentId: true,
   description: true,
   color: true,
   icon: true,
   keywords: true,
   notes: true,
   participatesDre: true,
   dreGroupId: true,
});

export const createCategorySchema = baseCategorySchema
   .extend({
      name: nameSchema,
      type: z.enum(["income", "expense"]),
      parentId: z.string().uuid().nullable().optional(),
      description: descriptionSchema,
      color: colorSchema.nullable().optional(),
      icon: z.string().max(50).nullable().optional(),
      keywords: keywordsSchema,
      notes: z.string().max(500).nullable().optional(),
      participatesDre: z.boolean().default(false),
      dreGroupId: z.string().nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.participatesDre && !data.dreGroupId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dreGroupId"],
            message: "Grupo DRE é obrigatório quando participa da DRE.",
         });
      }
   });

export const updateCategorySchema = baseCategorySchema
   .extend({
      name: nameSchema.optional(),
      description: descriptionSchema,
      color: colorSchema.nullable().optional(),
      icon: z.string().max(50).nullable().optional(),
      keywords: keywordsSchema,
      notes: z.string().max(500).nullable().optional(),
      participatesDre: z.boolean().optional(),
      dreGroupId: z.string().nullable().optional(),
   })
   .omit({ type: true, parentId: true })
   .partial()
   .superRefine((data, ctx) => {
      if (data.participatesDre && !data.dreGroupId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dreGroupId"],
            message: "Grupo DRE é obrigatório quando participa da DRE.",
         });
      }
   });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

**Step 2: Verify no import errors**

Run: `cd core/database && npx vitest run --no-coverage 2>&1 | head -30`
Expected: May have failures from subcategories references, but schema file itself should be valid.

**Step 3: Commit**

```bash
git add core/database/src/schemas/categories.ts
git commit -m "feat(database): rewrite categories schema with auto-referential tree structure"
```

---

## Task 2: Remover subcategories e atualizar referências

**Files:**

- Delete: `core/database/src/schemas/subcategories.ts`
- Delete: `core/database/src/repositories/subcategories-repository.ts`
- Modify: `core/database/src/schema.ts` — remove `subcategories` export
- Modify: `core/database/src/schemas/transactions.ts` — remove `subcategoryId` column and `subcategories` import
- Modify: `core/database/src/schemas/budget-goals.ts` — remove `subcategoryId` column and `subcategories` import
- Modify: `core/database/src/relations.ts` — remove all `subcategories` relations

**Step 1: Delete subcategories files**

Delete `core/database/src/schemas/subcategories.ts` and `core/database/src/repositories/subcategories-repository.ts`.

**Step 2: Remove subcategories export from schema.ts**

In `core/database/src/schema.ts`, remove the line:

```typescript
export * from "./schemas/subcategories";
```

**Step 3: Remove subcategoryId from transactions.ts**

In `core/database/src/schemas/transactions.ts`:

- Remove the `import { subcategories } from "./subcategories";` line
- Remove the `subcategoryId` column:
   ```typescript
   subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
      onDelete: "set null",
   }),
   ```

**Step 4: Remove subcategoryId from budget-goals.ts**

In `core/database/src/schemas/budget-goals.ts`:

- Remove the `import { subcategories } from "./subcategories";` line
- Remove the `subcategoryId` column and its unique index referencing subcategoryId

**Step 5: Update relations.ts**

In `core/database/src/relations.ts`, remove all references to `subcategories`:

- Remove `subcategories: r.many.subcategories()` from `categories` relation
- Remove the entire `subcategories` relation block
- Remove `subcategory: r.one.subcategories(...)` from `budgetGoals`, `transactions`, and any other relation blocks

Add self-referential relations for categories:

```typescript
categories: {
   parent: r.one.categories({
      from: r.categories.parentId,
      to: r.categories.id,
   }),
   children: r.many.categories(),
},
```

**Step 6: Remove subcategories import from old categories-repository.ts**

In `core/database/src/repositories/categories-repository.ts`, remove the `subcategories` import from the schema import line. The full rewrite happens in Task 4, but this fixes the import error now.

**Step 7: Verify compilation**

Run: `cd core/database && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to subcategories.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(database): remove subcategories table and all references"
```

---

## Task 3: Testes de validators

**Files:**

- Create: `core/database/__tests__/schemas/categories-validators.test.ts`

**Step 1: Write validator tests**

```typescript
import { describe, expect, it } from "vitest";
import {
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createCategorySchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createCategorySchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createCategorySchema
// =============================================================================

describe("createCategorySchema", () => {
   const validIncome = {
      name: "Salário",
      type: "income" as const,
   };

   const validExpense = {
      name: "Alimentação",
      type: "expense" as const,
   };

   it("accepts valid income category", () => {
      expectPass(validIncome);
   });

   it("accepts valid expense category", () => {
      expectPass(validExpense);
   });

   it("accepts category with all optional fields", () => {
      expectPass({
         ...validIncome,
         parentId: "550e8400-e29b-41d4-a716-446655440000",
         description: "Salário mensal",
         color: "#FF5733",
         icon: "wallet",
         keywords: ["salario", "pagamento"],
         notes: "Categoria principal de receita",
         participatesDre: true,
         dreGroupId: "PREST_SERVICOS",
      });
   });

   it("accepts category with minimal fields", () => {
      expectPass({ name: "Test", type: "income" });
   });

   it("rejects name shorter than 2 characters", () => {
      expectFail({ ...validIncome, name: "A" });
   });

   it("rejects name longer than 120 characters", () => {
      expectFail({ ...validIncome, name: "A".repeat(121) });
   });

   it("rejects invalid type", () => {
      expectFail({ ...validIncome, type: "invalid" });
   });

   it("rejects missing type", () => {
      expectFail({ name: "Test" });
   });

   it("rejects invalid color format", () => {
      expectFail({ ...validIncome, color: "red" });
   });

   it("accepts valid hex color", () => {
      expectPass({ ...validIncome, color: "#FF5733" });
   });

   it("accepts null color", () => {
      expectPass({ ...validIncome, color: null });
   });

   it("rejects description longer than 255 characters", () => {
      expectFail({ ...validIncome, description: "A".repeat(256) });
   });

   it("rejects keywords array with more than 20 items", () => {
      const keywords = Array.from({ length: 21 }, (_, i) => `keyword${i}`);
      expectFail({ ...validIncome, keywords });
   });

   it("rejects empty string in keywords", () => {
      expectFail({ ...validIncome, keywords: [""] });
   });

   it("accepts valid parentId UUID", () => {
      expectPass({
         ...validIncome,
         parentId: "550e8400-e29b-41d4-a716-446655440000",
      });
   });

   it("rejects invalid parentId format", () => {
      expectFail({ ...validIncome, parentId: "not-a-uuid" });
   });

   it("rejects participatesDre=true without dreGroupId", () => {
      expectFail({ ...validIncome, participatesDre: true }, "dreGroupId");
   });

   it("accepts participatesDre=true with dreGroupId", () => {
      expectPass({
         ...validIncome,
         participatesDre: true,
         dreGroupId: "PREST_SERVICOS",
      });
   });

   it("applies correct defaults", () => {
      const result = createCategorySchema.safeParse(validIncome);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.participatesDre).toBe(false);
      }
   });
});

// =============================================================================
// updateCategorySchema
// =============================================================================

describe("updateCategorySchema", () => {
   const parse = (input: unknown) => updateCategorySchema.safeParse(input);

   it("accepts empty object (all fields optional)", () => {
      expect(parse({}).success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      expect(parse({ name: "Novo Nome" }).success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      expect(parse({ color: "invalid" }).success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      expect(parse({ name: "A" }).success).toBe(false);
   });

   it("accepts valid color on update", () => {
      expect(parse({ color: "#AABBCC" }).success).toBe(true);
   });

   it("does not accept type field (immutable)", () => {
      const result = parse({ type: "income" });
      expect(result.success).toBe(true);
      if (result.success) {
         expect("type" in result.data).toBe(false);
      }
   });

   it("does not accept parentId field (immutable)", () => {
      const result = parse({
         parentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect("parentId" in result.data).toBe(false);
      }
   });

   it("rejects participatesDre=true without dreGroupId", () => {
      const result = parse({ participatesDre: true });
      expect(result.success).toBe(false);
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/schemas/categories-validators.test.ts`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add core/database/__tests__/schemas/categories-validators.test.ts
git commit -m "test(database): add categories validator tests"
```

---

## Task 4: Reescrever repository de categorias

**Files:**

- Rewrite: `core/database/src/repositories/categories-repository.ts`

**Step 1: Rewrite the repository**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateCategoryInput,
   type UpdateCategoryInput,
   categories,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";

export const DEFAULT_CATEGORIES: Array<{
   name: string;
   type: "income" | "expense";
}> = [
   { name: "Alimentação", type: "expense" },
   { name: "Casa", type: "expense" },
   { name: "Educação", type: "expense" },
   { name: "Lazer", type: "expense" },
   { name: "Saúde", type: "expense" },
   { name: "Transporte", type: "expense" },
   { name: "Viagem", type: "expense" },
   { name: "Salário", type: "income" },
   { name: "Investimento", type: "income" },
];

// =============================================================================
// Create
// =============================================================================

export async function createCategory(
   teamId: string,
   data: CreateCategoryInput,
) {
   const validated = validateInput(createCategorySchema, data);
   try {
      let level = 1;
      let type = validated.type;

      if (validated.parentId) {
         const parent = await db.query.categories.findFirst({
            where: { id: validated.parentId },
         });
         if (!parent) throw AppError.notFound("Categoria pai não encontrada.");
         if (parent.level >= 3) {
            throw AppError.validation("Limite de 3 níveis atingido.");
         }
         level = parent.level + 1;
         type = parent.type;
      }

      if (validated.keywords?.length) {
         await validateKeywordsUniqueness(teamId, validated.keywords);
      }

      const [category] = await db
         .insert(categories)
         .values({
            ...validated,
            teamId,
            level,
            type,
         })
         .returning();
      if (!category) throw AppError.database("Failed to create category");
      return category;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create category");
   }
}

export async function seedDefaultCategories(teamId: string) {
   try {
      const values = DEFAULT_CATEGORIES.map((cat) => ({
         teamId,
         name: cat.name,
         type: cat.type as "income" | "expense",
         level: 1,
         isDefault: true,
      }));
      await db.insert(categories).values(values).onConflictDoNothing();
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed default categories");
   }
}

// =============================================================================
// Read
// =============================================================================

export async function listCategories(
   teamId: string,
   opts?: {
      type?: "income" | "expense";
      includeArchived?: boolean;
   },
) {
   try {
      if (opts?.type) {
         if (opts.includeArchived) {
            return await db.query.categories.findMany({
               where: { teamId, type: opts.type },
               orderBy: { name: "asc" },
            });
         }
         return await db.query.categories.findMany({
            where: { teamId, type: opts.type, isArchived: false },
            orderBy: { name: "asc" },
         });
      }
      if (opts?.includeArchived) {
         return await db.query.categories.findMany({
            where: { teamId },
            orderBy: { name: "asc" },
         });
      }
      return await db.query.categories.findMany({
         where: { teamId, isArchived: false },
         orderBy: { name: "asc" },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list categories");
   }
}

export async function getCategory(id: string) {
   try {
      const category = await db.query.categories.findFirst({
         where: { id },
      });
      return category ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get category");
   }
}

// =============================================================================
// Update
// =============================================================================

export async function updateCategory(id: string, data: UpdateCategoryInput) {
   const validated = validateInput(updateCategorySchema, data);
   try {
      const existing = await db.query.categories.findFirst({
         where: { id },
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser editadas.");
      }

      if (validated.keywords?.length) {
         await validateKeywordsUniqueness(
            existing.teamId,
            validated.keywords,
            id,
         );
      }

      const [updated] = await db
         .update(categories)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(categories.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Categoria não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update category");
   }
}

// =============================================================================
// Archive / Reactivate
// =============================================================================

export async function archiveCategory(id: string) {
   try {
      const existing = await db.query.categories.findFirst({
         where: { id },
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser arquivadas.");
      }

      // Cascade: archive all descendants
      const descendantIds = await getDescendantIds(id);
      const allIds = [id, ...descendantIds];

      await db
         .update(categories)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(inArray(categories.id, allIds));

      return await db.query.categories.findFirst({ where: { id } });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive category");
   }
}

export async function reactivateCategory(id: string) {
   try {
      const [updated] = await db
         .update(categories)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(categories.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Categoria não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate category");
   }
}

// =============================================================================
// Delete
// =============================================================================

export async function deleteCategory(id: string) {
   try {
      const existing = await db.query.categories.findFirst({
         where: { id },
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser excluídas.");
      }

      const hasTransactions = await categoryTreeHasTransactions(id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }

      // FK cascade deletes children
      await db.delete(categories).where(eq(categories.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete category");
   }
}

// =============================================================================
// Helpers
// =============================================================================

export async function categoryTreeHasTransactions(
   categoryId: string,
): Promise<boolean> {
   try {
      const descendantIds = await getDescendantIds(categoryId);
      const allIds = [categoryId, ...descendantIds];

      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(inArray(transactions.categoryId, allIds));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check category transactions");
   }
}

async function getDescendantIds(categoryId: string): Promise<string[]> {
   // For 3 levels max, two queries is sufficient (no recursion needed)
   const level2 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId));

   const level2Ids = level2.map((r) => r.id);
   if (level2Ids.length === 0) return [];

   const level3 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, level2Ids));

   return [...level2Ids, ...level3.map((r) => r.id)];
}

export async function validateKeywordsUniqueness(
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
) {
   const conditions: SQL[] = [
      eq(categories.teamId, teamId),
      eq(categories.isArchived, false),
      sql`${categories.keywords} && ARRAY[${sql.join(
         keywords.map((k) => sql`${k}`),
         sql`,`,
      )}]::text[]`,
   ];

   if (excludeCategoryId) {
      conditions.push(sql`${categories.id} != ${excludeCategoryId}`);
   }

   const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(and(...conditions));

   if ((row?.count ?? 0) > 0) {
      throw AppError.conflict(
         "Palavras-chave já utilizadas em outra categoria ativa.",
      );
   }
}
```

**Step 2: Verify no import errors**

Run: `cd core/database && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add core/database/src/repositories/categories-repository.ts
git commit -m "refactor(database): rewrite categories repository with singleton pattern and tree support"
```

---

## Task 5: Testes de repository

**Files:**

- Create: `core/database/__tests__/repositories/categories-repository.test.ts`

**Step 1: Write repository tests**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

// =============================================================================
// Mock the singleton db
// =============================================================================

vi.mock("@core/database/client", async () => {
   return { db: null as unknown as DatabaseInstance };
});

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const clientModule = await import("@core/database/client");
   (clientModule as any).db = testDb.db;
});

afterAll(async () => {
   await testDb.cleanup();
});

// =============================================================================
// Helpers
// =============================================================================

function randomTeamId() {
   return crypto.randomUUID();
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Alimentação",
      type: "expense" as const,
      ...overrides,
   };
}

// =============================================================================
// Tests
// =============================================================================

describe("categories-repository", () => {
   let repo: typeof import("@core/database/repositories/categories-repository");

   beforeAll(async () => {
      repo = await import("@core/database/repositories/categories-repository");
   });

   // -------------------------------------------------------------------------
   // createCategory
   // -------------------------------------------------------------------------

   describe("createCategory", () => {
      it("creates a level 1 category", async () => {
         const teamId = randomTeamId();
         const category = await repo.createCategory(teamId, validCreateInput());

         expect(category).toMatchObject({
            teamId,
            name: "Alimentação",
            type: "expense",
            level: 1,
            isDefault: false,
            isArchived: false,
         });
         expect(category.id).toBeDefined();
         expect(category.parentId).toBeNull();
      });

      it("creates a level 2 category inheriting type from parent", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Receitas", type: "income" }),
         );

         const child = await repo.createCategory(
            teamId,
            validCreateInput({
               name: "Salário",
               type: "expense", // should be overridden to parent's type
               parentId: parent.id,
            }),
         );

         expect(child.level).toBe(2);
         expect(child.type).toBe("income"); // inherited from parent
         expect(child.parentId).toBe(parent.id);
      });

      it("creates a level 3 category", async () => {
         const teamId = randomTeamId();
         const l1 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Despesas" }),
         );
         const l2 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Casa", parentId: l1.id }),
         );
         const l3 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Aluguel", parentId: l2.id }),
         );

         expect(l3.level).toBe(3);
         expect(l3.parentId).toBe(l2.id);
      });

      it("rejects level 4 (parent at level 3)", async () => {
         const teamId = randomTeamId();
         const l1 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "L1" }),
         );
         const l2 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "L2", parentId: l1.id }),
         );
         const l3 = await repo.createCategory(
            teamId,
            validCreateInput({ name: "L3", parentId: l2.id }),
         );

         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ name: "L4", parentId: l3.id }),
            ),
         ).rejects.toThrow("Limite de 3 níveis");
      });

      it("rejects nonexistent parentId", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ parentId: crypto.randomUUID() }),
            ),
         ).rejects.toThrow("não encontrada");
      });
   });

   // -------------------------------------------------------------------------
   // listCategories
   // -------------------------------------------------------------------------

   describe("listCategories", () => {
      it("lists categories for a team", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(teamId, validCreateInput({ name: "Cat1" }));
         await repo.createCategory(teamId, validCreateInput({ name: "Cat2" }));

         const list = await repo.listCategories(teamId);
         expect(list).toHaveLength(2);
      });

      it("does not list archived categories by default", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveCategory(cat.id);

         const list = await repo.listCategories(teamId);
         expect(list).toHaveLength(0);
      });

      it("lists archived categories when includeArchived is true", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Archived2" }),
         );
         await repo.archiveCategory(cat.id);

         const list = await repo.listCategories(teamId, {
            includeArchived: true,
         });
         expect(list).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Income", type: "income" }),
         );
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Expense", type: "expense" }),
         );

         const incomeList = await repo.listCategories(teamId, {
            type: "income",
         });
         expect(incomeList).toHaveLength(1);
         expect(incomeList[0]!.name).toBe("Income");
      });

      it("does not return categories from other teams", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await repo.createCategory(teamA, validCreateInput({ name: "A" }));
         await repo.createCategory(teamB, validCreateInput({ name: "B" }));

         const list = await repo.listCategories(teamA);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("A");
      });
   });

   // -------------------------------------------------------------------------
   // getCategory
   // -------------------------------------------------------------------------

   describe("getCategory", () => {
      it("returns category by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createCategory(teamId, validCreateInput());

         const found = await repo.getCategory(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Alimentação" });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getCategory(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   // -------------------------------------------------------------------------
   // updateCategory
   // -------------------------------------------------------------------------

   describe("updateCategory", () => {
      it("updates category name", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(teamId, validCreateInput());

         const updated = await repo.updateCategory(cat.id, {
            name: "Novo Nome",
         });
         expect(updated.name).toBe("Novo Nome");
      });

      it("rejects editing default category", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);
         const list = await repo.listCategories(teamId);
         const defaultCat = list.find((c) => c.isDefault)!;

         await expect(
            repo.updateCategory(defaultCat.id, { name: "Renamed" }),
         ).rejects.toThrow("padrão");
      });
   });

   // -------------------------------------------------------------------------
   // archiveCategory
   // -------------------------------------------------------------------------

   describe("archiveCategory", () => {
      it("archives category and all descendants", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Child", parentId: parent.id }),
         );

         await repo.archiveCategory(parent.id);

         const parentAfter = await repo.getCategory(parent.id);
         const childAfter = await repo.getCategory(child.id);
         expect(parentAfter!.isArchived).toBe(true);
         expect(childAfter!.isArchived).toBe(true);
      });

      it("rejects archiving default category", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);
         const list = await repo.listCategories(teamId);
         const defaultCat = list.find((c) => c.isDefault)!;

         await expect(repo.archiveCategory(defaultCat.id)).rejects.toThrow(
            "padrão",
         );
      });
   });

   // -------------------------------------------------------------------------
   // reactivateCategory
   // -------------------------------------------------------------------------

   describe("reactivateCategory", () => {
      it("reactivates an archived category", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "ToReactivate" }),
         );
         await repo.archiveCategory(cat.id);

         const reactivated = await repo.reactivateCategory(cat.id);
         expect(reactivated.isArchived).toBe(false);
      });
   });

   // -------------------------------------------------------------------------
   // deleteCategory
   // -------------------------------------------------------------------------

   describe("deleteCategory", () => {
      it("deletes category without transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "ToDelete" }),
         );

         await repo.deleteCategory(cat.id);
         const found = await repo.getCategory(cat.id);
         expect(found).toBeNull();
      });

      it("cascade deletes children", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Child", parentId: parent.id }),
         );

         await repo.deleteCategory(parent.id);
         const foundChild = await repo.getCategory(child.id);
         expect(foundChild).toBeNull();
      });

      it("rejects deleting category with transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "WithTx" }),
         );

         // Create a bank account for the transaction
         const [account] = await testDb.db
            .insert(bankAccounts)
            .values({
               teamId,
               name: "Test Account",
               type: "checking",
               bankCode: "001",
            })
            .returning();

         // Insert a transaction linked to this category
         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2026-01-01",
            categoryId: cat.id,
            bankAccountId: account!.id,
         });

         await expect(repo.deleteCategory(cat.id)).rejects.toThrow(
            "lançamentos",
         );
      });

      it("rejects deleting category with transactions in descendant", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "ParentNoTx" }),
         );
         const child = await repo.createCategory(
            teamId,
            validCreateInput({ name: "ChildWithTx", parentId: parent.id }),
         );

         const [account] = await testDb.db
            .insert(bankAccounts)
            .values({
               teamId,
               name: "Test Account 2",
               type: "checking",
               bankCode: "001",
            })
            .returning();

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "50.00",
            date: "2026-01-01",
            categoryId: child.id,
            bankAccountId: account!.id,
         });

         await expect(repo.deleteCategory(parent.id)).rejects.toThrow(
            "lançamentos",
         );
      });

      it("rejects deleting default category", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);
         const list = await repo.listCategories(teamId);
         const defaultCat = list.find((c) => c.isDefault)!;

         await expect(repo.deleteCategory(defaultCat.id)).rejects.toThrow(
            "padrão",
         );
      });
   });

   // -------------------------------------------------------------------------
   // validateKeywordsUniqueness
   // -------------------------------------------------------------------------

   describe("validateKeywordsUniqueness", () => {
      it("allows unique keywords", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Cat1", keywords: ["food", "eat"] }),
         );

         // Should not throw — different keywords
         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ name: "Cat2", keywords: ["transport"] }),
            ),
         ).resolves.toBeDefined();
      });

      it("rejects duplicate keywords across categories", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Cat1", keywords: ["food", "eat"] }),
         );

         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ name: "Cat2", keywords: ["food"] }),
            ),
         ).rejects.toThrow("Palavras-chave");
      });
   });

   // -------------------------------------------------------------------------
   // seedDefaultCategories
   // -------------------------------------------------------------------------

   describe("seedDefaultCategories", () => {
      it("seeds default categories with correct types", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);

         const list = await repo.listCategories(teamId);
         expect(list.length).toBe(repo.DEFAULT_CATEGORIES.length);

         const allDefault = list.every((c) => c.isDefault);
         expect(allDefault).toBe(true);

         const incomeNames = list
            .filter((c) => c.type === "income")
            .map((c) => c.name);
         expect(incomeNames).toContain("Salário");
         expect(incomeNames).toContain("Investimento");
      });
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/repositories/categories-repository.test.ts`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/categories-repository.test.ts
git commit -m "test(database): add categories repository integration tests"
```

---

## Task 6: Verificação final

**Step 1: Run all tests**

Run: `cd core/database && npx vitest run`
Expected: All test files pass.

**Step 2: TypeScript check**

Run: `cd core/database && npx tsc --noEmit`
Expected: No errors.
