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
vi.mock("@core/database/repositories/bills-repository", () => ({
   generateBillsForSubscription: vi.fn().mockResolvedValue(undefined),
   cancelPendingBillsForSubscription: vi.fn().mockResolvedValue(undefined),
}));

import { contacts } from "@core/database/schemas/contacts";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as servicesRouter from "@/integrations/orpc/router/services";

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
   await ctx.db.execute(sql`DELETE FROM contact_subscriptions`);
   await ctx.db.execute(sql`DELETE FROM service_variants`);
   await ctx.db.execute(sql`DELETE FROM services`);
   await ctx.db.execute(sql`DELETE FROM contacts`);
});

describe("create", () => {
   it("creates a service and persists it", async () => {
      const result = await call(
         servicesRouter.create,
         {
            name: "Consultoria",
            basePrice: "150.00",
         },
         { context: ctx },
      );

      expect(result.name).toBe("Consultoria");
      expect(result.basePrice).toBe("150.00");

      const rows = await ctx.db.query.services.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });
});

describe("getAll", () => {
   it("lists services for the team", async () => {
      await call(
         servicesRouter.create,
         { name: "Serviço A", basePrice: "100.00" },
         { context: ctx },
      );
      await call(
         servicesRouter.create,
         { name: "Serviço B", basePrice: "200.00" },
         { context: ctx },
      );

      const result = await call(servicesRouter.getAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("filters by search term", async () => {
      await call(
         servicesRouter.create,
         { name: "Consultoria Financeira", basePrice: "100.00" },
         { context: ctx },
      );
      await call(
         servicesRouter.create,
         { name: "Desenvolvimento Web", basePrice: "200.00" },
         { context: ctx },
      );

      const result = await call(
         servicesRouter.getAll,
         { search: "Financeira" },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Consultoria Financeira");
   });

   it("does not leak services from another team", async () => {
      await call(
         servicesRouter.create,
         { name: "Private", basePrice: "10.00" },
         { context: ctx },
      );

      const result = await call(servicesRouter.getAll, undefined, {
         context: ctx2,
      });

      expect(result).toHaveLength(0);
   });
});

describe("update", () => {
   it("updates service after ownership check", async () => {
      const created = await call(
         servicesRouter.create,
         { name: "Original", basePrice: "50.00" },
         { context: ctx },
      );

      const updated = await call(
         servicesRouter.update,
         { id: created.id, name: "Atualizado" },
         { context: ctx },
      );

      expect(updated.name).toBe("Atualizado");

      const fromDb = await ctx.db.query.services.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("Atualizado");
   });

   it("rejects update from different team", async () => {
      const created = await call(
         servicesRouter.create,
         { name: "Private", basePrice: "50.00" },
         { context: ctx },
      );

      await expect(
         call(
            servicesRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Serviço não encontrado.");
   });
});

describe("remove", () => {
   it("deletes a service", async () => {
      const created = await call(
         servicesRouter.create,
         { name: "Deletar", basePrice: "10.00" },
         { context: ctx },
      );

      const result = await call(
         servicesRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.services.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from different team", async () => {
      const created = await call(
         servicesRouter.create,
         { name: "Private", basePrice: "10.00" },
         { context: ctx },
      );

      await expect(
         call(servicesRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Serviço não encontrado.");
   });
});

describe("exportAll", () => {
   it("returns all services for the team", async () => {
      await call(
         servicesRouter.create,
         { name: "Export A", basePrice: "10.00" },
         { context: ctx },
      );

      const result = await call(servicesRouter.exportAll, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Export A");
   });
});

describe("variants", () => {
   it("creates and lists variants for a service", async () => {
      const service = await call(
         servicesRouter.create,
         { name: "Com Variantes", basePrice: "100.00" },
         { context: ctx },
      );

      await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );
      await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Anual",
            basePrice: "1000.00",
            billingCycle: "annual",
         },
         { context: ctx },
      );

      const variants = await call(
         servicesRouter.getVariants,
         { serviceId: service.id },
         { context: ctx },
      );

      expect(variants).toHaveLength(2);
   });

   it("updates a variant", async () => {
      const service = await call(
         servicesRouter.create,
         { name: "Serviço", basePrice: "50.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Original",
            basePrice: "50.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const updated = await call(
         servicesRouter.updateVariant,
         { id: variant.id, name: "Atualizado" },
         { context: ctx },
      );

      expect(updated.name).toBe("Atualizado");
   });

   it("removes a variant", async () => {
      const service = await call(
         servicesRouter.create,
         { name: "Serviço", basePrice: "50.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Remover",
            basePrice: "50.00",
            billingCycle: "one_time",
         },
         { context: ctx },
      );

      const result = await call(
         servicesRouter.removeVariant,
         { id: variant.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const remaining = await call(
         servicesRouter.getVariants,
         { serviceId: service.id },
         { context: ctx },
      );
      expect(remaining).toHaveLength(0);
   });

   it("rejects variant creation from different team", async () => {
      const service = await call(
         servicesRouter.create,
         { name: "Serviço", basePrice: "50.00" },
         { context: ctx },
      );

      await expect(
         call(
            servicesRouter.createVariant,
            {
               serviceId: service.id,
               name: "Hack",
               basePrice: "50.00",
               billingCycle: "monthly",
            },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Serviço não encontrado.");
   });

   it("rejects variant update from different team", async () => {
      const service = await call(
         servicesRouter.create,
         { name: "Serviço", basePrice: "50.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Original",
            basePrice: "50.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      await expect(
         call(
            servicesRouter.updateVariant,
            { id: variant.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Variação não encontrada.");
   });
});

async function createContactForTeam(
   db: typeof ctx.db,
   teamId: string,
   suffix = "",
) {
   const [contact] = await db
      .insert(contacts)
      .values({
         teamId,
         name: `Contato${suffix} ${Date.now()}`,
         type: "cliente",
      })
      .returning();
   return contact!;
}

describe("subscriptions", () => {
   it("creates a subscription for a contact", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Plano Pro", basePrice: "200.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "200.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const sub = await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "180.00",
         },
         { context: ctx },
      );

      expect(sub.contactId).toBe(contact.id);
      expect(sub.variantId).toBe(variant.id);
      expect(sub.negotiatedPrice).toBe("180.00");
      expect(sub.status).toBe("active");

      const rows = await ctx.db.query.contactSubscriptions.findMany();
      expect(rows).toHaveLength(1);
   });

   it("lists subscriptions by team", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Serviço Sub", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      const subs = await call(servicesRouter.getAllSubscriptions, undefined, {
         context: ctx,
      });

      expect(subs).toHaveLength(1);
   });

   it("filters subscriptions by status", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Serviço Filter", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const sub = await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      await call(
         servicesRouter.cancelSubscription,
         { id: sub.id },
         { context: ctx },
      );

      const active = await call(
         servicesRouter.getAllSubscriptions,
         { status: "active" },
         { context: ctx },
      );
      expect(active).toHaveLength(0);

      const cancelled = await call(
         servicesRouter.getAllSubscriptions,
         { status: "cancelled" },
         { context: ctx },
      );
      expect(cancelled).toHaveLength(1);
   });

   it("cancels an active subscription", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Cancelável", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const sub = await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      const cancelled = await call(
         servicesRouter.cancelSubscription,
         { id: sub.id },
         { context: ctx },
      );

      expect(cancelled.status).toBe("cancelled");
   });

   it("rejects cancelling a non-active subscription", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Já Cancelada", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const sub = await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      await call(
         servicesRouter.cancelSubscription,
         { id: sub.id },
         { context: ctx },
      );

      await expect(
         call(
            servicesRouter.cancelSubscription,
            { id: sub.id },
            { context: ctx },
         ),
      ).rejects.toThrow("Apenas assinaturas ativas podem ser canceladas.");
   });

   it("rejects cancelling subscription from different team", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Cross Team", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      const sub = await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      await expect(
         call(
            servicesRouter.cancelSubscription,
            { id: sub.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Assinatura não encontrada.");
   });

   it("returns active count by variant", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const contact = await createContactForTeam(ctx.db, teamId);

      const service = await call(
         servicesRouter.create,
         { name: "Count Test", basePrice: "100.00" },
         { context: ctx },
      );

      const variant = await call(
         servicesRouter.createVariant,
         {
            serviceId: service.id,
            name: "Mensal",
            basePrice: "100.00",
            billingCycle: "monthly",
         },
         { context: ctx },
      );

      await call(
         servicesRouter.createSubscription,
         {
            contactId: contact.id,
            variantId: variant.id,
            startDate: "2026-01-01",
            negotiatedPrice: "100.00",
         },
         { context: ctx },
      );

      const counts = await call(
         servicesRouter.getActiveCountByVariant,
         undefined,
         { context: ctx },
      );

      expect(counts).toHaveLength(1);
      expect(counts[0]!.variantId).toBe(variant.id);
      expect(counts[0]!.count).toBe(1);
   });
});
