import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import {
   transactions,
   transactionTags,
} from "@core/database/schemas/transactions";
import * as repo from "../../src/repositories/tags-repository";

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
      it("creates tag with correct fields", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

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
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({
               description: "Tag de teste",
               color: "#ff0000",
            }),
         );

         expect(tag.description).toBe("Tag de teste");
         expect(tag.color).toBe("#ff0000");
      });

      it("rejects duplicate name within same team", async () => {
         const teamId = randomTeamId();
         await repo.createTag(testDb.db, teamId, validCreateInput());

         await expect(
            repo.createTag(testDb.db, teamId, validCreateInput()),
         ).rejects.toThrow();
      });

      it("allows same name in different teams", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await repo.createTag(testDb.db, teamA, validCreateInput());

         await expect(
            repo.createTag(testDb.db, teamB, validCreateInput()),
         ).resolves.toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createTag(testDb.db, teamId, validCreateInput({ name: "A" })),
         ).rejects.toMatchObject({ cause: expect.stringMatching(/mínimo/) });
      });

      it("rejects name longer than 120 chars", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "A".repeat(121) }),
            ),
         ).rejects.toMatchObject({ cause: expect.stringMatching(/máximo/) });
      });

      it("rejects invalid color format", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ color: "red" }),
            ),
         ).rejects.toMatchObject({ cause: expect.stringMatching(/hex/) });
      });
   });

   describe("listTags", () => {
      it("lists tags for a team", async () => {
         const teamId = randomTeamId();
         await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Tag A" }),
         );
         await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Tag B" }),
         );

         const list = await repo.listTags(testDb.db, teamId);
         expect(list).toHaveLength(2);
      });

      it("does not list archived by default", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveTag(testDb.db, tag.id);

         const list = await repo.listTags(testDb.db, teamId);
         expect(list).toHaveLength(0);
      });

      it("lists archived when includeArchived=true", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveTag(testDb.db, tag.id);

         const list = await repo.listTags(testDb.db, teamId, {
            includeArchived: true,
         });
         expect(list).toHaveLength(1);
      });

      it("orders by name ascending", async () => {
         const teamId = randomTeamId();
         await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Zebra" }),
         );
         await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "Alpha" }),
         );

         const list = await repo.listTags(testDb.db, teamId);
         expect(list[0]!.name).toBe("Alpha");
         expect(list[1]!.name).toBe("Zebra");
      });

      it("does not return other team's tags", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         await repo.createTag(
            testDb.db,
            teamA,
            validCreateInput({ name: "Tag A" }),
         );
         await repo.createTag(
            testDb.db,
            teamB,
            validCreateInput({ name: "Tag B" }),
         );

         const list = await repo.listTags(testDb.db, teamA);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Tag A");
      });
   });

   describe("getTag", () => {
      it("returns tag by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const found = await repo.getTag(testDb.db, created.id);
         expect(found).toMatchObject({ id: created.id, name: "Projeto Alpha" });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getTag(testDb.db, crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateTag", () => {
      it("updates tag name", async () => {
         const teamId = randomTeamId();
         const created = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateTag(testDb.db, created.id, {
            name: "Novo Nome",
         });
         expect(updated.name).toBe("Novo Nome");
         expect(updated.id).toBe(created.id);
      });

      it("updates tag description", async () => {
         const teamId = randomTeamId();
         const created = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateTag(testDb.db, created.id, {
            description: "Nova descrição",
         });
         expect(updated.description).toBe("Nova descrição");
      });

      it("rejects updating nonexistent tag", async () => {
         await expect(
            repo.updateTag(testDb.db, crypto.randomUUID(), { name: "Nope" }),
         ).rejects.toThrow(/não encontrad/);
      });
   });

   describe("archiveTag", () => {
      it("archives tag", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const archived = await repo.archiveTag(testDb.db, tag.id);
         expect(archived.isArchived).toBe(true);
      });

      it("rejects archiving nonexistent tag", async () => {
         await expect(
            repo.archiveTag(testDb.db, crypto.randomUUID()),
         ).rejects.toThrow(/não encontrad/);
      });
   });

   describe("reactivateTag", () => {
      it("reactivates archived tag", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         await repo.archiveTag(testDb.db, tag.id);

         const reactivated = await repo.reactivateTag(testDb.db, tag.id);
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("deleteTag", () => {
      it("deletes tag without transactions", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         await repo.deleteTag(testDb.db, tag.id);
         const found = await repo.getTag(testDb.db, tag.id);
         expect(found).toBeNull();
      });

      it("rejects deleting tag with transactions", async () => {
         const teamId = randomTeamId();
         const tag = await repo.createTag(
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

         const [transaction] = await testDb.db
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
            transactionId: transaction!.id,
            tagId: tag.id,
         });

         await expect(repo.deleteTag(testDb.db, tag.id)).rejects.toThrow(
            /lançamentos/,
         );
      });

      it("rejects deleting nonexistent tag", async () => {
         await expect(
            repo.deleteTag(testDb.db, crypto.randomUUID()),
         ).rejects.toThrow(/não encontrad/);
      });
   });
});
