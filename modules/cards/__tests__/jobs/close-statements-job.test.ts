import { Result } from "better-result";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { creditCards } from "@core/database/schemas/credit-cards";
import {
   creditCardStatements,
   type CreditCardStatement,
} from "@core/database/schemas/credit-card-statements";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import type { DatabaseInstance } from "@core/database/client";
import type { PgBossClient } from "@core/pg-boss/client";

import * as closeStatementsJob from "../../src/jobs/close-statements-job";

type DbSetup = Awaited<ReturnType<typeof setupTestDb>>;

type StatementData = {
   statementPeriod: string;
   closingDate: string;
   dueDate: string;
   status?: CreditCardStatement["status"];
};

function requireRow<T>(row: T | undefined, name: string) {
   if (!row) {
      throw new Error(`${name} não foi criado.`);
   }
   return row;
}

let testDb: DbSetup;

async function createAccount(db: DatabaseInstance, teamId: string) {
   const [account] = await db
      .insert(bankAccounts)
      .values({ teamId, name: "Conta principal" })
      .returning({ id: bankAccounts.id });
   return account;
}

async function createCard(
   db: DatabaseInstance,
   teamId: string,
   bankAccountId: string,
   closingDay = 20,
) {
   const [card] = await db
      .insert(creditCards)
      .values({
         teamId,
         name: "Cartão principal",
         creditLimit: "1000",
         closingDay,
         dueDay: 10,
         bankAccountId,
      })
      .returning({ id: creditCards.id });
   return card;
}

async function createStatement(
   db: DatabaseInstance,
   creditCardId: string,
   statement: StatementData,
) {
   const [row] = await db
      .insert(creditCardStatements)
      .values({
         creditCardId,
         statementPeriod: statement.statementPeriod,
         closingDate: statement.closingDate,
         dueDate: statement.dueDate,
         status: statement.status,
      })
      .returning({
         id: creditCardStatements.id,
         statementPeriod: creditCardStatements.statementPeriod,
      });
   return row;
}

async function fetchStatus(db: DatabaseInstance, cardId: string) {
   const rows: Pick<CreditCardStatement, "statementPeriod" | "status">[] =
      await db
         .select()
         .from(creditCardStatements)
         .where(eq(creditCardStatements.creditCardId, cardId));

   const statusByPeriod: Record<string, CreditCardStatement["status"]> = {};
   for (const row of rows) {
      statusByPeriod[row.statementPeriod] = row.status;
   }
   return statusByPeriod;
}

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("cards close statements job", () => {
   it("enfileira fechamento automático com payload válido", async () => {
      const send = vi.fn().mockResolvedValue("close-statements-job-id");
      const boss: Pick<PgBossClient, "send"> = { send };

      const queued = await closeStatementsJob.enqueueCloseStatementsJob({
         boss,
         today: "2026-06-15",
      });

      expect(Result.isOk(queued)).toBe(true);
      expect(queued.value).toBe("close-statements-job-id");
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
         closeStatementsJob.closeStatementsQueue.name,
         { today: "2026-06-15" },
         expect.objectContaining({
            retryLimit: closeStatementsJob.closeStatementsQueue.retryLimit,
            deadLetter: closeStatementsJob.closeStatementsQueue.deadLetter,
         }),
      );
   });

   it("fecha faturas com data de vencimento ou competência", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const account = requireRow(
         await createAccount(testDb.db, teamId),
         "Conta bancária",
      );
      const card = requireRow(
         await createCard(testDb.db, teamId, account.id, 20),
         "Cartão",
      );

      await createStatement(testDb.db, card.id, {
         statementPeriod: "2026-05",
         closingDate: "2026-06-30",
         dueDate: "2026-07-05",
      });
      await createStatement(testDb.db, card.id, {
         statementPeriod: "2026-04",
         closingDate: "2026-04-15",
         dueDate: "2026-05-05",
      });
      await createStatement(testDb.db, card.id, {
         statementPeriod: "2026-06",
         closingDate: "2026-06-25",
         dueDate: "2026-07-05",
      });
      await createStatement(testDb.db, card.id, {
         statementPeriod: "2026-07",
         closingDate: "2026-07-20",
         dueDate: "2026-07-25",
         status: "open",
      });

      const result = await closeStatementsJob.handleCloseStatementsJob({
         db: testDb.db,
         job: {
            id: "job-close-statements",
            data: {
               today: "2026-06-15",
            },
         },
      });

      expect(Result.isOk(result)).toBe(true);
      expect(result.value).toBe(2);

      const statusByPeriod = await fetchStatus(testDb.db, card.id);
      expect(statusByPeriod["2026-05"]).toBe("paid");
      expect(statusByPeriod["2026-04"]).toBe("paid");
      expect(statusByPeriod["2026-06"]).toBe("open");
      expect(statusByPeriod["2026-07"]).toBe("open");

      const futureClosing = await testDb.db
         .select()
         .from(creditCardStatements)
         .where(
            and(
               eq(creditCardStatements.creditCardId, card.id),
               eq(creditCardStatements.statementPeriod, "2026-07"),
            ),
         );
      expect(futureClosing).toHaveLength(1);
      expect(futureClosing[0]?.status).toBe("open");
   });

   it("rejeita payload inválido", async () => {
      const sent = await closeStatementsJob.handleCloseStatementsJob({
         db: testDb.db,
         job: {
            id: "job-invalid",
            data: {
               today: "2026-99-99",
            },
         },
      });

      expect(Result.isError(sent)).toBe(true);
   });

   it("rejeita enfileiramento com payload inválido", async () => {
      const send = vi.fn().mockResolvedValue("close-statements-job-id");
      const boss: Pick<PgBossClient, "send"> = { send };

      const queued = await closeStatementsJob.enqueueCloseStatementsJob({
         boss,
         today: "2026-99-99",
      });

      expect(Result.isError(queued)).toBe(true);
      expect(send).not.toHaveBeenCalled();
   });
});
