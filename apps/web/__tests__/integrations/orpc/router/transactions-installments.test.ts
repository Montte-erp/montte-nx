import { call } from "@orpc/server";
import { ORPCError } from "@orpc/server";
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
let teamId: string;
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
   if (!ctx.session) throw new Error("session is null");
   teamId = ctx.session.session.activeTeamId!;
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transaction_items`);
   await ctx.db.execute(sql`DELETE FROM transaction_tags`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);

   const account = await call(
      bankAccountsRouter.create,
      {
         name: "Conta Teste",
         type: "checking",
         bankCode: "260",
         initialBalance: "1000.00",
      },
      { context: ctx },
   );
   bankAccountId = account.id;
});

describe("createInstallments", () => {
   it("creates N installments correctly", async () => {
      const startDate = "2026-04-07";
      const result = await call(
         transactionsRouter.createInstallments,
         {
            teamId,
            type: "income",
            amount: "500.00",
            installmentCount: 2,
            startDate,
            bankAccountId,
         },
         { context: ctx },
      );

      expect(result).toHaveLength(2);

      const first = result[0]!;
      const second = result[1]!;

      expect(first.isInstallment).toBe(true);
      expect(first.installmentCount).toBe(2);
      expect(first.installmentNumber).toBe(1);
      expect(first.amount).toBe("250.00");
      expect(first.date).toBe(startDate);

      expect(second.isInstallment).toBe(true);
      expect(second.installmentCount).toBe(2);
      expect(second.installmentNumber).toBe(2);
      expect(second.amount).toBe("250.00");
      expect(second.date).toBe("2026-05-07");

      expect(first.installmentGroupId).toBeDefined();
      expect(first.installmentGroupId).toBe(second.installmentGroupId);
   });

   it("rejects transfer type", async () => {
      await expect(
         call(
            transactionsRouter.createInstallments,
            {
               teamId,
               type: "transfer" as never,
               amount: "100.00",
               installmentCount: 2,
               startDate: "2026-04-07",
               bankAccountId,
            },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });

   it("rejects installmentCount less than 2", async () => {
      await expect(
         call(
            transactionsRouter.createInstallments,
            {
               teamId,
               type: "expense",
               amount: "100.00",
               installmentCount: 1,
               startDate: "2026-04-07",
               bankAccountId,
            },
            { context: ctx },
         ),
      ).rejects.toThrow();
   });
});

describe("updateStatus", () => {
   it("marks pending transaction as confirmed", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "200.00",
            date: "2026-12-01",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.updateStatus,
         { id: created!.id, teamId, status: "confirmed" },
         { context: ctx },
      );

      expect(result.status).toBe("confirmed");
   });

   it("marks confirmed transaction as pending", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "expense",
            amount: "100.00",
            date: "2026-01-01",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         transactionsRouter.updateStatus,
         { id: created!.id, teamId, status: "pending" },
         { context: ctx },
      );

      expect(result.status).toBe("pending");
   });

   it("cannot update another team's transaction", async () => {
      const created = await call(
         transactionsRouter.create,
         {
            type: "income",
            amount: "300.00",
            date: "2026-04-07",
            bankAccountId,
         },
         { context: ctx },
      );

      if (!ctx2.session) throw new Error("session2 is null");
      const teamId2 = ctx2.session.session.activeTeamId!;

      await expect(
         call(
            transactionsRouter.updateStatus,
            { id: created!.id, teamId: teamId2, status: "confirmed" },
            { context: ctx2 },
         ),
      ).rejects.toThrow(ORPCError);
   });
});
