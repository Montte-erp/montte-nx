import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { categories } from "@core/database/schemas/categories";
import { makeCategory } from "../helpers/classification-factories";

const { enqueueDeriveKeywordsSpy } = vi.hoisted(() => ({
   enqueueDeriveKeywordsSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/workflows/derive-keywords-workflow", () => ({
   enqueueDeriveKeywordsWorkflow: enqueueDeriveKeywordsSpy,
}));

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as categoriesRouter from "../../src/router/categories";
import * as categoriesBulkRouter from "../../src/router/categories-bulk";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
});

describe("categories router", () => {
   it("create inserts a category and enqueues derive-keywords workflow", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      const result = await call(
         categoriesRouter.create,
         {
            name: "Marketing",
            type: "expense",
            icon: "briefcase",
            participatesDre: false,
         },
         { context: ctx },
      );

      expect(result.teamId).toBe(teamId);
      expect(result.name).toBe("Marketing");
      expect(result.type).toBe("expense");
      expect(result.icon).toBe("briefcase");

      const [persisted] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, result.id));
      expect(persisted?.name).toBe("Marketing");
      expect(persisted?.icon).toBe("briefcase");

      expect(enqueueDeriveKeywordsSpy).toHaveBeenCalledTimes(1);
      const [, payload] = enqueueDeriveKeywordsSpy.mock.calls[0] ?? [];
      expect(payload).toMatchObject({
         categoryId: result.id,
         teamId,
         organizationId,
         name: "Marketing",
      });
   });

   it("create with subcategories inserts parent + children but only enqueues parent", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.create,
         {
            name: "Vendas",
            type: "income",
            icon: "briefcase",
            participatesDre: false,
            subcategories: [{ name: "Produtos" }, { name: "Serviços" }],
         },
         { context: ctx },
      );

      const allRows = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.teamId, teamId));
      expect(allRows).toHaveLength(3);
      const childRows = allRows.filter((r) => r.parentId === result.id);
      expect(childRows).toHaveLength(2);
      expect(childRows.every((r) => r.icon === null)).toBe(true);

      expect(enqueueDeriveKeywordsSpy).toHaveBeenCalledTimes(1);
   });

   it("create with parentId links category to selected parent", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, {
         name: "Operacional",
         type: "expense",
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.create,
         {
            name: "Aluguel",
            type: "income",
            parentId: parent.id,
            participatesDre: false,
         },
         { context: ctx },
      );

      expect(result.parentId).toBe(parent.id);
      expect(result.type).toBe("expense");
      expect(result.level).toBe(2);

      const [persisted] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, result.id));
      expect(persisted?.parentId).toBe(parent.id);
   });

   it("create with parentId does not persist a subcategory icon", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, {
         icon: "briefcase",
         name: "Operacional",
         type: "expense",
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.create,
         {
            name: "Aluguel",
            type: "expense",
            parentId: parent.id,
            icon: "wallet",
            participatesDre: false,
         },
         { context: ctx },
      );

      expect(result.parentId).toBe(parent.id);
      expect(result.icon).toBeNull();

      const [persisted] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, result.id));
      expect(persisted?.icon).toBeNull();
   });

   it("update on cross-team category throws NOT_FOUND", async () => {
      const { teamId: otherTeamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, otherTeamId);
      const { teamId } = await seedTeam(testDb.db);

      const ctx = createTestContext(testDb.db, { teamId });
      await expect(
         call(
            categoriesRouter.update,
            { id: cat.id, name: "Hack", participatesDre: false },
            { context: ctx },
         ),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "NOT_FOUND",
      );
   });

   it("update allows default category", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, { isDefault: true });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesRouter.update,
         { id: cat.id, name: "Novo", participatesDre: false },
         { context: ctx },
      );

      expect(result.name).toBe("Novo");
      expect(result.isDefault).toBe(true);
   });

   it("update enqueues derive-keywords when keywords are not provided", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId);

      const ctx = createTestContext(testDb.db, { teamId });
      await call(
         categoriesRouter.update,
         { id: cat.id, name: "Atualizado", participatesDre: false },
         { context: ctx },
      );

      expect(enqueueDeriveKeywordsSpy).toHaveBeenCalledTimes(1);
   });

   it("update changes parentId and recalculates level", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const oldParent = await makeCategory(testDb.db, teamId, {
         name: "Antiga",
      });
      const newParent = await makeCategory(testDb.db, teamId, {
         name: "Nova",
      });
      const cat = await makeCategory(testDb.db, teamId, {
         name: "Filha",
         parentId: oldParent.id,
         level: 2,
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.update,
         { id: cat.id, parentId: newParent.id, participatesDre: false },
         { context: ctx },
      );

      expect(result.parentId).toBe(newParent.id);
      expect(result.level).toBe(2);

      const [persisted] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, cat.id));
      expect(persisted?.parentId).toBe(newParent.id);
   });

   it("update clears icon when moving a root category under a parent", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, {
         name: "Pai",
         icon: "briefcase",
      });
      const cat = await makeCategory(testDb.db, teamId, {
         name: "Filha",
         icon: "wallet",
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.update,
         { id: cat.id, parentId: parent.id, participatesDre: false },
         { context: ctx },
      );

      expect(result.parentId).toBe(parent.id);
      expect(result.icon).toBeNull();

      const [persisted] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, cat.id));
      expect(persisted?.icon).toBeNull();
   });

   it("update accepts null parentId and promotes category to root", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, {
         name: "Pai",
      });
      const cat = await makeCategory(testDb.db, teamId, {
         name: "Sem pai",
         parentId: parent.id,
         level: 2,
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.update,
         { id: cat.id, parentId: null, participatesDre: false },
         { context: ctx },
      );

      expect(result.parentId).toBeNull();
      expect(result.level).toBe(1);
   });

   it("update rejects parentId equal to the edited category", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId);
      const ctx = createTestContext(testDb.db, { teamId });

      await expect(
         call(
            categoriesRouter.update,
            { id: cat.id, parentId: cat.id, participatesDre: false },
            { context: ctx },
         ),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
      );
   });

   it("getPaginated returns parents before children", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, {
         name: "Moradia",
      });
      const child = await makeCategory(testDb.db, teamId, {
         name: "Aluguel",
         parentId: parent.id,
         level: 2,
      });
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesRouter.getPaginated,
         { page: 1, pageSize: 20 },
         { context: ctx },
      );

      const parentIndex = result.data.findIndex((row) => row.id === parent.id);
      const childIndex = result.data.findIndex((row) => row.id === child.id);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(childIndex).toBeGreaterThan(parentIndex);
   });

   it("update does NOT enqueue derive-keywords when keywords are provided", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId);

      const ctx = createTestContext(testDb.db, { teamId });
      await call(
         categoriesRouter.update,
         {
            id: cat.id,
            name: "Manual",
            participatesDre: false,
            keywords: ["palavra1", "palavra2"],
         },
         { context: ctx },
      );

      expect(enqueueDeriveKeywordsSpy).not.toHaveBeenCalled();
   });

   it("archive sets isArchived to true on the category and descendants", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const parent = await makeCategory(testDb.db, teamId, { name: "Parent" });
      const child = await makeCategory(testDb.db, teamId, {
         name: "Child",
         parentId: parent.id,
         level: 2,
      });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesRouter.archive,
         { id: parent.id },
         { context: ctx },
      );
      expect(result.isArchived).toBe(true);

      const [childRow] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, child.id));
      expect(childRow?.isArchived).toBe(true);
   });

   it("archive on default category throws CONFLICT", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, { isDefault: true });
      const ctx = createTestContext(testDb.db, { teamId });

      await expect(
         call(categoriesRouter.archive, { id: cat.id }, { context: ctx }),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "CONFLICT",
      );
   });

   it("unarchive sets isArchived to false", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, { isArchived: true });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesRouter.unarchive,
         { id: cat.id },
         { context: ctx },
      );
      expect(result.isArchived).toBe(false);
   });

   it("bulkArchive archives all selected non-default categories", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeCategory(testDb.db, teamId, { name: "A" });
      const b = await makeCategory(testDb.db, teamId, { name: "B" });
      const c = await makeCategory(testDb.db, teamId, { name: "C" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesBulkRouter.bulkArchive,
         { ids: [a.id, b.id, c.id] },
         { context: ctx },
      );
      expect(result).toEqual({ archived: 3 });

      const rows = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.teamId, teamId));
      expect(rows.every((r) => r.isArchived)).toBe(true);
   });

   it("bulkArchive throws CONFLICT when any selected is default", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeCategory(testDb.db, teamId, { name: "A" });
      const b = await makeCategory(testDb.db, teamId, {
         name: "B",
         isDefault: true,
      });

      const ctx = createTestContext(testDb.db, { teamId });
      await expect(
         call(
            categoriesBulkRouter.bulkArchive,
            { ids: [a.id, b.id] },
            { context: ctx },
         ),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "CONFLICT",
      );
   });

   it("bulkRemove deletes selected categories including default ones without transactions", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeCategory(testDb.db, teamId, {
         name: "A",
         isDefault: true,
      });
      const b = await makeCategory(testDb.db, teamId, { name: "B" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesBulkRouter.bulkRemove,
         { ids: [a.id, b.id] },
         { context: ctx },
      );
      expect(result).toEqual({ deleted: 2 });

      const rows = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.teamId, teamId));
      expect(rows).toHaveLength(0);
   });

   it("remove deletes default category without transactions", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId, { isDefault: true });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         categoriesRouter.remove,
         { id: cat.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.teamId, teamId));
      expect(rows).toHaveLength(0);
   });

   it("importBatch inserts parents and subcategories, enqueues only parents", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         categoriesBulkRouter.importBatch,
         {
            categories: [
               {
                  name: "Receitas",
                  type: "income",
                  participatesDre: false,
                  subcategories: [{ name: "Vendas" }, { name: "Serviços" }],
               },
               {
                  name: "Despesas",
                  type: "expense",
                  participatesDre: false,
                  subcategories: [{ name: "Marketing" }],
               },
            ],
         },
         { context: ctx },
      );

      expect(result).toHaveLength(5);
      expect(enqueueDeriveKeywordsSpy).toHaveBeenCalledTimes(2);
   });

   it("regenerateKeywords enqueues a derive-keywords workflow without writing", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const cat = await makeCategory(testDb.db, teamId);

      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const result = await call(
         categoriesRouter.regenerateKeywords,
         { id: cat.id },
         { context: ctx },
      );
      expect(result).toEqual({ success: true });

      expect(enqueueDeriveKeywordsSpy).toHaveBeenCalledTimes(1);
      const [, payload] = enqueueDeriveKeywordsSpy.mock.calls[0] ?? [];
      expect(payload).toMatchObject({
         categoryId: cat.id,
      });
   });

   it("getAll returns only the team's categories", async () => {
      const { teamId: teamA } = await seedTeam(testDb.db);
      const { teamId: teamB } = await seedTeam(testDb.db);
      await makeCategory(testDb.db, teamA, { name: "A1" });
      await makeCategory(testDb.db, teamA, { name: "A2" });
      await makeCategory(testDb.db, teamB, { name: "B1" });

      const ctx = createTestContext(testDb.db, { teamId: teamA });
      const result = await call(categoriesRouter.getAll, undefined, {
         context: ctx,
      });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(["A1", "A2"]);
   });

   it("exportAll returns all team categories including archived", async () => {
      const { teamId } = await seedTeam(testDb.db);
      await makeCategory(testDb.db, teamId, { name: "Active" });
      await makeCategory(testDb.db, teamId, {
         name: "Archived",
         isArchived: true,
      });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(categoriesBulkRouter.exportAll, undefined, {
         context: ctx,
      });
      expect(result).toHaveLength(2);
   });
});
