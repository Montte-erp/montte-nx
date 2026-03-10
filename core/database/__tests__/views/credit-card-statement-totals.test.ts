import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { creditCardStatementTotals } from "@core/database/schemas/credit-card-statement-totals";
import { transactions } from "@core/database/schemas/transactions";
import { creditCards } from "@core/database/schemas/credit-cards";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();

   // pushSchema may not create materialized views — create it manually
   await testDb.db.execute(sql`
		CREATE MATERIALIZED VIEW IF NOT EXISTS credit_card_statement_totals AS
		SELECT
			credit_card_id,
			statement_period,
			COALESCE(SUM(amount::numeric), 0) AS total_purchases,
			COUNT(*)::int AS transaction_count
		FROM transactions
		WHERE credit_card_id IS NOT NULL
		GROUP BY credit_card_id, statement_period
	`);
});

afterAll(async () => {
   await testDb.cleanup();
});

describe("creditCardStatementTotals materialized view", () => {
   it("aggregates transactions by credit card and statement period", async () => {
      const db = testDb.db;

      // Insert bank account
      const [account] = await db
         .insert(bankAccounts)
         .values({
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Conta Corrente",
            type: "checking",
            bankCode: "001",
         })
         .returning();

      // Insert credit card
      const [card] = await db
         .insert(creditCards)
         .values({
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Nubank",
            creditLimit: "5000.00",
            closingDay: 15,
            dueDay: 25,
            bankAccountId: account.id,
         })
         .returning();

      // Insert transactions for the card
      await db.insert(transactions).values([
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Mercado",
            type: "expense",
            amount: "150.00",
            date: "2026-03-10",
            creditCardId: card.id,
            statementPeriod: "2026-03",
         },
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Gasolina",
            type: "expense",
            amount: "200.00",
            date: "2026-03-12",
            creditCardId: card.id,
            statementPeriod: "2026-03",
         },
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Restaurante",
            type: "expense",
            amount: "80.00",
            date: "2026-04-05",
            creditCardId: card.id,
            statementPeriod: "2026-04",
         },
      ]);

      // Refresh the materialized view
      await db.refreshMaterializedView(creditCardStatementTotals);

      // Query the view
      const rows = await db.select().from(creditCardStatementTotals);

      expect(rows).toHaveLength(2);

      const march = rows.find((r) => r.statementPeriod === "2026-03");
      expect(march).toBeDefined();
      expect(Number(march!.totalPurchases)).toBe(350);
      expect(march!.transactionCount).toBe(2);

      const april = rows.find((r) => r.statementPeriod === "2026-04");
      expect(april).toBeDefined();
      expect(Number(april!.totalPurchases)).toBe(80);
      expect(april!.transactionCount).toBe(1);
   });
});
