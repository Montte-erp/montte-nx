import { Result } from "better-result";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import {
   creditCardStatements,
   type CreditCardStatement,
} from "@core/database/schemas/credit-card-statements";
import { creditCards } from "@core/database/schemas/credit-cards";
import { transactions } from "@core/database/schemas/transactions";
import type { DatabaseInstance } from "@core/database/client";
import { seedTeam } from "@core/database/testing/factories";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { findBlockingOpenStatement } from "../../src/router/utils";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as creditCardsRouter from "../../src/router/credit-cards";
import * as statementsRouter from "../../src/router/statements";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

function requireRow<T>(row: T | undefined, name: string) {
   if (!row) throw new Error(`${name} não foi criado.`);
   return row;
}

async function expectCardsError(promise: Promise<unknown>, status: number) {
   await expect(promise).rejects.toMatchObject({
      _tag: "CardsRouterError",
      error: { status },
   });
}

async function makeAccount(db: DatabaseInstance, teamId: string, name: string) {
   const [account] = await db
      .insert(bankAccounts)
      .values({ teamId, name })
      .returning({ id: bankAccounts.id });
   return requireRow(account, "Conta bancária");
}

async function makeCard(
   db: DatabaseInstance,
   teamId: string,
   bankAccountId: string,
   name: string,
) {
   const [card] = await db
      .insert(creditCards)
      .values({
         teamId,
         name,
         creditLimit: "1000",
         closingDay: 10,
         dueDay: 20,
         bankAccountId,
      })
      .returning({
         id: creditCards.id,
         bankAccountId: creditCards.bankAccountId,
      });
   return requireRow(card, "Cartão");
}

async function makeStatement(
   db: DatabaseInstance,
   creditCardId: string,
   statementPeriod: string,
   status: CreditCardStatement["status"] = "open",
) {
   const [statement] = await db
      .insert(creditCardStatements)
      .values({
         creditCardId,
         statementPeriod,
         closingDate: `${statementPeriod}-10`,
         dueDate: `${statementPeriod}-20`,
         status,
      })
      .returning({
         id: creditCardStatements.id,
         creditCardId: creditCardStatements.creditCardId,
         status: creditCardStatements.status,
         paymentTransactionId: creditCardStatements.paymentTransactionId,
      });
   return requireRow(statement, "Fatura");
}

type TransactionInput = {
   teamId: string;
   name?: string;
   type?: "income" | "expense" | "transfer";
   status?: "pending" | "paid" | "cancelled";
   ignored?: boolean;
   creditCardId?: string | null;
   bankAccountId?: string | null;
   statementPeriod?: string | null;
};

async function makeTransaction(db: DatabaseInstance, input: TransactionInput) {
   const [transaction] = await db
      .insert(transactions)
      .values({
         teamId: input.teamId,
         name: input.name ?? "Pagamento da fatura",
         type: input.type ?? "expense",
         amount: "100",
         date: "2026-05-18",
         status: input.status ?? "paid",
         ignored: input.ignored ?? false,
         creditCardId: input.creditCardId,
         bankAccountId: input.bankAccountId,
         statementPeriod: input.statementPeriod,
      })
      .returning({ id: transactions.id });
   return requireRow(transaction, "Transação");
}

