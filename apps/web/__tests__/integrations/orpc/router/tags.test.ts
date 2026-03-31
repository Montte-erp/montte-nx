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

import { transactions } from "@core/database/schemas/transactions";
import { transactionTags } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as tagsRouter from "@/integrations/orpc/router/tags";

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
   await ctx.db.execute(sql`DELETE FROM transaction_tags`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM tags`);
});

describe("create", () => {
   it("creates a tag and persists it", async () => {
      const result = await call(
         tagsRouter.create,
         { name: "Marketing", color: "#6366f1" },
         { context: ctx },
      );

      expect(result.name).toBe("Marketing");
      expect(result.color).toBe("#6366f1");
      expect(result.isArchived).toBe(false);

      const rows = await ctx.db.query.tags.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("creates a tag with description", async () => {
      const result = await call(
         tagsRouter.create,
         { name: "Vendas", description: "Departamento de vendas" },
         { context: ctx },
      );

      expect(result.name).toBe("Vendas");
      expect(result.description).toBe("Departamento de vendas");
   });
});

describe("getAll", () => {
   it("lists tags for the team", async () => {
      await call(tagsRouter.create, { name: "Alpha" }, { context: ctx });
      await call(tagsRouter.create, { name: "Beta" }, { context: ctx });

      const result = await call(tagsRouter.getAll, undefined, { context: ctx });

      expect(result).toHaveLength(2);
   });

   it("does not list archived tags", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Old" },
         { context: ctx },
      );
      await call(tagsRouter.archive, { id: created.id }, { context: ctx });

      const result = await call(tagsRouter.getAll, undefined, { context: ctx });
      expect(result).toHaveLength(0);
   });

   it("does not list tags from another team", async () => {
      await call(tagsRouter.create, { name: "Private" }, { context: ctx });

      const result = await call(tagsRouter.getAll, undefined, {
         context: ctx2,
      });
      expect(result).toHaveLength(0);
   });
});

describe("update", () => {
   it("updates tag after ownership check", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Marketing" },
         { context: ctx },
      );

      const updated = await call(
         tagsRouter.update,
         { id: created.id, name: "Vendas" },
         { context: ctx },
      );

      expect(updated.name).toBe("Vendas");

      const fromDb = await ctx.db.query.tags.findFirst({
         where: (fields, { eq }) => eq(fields.id, created.id),
      });
      expect(fromDb!.name).toBe("Vendas");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Private" },
         { context: ctx },
      );

      await expect(
         call(
            tagsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Tag não encontrada.");
   });
});

describe("remove", () => {
   it("deletes tag with no transactions", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Deletar" },
         { context: ctx },
      );

      const result = await call(
         tagsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.tags.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion when tag has transactions", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Com Lancamentos" },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;

      const [txn] = await ctx.db
         .insert(transactions)
         .values({
            teamId,
            type: "income",
            amount: "50.00",
            date: "2025-01-15",
         })
         .returning();

      await ctx.db.insert(transactionTags).values({
         transactionId: txn!.id,
         tagId: created.id,
      });

      await expect(
         call(tagsRouter.remove, { id: created.id }, { context: ctx }),
      ).rejects.toThrow(
         "Tag com lançamentos não pode ser excluída. Use arquivamento.",
      );
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Private" },
         { context: ctx },
      );

      await expect(
         call(tagsRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Tag não encontrada.");
   });
});

describe("bulkRemove", () => {
   it("deletes multiple tags and returns deleted count", async () => {
      const tag1 = await call(
         tagsRouter.create,
         { name: "Tag1" },
         { context: ctx },
      );
      const tag2 = await call(
         tagsRouter.create,
         { name: "Tag2" },
         { context: ctx },
      );

      const result = await call(
         tagsRouter.bulkRemove,
         { ids: [tag1.id, tag2.id] },
         { context: ctx },
      );

      expect(result).toEqual({ deleted: 2 });

      const rows = await ctx.db.query.tags.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects if any tag belongs to another team", async () => {
      const tag1 = await call(
         tagsRouter.create,
         { name: "Mine" },
         { context: ctx },
      );
      const tag2 = await call(
         tagsRouter.create,
         { name: "Other" },
         { context: ctx2 },
      );

      await expect(
         call(
            tagsRouter.bulkRemove,
            { ids: [tag1.id, tag2.id] },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });

   it("rejects if any tag has transactions", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Com Lancamentos" },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;

      const [txn] = await ctx.db
         .insert(transactions)
         .values({
            teamId,
            type: "income",
            amount: "50.00",
            date: "2025-01-15",
         })
         .returning();

      await ctx.db.insert(transactionTags).values({
         transactionId: txn!.id,
         tagId: created.id,
      });

      await expect(
         call(tagsRouter.bulkRemove, { ids: [created.id] }, { context: ctx }),
      ).rejects.toThrow(
         "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
      );
   });
});

describe("archive", () => {
   it("archives tag after ownership check", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Arquivar" },
         { context: ctx },
      );

      const result = await call(
         tagsRouter.archive,
         { id: created.id },
         { context: ctx },
      );

      expect(result.isArchived).toBe(true);

      const fromDb = await ctx.db.query.tags.findFirst({
         where: (fields, { eq }) => eq(fields.id, created.id),
      });
      expect(fromDb!.isArchived).toBe(true);
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         tagsRouter.create,
         { name: "Private" },
         { context: ctx },
      );

      await expect(
         call(tagsRouter.archive, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Tag não encontrada.");
   });
});
