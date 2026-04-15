import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import * as repo from "../../src/repositories/credit-cards-repository";

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

async function createBankAccount(teamId: string) {
   const [account] = await testDb.db
      .insert(bankAccounts)
      .values({
         teamId,
         name: "Test Bank Account",
         type: "checking",
         bankCode: "001",
      })
      .returning();
   return account!;
}

function validInput(
   bankAccountId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      name: "Nubank Platinum",
      closingDay: 15,
      dueDay: 22,
      bankAccountId,
      ...overrides,
   };
}

describe("credit-cards-repository", () => {
   describe("createCreditCard", () => {
      it("creates a credit card with valid data", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { brand: "mastercard" }),
         );

         expect(card).toMatchObject({
            teamId,
            name: "Nubank Platinum",
            closingDay: 15,
            dueDay: 22,
            bankAccountId: bankAccount.id,
            brand: "mastercard",
            status: "active",
            color: "#6366f1",
            creditLimit: "0.00",
         });
         expect(card.id).toBeDefined();
         expect(card.createdAt).toBeInstanceOf(Date);
      });

      it("creates a credit card with custom credit limit and color", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, {
               creditLimit: "10000.00",
               color: "#ff0000",
               brand: "visa",
            }),
         );

         expect(card.creditLimit).toBe("10000.00");
         expect(card.color).toBe("#ff0000");
         expect(card.brand).toBe("visa");
      });

      it("rejects name shorter than 2 characters", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await expect(
            repo.createCreditCard(
               testDb.db,
               teamId,
               validInput(bankAccount.id, { name: "A" }),
            ),
         ).rejects.toThrow();
      });

      it("rejects invalid closing day (0)", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await expect(
            repo.createCreditCard(
               testDb.db,
               teamId,
               validInput(bankAccount.id, { closingDay: 0 }),
            ),
         ).rejects.toThrow();
      });

      it("rejects closing day above 31", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await expect(
            repo.createCreditCard(
               testDb.db,
               teamId,
               validInput(bankAccount.id, { closingDay: 32 }),
            ),
         ).rejects.toThrow();
      });

      it("rejects invalid color format", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await expect(
            repo.createCreditCard(
               testDb.db,
               teamId,
               validInput(bankAccount.id, { color: "red" }),
            ),
         ).rejects.toThrow();
      });

      it("rejects negative credit limit", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await expect(
            repo.createCreditCard(
               testDb.db,
               teamId,
               validInput(bankAccount.id, { creditLimit: "-100" }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("listCreditCards", () => {
      it("lists credit cards for a team", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);

         await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { name: "Card A" }),
         );
         await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, {
               name: "Card B",
               closingDay: 5,
               dueDay: 10,
            }),
         );

         const result = await repo.listCreditCards(testDb.db, teamId);
         expect(result.data).toHaveLength(2);
         for (const card of result.data) {
            expect(card.teamId).toBe(teamId);
         }
      });

      it("does not return cards from other teams", async () => {
         const teamA = randomTeamId();
         const teamB = randomTeamId();
         const bankA = await createBankAccount(teamA);
         const bankB = await createBankAccount(teamB);

         await repo.createCreditCard(
            testDb.db,
            teamA,
            validInput(bankA.id, { name: "Team A Card" }),
         );
         await repo.createCreditCard(
            testDb.db,
            teamB,
            validInput(bankB.id, { name: "Team B Card" }),
         );

         const resultA = await repo.listCreditCards(testDb.db, teamA);
         expect(resultA.data).toHaveLength(1);
         expect(resultA.data[0]!.name).toBe("Team A Card");
      });
   });

   describe("getCreditCard", () => {
      it("gets a credit card by id", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const created = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { brand: "amex" }),
         );

         const found = await repo.getCreditCard(testDb.db, created.id);
         expect(found).not.toBeNull();
         expect(found!.id).toBe(created.id);
         expect(found!.name).toBe("Nubank Platinum");
         expect(found!.brand).toBe("amex");
      });

      it("returns null for non-existent id", async () => {
         const result = await repo.getCreditCard(
            testDb.db,
            crypto.randomUUID(),
         );
         expect(result).toBeNull();
      });
   });

   describe("updateCreditCard", () => {
      it("updates name, brand, and credit limit", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         const updated = await repo.updateCreditCard(testDb.db, card.id, {
            name: "Updated Name",
            brand: "elo",
            creditLimit: "5000.00",
         });

         expect(updated.name).toBe("Updated Name");
         expect(updated.brand).toBe("elo");
         expect(updated.creditLimit).toBe("5000.00");
      });

      it("throws for non-existent card", async () => {
         await expect(
            repo.updateCreditCard(testDb.db, crypto.randomUUID(), {
               name: "Ghost",
            }),
         ).rejects.toThrow();
      });
   });

   describe("deleteCreditCard", () => {
      it("deletes a credit card without open statements", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         await repo.deleteCreditCard(testDb.db, card.id);

         const rows = await testDb.db
            .select()
            .from(creditCards)
            .where(eq(creditCards.id, card.id));
         expect(rows).toHaveLength(0);
      });

      it("rejects deleting a credit card with open statements", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         await testDb.db.insert(creditCardStatements).values({
            creditCardId: card.id,
            statementPeriod: "2026-03",
            closingDate: "2026-03-10",
            dueDate: "2026-03-20",
            status: "open",
         });

         await expect(
            repo.deleteCreditCard(testDb.db, card.id),
         ).rejects.toThrow(/faturas abertas/);

         const rows = await testDb.db
            .select()
            .from(creditCards)
            .where(eq(creditCards.id, card.id));
         expect(rows).toHaveLength(1);
      });

      it("allows deleting when paid statements are removed first", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         const [statement] = await testDb.db
            .insert(creditCardStatements)
            .values({
               creditCardId: card.id,
               statementPeriod: "2026-02",
               closingDate: "2026-02-10",
               dueDate: "2026-02-20",
               status: "paid",
            })
            .returning();

         await testDb.db
            .delete(creditCardStatements)
            .where(eq(creditCardStatements.id, statement!.id));

         await repo.deleteCreditCard(testDb.db, card.id);

         const rows = await testDb.db
            .select()
            .from(creditCards)
            .where(eq(creditCards.id, card.id));
         expect(rows).toHaveLength(0);
      });
   });

   describe("bulkDeleteCreditCards", () => {
      it("deletes multiple cards belonging to the team", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card1 = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { name: "Card One" }),
         );
         const card2 = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { name: "Card Two" }),
         );

         await repo.bulkDeleteCreditCards(
            testDb.db,
            [card1.id, card2.id],
            teamId,
         );

         const rows = await testDb.db
            .select()
            .from(creditCards)
            .where(eq(creditCards.id, card1.id));
         expect(rows).toHaveLength(0);
      });

      it("throws conflict when any card has open statements", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card1 = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { name: "Card Safe" }),
         );
         const card2 = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id, { name: "Card With Statement" }),
         );

         await testDb.db.insert(creditCardStatements).values({
            creditCardId: card2.id,
            statementPeriod: "2026-04",
            closingDate: "2026-04-10",
            dueDate: "2026-04-20",
            status: "open",
         });

         await expect(
            repo.bulkDeleteCreditCards(testDb.db, [card1.id, card2.id], teamId),
         ).rejects.toThrow(/faturas abertas/);
      });

      it("throws notFound when an id does not belong to the team", async () => {
         const teamId = randomTeamId();
         const otherTeamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const otherBankAccount = await createBankAccount(otherTeamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );
         const otherCard = await repo.createCreditCard(
            testDb.db,
            otherTeamId,
            validInput(otherBankAccount.id),
         );

         await expect(
            repo.bulkDeleteCreditCards(
               testDb.db,
               [card.id, otherCard.id],
               teamId,
            ),
         ).rejects.toThrow();
      });
   });

   describe("creditCardHasOpenStatements", () => {
      it("returns false when no statements exist", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         const result = await repo.creditCardHasOpenStatements(
            testDb.db,
            card.id,
         );
         expect(result).toBe(false);
      });

      it("returns true when open statements exist", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         await testDb.db.insert(creditCardStatements).values({
            creditCardId: card.id,
            statementPeriod: "2026-04",
            closingDate: "2026-04-10",
            dueDate: "2026-04-20",
            status: "open",
         });

         const result = await repo.creditCardHasOpenStatements(
            testDb.db,
            card.id,
         );
         expect(result).toBe(true);
      });

      it("returns false when only paid statements exist", async () => {
         const teamId = randomTeamId();
         const bankAccount = await createBankAccount(teamId);
         const card = await repo.createCreditCard(
            testDb.db,
            teamId,
            validInput(bankAccount.id),
         );

         await testDb.db.insert(creditCardStatements).values({
            creditCardId: card.id,
            statementPeriod: "2026-05",
            closingDate: "2026-05-10",
            dueDate: "2026-05-20",
            status: "paid",
         });

         const result = await repo.creditCardHasOpenStatements(
            testDb.db,
            card.id,
         );
         expect(result).toBe(false);
      });
   });
});