async function seedCard(db: DatabaseInstance) {
   const team = await seedTeam(db);
   const account = await makeAccount(db, team.teamId, "Conta principal");
   const card = await makeCard(db, team.teamId, account.id, "Cartão principal");

   return { ...team, account, card };
}

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("credit cards router", () => {
   it("create rejeita conta bancária de outro time", async () => {
      const team = await seedTeam(testDb.db);
      const otherTeam = await seedTeam(testDb.db);
      const foreignAccount = await makeAccount(
         testDb.db,
         otherTeam.teamId,
         "Conta de outro time",
      );
      const ctx = createTestContext(testDb.db, team);

      await expectCardsError(
         call(
            creditCardsRouter.create,
            {
               name: "Cartão inválido",
               creditLimit: "1000",
               closingDay: 10,
               dueDay: 20,
               bankAccountId: foreignAccount.id,
            },
            { context: ctx },
         ),
         400,
      );
   });

   it("update rejeita mover cartão para conta bancária de outro time", async () => {
      const seeded = await seedCard(testDb.db);
      const otherTeam = await seedTeam(testDb.db);
      const foreignAccount = await makeAccount(
         testDb.db,
         otherTeam.teamId,
         "Conta de outro time",
      );
      const ctx = createTestContext(testDb.db, seeded);

      await expectCardsError(
         call(
            creditCardsRouter.update,
            { id: seeded.card.id, bankAccountId: foreignAccount.id },
            { context: ctx },
         ),
         400,
      );

      const [persisted] = await testDb.db
         .select({ bankAccountId: creditCards.bankAccountId })
         .from(creditCards)
         .where(eq(creditCards.id, seeded.card.id));
      expect(persisted?.bankAccountId).toBe(seeded.account.id);
   });

   it("getAll trata caracteres wildcard da busca como texto literal", async () => {
      const seeded = await seedCard(testDb.db);
      await makeCard(
         testDb.db,
         seeded.teamId,
         seeded.account.id,
         "Cartão 100% Real",
      );
      await makeCard(
         testDb.db,
         seeded.teamId,
         seeded.account.id,
         "Cartão 100X Real",
      );
      const ctx = createTestContext(testDb.db, seeded);

      const result = await call(
         creditCardsRouter.getAll,
         { search: "100%" },
         { context: ctx },
      );

      expect(result.data.map((card) => card.name)).toEqual([
         "Cartão 100% Real",
      ]);
      expect(result.totalCount).toBe(1);
   });

   it("remove bloqueia cartão com fatura aberta", async () => {
      const seeded = await seedCard(testDb.db);
      await makeStatement(testDb.db, seeded.card.id, "2026-05");
      const ctx = createTestContext(testDb.db, seeded);

      await expectCardsError(
         call(
            creditCardsRouter.remove,
            { id: seeded.card.id },
            { context: ctx },
         ),
         409,
      );

      const rows = await testDb.db
         .select()
         .from(creditCards)
         .where(eq(creditCards.id, seeded.card.id));
      expect(rows).toHaveLength(1);
   });

   it("bulkRemove deduplica ids antes de validar e remover", async () => {
      const seeded = await seedCard(testDb.db);
      const ctx = createTestContext(testDb.db, seeded);

      const result = await call(
         creditCardsRouter.bulkRemove,
         { ids: [seeded.card.id, seeded.card.id] },
         { context: ctx },
      );

      expect(result).toEqual({ deleted: 1 });

      const rows = await testDb.db
         .select()
         .from(creditCards)
         .where(eq(creditCards.id, seeded.card.id));
      expect(rows).toHaveLength(0);
   });

   it("bulkCreate cria cartões válidos e rejeita limite negativo", async () => {
      const seeded = await seedCard(testDb.db);
      const ctx = createTestContext(testDb.db, seeded);

      const result = await call(
         creditCardsRouter.bulkCreate,
         {
            cards: [
               {
                  name: "Cartão importado",
                  creditLimit: "5000",
                  closingDay: 5,
                  dueDay: 15,
                  bankAccountId: seeded.account.id,
               },
            ],
         },
         { context: ctx },
      );
      expect(result).toEqual({ created: 1 });

      await expect(
         call(
            creditCardsRouter.bulkCreate,
            {
               cards: [
                  {
                     name: "Cartão inválido",
                     creditLimit: "-1",
                     closingDay: 5,
                     dueDay: 15,
                     bankAccountId: seeded.account.id,
                  },
               ],
            },
            { context: ctx },
         ),
      ).rejects.toBeDefined();
   });
});

describe("cards utils", () => {
   it("findBlockingOpenStatement isola faturas abertas por teamId", async () => {
      const seeded = await seedCard(testDb.db);
      const otherTeam = await seedTeam(testDb.db);
      await makeStatement(testDb.db, seeded.card.id, "2026-06");

      const foreignResult = await findBlockingOpenStatement(
         testDb.db,
         [seeded.card.id],
         otherTeam.teamId,
      );
      expect(Result.isOk(foreignResult)).toBe(true);
      if (Result.isOk(foreignResult)) {
         expect(foreignResult.value).toBeUndefined();
      }

      const ownerResult = await findBlockingOpenStatement(
         testDb.db,
         [seeded.card.id],
         seeded.teamId,
      );
      expect(Result.isOk(ownerResult)).toBe(true);
      if (Result.isOk(ownerResult)) {
         expect(ownerResult.value?.creditCardId).toBe(seeded.card.id);
      }
   });
});

