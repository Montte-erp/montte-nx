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
import { tags } from "@core/database/schemas/tags";
import { makeTag } from "../helpers/classification-factories";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as tagsRouter from "../../src/router/tags";

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

describe("tags router", () => {
   it("create inserts a tag scoped to team", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      const result = await call(
         tagsRouter.create,
         { name: "Operações" },
         { context: ctx },
      );

      expect(result.teamId).toBe(teamId);
      expect(result.name).toBe("Operações");

      const [persisted] = await testDb.db
         .select()
         .from(tags)
         .where(eq(tags.id, result.id));
      expect(persisted?.name).toBe("Operações");
   });

   it("update on cross-team tag throws NOT_FOUND", async () => {
      const { teamId: otherTeamId } = await seedTeam(testDb.db);
      const tag = await makeTag(testDb.db, otherTeamId);
      const { teamId } = await seedTeam(testDb.db);

      const ctx = createTestContext(testDb.db, { teamId });
      await expect(
         call(
            tagsRouter.update,
            { id: tag.id, name: "Hack" },
            { context: ctx },
         ),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "NOT_FOUND",
      );
   });

   it("update changes name", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const tag = await makeTag(testDb.db, teamId);

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.update,
         { id: tag.id, name: "Novo Nome" },
         { context: ctx },
      );

      expect(result.name).toBe("Novo Nome");
   });

   it("archive sets isArchived to true", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const tag = await makeTag(testDb.db, teamId);

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.archive,
         { id: tag.id },
         { context: ctx },
      );
      expect(result.isArchived).toBe(true);
   });

   it("unarchive sets isArchived back to false", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const tag = await makeTag(testDb.db, teamId, { isArchived: true });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.unarchive,
         { id: tag.id },
         { context: ctx },
      );
      expect(result.isArchived).toBe(false);
   });

   it("bulkArchive archives all selected tags", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeTag(testDb.db, teamId, { name: "A" });
      const b = await makeTag(testDb.db, teamId, { name: "B" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.bulkArchive,
         { ids: [a.id, b.id] },
         { context: ctx },
      );
      expect(result).toEqual({ archived: 2 });

      const rows = await testDb.db
         .select()
         .from(tags)
         .where(eq(tags.teamId, teamId));
      expect(rows.every((r) => r.isArchived)).toBe(true);
   });

   it("bulkArchive throws NOT_FOUND when any id is not in the team", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeTag(testDb.db, teamId);
      const orphanId = crypto.randomUUID();

      const ctx = createTestContext(testDb.db, { teamId });
      await expect(
         call(
            tagsRouter.bulkArchive,
            { ids: [a.id, orphanId] },
            { context: ctx },
         ),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "NOT_FOUND",
      );
   });

   it("bulkRemove deletes all selected non-default tags", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeTag(testDb.db, teamId, { name: "A" });
      const b = await makeTag(testDb.db, teamId, { name: "B" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.bulkRemove,
         { ids: [a.id, b.id] },
         { context: ctx },
      );
      expect(result).toEqual({ deleted: 2 });

      const rows = await testDb.db
         .select()
         .from(tags)
         .where(eq(tags.teamId, teamId));
      expect(rows).toHaveLength(0);
   });

   it("bulkRemove throws FORBIDDEN when any selected is default", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const a = await makeTag(testDb.db, teamId, { name: "A" });
      const b = await makeTag(testDb.db, teamId, {
         name: "B",
         isDefault: true,
      });

      const ctx = createTestContext(testDb.db, { teamId });
      await expect(
         call(tagsRouter.bulkRemove, { ids: [a.id, b.id] }, { context: ctx }),
      ).rejects.toSatisfy(
         (e: Error & { code?: string }) => e.code === "FORBIDDEN",
      );
   });

   it("getStats returns counts of active and archived", async () => {
      const { teamId } = await seedTeam(testDb.db);
      await makeTag(testDb.db, teamId, { name: "Active1" });
      await makeTag(testDb.db, teamId, { name: "Active2" });
      await makeTag(testDb.db, teamId, {
         name: "Archived1",
         isArchived: true,
      });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(tagsRouter.getStats, undefined, {
         context: ctx,
      });
      expect(result.active).toBe(2);
      expect(result.archived).toBe(1);
   });

   it("bulkCreate inserts all items", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId });

      const result = await call(
         tagsRouter.bulkCreate,
         {
            items: [{ name: "Tag1" }, { name: "Tag2" }, { name: "Tag3" }],
         },
         { context: ctx },
      );
      expect(result).toHaveLength(3);
   });

   it("getAll returns paginated team tags", async () => {
      const { teamId } = await seedTeam(testDb.db);
      await makeTag(testDb.db, teamId, { name: "Alpha" });
      await makeTag(testDb.db, teamId, { name: "Beta" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.getAll,
         { page: 1, pageSize: 20 },
         { context: ctx },
      );
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
   });

   it("getAll filters by search across name and description", async () => {
      const { teamId } = await seedTeam(testDb.db);
      await makeTag(testDb.db, teamId, { name: "Operações" });
      await makeTag(testDb.db, teamId, { name: "Marketing" });

      const ctx = createTestContext(testDb.db, { teamId });
      const result = await call(
         tagsRouter.getAll,
         { search: "Oper", page: 1, pageSize: 20 },
         { context: ctx },
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Operações");
   });
});
