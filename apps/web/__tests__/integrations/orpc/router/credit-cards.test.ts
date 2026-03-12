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
import * as bankAccountsRouter from "@/integrations/orpc/router/bank-accounts";
import * as creditCardsRouter from "@/integrations/orpc/router/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";

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
   await ctx.db.execute(sql`DELETE FROM credit_card_statements`);
   await ctx.db.execute(sql`DELETE FROM credit_cards`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);

   const ba = await call(
      bankAccountsRouter.create,
      {
         name: "Conta Teste",
         type: "checking",
         bankCode: "001",
         initialBalance: "0",
      },
      { context: ctx },
   );
   bankAccountId = ba.id;

   await call(
      bankAccountsRouter.create,
      {
         name: "Conta Teste 2",
         type: "checking",
         bankCode: "002",
         initialBalance: "0",
      },
      { context: ctx2 },
   );
});

describe("create", () => {
   it("creates a credit card and persists it", async () => {
      const result = await call(
         creditCardsRouter.create,
         {
            name: "Nubank Platinum",
            color: "#6366f1",
            creditLimit: "5000.00",
            closingDay: 10,
            dueDay: 17,
            bankAccountId,
            brand: "mastercard",
         },
         { context: ctx },
      );

      expect(result.name).toBe("Nubank Platinum");
      expect(result.creditLimit).toBe("5000.00");
      expect(result.closingDay).toBe(10);
      expect(result.dueDay).toBe(17);
      expect(result.brand).toBe("mastercard");

      const rows = await ctx.db.query.creditCards.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });
});

describe("getAll", () => {
   it("lists credit cards for the team", async () => {
      await call(
         creditCardsRouter.create,
         { name: "Card A", closingDay: 5, dueDay: 12, bankAccountId },
         { context: ctx },
      );
      await call(
         creditCardsRouter.create,
         { name: "Card B", closingDay: 15, dueDay: 22, bankAccountId },
         { context: ctx },
      );

      const result = await call(creditCardsRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });
});

describe("getById", () => {
   it("returns card after ownership check", async () => {
      const created = await call(
         creditCardsRouter.create,
         { name: "Inter Gold", closingDay: 8, dueDay: 15, bankAccountId },
         { context: ctx },
      );

      const result = await call(
         creditCardsRouter.getById,
         { id: created.id },
         { context: ctx },
      );

      expect(result.id).toBe(created.id);
      expect(result.name).toBe("Inter Gold");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         creditCardsRouter.create,
         { name: "Private Card", closingDay: 10, dueDay: 17, bankAccountId },
         { context: ctx },
      );

      await expect(
         call(creditCardsRouter.getById, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Cartão de crédito não encontrado.");
   });
});

describe("update", () => {
   it("updates card after ownership check", async () => {
      const created = await call(
         creditCardsRouter.create,
         {
            name: "Bradesco Visa",
            closingDay: 10,
            dueDay: 17,
            bankAccountId,
            brand: "visa",
         },
         { context: ctx },
      );

      const updated = await call(
         creditCardsRouter.update,
         { id: created.id, name: "Bradesco Black" },
         { context: ctx },
      );

      expect(updated.name).toBe("Bradesco Black");

      const fromDb = await ctx.db.query.creditCards.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("Bradesco Black");
   });
});

describe("remove", () => {
   it("deletes card with no open statements", async () => {
      const created = await call(
         creditCardsRouter.create,
         { name: "Deletar", closingDay: 5, dueDay: 12, bankAccountId },
         { context: ctx },
      );

      const result = await call(
         creditCardsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.creditCards.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion when card has open statements", async () => {
      const created = await call(
         creditCardsRouter.create,
         { name: "Com Faturas", closingDay: 10, dueDay: 17, bankAccountId },
         { context: ctx },
      );

      await ctx.db.insert(creditCardStatements).values({
         creditCardId: created.id,
         statementPeriod: "2025-01",
         status: "open",
         closingDate: "2025-01-10",
         dueDate: "2025-01-17",
      });

      await expect(
         call(creditCardsRouter.remove, { id: created.id }, { context: ctx }),
      ).rejects.toThrow("Cartão com faturas abertas não pode ser excluído.");
   });
});
