import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { tags } from "@core/database/schemas/tags";
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
         const tag = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         expect(tag).toMatchObject({
            teamId,
            name: "Projeto Alpha",
            color: "#6366f1",
            description: null,
            isArchived: false,
            isDefault: false,
         });
         expect(tag.id).toBeDefined();
      });

      it("creates tag with description and color", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({
                  description: "Tag de teste",
                  color: "#ff0000",
               }),
            )
         )._unsafeUnwrap();

         expect(tag.description).toBe("Tag de teste");
         expect(tag.color).toBe("#ff0000");
      });

      it("rejects duplicate name within same team", async () => {
         const teamId = randomTeamId();
         (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         const result = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         expect(result.isErr()).toBe(true);
      });

      it("allows same name in different teams", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         (
            await repo.createTag(testDb.db, teamA, validCreateInput())
         )._unsafeUnwrap();

         expect(
            (
               await repo.createTag(testDb.db, teamB, validCreateInput())
            )._unsafeUnwrap(),
         ).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         const result = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "A" }),
         );
         expect(result._unsafeUnwrapErr()).toMatchObject({
            cause: expect.stringMatching(/mínimo/),
         });
      });

      it("rejects name longer than 120 chars", async () => {
         const teamId = randomTeamId();
         const result = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ name: "A".repeat(121) }),
         );
         expect(result._unsafeUnwrapErr()).toMatchObject({
            cause: expect.stringMatching(/máximo/),
         });
      });

      it("rejects invalid color format", async () => {
         const teamId = randomTeamId();
         const result = await repo.createTag(
            testDb.db,
            teamId,
            validCreateInput({ color: "red" }),
         );
         expect(result._unsafeUnwrapErr()).toMatchObject({
            cause: expect.stringMatching(/hex/),
         });
      });
   });

   describe("listTags", () => {
      it("lists tags for a team", async () => {
         const teamId = randomTeamId();
         (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Tag A" }),
            )
         )._unsafeUnwrap();
         (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Tag B" }),
            )
         )._unsafeUnwrap();

         const list = (await repo.listTags(testDb.db, teamId))._unsafeUnwrap();
         expect(list).toHaveLength(2);
      });

      it("does not list archived by default", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Archived" }),
            )
         )._unsafeUnwrap();
         (await repo.archiveTag(testDb.db, tag.id))._unsafeUnwrap();

         const list = (await repo.listTags(testDb.db, teamId))._unsafeUnwrap();
         expect(list).toHaveLength(0);
      });

      it("lists archived when includeArchived=true", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Archived" }),
            )
         )._unsafeUnwrap();
         (await repo.archiveTag(testDb.db, tag.id))._unsafeUnwrap();

         const list = (
            await repo.listTags(testDb.db, teamId, { includeArchived: true })
         )._unsafeUnwrap();
         expect(list).toHaveLength(1);
      });

      it("orders by name ascending", async () => {
         const teamId = randomTeamId();
         (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Zebra" }),
            )
         )._unsafeUnwrap();
         (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Alpha" }),
            )
         )._unsafeUnwrap();

         const list = (await repo.listTags(testDb.db, teamId))._unsafeUnwrap();
         expect(list[0]!.name).toBe("Alpha");
         expect(list[1]!.name).toBe("Zebra");
      });

      it("does not return other team's tags", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         (
            await repo.createTag(
               testDb.db,
               teamA,
               validCreateInput({ name: "Tag A" }),
            )
         )._unsafeUnwrap();
         (
            await repo.createTag(
               testDb.db,
               teamB,
               validCreateInput({ name: "Tag B" }),
            )
         )._unsafeUnwrap();

         const list = (await repo.listTags(testDb.db, teamA))._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Tag A");
      });
   });

   describe("getTag", () => {
      it("returns tag by id", async () => {
         const teamId = randomTeamId();
         const created = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         const found = (
            await repo.getTag(testDb.db, created.id)
         )._unsafeUnwrap();
         expect(found).toMatchObject({ id: created.id, name: "Projeto Alpha" });
      });

      it("returns null for nonexistent id", async () => {
         const found = (
            await repo.getTag(testDb.db, crypto.randomUUID())
         )._unsafeUnwrap();
         expect(found).toBeNull();
      });
   });

   describe("updateTag", () => {
      it("updates tag name", async () => {
         const teamId = randomTeamId();
         const created = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         const updated = (
            await repo.updateTag(testDb.db, created.id, { name: "Novo Nome" })
         )._unsafeUnwrap();
         expect(updated.name).toBe("Novo Nome");
         expect(updated.id).toBe(created.id);
      });

      it("updates tag description", async () => {
         const teamId = randomTeamId();
         const created = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         const updated = (
            await repo.updateTag(testDb.db, created.id, {
               description: "Nova descrição",
            })
         )._unsafeUnwrap();
         expect(updated.description).toBe("Nova descrição");
      });

      it("rejects updating nonexistent tag", async () => {
         const result = await repo.updateTag(testDb.db, crypto.randomUUID(), {
            name: "Nope",
         });
         expect(result._unsafeUnwrapErr().message).toMatch(/não encontrad/);
      });
   });

   describe("archiveTag", () => {
      it("archives tag", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         const archived = (
            await repo.archiveTag(testDb.db, tag.id)
         )._unsafeUnwrap();
         expect(archived.isArchived).toBe(true);
      });

      it("rejects archiving nonexistent tag", async () => {
         const result = await repo.archiveTag(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrapErr().message).toMatch(/não encontrad/);
      });
   });

   describe("reactivateTag", () => {
      it("reactivates archived tag", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();
         (await repo.archiveTag(testDb.db, tag.id))._unsafeUnwrap();

         const reactivated = (
            await repo.reactivateTag(testDb.db, tag.id)
         )._unsafeUnwrap();
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("bulkDeleteTags", () => {
      it("deletes multiple tags with no transactions", async () => {
         const teamId = randomTeamId();
         const tag1 = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Bulk A" }),
            )
         )._unsafeUnwrap();
         const tag2 = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Bulk B" }),
            )
         )._unsafeUnwrap();

         (
            await repo.bulkDeleteTags(testDb.db, [tag1.id, tag2.id], teamId)
         )._unsafeUnwrap();

         expect(
            (await repo.getTag(testDb.db, tag1.id))._unsafeUnwrap(),
         ).toBeNull();
         expect(
            (await repo.getTag(testDb.db, tag2.id))._unsafeUnwrap(),
         ).toBeNull();
      });

      it("rejects if any tag belongs to another team", async () => {
         const teamId = randomTeamId();
         const otherTeamId = randomTeamId();
         const tag1 = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Mine Bulk" }),
            )
         )._unsafeUnwrap();
         const tag2 = (
            await repo.createTag(
               testDb.db,
               otherTeamId,
               validCreateInput({ name: "Other Bulk" }),
            )
         )._unsafeUnwrap();

         const result = await repo.bulkDeleteTags(
            testDb.db,
            [tag1.id, tag2.id],
            teamId,
         );
         expect(result._unsafeUnwrapErr().message).toMatch(
            /não foram encontrados/,
         );
      });

      it("rejects if any tag has transactions", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Com Lancamentos Bulk" }),
            )
         )._unsafeUnwrap();

         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "50.00",
            date: "2025-01-15",
            tagId: tag.id,
         });

         const result = await repo.bulkDeleteTags(testDb.db, [tag.id], teamId);
         expect(result._unsafeUnwrapErr().message).toMatch(/lançamentos/);
      });
   });

   describe("deleteTag", () => {
      it("deletes tag without transactions", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

         (await repo.deleteTag(testDb.db, tag.id))._unsafeUnwrap();
         const found = (await repo.getTag(testDb.db, tag.id))._unsafeUnwrap();
         expect(found).toBeNull();
      });

      it("rejects deleting tag with transactions", async () => {
         const teamId = randomTeamId();
         const tag = (
            await repo.createTag(testDb.db, teamId, validCreateInput())
         )._unsafeUnwrap();

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
            tagId: tag.id,
         });

         const result = await repo.deleteTag(testDb.db, tag.id);
         expect(result._unsafeUnwrapErr().message).toMatch(/lançamentos/);
      });

      it("rejects deleting nonexistent tag", async () => {
         const result = await repo.deleteTag(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrapErr().message).toMatch(/não encontrad/);
      });

      it("rejects deleting default tag", async () => {
         const teamId = randomTeamId();
         const [tag] = await testDb.db
            .insert(tags)
            .values({ teamId, name: "Padrão", isDefault: true })
            .returning();

         const result = await repo.deleteTag(testDb.db, tag!.id);
         expect(result._unsafeUnwrapErr().message).toMatch(/padrão/);
      });
   });

   describe("bulkDeleteTags — isDefault", () => {
      it("rejects bulk delete when any tag is default", async () => {
         const teamId = randomTeamId();
         const [defaultTag] = await testDb.db
            .insert(tags)
            .values({ teamId, name: "Padrão Bulk", isDefault: true })
            .returning();
         const normal = (
            await repo.createTag(
               testDb.db,
               teamId,
               validCreateInput({ name: "Normal" }),
            )
         )._unsafeUnwrap();

         const result = await repo.bulkDeleteTags(
            testDb.db,
            [defaultTag!.id, normal.id],
            teamId,
         );
         expect(result._unsafeUnwrapErr().message).toMatch(/padrão/);
      });
   });
});
