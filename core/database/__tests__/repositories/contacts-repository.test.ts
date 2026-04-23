import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { transactions } from "@core/database/schemas/transactions";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import * as repo from "../../src/repositories/contacts-repository";

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
      name: "João Silva",
      type: "cliente" as const,
      ...overrides,
   };
}

describe("contacts-repository", () => {
   describe("validators", () => {
      it("rejects name shorter than 2 characters", async () => {
         const teamId = randomTeamId();
         const result = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "A" }),
         );
         expect(result.isErr()).toBe(true);
      });

      it("rejects name longer than 120 characters", async () => {
         const teamId = randomTeamId();
         const result = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "A".repeat(121) }),
         );
         expect(result.isErr()).toBe(true);
      });

      it("rejects invalid email", async () => {
         const teamId = randomTeamId();
         const result = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ email: "not-an-email" }),
         );
         expect(result.isErr()).toBe(true);
      });
   });

   describe("createContact", () => {
      it("creates a contact and returns it", async () => {
         const teamId = randomTeamId();
         const result = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const contact = result._unsafeUnwrap();

         expect(contact).toMatchObject({
            teamId,
            name: "João Silva",
            type: "cliente",
            isArchived: false,
         });
         expect(contact.id).toBeDefined();
      });
   });

   describe("listContacts", () => {
      it("lists active contacts only by default", async () => {
         const teamId = randomTeamId();
         await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Active" }),
         );
         const archivedResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         const archived = archivedResult._unsafeUnwrap();
         await repo.archiveContact(testDb.db, archived.id);

         const listResult = await repo.listContacts(testDb.db, teamId);
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all contacts when includeArchived is true", async () => {
         const teamId = randomTeamId();
         await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Contact A" }),
         );
         const bResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Contact B" }),
         );
         const b = bResult._unsafeUnwrap();
         await repo.archiveContact(testDb.db, b.id);

         const listResult = await repo.listContacts(
            testDb.db,
            teamId,
            undefined,
            true,
         );
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(2);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Cliente", type: "cliente" }),
         );
         await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput({ name: "Fornecedor", type: "fornecedor" }),
         );

         const listResult = await repo.listContacts(
            testDb.db,
            teamId,
            "fornecedor",
         );
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Fornecedor");
      });
   });

   describe("getContact", () => {
      it("returns contact by id", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const created = createdResult._unsafeUnwrap();

         const foundResult = await repo.getContact(testDb.db, created.id);
         const found = foundResult._unsafeUnwrap();
         expect(found).toMatchObject({ id: created.id, name: "João Silva" });
      });

      it("returns null for non-existent id", async () => {
         const result = await repo.getContact(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });

   describe("updateContact", () => {
      it("updates a contact", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const created = createdResult._unsafeUnwrap();

         const updatedResult = await repo.updateContact(testDb.db, created.id, {
            name: "Maria Silva",
         });
         const updated = updatedResult._unsafeUnwrap();

         expect(updated.name).toBe("Maria Silva");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("archiveContact", () => {
      it("archives a contact", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const created = createdResult._unsafeUnwrap();

         const archivedResult = await repo.archiveContact(
            testDb.db,
            created.id,
         );
         const archived = archivedResult._unsafeUnwrap();
         expect(archived.isArchived).toBe(true);
      });
   });

   describe("reactivateContact", () => {
      it("reactivates an archived contact", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const created = createdResult._unsafeUnwrap();
         await repo.archiveContact(testDb.db, created.id);

         const reactivatedResult = await repo.reactivateContact(
            testDb.db,
            created.id,
         );
         const reactivated = reactivatedResult._unsafeUnwrap();
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("deleteContact", () => {
      it("deletes a contact without links", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const created = createdResult._unsafeUnwrap();

         await repo.deleteContact(testDb.db, created.id);
         const foundResult = await repo.getContact(testDb.db, created.id);
         expect(foundResult._unsafeUnwrap()).toBeNull();
      });

      it("rejects deleting a contact with transactions", async () => {
         const teamId = randomTeamId();
         const contactResult = await repo.createContact(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const contact = contactResult._unsafeUnwrap();

         const [account] = await testDb.db
            .insert(bankAccounts)
            .values({
               teamId,
               name: "Conta",
               type: "checking",
               initialBalance: "0",
            })
            .returning();

         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account!.id,
            contactId: contact.id,
         });

         const result = await repo.deleteContact(testDb.db, contact.id);
         expect(result.isErr()).toBe(true);
         expect(result._unsafeUnwrapErr().message).toMatch(
            /lançamentos vinculados/,
         );
      });
   });
});
