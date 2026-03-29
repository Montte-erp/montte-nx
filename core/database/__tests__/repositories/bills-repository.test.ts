import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bills, recurrenceSettings } from "@core/database/schemas/bills";
import { contacts } from "@core/database/schemas/contacts";
import * as repo from "../../src/repositories/bills-repository";
import { and, desc, eq } from "drizzle-orm";

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
      name: "Aluguel",
      type: "payable" as const,
      amount: "1500.00",
      dueDate: "2026-02-01",
      ...overrides,
   };
}

describe("bills-repository", () => {
   describe("validators", () => {
      it("rejects amount <= 0", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(
               testDb.db,
               teamId,
               validCreateInput({ amount: "0" }),
            ),
         ).rejects.toThrow(/validation failed/);
      });

      it("rejects invalid dueDate format", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(
               testDb.db,
               teamId,
               validCreateInput({ dueDate: "01/02/2026" }),
            ),
         ).rejects.toThrow(/validation failed/);
      });

      it("rejects name shorter than 2 characters", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(testDb.db, teamId, validCreateInput({ name: "A" })),
         ).rejects.toThrow(/validation failed/);
      });

      it("rejects missing type", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(testDb.db, teamId, {
               ...validCreateInput(),
               type: undefined,
            } as any),
         ).rejects.toThrow();
      });
   });

   describe("createBill", () => {
      it("creates a bill and returns it", async () => {
         const teamId = randomTeamId();
         const bill = await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         expect(bill).toMatchObject({
            teamId,
            name: "Aluguel",
            type: "payable",
            status: "pending",
            amount: "1500.00",
         });
         expect(bill.id).toBeDefined();
      });

      it("creates a bill with contactId FK", async () => {
         const teamId = randomTeamId();
         const [contact] = await testDb.db
            .insert(contacts)
            .values({ teamId, name: "Landlord", type: "fornecedor" })
            .returning();

         const bill = await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ contactId: contact!.id }),
         );

         expect(bill.contactId).toBe(contact!.id);
      });
   });

   describe("listBills (via direct query — RAW where not supported in PGlite)", () => {
      it("lists bills by teamId", async () => {
         const teamId = randomTeamId();
         await repo.createBill(testDb.db, teamId, validCreateInput());

         const rows = await testDb.db
            .select()
            .from(bills)
            .where(eq(bills.teamId, teamId));
         expect(rows).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ type: "payable" }),
         );
         await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ name: "Receita", type: "receivable" }),
         );

         const rows = await testDb.db
            .select()
            .from(bills)
            .where(and(eq(bills.teamId, teamId), eq(bills.type, "receivable")));
         expect(rows).toHaveLength(1);
      });

      it("filters by status", async () => {
         const teamId = randomTeamId();
         await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ dueDate: "2099-01-01" }),
         );
         await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ name: "Pago", dueDate: "2099-02-01" }),
         );

         const rows = await testDb.db
            .select()
            .from(bills)
            .where(and(eq(bills.teamId, teamId), eq(bills.status, "pending")));
         expect(rows).toHaveLength(2);
      });
   });

   describe("getBill (via direct query — relational with not supported in PGlite)", () => {
      it("returns bill by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const [found] = await testDb.db
            .select()
            .from(bills)
            .where(eq(bills.id, created.id));
         expect(found).toBeDefined();
         expect(found?.name).toBe("Aluguel");
      });

      it("returns undefined for non-existent id", async () => {
         const rows = await testDb.db
            .select()
            .from(bills)
            .where(eq(bills.id, crypto.randomUUID()));
         expect(rows).toHaveLength(0);
      });
   });

   describe("updateBill", () => {
      it("updates a bill", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateBill(testDb.db, created.id, {
            name: "Aluguel Atualizado",
         });
         expect(updated.name).toBe("Aluguel Atualizado");
      });
   });

   describe("deleteBill", () => {
      it("deletes a bill", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         await repo.deleteBill(testDb.db, created.id);
         const rows = await testDb.db
            .select()
            .from(bills)
            .where(eq(bills.id, created.id));
         expect(rows).toHaveLength(0);
      });
   });

   describe("createBillsBatch", () => {
      it("creates multiple bills at once", async () => {
         const teamId = randomTeamId();
         const batch = [
            {
               teamId,
               name: "Parcela 1/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-01-01",
               status: "pending" as const,
            },
            {
               teamId,
               name: "Parcela 2/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-02-01",
               status: "pending" as const,
            },
            {
               teamId,
               name: "Parcela 3/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-03-01",
               status: "pending" as const,
            },
         ];

         const result = await repo.createBillsBatch(testDb.db, batch);
         expect(result).toHaveLength(3);
      });
   });

   describe("recurrence", () => {
      it("creates a recurrence setting", async () => {
         const teamId = randomTeamId();
         const setting = await repo.createRecurrenceSetting(testDb.db, teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         expect(setting).toMatchObject({
            teamId,
            frequency: "monthly",
            windowMonths: 3,
         });
         expect(setting.id).toBeDefined();
      });

      it("gets active recurrence settings (via direct query)", async () => {
         const teamId = randomTeamId();
         await repo.createRecurrenceSetting(testDb.db, teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         const settings = await testDb.db
            .select()
            .from(recurrenceSettings)
            .where(eq(recurrenceSettings.teamId, teamId));
         expect(settings.length).toBeGreaterThanOrEqual(1);
      });

      it("gets last bill for recurrence group (via direct query)", async () => {
         const teamId = randomTeamId();
         const setting = await repo.createRecurrenceSetting(testDb.db, teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         const batch = [
            {
               teamId,
               name: "Recorrente",
               type: "payable" as const,
               amount: "100.00",
               dueDate: "2026-01-01",
               status: "pending" as const,
               recurrenceGroupId: setting.id,
            },
            {
               teamId,
               name: "Recorrente",
               type: "payable" as const,
               amount: "100.00",
               dueDate: "2026-02-01",
               status: "pending" as const,
               recurrenceGroupId: setting.id,
            },
         ];
         await repo.createBillsBatch(testDb.db, batch);

         const [last] = await testDb.db
            .select()
            .from(bills)
            .where(eq(bills.recurrenceGroupId, setting.id))
            .orderBy(desc(bills.dueDate))
            .limit(1);
         expect(last?.dueDate).toBe("2026-02-01");
      });
   });

   describe("contactId FK restrict", () => {
      it("prevents deleting contact linked to a bill", async () => {
         const teamId = randomTeamId();
         const [contact] = await testDb.db
            .insert(contacts)
            .values({ teamId, name: "Fornecedor", type: "fornecedor" })
            .returning();

         await repo.createBill(
            testDb.db,
            teamId,
            validCreateInput({ contactId: contact!.id }),
         );

         await expect(
            testDb.db.delete(contacts).where(eq(contacts.id, contact!.id)),
         ).rejects.toThrow();
      });
   });
});
