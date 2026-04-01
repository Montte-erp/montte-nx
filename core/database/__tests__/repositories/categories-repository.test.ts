import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import * as repo from "../../src/repositories/categories-repository";

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
      name: "Alimentação",
      type: "expense" as const,
      ...overrides,
   };
}

describe("categories-repository", () => {
   describe("createCategory", () => {
      it("creates a level 1 category with correct fields", async () => {
         const teamId = randomTeamId();
         const category = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
         );

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
            testDb.db,
            teamId,
            validCreateInput({ name: "Salário", type: "income" }),
         );

         const child = await repo.createCategory(
            testDb.db,
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
            testDb.db,
            teamId,
            validCreateInput({ name: "L1" }),
         );
         const l2 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "L2", parentId: l1.id }),
         );
         const l3 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "L3", parentId: l2.id }),
         );

         expect(l3.level).toBe(3);
      });

      it("rejects level 4", async () => {
         const teamId = randomTeamId();
         const l1 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "L1" }),
         );
         const l2 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "L2", parentId: l1.id }),
         );
         const l3 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "L3", parentId: l2.id }),
         );

         await expect(
            repo.createCategory(
               testDb.db,
               teamId,
               validCreateInput({ name: "L4", parentId: l3.id }),
            ),
         ).rejects.toThrow(/Limite de 3 níveis/);
      });

      it("rejects nonexistent parentId", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createCategory(
               testDb.db,
               teamId,
               validCreateInput({ parentId: crypto.randomUUID() }),
            ),
         ).rejects.toThrow(/não encontrada/);
      });
   });

   describe("listCategories", () => {
      it("lists categories for a team", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cat A" }),
         );
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cat B" }),
         );

         const list = await repo.listCategories(testDb.db, teamId);
         expect(list).toHaveLength(2);
      });

      it("does not list archived by default", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveCategory(testDb.db, cat.id);

         const list = await repo.listCategories(testDb.db, teamId);
         expect(list).toHaveLength(0);
      });

      it("lists archived when includeArchived=true", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveCategory(testDb.db, cat.id);

         const list = await repo.listCategories(testDb.db, teamId, {
            includeArchived: true,
         });
         expect(list).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Salário", type: "income" }),
         );
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Comida", type: "expense" }),
         );

         const list = await repo.listCategories(testDb.db, teamId, {
            type: "income",
         });
         expect(list).toHaveLength(1);
         expect(list[0]!.type).toBe("income");
      });

      it("does not return other team's categories", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await repo.createCategory(
            testDb.db,
            teamA,
            validCreateInput({ name: "Cat A" }),
         );
         await repo.createCategory(
            testDb.db,
            teamB,
            validCreateInput({ name: "Cat B" }),
         );

         const list = await repo.listCategories(testDb.db, teamA);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Cat A");
      });
   });

   describe("getCategory", () => {
      it("returns category by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const found = await repo.getCategory(testDb.db, created.id);
         expect(found).toMatchObject({ id: created.id, name: "Alimentação" });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getCategory(testDb.db, crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateCategory", () => {
      it("updates category name", async () => {
         const teamId = randomTeamId();
         const created = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateCategory(testDb.db, created.id, {
            name: "Transporte",
         });
         expect(updated.name).toBe("Transporte");
         expect(updated.id).toBe(created.id);
      });

      it("rejects editing default category", async () => {
         const teamId = randomTeamId();
         await repo.seedEmpresarialCategories(testDb.db, teamId);
         const defaults = await repo.listCategories(testDb.db, teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(
            repo.updateCategory(testDb.db, defaultCat.id, {
               name: "Novo Nome",
            }),
         ).rejects.toThrow(/padrão/);
      });
   });

   describe("archiveCategory", () => {
      it("archives category and all descendants", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Child", parentId: parent.id }),
         );

         await repo.archiveCategory(testDb.db, parent.id);

         const parentAfter = await repo.getCategory(testDb.db, parent.id);
         const childAfter = await repo.getCategory(testDb.db, child.id);
         expect(parentAfter!.isArchived).toBe(true);
         expect(childAfter!.isArchived).toBe(true);
      });

      it("rejects archiving default category", async () => {
         const teamId = randomTeamId();
         await repo.seedEmpresarialCategories(testDb.db, teamId);
         const defaults = await repo.listCategories(testDb.db, teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(
            repo.archiveCategory(testDb.db, defaultCat.id),
         ).rejects.toThrow(/padrão/);
      });
   });

   describe("reactivateCategory", () => {
      it("reactivates archived category", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         await repo.archiveCategory(testDb.db, cat.id);

         const reactivated = await repo.reactivateCategory(testDb.db, cat.id);
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("deleteCategory", () => {
      it("deletes category without transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         await repo.deleteCategory(testDb.db, cat.id);
         const found = await repo.getCategory(testDb.db, cat.id);
         expect(found).toBeNull();
      });

      it("cascade deletes children", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Child", parentId: parent.id }),
         );

         await repo.deleteCategory(testDb.db, parent.id);
         const foundChild = await repo.getCategory(testDb.db, child.id);
         expect(foundChild).toBeNull();
      });

      it("rejects deleting with transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput(),
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
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account!.id,
            categoryId: cat.id,
         });

         await expect(repo.deleteCategory(testDb.db, cat.id)).rejects.toThrow(
            /lançamentos/,
         );
      });

      it("rejects deleting with transactions in descendant", async () => {
         const teamId = randomTeamId();
         const parent = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Parent" }),
         );
         const child = await repo.createCategory(
            testDb.db,
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

         await expect(
            repo.deleteCategory(testDb.db, parent.id),
         ).rejects.toThrow(/lançamentos/);
      });

      it("rejects deleting default category", async () => {
         const teamId = randomTeamId();
         await repo.seedEmpresarialCategories(testDb.db, teamId);
         const defaults = await repo.listCategories(testDb.db, teamId);
         const defaultCat = defaults.find((c) => c.isDefault)!;

         await expect(
            repo.deleteCategory(testDb.db, defaultCat.id),
         ).rejects.toThrow(/padrão/);
      });
   });

   describe("validateKeywordsUniqueness", () => {
      it("allows unique keywords", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cat A", keywords: ["food"] }),
         );

         await expect(
            repo.createCategory(
               testDb.db,
               teamId,
               validCreateInput({ name: "Cat B", keywords: ["transport"] }),
            ),
         ).resolves.toBeDefined();
      });

      it("rejects duplicate keywords across categories", async () => {
         const teamId = randomTeamId();
         await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cat A", keywords: ["food"] }),
         );

         await expect(
            repo.createCategory(
               testDb.db,
               teamId,
               validCreateInput({ name: "Cat B", keywords: ["food"] }),
            ),
         ).rejects.toThrow(/Palavras-chave/);
      });
   });

   describe("bulkDeleteCategories", () => {
      it("deletes multiple categories with no transactions", async () => {
         const teamId = randomTeamId();
         const cat1 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Bulk Cat A" }),
         );
         const cat2 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Bulk Cat B" }),
         );

         await repo.bulkDeleteCategories(testDb.db, [cat1.id, cat2.id], teamId);

         expect(await repo.getCategory(testDb.db, cat1.id)).toBeNull();
         expect(await repo.getCategory(testDb.db, cat2.id)).toBeNull();
      });

      it("rejects if any category belongs to another team", async () => {
         const teamId = randomTeamId();
         const otherTeamId = randomTeamId();
         const cat1 = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Mine Bulk Cat" }),
         );
         const cat2 = await repo.createCategory(
            testDb.db,
            otherTeamId,
            validCreateInput({ name: "Other Bulk Cat" }),
         );

         await expect(
            repo.bulkDeleteCategories(testDb.db, [cat1.id, cat2.id], teamId),
         ).rejects.toThrow(/não foram encontradas/);
      });

      it("rejects if any category is default", async () => {
         const teamId = randomTeamId();
         await repo.seedEmpresarialCategories(testDb.db, teamId);
         const list = await repo.listCategories(testDb.db, teamId);
         const defaultCat = list.find((c) => c.isDefault)!;

         await expect(
            repo.bulkDeleteCategories(testDb.db, [defaultCat.id], teamId),
         ).rejects.toThrow(/padrão/);
      });

      it("rejects if any category has transactions", async () => {
         const teamId = randomTeamId();
         const cat = await repo.createCategory(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cat Com Lancamentos" }),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2025-01-15",
            categoryId: cat.id,
         });

         await expect(
            repo.bulkDeleteCategories(testDb.db, [cat.id], teamId),
         ).rejects.toThrow(/lançamentos/);
      });
   });

   describe("seedEmpresarialCategories", () => {
      it("seeds empresarial preset with correct types and hierarchy", async () => {
         const teamId = randomTeamId();
         await repo.seedEmpresarialCategories(testDb.db, teamId);

         const list = await repo.listCategories(testDb.db, teamId);
         expect(list.length).toBeGreaterThan(0);
         expect(list.every((c) => c.isDefault)).toBe(true);

         const vendas = list.find((c) => c.name === "Vendas");
         const outrasReceitas = list.find((c) => c.name === "Outras Receitas");
         expect(vendas!.type).toBe("income");
         expect(outrasReceitas!.type).toBe("income");

         const impostos = list.find((c) => c.name === "Impostos");
         expect(impostos!.type).toBe("expense");
      });
   });
});
