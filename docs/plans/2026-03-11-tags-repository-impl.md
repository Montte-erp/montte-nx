# Tags Repository Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `description` field to tags schema, create Zod validators, and build a full CRUD tags repository with tests following the categories-repository pattern.

**Architecture:** Single `tags` table with new `description` column. Repository functions use singleton `db` import. Validators use `drizzle-orm/zod` + custom Zod refinements. Tests use PGlite via `setupTestDb`.

**Tech Stack:** Drizzle ORM, Zod, Vitest, PGlite, `@core/utils/errors`

---

### Task 1: Add `description` field to tags schema

**Files:**

- Modify: `core/database/src/schemas/tags.ts`

**Step 1: Add the description column**

In `core/database/src/schemas/tags.ts`, add `description` field after `color`:

```typescript
description: text("description"),
```

**Step 2: Add Zod validators**

After the type exports, add validators following categories pattern:

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
   .optional();

export const createTagSchema = createInsertSchema(tags)
   .pick({ name: true, color: true, description: true })
   .extend({
      name: nameSchema,
      color: colorSchema,
      description: z.string().max(255).nullable().optional(),
   });

export const updateTagSchema = createTagSchema.partial();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
```

**Step 3: Verify typecheck**

Run: `cd core/database && bunx tsc --noEmit -p tsconfig.test.json`
Expected: No errors

**Step 4: Commit**

```bash
git add core/database/src/schemas/tags.ts
git commit -m "feat(database): add description field and validators to tags schema"
```

---

### Task 2: Write failing tests for tags repository

**Files:**

- Create: `core/database/__tests__/repositories/tags-repository.test.ts`

**Step 1: Write the test file**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { tags } from "@core/database/schemas/tags";
import {
   transactions,
   transactionTags,
} from "@core/database/schemas/transactions";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Projeto Alpha",
      ...overrides,
   };
}

describe("tags-repository", () => {
   describe("createTag", () => {
      it("creates a tag with correct fields", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());

         expect(tag).toMatchObject({
            teamId,
            name: "Projeto Alpha",
            color: "#6366f1",
            description: null,
            isArchived: false,
         });
         expect(tag.id).toBeDefined();
      });

      it("creates tag with description and color", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(
            teamId,
            validCreateInput({
               name: "Cliente Y",
               description: "Cliente importante",
               color: "#FF5733",
            }),
         );

         expect(tag).toMatchObject({
            name: "Cliente Y",
            description: "Cliente importante",
            color: "#FF5733",
         });
      });

      it("rejects duplicate name within same team", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         await createTag(teamId, validCreateInput());

         await expect(createTag(teamId, validCreateInput())).rejects.toThrow();
      });

      it("allows same name in different teams", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await createTag(teamA, validCreateInput());

         await expect(
            createTag(teamB, validCreateInput()),
         ).resolves.toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();

         await expect(
            createTag(teamId, validCreateInput({ name: "A" })),
         ).rejects.toThrow(/mínimo/);
      });

      it("rejects name longer than 120 chars", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();

         await expect(
            createTag(teamId, validCreateInput({ name: "A".repeat(121) })),
         ).rejects.toThrow(/máximo/);
      });

      it("rejects invalid color format", async () => {
         const { createTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();

         await expect(
            createTag(teamId, validCreateInput({ color: "red" })),
         ).rejects.toThrow(/hex/);
      });
   });

   describe("listTags", () => {
      it("lists tags for a team", async () => {
         const { createTag, listTags } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         await createTag(teamId, validCreateInput({ name: "Tag A" }));
         await createTag(teamId, validCreateInput({ name: "Tag B" }));

         const list = await listTags(teamId);
         expect(list).toHaveLength(2);
      });

      it("does not list archived by default", async () => {
         const { createTag, listTags, archiveTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());
         await archiveTag(tag.id);

         const list = await listTags(teamId);
         expect(list).toHaveLength(0);
      });

      it("lists archived when includeArchived=true", async () => {
         const { createTag, listTags, archiveTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());
         await archiveTag(tag.id);

         const list = await listTags(teamId, { includeArchived: true });
         expect(list).toHaveLength(1);
      });

      it("orders by name ascending", async () => {
         const { createTag, listTags } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         await createTag(teamId, validCreateInput({ name: "Zebra" }));
         await createTag(teamId, validCreateInput({ name: "Alpha" }));

         const list = await listTags(teamId);
         expect(list[0]!.name).toBe("Alpha");
         expect(list[1]!.name).toBe("Zebra");
      });

      it("does not return other team's tags", async () => {
         const { createTag, listTags } =
            await import("../../src/repositories/tags-repository");
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await createTag(teamA, validCreateInput({ name: "Tag A" }));
         await createTag(teamB, validCreateInput({ name: "Tag B" }));

         const list = await listTags(teamA);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Tag A");
      });
   });

   describe("getTag", () => {
      it("returns tag by id", async () => {
         const { createTag, getTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const created = await createTag(teamId, validCreateInput());

         const found = await getTag(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Projeto Alpha" });
      });

      it("returns null for nonexistent id", async () => {
         const { getTag } =
            await import("../../src/repositories/tags-repository");
         const found = await getTag(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateTag", () => {
      it("updates tag name", async () => {
         const { createTag, updateTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const created = await createTag(teamId, validCreateInput());

         const updated = await updateTag(created.id, { name: "Novo Nome" });
         expect(updated.name).toBe("Novo Nome");
         expect(updated.id).toBe(created.id);
      });

      it("updates tag description", async () => {
         const { createTag, updateTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const created = await createTag(teamId, validCreateInput());

         const updated = await updateTag(created.id, {
            description: "Descrição nova",
         });
         expect(updated.description).toBe("Descrição nova");
      });

      it("rejects updating nonexistent tag", async () => {
         const { updateTag } =
            await import("../../src/repositories/tags-repository");

         await expect(
            updateTag(crypto.randomUUID(), { name: "Foo" }),
         ).rejects.toThrow(/não encontrad/);
      });
   });

   describe("archiveTag", () => {
      it("archives tag", async () => {
         const { createTag, archiveTag, getTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());

         const archived = await archiveTag(tag.id);
         expect(archived.isArchived).toBe(true);
      });

      it("rejects archiving nonexistent tag", async () => {
         const { archiveTag } =
            await import("../../src/repositories/tags-repository");

         await expect(archiveTag(crypto.randomUUID())).rejects.toThrow(
            /não encontrad/,
         );
      });
   });

   describe("reactivateTag", () => {
      it("reactivates archived tag", async () => {
         const { createTag, archiveTag, reactivateTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());
         await archiveTag(tag.id);

         const reactivated = await reactivateTag(tag.id);
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("deleteTag", () => {
      it("deletes tag without transactions", async () => {
         const { createTag, deleteTag, getTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());

         await deleteTag(tag.id);
         const found = await getTag(tag.id);
         expect(found).toBeNull();
      });

      it("rejects deleting tag with transactions", async () => {
         const { createTag, deleteTag } =
            await import("../../src/repositories/tags-repository");
         const teamId = randomTeamId();
         const tag = await createTag(teamId, validCreateInput());

         const [account] = await testDb.db
            .insert(bankAccounts)
            .values({
               teamId,
               name: "Conta Teste",
               type: "checking",
               bankCode: "001",
               color: "#000000",
               initialBalance: "0.00",
            })
            .returning();

         const [txn] = await testDb.db
            .insert(transactions)
            .values({
               teamId,
               type: "expense",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account!.id,
            })
            .returning();

         await testDb.db.insert(transactionTags).values({
            transactionId: txn!.id,
            tagId: tag.id,
         });

         await expect(deleteTag(tag.id)).rejects.toThrow(/lançamentos/);
      });

      it("rejects deleting nonexistent tag", async () => {
         const { deleteTag } =
            await import("../../src/repositories/tags-repository");

         await expect(deleteTag(crypto.randomUUID())).rejects.toThrow(
            /não encontrad/,
         );
      });
   });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd core/database && bunx vitest run __tests__/repositories/tags-repository.test.ts`
