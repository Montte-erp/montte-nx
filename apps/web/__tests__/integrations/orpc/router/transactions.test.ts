import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as bankAccountsRouter from "@/integrations/orpc/router/bank-accounts";
import * as transactionsRouter from "@/integrations/orpc/router/transactions";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

let bankAccountId: string;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transaction_items`);
   await ctx.db.execute(sql`DELETE FROM transaction_tags`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
   await ctx.db.execute(sql`DELETE FROM categories`);

   const account = await call(
      bankAccountsRouter.create,
      {
         name: "Nubank",
         type: "checking",
         bankCode: "260",
         initialBalance: "1000.00",
      },
      { context: ctx },
   );
   bankAccountId = account.id;
});

describe("create", () => {
   it("creates an expense transaction and persists it", async () => {
      const result = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            bankAccountId,
            paymentMethod: "pix",
         },
         { context: ctx },
      );

      expect(result).toBeDefined();
      expect(result!.type).toBe("expense");
      expect(result!.amount).toBe("150.00");

      const rows = await ctx.db.query.transactions.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result!.id);
   });

   it("creates an income transaction", async () => {
      const result = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "500.00",
            date: "2026-02-01",
            bankAccountId,
         },
         { context: ctx },
      );

      expect(result!.type).toBe("income");
      expect(result!.amount).toBe("500.00");
   });

   it("creates a transfer between two accounts", async () => {
      const account2 = await call(
         bankAccountsRouter.create,
         {
            name: "Inter",
            type: "checking",
            bankCode: "077",
            initialBalance: "200.00",
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.create,
         {
            type: "transfer",
            amount: "100.00",
            date: "2026-01-20",
            bankAccountId,
            destinationBankAccountId: account2.id,
         },
         { context: ctx },
      );

      expect(result!.type).toBe("transfer");
      expect(result!.destinationBankAccountId).toBe(account2.id);
   });

   it("rejects expense without bank account or credit card", async () => {
      await expect(
         call(
            transactionsRouter.create,
            {
               type: "expense",
               amount: "50.00",
               date: "2026-01-15",
            },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });

   it("creates transaction with items", async () => {
      const result = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "300.00",
            date: "2026-01-15",
            bankAccountId,
            items: [
               { quantity: "2", unitPrice: "100.00", description: "Item A" },
               { quantity: "1", unitPrice: "100.00", description: "Item B" },
            ],
         },
         { context: ctx },
      );

      expect(result).toBeDefined();

      const items = await ctx.db.query.transactionItems.findMany();
      expect(items).toHaveLength(2);
   });
});

describe("getAll", () => {
   it("lists transactions for the team", async () => {
      await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "100.00",
            date: "2026-01-10",
            bankAccountId,
         },
         { context: ctx },
      );
      await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "200.00",
            date: "2026-01-11",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(transactionsRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
   });

   it("filters by type", async () => {
      await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "100.00",
            date: "2026-01-10",
            bankAccountId,
         },
         { context: ctx },
      );
      await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "200.00",
            date: "2026-01-11",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.getAll,
         { type: "income" },
         { context: ctx },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.type).toBe("income");
   });

   it("does not return transactions from another team", async () => {
      await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "100.00",
            date: "2026-01-10",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(transactionsRouter.getAll, undefined, {
         context: ctx2,
      });

      expect(result.data).toHaveLength(0);
   });
});

describe("getSummary", () => {
   it("returns correct totals", async () => {
      await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "1000.00",
            date: "2026-01-10",
            bankAccountId,
         },
         { context: ctx },
      );
      await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "300.00",
            date: "2026-01-11",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(transactionsRouter.getSummary, undefined, {
         context: ctx,
      });

      expect(result.totalCount).toBe(2);
      expect(Number(result.incomeTotal)).toBe(1000);
      expect(Number(result.expenseTotal)).toBe(300);
      expect(Number(result.balance)).toBe(700);
   });
});

describe("getById", () => {
   it("returns transaction with tags", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.getById,
         { id: created!.id },
         { context: ctx },
      );

      expect(result!.id).toBe(created!.id);
      expect(result!.tagIds).toEqual([]);
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      await expect(
         call(
            transactionsRouter.getById,
            { id: created!.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("update", () => {
   it("updates transaction after ownership check", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            bankAccountId,
            name: "Original",
         },
         { context: ctx },
      );

      const updated = await call(
         transactionsRouter.update,
         { id: created!.id, name: "Atualizado" },
         { context: ctx },
      );

      expect(updated.name).toBe("Atualizado");

      const fromDb = await ctx.db.query.transactions.findFirst({
         where: { id: created!.id },
      });
      expect(fromDb!.name).toBe("Atualizado");
   });

   it("updates amount", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      const updated = await call(
         transactionsRouter.update,
         { id: created!.id, amount: "350.00" },
         { context: ctx },
      );

      expect(updated.amount).toBe("350.00");
   });

   it("rejects update from a different team", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      await expect(
         call(
            transactionsRouter.update,
            { id: created!.id, name: "Hack" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("remove", () => {
   it("deletes transaction", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "50.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.remove,
         { id: created!.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.transactions.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from a different team", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId,
         },
         { context: ctx },
      );

      await expect(
         call(
            transactionsRouter.remove,
            { id: created!.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Transação não encontrada.");
   });
});

describe("importBulk", () => {
   it("imports multiple transactions", async () => {
      const result = await call(
         transactionsRouter.importBulk,
         {
            transactions: [
               {
                  type: "expense",
                  amount: "100.00",
                  date: "2026-01-10",
                  bankAccountId,
               },
               {
                  type: "income",
                  amount: "200.00",
                  date: "2026-01-11",
                  bankAccountId,
               },
            ],
         },
         { context: ctx },
      );

      expect(result).toEqual({ imported: 2, skipped: 0 });

      const rows = await ctx.db.query.transactions.findMany();
      expect(rows).toHaveLength(2);
   });
});