describe("statements router", () => {
   async function seedStatement() {
      const seeded = await seedCard(testDb.db);
      const statement = await makeStatement(
         testDb.db,
         seeded.card.id,
         "2026-07",
      );

      return { ...seeded, statement };
   }

   it("create rejeita fatura duplicada para o mesmo cartão e competência", async () => {
      const seeded = await seedCard(testDb.db);
      const ctx = createTestContext(testDb.db, seeded);
      const input = {
         creditCardId: seeded.card.id,
         statementPeriod: "2026-08",
         closingDate: "2026-08-10",
         dueDate: "2026-08-20",
      };

      const created = await call(statementsRouter.create, input, {
         context: ctx,
      });
      expect(created.statementPeriod).toBe("2026-08");

      await expectCardsError(
         call(statementsRouter.create, input, { context: ctx }),
         409,
      );
   });

   it("getById não expõe fatura para outro time", async () => {
      const seeded = await seedStatement();
      const otherTeam = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, otherTeam);

      await expectCardsError(
         call(
            statementsRouter.getById,
            { id: seeded.statement.id },
            { context: ctx },
         ),
         404,
      );
   });

   it("close fecha fatura por competência e é idempotente", async () => {
      const seeded = await seedCard(testDb.db);
      const period = "2026-09";
      await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: seeded.card.id,
         statementPeriod: period,
      });
      const ctx = createTestContext(testDb.db, seeded);

      const first = await call(
         statementsRouter.close,
         {
            creditCardId: seeded.card.id,
            statementPeriod: period,
         },
         { context: ctx },
      );
      const second = await call(
         statementsRouter.close,
         {
            creditCardId: seeded.card.id,
            statementPeriod: period,
         },
         { context: ctx },
      );

      expect(first.status).toBe("closed");
      expect(second.status).toBe("closed");
   });

   it("close mantém fatura em paid sem alterar status", async () => {
      const seeded = await seedCard(testDb.db);
      const period = "2026-10";
      await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: seeded.card.id,
         statementPeriod: period,
      });
      await makeStatement(testDb.db, seeded.card.id, period, "paid");
      const ctx = createTestContext(testDb.db, seeded);

      const first = await call(
         statementsRouter.close,
         {
            creditCardId: seeded.card.id,
            statementPeriod: period,
         },
         { context: ctx },
      );
      const second = await call(
         statementsRouter.close,
         {
            creditCardId: seeded.card.id,
            statementPeriod: period,
         },
         { context: ctx },
      );

      expect(first.status).toBe("paid");
      expect(second.status).toBe("paid");
   });

   it("markAsPaid vincula transação válida do mesmo time", async () => {
      const seeded = await seedStatement();
      const payment = await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: seeded.card.id,
      });
      const ctx = createTestContext(testDb.db, seeded);

      const result = await call(
         statementsRouter.markAsPaid,
         {
            id: seeded.statement.id,
            paymentTransactionId: payment.id,
         },
         { context: ctx },
      );

      expect(result.status).toBe("paid");
      expect(result.paymentTransactionId).toBe(payment.id);
   });

   it("markAsOpen limpa o pagamento e reabre a fatura", async () => {
      const seeded = await seedStatement();
      const payment = await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: seeded.card.id,
      });
      const ctx = createTestContext(testDb.db, seeded);

      await call(
         statementsRouter.markAsPaid,
         {
            id: seeded.statement.id,
            paymentTransactionId: payment.id,
         },
         { context: ctx },
      );
      const result = await call(
         statementsRouter.markAsOpen,
         { id: seeded.statement.id },
         { context: ctx },
      );

      expect(result.status).toBe("open");
      expect(result.paymentTransactionId).toBeNull();
   });

   it.each([
      {
         name: "tipo receita",
         transaction: { type: "income" },
         status: 400,
      },
      {
         name: "status pendente",
         transaction: { status: "pending" },
         status: 400,
      },
      {
         name: "transação ignorada",
         transaction: { ignored: true },
         status: 400,
      },
   ])("markAsPaid rejeita $name", async ({ transaction, status }) => {
      const seeded = await seedStatement();
      const payment = await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: seeded.card.id,
         ...transaction,
      });
      const ctx = createTestContext(testDb.db, seeded);

      await expectCardsError(
         call(
            statementsRouter.markAsPaid,
            {
               id: seeded.statement.id,
               paymentTransactionId: payment.id,
            },
            { context: ctx },
         ),
         status,
      );
   });

   it("markAsPaid rejeita transação de outro cartão", async () => {
      const seeded = await seedStatement();
      const otherCard = await makeCard(
         testDb.db,
         seeded.teamId,
         seeded.account.id,
         "Outro cartão",
      );
      const payment = await makeTransaction(testDb.db, {
         teamId: seeded.teamId,
         creditCardId: otherCard.id,
      });
      const ctx = createTestContext(testDb.db, seeded);

      await expectCardsError(
         call(
            statementsRouter.markAsPaid,
            {
               id: seeded.statement.id,
               paymentTransactionId: payment.id,
            },
            { context: ctx },
         ),
         400,
      );
   });

   it("markAsPaid rejeita transação de outro time", async () => {
      const seeded = await seedStatement();
      const otherTeam = await seedTeam(testDb.db);
      const payment = await makeTransaction(testDb.db, {
         teamId: otherTeam.teamId,
      });
      const ctx = createTestContext(testDb.db, seeded);

      await expectCardsError(
         call(
            statementsRouter.markAsPaid,
            {
               id: seeded.statement.id,
               paymentTransactionId: payment.id,
            },
            { context: ctx },
         ),
         404,
      );
   });
});
