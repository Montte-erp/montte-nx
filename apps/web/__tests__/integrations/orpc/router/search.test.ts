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
import { dashboards } from "@core/database/schemas/dashboards";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as searchRouter from "@/integrations/orpc/router/search";

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
}, 30_000);

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
   await ctx.db.execute(sql`DELETE FROM categories`);
   await ctx.db.execute(sql`DELETE FROM tags`);
   await ctx.db.execute(sql`DELETE FROM insights`);
   await ctx.db.execute(sql`DELETE FROM dashboards`);
});

const teamId = () => ctx.session!.session.activeTeamId!;
const teamId2 = () => ctx2.session!.session.activeTeamId!;

describe("globalSearch", () => {
   it("returns empty results when no data exists", async () => {
      const result = await call(
         searchRouter.globalSearch,
         { query: "anything" },
         { context: ctx },
      );

      expect(result.dashboards).toEqual([]);
      expect(result.insights).toEqual([]);
      expect(result.transactions).toEqual([]);
      expect(result.bankAccounts).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.tags).toEqual([]);
   });

   it("finds matching bank accounts", async () => {
      await ctx.db.insert(bankAccounts).values({
         teamId: teamId(),
         name: "Nubank Conta",
         type: "checking",
      });
      await ctx.db.insert(bankAccounts).values({
         teamId: teamId(),
         name: "Bradesco PJ",
         type: "checking",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "Nubank" },
         { context: ctx },
      );

      expect(result.bankAccounts).toHaveLength(1);
      expect(result.bankAccounts[0]!.name).toBe("Nubank Conta");
   });

   it("finds matching categories", async () => {
      await ctx.db.insert(categories).values({
         teamId: teamId(),
         name: "Alimentação",
         type: "expense",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "aliment" },
         { context: ctx },
      );

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]!.name).toBe("Alimentação");
   });

   it("finds matching tags", async () => {
      await ctx.db.insert(tags).values({
         teamId: teamId(),
         name: "Marketing Q1",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "marketing" },
         { context: ctx },
      );

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0]!.name).toBe("Marketing Q1");
   });

   it("finds matching transactions", async () => {
      await ctx.db.insert(transactions).values({
         teamId: teamId(),
         name: "Pagamento fornecedor",
         type: "expense",
         amount: "500.00",
         date: "2026-03-01",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "fornecedor" },
         { context: ctx },
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.name).toBe("Pagamento fornecedor");
   });

   it("finds matching dashboards", async () => {
      await ctx.db.insert(dashboards).values({
         teamId: teamId(),
         organizationId: ctx.session!.session.activeOrganizationId!,
         createdBy: ctx.session!.user.id,
         name: "Visão Geral Financeira",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "financeira" },
         { context: ctx },
      );

      expect(result.dashboards).toHaveLength(1);
      expect(result.dashboards[0]!.name).toBe("Visão Geral Financeira");
   });

   it("isolates results between teams", async () => {
      await ctx.db.insert(bankAccounts).values({
         teamId: teamId(),
         name: "Conta Time A",
         type: "checking",
      });
      await ctx.db.insert(bankAccounts).values({
         teamId: teamId2(),
         name: "Conta Time B",
         type: "checking",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "Conta" },
         { context: ctx },
      );

      expect(result.bankAccounts).toHaveLength(1);
      expect(result.bankAccounts[0]!.name).toBe("Conta Time A");
   });

   it("searches case-insensitively", async () => {
      await ctx.db.insert(tags).values({
         teamId: teamId(),
         name: "URGENTE",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "urgente" },
         { context: ctx },
      );

      expect(result.tags).toHaveLength(1);
   });

   it("limits results to 5 per category", async () => {
      const values = Array.from({ length: 8 }, (_, i) => ({
         teamId: teamId(),
         name: `Tag Teste ${i + 1}`,
      }));
      await ctx.db.insert(tags).values(values);

      const result = await call(
         searchRouter.globalSearch,
         { query: "Tag Teste" },
         { context: ctx },
      );

      expect(result.tags).toHaveLength(5);
   });

   it("searches across multiple resource types simultaneously", async () => {
      await ctx.db.insert(bankAccounts).values({
         teamId: teamId(),
         name: "Montte Bank",
         type: "checking",
      });
      await ctx.db.insert(categories).values({
         teamId: teamId(),
         name: "Montte Category",
         type: "expense",
      });
      await ctx.db.insert(tags).values({
         teamId: teamId(),
         name: "Montte Tag",
      });

      const result = await call(
         searchRouter.globalSearch,
         { query: "Montte" },
         { context: ctx },
      );

      expect(result.bankAccounts).toHaveLength(1);
      expect(result.categories).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
   });
});
