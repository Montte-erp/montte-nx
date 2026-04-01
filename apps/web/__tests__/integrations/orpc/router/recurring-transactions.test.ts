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
import * as recurringTransactionsRouter from "@/integrations/orpc/router/recurring-transactions";

let ctx: ORPCContextWithAuth;
let teamId: string;
let bankAccountId: string;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
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
   await ctx.db.execute(sql`DELETE FROM recurring_transactions`);
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

describe("recurringTransactions.create", () => {
   it("creates a monthly income recurring rule with bankAccountId", async () => {
      const result = await call(
         recurringTransactionsRouter.create,
         {
            teamId,
            type: "income",
            amount: "500.00",
            frequency: "monthly",
            startDate: "2026-01-01",
            bankAccountId,
         },
         { context: ctx },
      );

      expect(result).toBeDefined();
      expect(result.teamId).toBe(teamId);
      expect(result.type).toBe("income");
      expect(result.amount).toBe("500.00");
      expect(result.frequency).toBe("monthly");
      expect(result.bankAccountId).toBe(bankAccountId);
   });

   it("creates a weekly expense recurring rule with bankAccountId", async () => {
      const result = await call(
         recurringTransactionsRouter.create,
         {
            teamId,
            type: "expense",
            amount: "150.00",
            frequency: "weekly",
            startDate: "2026-02-01",
            bankAccountId,
         },
         { context: ctx },
      );

      expect(result).toBeDefined();
      expect(result.teamId).toBe(teamId);
      expect(result.type).toBe("expense");
      expect(result.amount).toBe("150.00");
      expect(result.frequency).toBe("weekly");
   });
});

describe("recurringTransactions.getAll", () => {
   it("returns rules for a team", async () => {
      await call(
         recurringTransactionsRouter.create,
         {
            teamId,
            type: "income",
            amount: "200.00",
            frequency: "monthly",
            startDate: "2026-01-01",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         recurringTransactionsRouter.getAll,
         { teamId },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.teamId).toBe(teamId);
   });

   it("returns empty array for a team with no rules", async () => {
      const result = await call(
         recurringTransactionsRouter.getAll,
         { teamId },
         { context: ctx },
      );

      expect(result).toHaveLength(0);
   });
});

describe("recurringTransactions.remove", () => {
   it("deletes an existing rule and returns it", async () => {
      const created = await call(
         recurringTransactionsRouter.create,
         {
            teamId,
            type: "expense",
            amount: "99.00",
            frequency: "monthly",
            startDate: "2026-03-01",
            bankAccountId,
         },
         { context: ctx },
      );

      const result = await call(
         recurringTransactionsRouter.remove,
         { id: created.id, teamId },
         { context: ctx },
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);

      const remaining = await call(
         recurringTransactionsRouter.getAll,
         { teamId },
         { context: ctx },
      );
      expect(remaining).toHaveLength(0);
   });

   it("throws NOT_FOUND for an unknown id", async () => {
      await expect(
         call(
            recurringTransactionsRouter.remove,
            { id: "00000000-0000-0000-0000-000000000000", teamId },
            { context: ctx },
         ),
      ).rejects.toThrow(ORPCError);
   });
});
