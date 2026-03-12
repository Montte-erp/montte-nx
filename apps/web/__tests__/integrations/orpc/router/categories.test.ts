import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as categoriesRouter from "@/integrations/orpc/router/categories";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM categories`);
});

describe("create", () => {
   it("creates a category and persists it", async () => {
      const result = await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );

      expect(result.name).toBe("Alimentação");
      expect(result.type).toBe("expense");
      expect(result.level).toBe(1);
      expect(result.isDefault).toBe(false);

      const rows = await ctx.db.query.categories.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("creates a subcategory under a parent", async () => {
      const parent = await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );

      const child = await call(
         categoriesRouter.create,
         { name: "Restaurantes", type: "expense", parentId: parent.id },
         { context: ctx },
      );

      expect(child.parentId).toBe(parent.id);
      expect(child.level).toBe(2);
      expect(child.type).toBe("expense");
   });

   it("creates a category with keywords", async () => {
      const result = await call(
         categoriesRouter.create,
         { name: "Transporte", type: "expense", keywords: ["uber", "taxi"] },
         { context: ctx },
      );

      expect(result.keywords).toEqual(["uber", "taxi"]);
   });
});

describe("getAll", () => {
   it("lists categories for the team", async () => {
      await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );
      await call(
         categoriesRouter.create,
         { name: "Salário", type: "income" },
         { context: ctx },
      );

      const result = await call(categoriesRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("filters by type", async () => {
      await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );
      await call(
         categoriesRouter.create,
         { name: "Salário", type: "income" },
         { context: ctx },
      );

      const result = await call(
         categoriesRouter.getAll,
         { type: "expense" },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Alimentação");
   });

   it("excludes archived categories by default", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Lazer", type: "expense" },
         { context: ctx },
      );

      await call(
         categoriesRouter.archive,
         { id: created.id },
         { context: ctx },
      );

      const result = await call(categoriesRouter.getAll, undefined, {
         context: ctx,
      });
      expect(result).toHaveLength(0);
   });

   it("includes archived when requested", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Lazer", type: "expense" },
         { context: ctx },
      );

      await call(
         categoriesRouter.archive,
         { id: created.id },
         { context: ctx },
      );

      const result = await call(
         categoriesRouter.getAll,
         { includeArchived: true },
         { context: ctx },
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.isArchived).toBe(true);
   });

   it("does not return categories from another team", async () => {
      await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );

      const result = await call(categoriesRouter.getAll, undefined, {
         context: ctx2,
      });
      expect(result).toHaveLength(0);
   });
});

describe("update", () => {
   it("updates category after ownership check", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );

      const updated = await call(
         categoriesRouter.update,
         { id: created.id, name: "Alimentação e Bebidas" },
         { context: ctx },
      );

      expect(updated.name).toBe("Alimentação e Bebidas");

      const fromDb = await ctx.db.query.categories.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("Alimentação e Bebidas");
   });

   it("rejects update from a different team", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );

      await expect(
         call(
            categoriesRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Categoria não encontrada.");
   });

   it("rejects update on default categories", async () => {
      await ctx.db.insert(categories).values({
         teamId: ctx.session!.session.activeTeamId!,
         name: "Default Cat",
         type: "expense",
         level: 1,
         isDefault: true,
      });

      const rows = await ctx.db.query.categories.findMany();
      const defaultCat = rows[0]!;

      await expect(
         call(
            categoriesRouter.update,
            { id: defaultCat.id, name: "Changed" },
            { context: ctx },
         ),
      ).rejects.toThrow("Categorias padrão não podem ser editadas.");
   });
});

describe("remove", () => {
   it("deletes category with no transactions", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Deletar", type: "expense" },
         { context: ctx },
      );

      const result = await call(
         categoriesRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.categories.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from a different team", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Private", type: "expense" },
         { context: ctx },
      );

      await expect(
         call(categoriesRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Categoria não encontrada.");
   });

   it("rejects deletion when category has transactions", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Com Lançamentos", type: "expense" },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;

      const [bankAccount] = await ctx.db
         .insert(
            (await import("@core/database/schemas/bank-accounts")).bankAccounts,
         )
         .values({ teamId, name: "Test Account", type: "checking" })
         .returning();

      await ctx.db.insert(transactions).values({
         teamId,
         type: "expense",
         amount: "50.00",
         date: "2025-01-15",
         categoryId: created.id,
         bankAccountId: bankAccount!.id,
      });

      await expect(
         call(categoriesRouter.remove, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Categoria com lançamentos não pode ser excluída.");
   });

   it("rejects deletion of default categories", async () => {
      await ctx.db.insert(categories).values({
         teamId: ctx.session!.session.activeTeamId!,
         name: "Default Cat",
         type: "expense",
         level: 1,
         isDefault: true,
      });

      const rows = await ctx.db.query.categories.findMany();
      const defaultCat = rows[0]!;

      await expect(
         call(categoriesRouter.remove, { id: defaultCat.id }, { context: ctx }),
      ).rejects.toThrow("Categorias padrão não podem ser excluídas.");
   });
});

describe("exportAll", () => {
   it("returns all categories including archived", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Lazer", type: "expense" },
         { context: ctx },
      );
      await call(
         categoriesRouter.create,
         { name: "Salário", type: "income" },
         { context: ctx },
      );

      await call(
         categoriesRouter.archive,
         { id: created.id },
         { context: ctx },
      );

      const result = await call(categoriesRouter.exportAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });
});

describe("importBatch", () => {
   it("creates multiple categories and persists them", async () => {
      const result = await call(
         categoriesRouter.importBatch,
         {
            categories: [
               { name: "Alimentação", type: "expense" },
               { name: "Salário", type: "income" },
            ],
         },
         { context: ctx },
      );

      expect(result).toHaveLength(2);

      const rows = await ctx.db.query.categories.findMany();
      expect(rows).toHaveLength(2);
   });
});

describe("archive", () => {
   it("archives category and persists the change", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Lazer", type: "expense" },
         { context: ctx },
      );

      const result = await call(
         categoriesRouter.archive,
         { id: created.id },
         { context: ctx },
      );

      expect(result!.isArchived).toBe(true);

      const fromDb = await ctx.db.query.categories.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.isArchived).toBe(true);
   });

   it("rejects archive from a different team", async () => {
      const created = await call(
         categoriesRouter.create,
         { name: "Private", type: "expense" },
         { context: ctx },
      );

      await expect(
         call(categoriesRouter.archive, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Categoria não encontrada.");
   });

   it("rejects archive of default categories", async () => {
      await ctx.db.insert(categories).values({
         teamId: ctx.session!.session.activeTeamId!,
         name: "Default Cat",
         type: "expense",
         level: 1,
         isDefault: true,
      });

      const rows = await ctx.db.query.categories.findMany();
      const defaultCat = rows[0]!;

      await expect(
         call(
            categoriesRouter.archive,
            { id: defaultCat.id },
            { context: ctx },
         ),
      ).rejects.toThrow("Categorias padrão não podem ser arquivadas.");
   });

   it("archives descendants too", async () => {
      const parent = await call(
         categoriesRouter.create,
         { name: "Alimentação", type: "expense" },
         { context: ctx },
      );
      await call(
         categoriesRouter.create,
         { name: "Restaurantes", type: "expense", parentId: parent.id },
         { context: ctx },
      );

      await call(categoriesRouter.archive, { id: parent.id }, { context: ctx });

      const rows = await ctx.db.query.categories.findMany();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.isArchived)).toBe(true);
   });
});
