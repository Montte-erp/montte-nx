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
      it("creates a level 1 category with correct fields", async () => {
         const teamId = randomTeamId();
         const category = await repo.createCategory(teamId, validCreateInput());

         expect(category).toMatchObject({
            teamId,
            name: "Alimentação",
            type: "expense",
            level: 1,
            isDefault: false,
            isArchived: false,
            parentId: null,
         });
         expect(category.id).toBeDefined();
      });

      it("creates level 2 inheriting type from parent", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Salário", type: "income" }),
         );

         const child = await repo.createCategory(
            teamId,
            validCreateInput({
               name: "Bônus",
               type: "expense",
               parentId: parent.id,
            }),
         );

         expect(child.type).toBe("income");
         expect(child.level).toBe(2);
      });

      it("creates level 3", async () => {
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

         expect(l3.level).toBe(3);
      });

      it("rejects level 4", async () => {
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
         ).rejects.toThrow(/Limite de 3 níveis/);
      });

      it("rejects nonexistent parentId", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ parentId: crypto.randomUUID() }),
            ),
         ).rejects.toThrow(/não encontrada/);
      });
   });

   // -------------------------------------------------------------------------
   // listCategories
   // -------------------------------------------------------------------------

   describe("listCategories", () => {
      it("lists categories for a team", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(teamId, validCreateInput({ name: "Cat A" }));
         await repo.createCategory(teamId, validCreateInput({ name: "Cat B" }));

         const list = await repo.listCategories(teamId);
         expect(list).toHaveLength(2);
      });

      it("does not list archived by default", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveCategory(cat.id);

         const list = await repo.listCategories(teamId);
         expect(list).toHaveLength(0);
      });

      it("lists archived when includeArchived=true", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Archived" }),
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
            validCreateInput({ name: "Salário", type: "income" }),
         );
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Comida", type: "expense" }),
         );

         const list = await repo.listCategories(teamId, { type: "income" });
         expect(list).toHaveLength(1);
         expect(list[0]!.type).toBe("income");
      });

      it("does not return other team's categories", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await repo.createCategory(teamA, validCreateInput({ name: "Cat A" }));
         await repo.createCategory(teamB, validCreateInput({ name: "Cat B" }));

         const list = await repo.listCategories(teamA);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Cat A");
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
         const created = await repo.createCategory(teamId, validCreateInput());

         const updated = await repo.updateCategory(created.id, {
            name: "Transporte",
         });
         expect(updated.name).toBe("Transporte");
         expect(updated.id).toBe(created.id);
      });

      it("rejects editing default category", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);
         const defaults = await repo.listCategories(teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(
            repo.updateCategory(defaultCat.id, { name: "Novo Nome" }),
         ).rejects.toThrow(/padrão/);
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
         const defaults = await repo.listCategories(teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(repo.archiveCategory(defaultCat.id)).rejects.toThrow(
            /padrão/,
         );
      });
   });

   // -------------------------------------------------------------------------
   // reactivateCategory
   // -------------------------------------------------------------------------

   describe("reactivateCategory", () => {
      it("reactivates archived category", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(teamId, validCreateInput());
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
         const cat = await repo.createCategory(teamId, validCreateInput());

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

      it("rejects deleting with transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(teamId, validCreateInput());

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

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account!.id,
            categoryId: cat.id,
         });

         await expect(repo.deleteCategory(cat.id)).rejects.toThrow(
            /lançamentos/,
         );
      });

      it("rejects deleting with transactions in descendant", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            teamId,
            validCreateInput({ name: "Child", parentId: parent.id }),
         );

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

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "50.00",
            date: "2026-01-15",
            bankAccountId: account!.id,
            categoryId: child.id,
         });

         await expect(repo.deleteCategory(parent.id)).rejects.toThrow(
            /lançamentos/,
         );
      });

      it("rejects deleting default category", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);
         const defaults = await repo.listCategories(teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(repo.deleteCategory(defaultCat.id)).rejects.toThrow(
            /padrão/,
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
            validCreateInput({ name: "Cat A", keywords: ["food"] }),
         );

         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ name: "Cat B", keywords: ["transport"] }),
            ),
         ).resolves.toBeDefined();
      });

      it("rejects duplicate keywords across categories", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            teamId,
            validCreateInput({ name: "Cat A", keywords: ["food"] }),
         );

         await expect(
            repo.createCategory(
               teamId,
               validCreateInput({ name: "Cat B", keywords: ["food"] }),
            ),
         ).rejects.toThrow(/Palavras-chave/);
      });
   });

   // -------------------------------------------------------------------------
   // seedDefaultCategories
   // -------------------------------------------------------------------------

   describe("seedDefaultCategories", () => {
      it("seeds defaults with correct types", async () => {
         const teamId = randomTeamId();
         await repo.seedDefaultCategories(teamId);

         const list = await repo.listCategories(teamId);
         expect(list).toHaveLength(repo.DEFAULT_CATEGORIES.length);
         expect(list.every((c) => c.isDefault)).toBe(true);

         const salario = list.find((c) => c.name === "Salário");
         const investimento = list.find((c) => c.name === "Investimento");
         expect(salario!.type).toBe("income");
         expect(investimento!.type).toBe("income");
      });
   });
});
