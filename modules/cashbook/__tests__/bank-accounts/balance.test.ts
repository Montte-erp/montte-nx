import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import {
   computeBankAccountBalance,
   computeBankAccountBalances,
} from "../../src/bank-accounts";

describe("bank account balance", () => {
   let ctx: Awaited<ReturnType<typeof setupTestDb>>;

   beforeAll(async () => {
      ctx = await setupTestDb();
   });

   afterAll(async () => {
      await ctx.cleanup();
   });

   it("excludes cancelled transactions from current and projected balance", async () => {
      const teamId = "00000000-0000-0000-0000-000000000002";
      const [account] = await ctx.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Cancelados",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();
      await ctx.db.insert(transactions).values([
         {
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2026-05-01",
            status: "cancelled",
            bankAccountId: account.id,
         },
      ]);
      const single = await computeBankAccountBalance(
         ctx.db,
         account.id,
         account.initialBalance,
      );
      expect(single.currentBalance).toBe("0.00");
      expect(single.projectedBalance).toBe("0.00");
   });

   it("only counts paid transactions in current balance", async () => {
      const teamId = "00000000-0000-0000-0000-000000000003";
      const [account] = await ctx.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Mista",
            type: "checking",
            initialBalance: "1000",
            status: "active",
         })
         .returning();
      await ctx.db.insert(transactions).values([
         {
            teamId,
            type: "income",
            amount: "500",
            date: "2026-05-01",
            status: "paid",
            bankAccountId: account.id,
         },
         {
            teamId,
            type: "expense",
            amount: "200",
            date: "2026-05-02",
            status: "paid",
            bankAccountId: account.id,
         },
         {
            teamId,
            type: "expense",
            amount: "999",
            date: "2026-05-03",
            status: "pending",
            bankAccountId: account.id,
         },
         {
            teamId,
            type: "expense",
            amount: "888",
            date: "2026-05-04",
            status: "cancelled",
            bankAccountId: account.id,
         },
      ]);
      const single = await computeBankAccountBalance(
         ctx.db,
         account.id,
         account.initialBalance,
      );
      expect(single.currentBalance).toBe("1300.00");
      expect(single.projectedBalance).toBe("301.00");
   });

   it("excludes pending transactions from current balance", async () => {
      const teamId = "00000000-0000-0000-0000-000000000001";
      const [account] = await ctx.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Teste",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();

      await ctx.db.insert(transactions).values([
         {
            teamId,
            type: "expense",
            amount: "434.34",
            date: "2026-09-02",
            status: "pending",
            bankAccountId: account.id,
         },
         {
            teamId,
            type: "expense",
            amount: "5555.55",
            date: "2026-05-11",
            status: "pending",
            bankAccountId: account.id,
         },
      ]);

      const single = await computeBankAccountBalance(
         ctx.db,
         account.id,
         account.initialBalance,
      );
      const batch = await computeBankAccountBalances(ctx.db, [account]);
      const batched = batch.get(account.id);

      expect(single.currentBalance).toBe("0.00");
      expect(single.projectedBalance).toBe("-5989.89");
      expect(batched?.currentBalance).toBe("0.00");
      expect(batched?.projectedBalance).toBe("-5989.89");
   });
});
