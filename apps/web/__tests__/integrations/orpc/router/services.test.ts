import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/services-repository");
vi.mock("@core/database/repositories/subscriptions-repository");
vi.mock("@core/database/repositories/contacts-repository");
vi.mock("@core/database/repositories/bills-repository", () => ({
   generateBillsForSubscription: vi.fn().mockResolvedValue(undefined),
   cancelPendingBillsForSubscription: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));
vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
   }),
}));

import {
   createService,
   createVariant as createVariantRepo,
   deleteService,
   deleteVariant,
   ensureServiceOwnership,
   ensureVariantOwnership,
   listServices,
   listVariantsByService,
   updateService,
   updateVariant as updateVariantRepo,
} from "@core/database/repositories/services-repository";
import {
   countActiveSubscriptionsByVariant,
   createSubscription as createSubscriptionRepo,
   ensureSubscriptionOwnership,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import { AppError } from "@core/logging/errors";
import * as servicesRouter from "@/integrations/orpc/router/services";

const SERVICE_ID = "a0000000-0000-4000-8000-000000000001";
const VARIANT_ID = "a0000000-0000-4000-8000-000000000002";
const CONTACT_ID = "a0000000-0000-4000-8000-000000000003";
const SUBSCRIPTION_ID = "a0000000-0000-4000-8000-000000000004";

const mockService = {
   id: SERVICE_ID,
   teamId: TEST_TEAM_ID,
   name: "Consultoria",
   description: null,
   basePrice: "100.00",
   categoryId: null,
   tagId: null,
   isActive: true,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const mockVariant = {
   id: VARIANT_ID,
   serviceId: SERVICE_ID,
   teamId: TEST_TEAM_ID,
   name: "Mensal",
   basePrice: "200.00",
   billingCycle: "monthly" as const,
   isActive: true,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const mockContact = {
   id: CONTACT_ID,
   teamId: TEST_TEAM_ID,
   name: "João",
};

const mockSubscription = {
   id: SUBSCRIPTION_ID,
   teamId: TEST_TEAM_ID,
   contactId: CONTACT_ID,
   variantId: VARIANT_ID,
   startDate: "2026-01-01",
   endDate: null,
   negotiatedPrice: "200.00",
   notes: null,
   status: "active" as const,
   source: "manual" as const,
   externalId: null,
   currentPeriodStart: null,
   currentPeriodEnd: null,
   cancelAtPeriodEnd: false,
   canceledAt: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("services", () => {
   describe("getAll", () => {
      it("lists services", async () => {
         vi.mocked(listServices).mockResolvedValueOnce([mockService as any]);

         const result = await call(servicesRouter.getAll, undefined, {
            context: createTestContext(),
         });

         expect(result).toEqual([mockService]);
         expect(listServices).toHaveBeenCalledWith(TEST_TEAM_ID, undefined);
      });

      it("passes filters", async () => {
         vi.mocked(listServices).mockResolvedValueOnce([]);

         await call(
            servicesRouter.getAll,
            { search: "test" },
            { context: createTestContext() },
         );

         expect(listServices).toHaveBeenCalledWith(TEST_TEAM_ID, {
            search: "test",
         });
      });
   });

   describe("create", () => {
      it("creates a service", async () => {
         vi.mocked(createService).mockResolvedValueOnce(mockService);

         const result = await call(
            servicesRouter.create,
            { name: "Consultoria", basePrice: "100.00" },
            { context: createTestContext() },
         );

         expect(result).toEqual(mockService);
         expect(createService).toHaveBeenCalledWith(
            TEST_TEAM_ID,
            expect.objectContaining({ name: "Consultoria" }),
         );
      });
   });

   describe("update", () => {
      it("updates after ownership check", async () => {
         vi.mocked(ensureServiceOwnership).mockResolvedValueOnce(mockService);
         const updated = { ...mockService, name: "Mentoria" };
         vi.mocked(updateService).mockResolvedValueOnce(updated);

         const result = await call(
            servicesRouter.update,
            { id: SERVICE_ID, name: "Mentoria" },
            { context: createTestContext() },
         );

         expect(result.name).toBe("Mentoria");
         expect(ensureServiceOwnership).toHaveBeenCalledWith(
            SERVICE_ID,
            TEST_TEAM_ID,
         );
      });

      it("propagates NOT_FOUND", async () => {
         vi.mocked(ensureServiceOwnership).mockRejectedValueOnce(
            AppError.notFound("Serviço não encontrado."),
         );

         await expect(
            call(
               servicesRouter.update,
               { id: SERVICE_ID, name: "Novo Nome" },
               { context: createTestContext() },
            ),
         ).rejects.toThrow("Serviço não encontrado.");
      });
   });

   describe("remove", () => {
      it("deletes after ownership check", async () => {
         vi.mocked(ensureServiceOwnership).mockResolvedValueOnce(mockService);
         vi.mocked(deleteService).mockResolvedValueOnce(undefined);

         const result = await call(
            servicesRouter.remove,
            { id: SERVICE_ID },
            { context: createTestContext() },
         );

         expect(result).toEqual({ success: true });
         expect(deleteService).toHaveBeenCalledWith(SERVICE_ID);
      });
   });

   describe("exportAll", () => {
      it("returns all services", async () => {
         vi.mocked(listServices).mockResolvedValueOnce([mockService as any]);

         const result = await call(servicesRouter.exportAll, undefined, {
            context: createTestContext(),
         });

         expect(result).toEqual([mockService]);
         expect(listServices).toHaveBeenCalledWith(TEST_TEAM_ID);
      });
   });
});

describe("variants", () => {
   describe("getVariants", () => {
      it("lists variants after service ownership check", async () => {
         vi.mocked(ensureServiceOwnership).mockResolvedValueOnce(mockService);
         vi.mocked(listVariantsByService).mockResolvedValueOnce([mockVariant]);

         const result = await call(
            servicesRouter.getVariants,
            { serviceId: SERVICE_ID },
            { context: createTestContext() },
         );

         expect(result).toEqual([mockVariant]);
         expect(ensureServiceOwnership).toHaveBeenCalledWith(
            SERVICE_ID,
            TEST_TEAM_ID,
         );
      });
   });

   describe("createVariant", () => {
      it("creates variant after service ownership check", async () => {
         vi.mocked(ensureServiceOwnership).mockResolvedValueOnce(mockService);
         vi.mocked(createVariantRepo).mockResolvedValueOnce(mockVariant);

         const result = await call(
            servicesRouter.createVariant,
            {
               serviceId: SERVICE_ID,
               name: "Mensal",
               basePrice: "200.00",
               billingCycle: "monthly",
            },
            { context: createTestContext() },
         );

         expect(result).toEqual(mockVariant);
         expect(createVariantRepo).toHaveBeenCalledWith(
            TEST_TEAM_ID,
            SERVICE_ID,
            expect.objectContaining({ name: "Mensal" }),
         );
      });
   });

   describe("updateVariant", () => {
      it("updates after variant ownership check", async () => {
         vi.mocked(ensureVariantOwnership).mockResolvedValueOnce(mockVariant);
         const updated = { ...mockVariant, name: "Anual" };
         vi.mocked(updateVariantRepo).mockResolvedValueOnce(updated);

         const result = await call(
            servicesRouter.updateVariant,
            { id: VARIANT_ID, name: "Anual" },
            { context: createTestContext() },
         );

         expect(result.name).toBe("Anual");
         expect(ensureVariantOwnership).toHaveBeenCalledWith(
            VARIANT_ID,
            TEST_TEAM_ID,
         );
      });

      it("propagates NOT_FOUND", async () => {
         vi.mocked(ensureVariantOwnership).mockRejectedValueOnce(
            AppError.notFound("Variação não encontrada."),
         );

         await expect(
            call(
               servicesRouter.updateVariant,
               { id: VARIANT_ID, name: "Novo Nome" },
               { context: createTestContext() },
            ),
         ).rejects.toThrow("Variação não encontrada.");
      });
   });

   describe("removeVariant", () => {
      it("deletes after variant ownership check", async () => {
         vi.mocked(ensureVariantOwnership).mockResolvedValueOnce(mockVariant);
         vi.mocked(deleteVariant).mockResolvedValueOnce(undefined);

         const result = await call(
            servicesRouter.removeVariant,
            { id: VARIANT_ID },
            { context: createTestContext() },
         );

         expect(result).toEqual({ success: true });
         expect(deleteVariant).toHaveBeenCalledWith(VARIANT_ID);
      });
   });
});

describe("subscriptions", () => {
   describe("getAllSubscriptions", () => {
      it("lists subscriptions", async () => {
         vi.mocked(listSubscriptionsByTeam).mockResolvedValueOnce([
            mockSubscription,
         ]);

         const result = await call(
            servicesRouter.getAllSubscriptions,
            undefined,
            { context: createTestContext() },
         );

         expect(result).toEqual([mockSubscription]);
         expect(listSubscriptionsByTeam).toHaveBeenCalledWith(
            TEST_TEAM_ID,
            undefined,
         );
      });

      it("passes status filter", async () => {
         vi.mocked(listSubscriptionsByTeam).mockResolvedValueOnce([]);

         await call(
            servicesRouter.getAllSubscriptions,
            { status: "active" },
            { context: createTestContext() },
         );

         expect(listSubscriptionsByTeam).toHaveBeenCalledWith(
            TEST_TEAM_ID,
            "active",
         );
      });
   });

   describe("getContactSubscriptions", () => {
      it("lists contact subscriptions after ownership check", async () => {
         vi.mocked(ensureContactOwnership).mockResolvedValueOnce(
            mockContact as any,
         );
         vi.mocked(listSubscriptionsByContact).mockResolvedValueOnce([
            mockSubscription,
         ]);

         const result = await call(
            servicesRouter.getContactSubscriptions,
            { contactId: CONTACT_ID },
            { context: createTestContext() },
         );

         expect(result).toEqual([mockSubscription]);
         expect(ensureContactOwnership).toHaveBeenCalledWith(
            CONTACT_ID,
            TEST_TEAM_ID,
         );
      });
   });

   describe("createSubscription", () => {
      it("creates subscription with ownership checks", async () => {
         vi.mocked(ensureContactOwnership).mockResolvedValueOnce(
            mockContact as any,
         );
         vi.mocked(ensureVariantOwnership).mockResolvedValueOnce(mockVariant);
         vi.mocked(createSubscriptionRepo).mockResolvedValueOnce(
            mockSubscription,
         );
         vi.mocked(ensureServiceOwnership).mockResolvedValueOnce(mockService);

         const result = await call(
            servicesRouter.createSubscription,
            {
               contactId: CONTACT_ID,
               variantId: VARIANT_ID,
               startDate: "2026-01-01",
               negotiatedPrice: "200.00",
            },
            { context: createTestContext() },
         );

         expect(result).toEqual(mockSubscription);
         expect(ensureContactOwnership).toHaveBeenCalledWith(
            CONTACT_ID,
            TEST_TEAM_ID,
         );
         expect(ensureVariantOwnership).toHaveBeenCalledWith(
            VARIANT_ID,
            TEST_TEAM_ID,
         );
      });
   });

   describe("cancelSubscription", () => {
      it("cancels an active manual subscription", async () => {
         vi.mocked(ensureSubscriptionOwnership).mockResolvedValueOnce(
            mockSubscription,
         );
         const cancelled = {
            ...mockSubscription,
            status: "cancelled" as const,
         };
         vi.mocked(updateSubscription).mockResolvedValueOnce(cancelled);

         const result = await call(
            servicesRouter.cancelSubscription,
            { id: SUBSCRIPTION_ID },
            { context: createTestContext() },
         );

         expect(result.status).toBe("cancelled");
         expect(updateSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID, {
            status: "cancelled",
         });
      });

      it("rejects non-active subscription", async () => {
         vi.mocked(ensureSubscriptionOwnership).mockResolvedValueOnce({
            ...mockSubscription,
            status: "completed",
         });

         await expect(
            call(
               servicesRouter.cancelSubscription,
               { id: SUBSCRIPTION_ID },
               { context: createTestContext() },
            ),
         ).rejects.toThrow("Apenas assinaturas ativas podem ser canceladas.");
      });

      it("rejects asaas subscription", async () => {
         vi.mocked(ensureSubscriptionOwnership).mockResolvedValueOnce({
            ...mockSubscription,
            source: "asaas",
         });

         await expect(
            call(
               servicesRouter.cancelSubscription,
               { id: SUBSCRIPTION_ID },
               { context: createTestContext() },
            ),
         ).rejects.toThrow(
            "Assinaturas do Asaas não podem ser canceladas aqui.",
         );
      });

      it("propagates NOT_FOUND", async () => {
         vi.mocked(ensureSubscriptionOwnership).mockRejectedValueOnce(
            AppError.notFound("Assinatura não encontrada."),
         );

         await expect(
            call(
               servicesRouter.cancelSubscription,
               { id: SUBSCRIPTION_ID },
               { context: createTestContext() },
            ),
         ).rejects.toThrow("Assinatura não encontrada.");
      });
   });

   describe("getExpiringSoon", () => {
      it("returns expiring subscriptions", async () => {
         vi.mocked(listExpiringSoon).mockResolvedValueOnce([mockSubscription]);

         const result = await call(servicesRouter.getExpiringSoon, undefined, {
            context: createTestContext(),
         });

         expect(result).toEqual([mockSubscription]);
         expect(listExpiringSoon).toHaveBeenCalledWith(TEST_TEAM_ID);
      });
   });

   describe("getActiveCountByVariant", () => {
      it("returns active counts", async () => {
         const counts = [{ variantId: VARIANT_ID, count: 5 }];
         vi.mocked(countActiveSubscriptionsByVariant).mockResolvedValueOnce(
            counts as any,
         );

         const result = await call(
            servicesRouter.getActiveCountByVariant,
            undefined,
            { context: createTestContext() },
         );

         expect(result).toEqual(counts);
         expect(countActiveSubscriptionsByVariant).toHaveBeenCalledWith(
            TEST_TEAM_ID,
         );
      });
   });
});
