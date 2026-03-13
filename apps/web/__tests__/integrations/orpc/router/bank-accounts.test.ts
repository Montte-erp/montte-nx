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

import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
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
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
});

describe("create", () => {
   it("creates a bank account and persists it", async () => {
      const result = await call(
         bankAccountsRouter.create,
         {
            name: "Nubank",
            type: "checking",
            color: "#6366f1",
            bankCode: "260",
            initialBalance: "1000.00",
         },
         { context: ctx },
      );

      expect(result.name).toBe("Nubank");
      expect(result.type).toBe("checking");
      expect(result.initialBalance).toBe("1000.00");

      const rows = await ctx.db.query.bankAccounts.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });
});

describe("getAll", () => {
   it("lists accounts with balance", async () => {
      await call(
         bankAccountsRouter.create,
         {
            name: "Conta A",
            type: "checking",
            bankCode: "001",
            initialBalance: "500.00",
         },
         { context: ctx },
      );
      await call(
         bankAccountsRouter.create,
         {
            name: "Conta B",
            type: "savings",
            bankCode: "002",
            initialBalance: "200.00",
         },
         { context: ctx },
      );

      const result = await call(bankAccountsRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.currentBalance).toBeDefined();
      expect(result[0]!.projectedBalance).toBeDefined();
   });
});

describe("getById", () => {
   it("returns account with balance fields", async () => {
      const created = await call(
         bankAccountsRouter.create,
         {
            name: "Inter",
            type: "checking",
            bankCode: "077",
            initialBalance: "750.00",
         },
         { context: ctx },
      );

      const result = await call(
         bankAccountsRouter.getById,
         { id: created.id },
         { context: ctx },
      );

      expect(result.id).toBe(created.id);
      expect(result.currentBalance).toBe("750.00");
      expect(result.projectedBalance).toBe("750.00");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         bankAccountsRouter.create,
         {
            name: "Private",
            type: "checking",
            bankCode: "341",
            initialBalance: "100.00",
         },
         { context: ctx },
      );

      await expect(
         call(
            bankAccountsRouter.getById,
            { id: created.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Conta bancária não encontrada.");
   });
});

describe("update", () => {
   it("updates account after ownership check", async () => {
      const created = await call(
         bankAccountsRouter.create,
         { name: "Bradesco", type: "checking", bankCode: "237" },
         { context: ctx },
      );

      const updated = await call(
         bankAccountsRouter.update,
         { id: created.id, name: "Bradesco PJ" },
         { context: ctx },
      );

      expect(updated.name).toBe("Bradesco PJ");

      const fromDb = await ctx.db.query.bankAccounts.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("Bradesco PJ");
   });
});

describe("remove", () => {
   it("deletes account with no transactions", async () => {
      const created = await call(
         bankAccountsRouter.create,
         { name: "Deletar", type: "cash" },
         { context: ctx },
      );

      const result = await call(
         bankAccountsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.bankAccounts.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion when account has transactions", async () => {
      const created = await call(
         bankAccountsRouter.create,
         {
            name: "Com Lancamentos",
            type: "checking",
            bankCode: "001",
            initialBalance: "100.00",
         },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;
      await ctx.db.insert(transactions).values({
         teamId,
         type: "income",
         amount: "50.00",
         date: "2025-01-15",
         bankAccountId: created.id,
      });

      await expect(
         call(bankAccountsRouter.remove, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Conta com lançamentos não pode ser excluída.");
   });
});
