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

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as billsRouter from "@/integrations/orpc/router/bills";
import * as bankAccountsRouter from "@/integrations/orpc/router/bank-accounts";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

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
   await ctx.db.execute(sql`DELETE FROM bills`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
});

const billInput = {
   name: "Aluguel",
   type: "payable" as const,
   amount: "1500.00",
   dueDate: "2026-04-01",
};

async function createBankAccount(context: ORPCContextWithAuth) {
   return call(
      bankAccountsRouter.create,
      {
         name: "Nubank",
         type: "checking",
         bankCode: "260",
         initialBalance: "5000.00",
      },
      { context },
   );
}

describe("create", () => {
   it("creates a single bill and persists it", async () => {
      const result = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      expect(result).toBeDefined();
      expect((result as any).name).toBe("Aluguel");
      expect((result as any).type).toBe("payable");
      expect((result as any).amount).toBe("1500.00");
      expect((result as any).status).toBe("pending");

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe((result as any).id);
   });

   it("creates a bill with bank account reference", async () => {
      const account = await createBankAccount(ctx);

      const result = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      expect((result as any).bankAccountId).toBe(account.id);
   });

   it("rejects invalid bank account reference", async () => {
      await expect(
         call(
            billsRouter.create,
            {
               bill: {
                  ...billInput,
                  bankAccountId: "a0000000-0000-4000-8000-000000000099",
               },
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Conta bancária inválida.");
   });

   it("creates installment bills", async () => {
      const result = await call(
         billsRouter.create,
         {
            bill: billInput,
            installment: { mode: "equal", count: 3 },
         },
         { context: ctx },
      );

      expect(result).toHaveLength(3);

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(3);

      const bills = result as Array<{ name: string; amount: string }>;
      expect(bills[0]!.name).toBe("Aluguel (1/3)");
      expect(bills[1]!.name).toBe("Aluguel (2/3)");
      expect(bills[2]!.name).toBe("Aluguel (3/3)");

      expect(bills[0]!.amount).toBe("500.00");
   });
});

describe("getAll", () => {
   it("lists bills for the team", async () => {
      await call(billsRouter.create, { bill: billInput }, { context: ctx });
      await call(
         billsRouter.create,
         { bill: { ...billInput, name: "Internet", amount: "100.00" } },
         { context: ctx },
      );

      const result = await call(billsRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
   });

   it("isolates bills between teams", async () => {
      await call(billsRouter.create, { bill: billInput }, { context: ctx });
      await call(
         billsRouter.create,
         { bill: { ...billInput, name: "Other team bill" } },
         { context: ctx2 },
      );

      const result = await call(billsRouter.getAll, undefined, {
         context: ctx,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("Aluguel");
   });

   it("filters by type", async () => {
      await call(billsRouter.create, { bill: billInput }, { context: ctx });
      await call(
         billsRouter.create,
         { bill: { ...billInput, name: "Receita", type: "receivable" } },
         { context: ctx },
      );

      const result = await call(
         billsRouter.getAll,
         { type: "payable" },
         { context: ctx },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("Aluguel");
   });
});

describe("update", () => {
   it("updates a bill after ownership check", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      const updated = await call(
         billsRouter.update,
         { id: (created as any).id, name: "Aluguel Atualizado" },
         { context: ctx },
      );

      expect(updated.name).toBe("Aluguel Atualizado");

      const fromDb = await ctx.db.query.bills.findFirst({
         where: { id: (created as any).id },
      });
      expect(fromDb!.name).toBe("Aluguel Atualizado");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.update,
            { id: (created as any).id, name: "Hack" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });

   it("rejects editing a paid bill", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      const account = await createBankAccount(ctx);

      await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
         },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.update,
            { id: (created as any).id, name: "Novo" },
            { context: ctx },
         ),
      ).rejects.toThrow("Não é possível editar uma conta já paga.");
   });
});

describe("pay", () => {
   it("pays a bill and creates a transaction", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      const result = await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
         },
         { context: ctx },
      );

      expect(result.status).toBe("paid");
      expect(result.transactionId).toBeDefined();

      const txRows = await ctx.db.query.transactions.findMany();
      expect(txRows).toHaveLength(1);
      expect(txRows[0]!.type).toBe("expense");
      expect(txRows[0]!.amount).toBe("1500.00");
   });

   it("uses bill bank account when none provided", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      const result = await call(
         billsRouter.pay,
         { id: (created as any).id, amount: "1500.00", date: "2026-04-01" },
         { context: ctx },
      );

      expect(result.status).toBe("paid");
   });

   it("rejects paying without any bank account", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.pay,
            { id: (created as any).id, amount: "1500.00", date: "2026-04-01" },
            { context: ctx },
         ),
      ).rejects.toThrow("Conta bancária é obrigatória para pagar uma conta.");
   });

   it("rejects paying an already paid bill", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
         },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.pay,
            {
               id: (created as any).id,
               amount: "1500.00",
               date: "2026-04-01",
               bankAccountId: account.id,
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Esta conta já foi paga.");
   });

   it("handles partial payment", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      const result = await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
            paymentType: "partial",
         },
         { context: ctx },
      );

      expect(result.amount).toBe("1000.00");
      expect(result.status).toBe("pending");
   });
});

describe("unpay", () => {
   it("reverts a paid bill to pending and deletes transaction", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
         },
         { context: ctx },
      );

      const result = await call(
         billsRouter.unpay,
         { id: (created as any).id },
         { context: ctx },
      );

      expect(result.status).toBe("pending");
      expect(result.transactionId).toBeNull();

      const txRows = await ctx.db.query.transactions.findMany();
      expect(txRows).toHaveLength(0);
   });

   it("rejects unpaying a non-paid bill", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      await expect(
         call(billsRouter.unpay, { id: (created as any).id }, { context: ctx }),
      ).rejects.toThrow("Esta conta não está paga.");
   });
});

describe("cancel", () => {
   it("cancels a bill", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      const result = await call(
         billsRouter.cancel,
         { id: (created as any).id },
         { context: ctx },
      );

      expect(result.status).toBe("cancelled");

      const fromDb = await ctx.db.query.bills.findFirst({
         where: { id: (created as any).id },
      });
      expect(fromDb!.status).toBe("cancelled");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.cancel,
            { id: (created as any).id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });
});

describe("remove", () => {
   it("deletes a pending bill", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      const result = await call(
         billsRouter.remove,
         { id: (created as any).id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deleting a paid bill", async () => {
      const account = await createBankAccount(ctx);
      const created = await call(
         billsRouter.create,
         { bill: { ...billInput, bankAccountId: account.id } },
         { context: ctx },
      );

      await call(
         billsRouter.pay,
         {
            id: (created as any).id,
            amount: "1500.00",
            date: "2026-04-01",
            bankAccountId: account.id,
         },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.remove,
            { id: (created as any).id },
            { context: ctx },
         ),
      ).rejects.toThrow("Não é possível excluir uma conta já paga.");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         billsRouter.create,
         { bill: billInput },
         { context: ctx },
      );

      await expect(
         call(
            billsRouter.remove,
            { id: (created as any).id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Conta a pagar/receber não encontrada.");
   });
});