Expected: FAIL — module `../../src/repositories/tags-repository` not found

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/tags-repository.test.ts
git commit -m "test(database): add tags repository tests (red phase)"
```

---

### Task 3: Implement tags repository

**Files:**

- Create: `core/database/src/repositories/tags-repository.ts`

**Step 1: Write the repository**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { eq, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
   tags,
   createTagSchema,
   updateTagSchema,
} from "@core/database/schemas/tags";
import { transactionTags } from "@core/database/schemas/transactions";

export async function createTag(teamId: string, data: CreateTagInput) {
   const validated = validateInput(createTagSchema, data);
   try {
      const [tag] = await db
         .insert(tags)
         .values({ ...validated, teamId })
         .returning();
      if (!tag) throw AppError.database("Failed to create tag");
      return tag;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create tag");
   }
}

export async function listTags(
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      if (opts?.includeArchived) {
         return await db.query.tags.findMany({
            where: { teamId },
            orderBy: { name: "asc" },
         });
      }
      return await db.query.tags.findMany({
         where: { teamId, isArchived: false },
         orderBy: { name: "asc" },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list tags");
   }
}

export async function getTag(id: string) {
   try {
      const tag = await db.query.tags.findFirst({ where: { id } });
      return tag ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get tag");
   }
}

export async function updateTag(id: string, data: UpdateTagInput) {
   const validated = validateInput(updateTagSchema, data);
   try {
      const [updated] = await db
         .update(tags)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update tag");
   }
}

export async function archiveTag(id: string) {
   try {
      const [updated] = await db
         .update(tags)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive tag");
   }
}

export async function reactivateTag(id: string) {
   try {
      const [updated] = await db
         .update(tags)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate tag");
   }
}

export async function deleteTag(id: string) {
   try {
      const existing = await db.query.tags.findFirst({ where: { id } });
      if (!existing) throw AppError.notFound("Tag não encontrada.");

      const hasTransactions = await tagHasTransactions(id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Tag com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }

      await db.delete(tags).where(eq(tags.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete tag");
   }
}

export async function tagHasTransactions(tagId: string): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactionTags)
         .where(eq(transactionTags.tagId, tagId));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check tag transactions");
   }
}
```

**Step 2: Run tests to verify they pass**

Run: `cd core/database && bunx vitest run __tests__/repositories/tags-repository.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add core/database/src/repositories/tags-repository.ts
git commit -m "feat(database): implement tags repository with full CRUD"
```

---

### Task 4: Verify everything together

**Step 1: Run all database tests**

Run: `cd core/database && bunx vitest run`
Expected: All tests pass (categories + tags)

**Step 2: Run typecheck**

Run: `cd core/database && bunx tsc --noEmit -p tsconfig.test.json`
Expected: No errors

**Step 3: Run linter**

Run: `bun run check`
Expected: No new errors
