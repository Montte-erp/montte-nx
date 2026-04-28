import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { call } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import {
   attachBenefit,
   makeBenefit,
   makeService,
} from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";
import "../helpers/mock-billing-context";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as benefitsRouter from "../../src/router/benefits";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
});

describe("benefits router", () => {
   describe("benefits", () => {
      it("createBenefit inserts row with teamId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            benefitsRouter.createBenefit,
            {
               name: "Acesso Premium",
               type: "feature_access",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.name).toBe("Acesso Premium");
         expect(result.type).toBe("feature_access");
      });

      it("getBenefits returns aggregated usedInServices count", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, {
            teamId,
            name: "Bundle",
         });
         const serviceA = await makeService(testDb.db, { teamId });
         const serviceB = await makeService(testDb.db, { teamId });
         await attachBenefit(testDb.db, {
            serviceId: serviceA.id,
            benefitId: benefit.id,
         });
         await attachBenefit(testDb.db, {
            serviceId: serviceB.id,
            benefitId: benefit.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(benefitsRouter.getBenefits, undefined, {
            context: ctx,
         });
         expect(result).toHaveLength(1);
         expect(result[0]?.id).toBe(benefit.id);
         expect(result[0]?.usedInServices).toBe(2);
      });

      it("getBenefitById returns benefit on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            benefitsRouter.getBenefitById,
            { id: benefit.id },
            { context: ctx },
         );
         expect(result.id).toBe(benefit.id);
      });

      it("getBenefitById throws NOT_FOUND for cross-team benefit", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               benefitsRouter.getBenefitById,
               { id: benefit.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("updateBenefitById changes name and persists", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, {
            teamId,
            name: "Antigo",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            benefitsRouter.updateBenefitById,
            { id: benefit.id, name: "Novo" },
            { context: ctx },
         );
         expect(result.name).toBe("Novo");

         const [persisted] = await testDb.db
            .select()
            .from(benefits)
            .where(eq(benefits.id, benefit.id));
         expect(persisted?.name).toBe("Novo");
      });

      it("updateBenefitById throws NOT_FOUND for cross-team benefit", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               benefitsRouter.updateBenefitById,
               { id: benefit.id, name: "Hack" },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("removeBenefit deletes the benefit row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            benefitsRouter.removeBenefit,
            { id: benefit.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(benefits)
            .where(eq(benefits.id, benefit.id));
         expect(rows).toHaveLength(0);
      });

      it("removeBenefit throws NOT_FOUND for cross-team benefit", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               benefitsRouter.removeBenefit,
               { id: benefit.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("attachBenefit then detachBenefit, with idempotent re-attach", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const benefit = await makeBenefit(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });

         const first = await call(
            benefitsRouter.attachBenefit,
            { serviceId: service.id, benefitId: benefit.id },
            { context: ctx },
         );
         expect(first).toEqual({ success: true });

         // Idempotent re-attach (onConflictDoNothing)
         const second = await call(
            benefitsRouter.attachBenefit,
            { serviceId: service.id, benefitId: benefit.id },
            { context: ctx },
         );
         expect(second).toEqual({ success: true });

         const linksAfterAttach = await testDb.db
            .select()
            .from(serviceBenefits)
            .where(
               and(
                  eq(serviceBenefits.serviceId, service.id),
                  eq(serviceBenefits.benefitId, benefit.id),
               ),
            );
         expect(linksAfterAttach).toHaveLength(1);

         const detach = await call(
            benefitsRouter.detachBenefit,
            { serviceId: service.id, benefitId: benefit.id },
            { context: ctx },
         );
         expect(detach).toEqual({ success: true });

         const linksAfterDetach = await testDb.db
            .select()
            .from(serviceBenefits)
            .where(
               and(
                  eq(serviceBenefits.serviceId, service.id),
                  eq(serviceBenefits.benefitId, benefit.id),
               ),
            );
         expect(linksAfterDetach).toHaveLength(0);
      });

      it("attachBenefit throws NOT_FOUND for cross-team service", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherService = await makeService(testDb.db, {
            teamId: otherTeamId,
         });
         const { teamId } = await seedTeam(testDb.db);
         const benefit = await makeBenefit(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               benefitsRouter.attachBenefit,
               { serviceId: otherService.id, benefitId: benefit.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("attachBenefit throws NOT_FOUND for cross-team benefit", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherBenefit = await makeBenefit(testDb.db, {
            teamId: otherTeamId,
         });
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               benefitsRouter.attachBenefit,
               { serviceId: service.id, benefitId: otherBenefit.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("getServiceBenefits returns benefit rows for a service", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const benefitA = await makeBenefit(testDb.db, {
            teamId,
            name: "Alpha",
         });
         const benefitB = await makeBenefit(testDb.db, {
            teamId,
            name: "Beta",
         });
         await attachBenefit(testDb.db, {
            serviceId: service.id,
            benefitId: benefitA.id,
         });
         await attachBenefit(testDb.db, {
            serviceId: service.id,
            benefitId: benefitB.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            benefitsRouter.getServiceBenefits,
            { serviceId: service.id },
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         const ids = result.map((b) => b.id).sort();
         expect(ids).toEqual([benefitA.id, benefitB.id].sort());
         // Returns benefit rows, not link rows — rows must have name
         expect(result[0]?.name).toBeTruthy();
      });
   });
});
