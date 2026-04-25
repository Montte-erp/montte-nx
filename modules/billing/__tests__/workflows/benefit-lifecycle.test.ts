import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const dbosMocks = vi.hoisted(async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.createDbosMocks();
});

vi.mock("@dbos-inc/dbos-sdk", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.dbosSdkMockFactory(await dbosMocks);
});
vi.mock("@dbos-inc/drizzle-datasource", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.drizzleDataSourceMockFactory(await dbosMocks);
});

import { billingPublisherSpy } from "../helpers/mock-billing-context";

import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import { WorkflowError } from "@core/dbos/errors";
import {
   attachBenefit,
   makeBenefit,
   makeContact,
   makeService,
   makeSubscription,
} from "../helpers/billing-factories";

import { benefitLifecycleWorkflow } from "../../src/workflows/benefit-lifecycle-workflow";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
});

describe("benefitLifecycleWorkflow", () => {
   it("no-ops when service has no benefits", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(0);
      expect(billingPublisherSpy).not.toHaveBeenCalled();
   });

   it("grants benefits when newStatus is active and no previous status", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      const benefitB = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitB.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(2);
      expect(grants.every((g) => g.status === "active")).toBe(true);
      const benefitIds = grants.map((g) => g.benefitId).sort();
      expect(benefitIds).toEqual([benefitA.id, benefitB.id].sort());

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(billingPublisherSpy).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED,
            status: "completed",
            teamId,
            payload: {
               subscriptionId: sub.id,
               benefitIds: expect.arrayContaining([benefitA.id, benefitB.id]),
            },
         }),
      );
   });

   it("grants benefits when newStatus is trialing", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      const benefitB = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitB.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
      });

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "trialing",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(2);
      expect(grants.every((g) => g.status === "active")).toBe(true);

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(billingPublisherSpy).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED,
         }),
      );
   });

   it("revokes existing grants when newStatus is cancelled", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      const benefitB = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitB.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await testDb.db.insert(benefitGrants).values([
         {
            teamId,
            subscriptionId: sub.id,
            benefitId: benefitA.id,
            status: "active",
         },
         {
            teamId,
            subscriptionId: sub.id,
            benefitId: benefitB.id,
            status: "active",
         },
      ]);

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "cancelled",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(2);
      expect(grants.every((g) => g.status === "revoked")).toBe(true);
      expect(grants.every((g) => g.revokedAt !== null)).toBe(true);

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(billingPublisherSpy).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED,
            payload: {
               subscriptionId: sub.id,
               benefitIds: expect.arrayContaining([benefitA.id, benefitB.id]),
            },
         }),
      );
   });

   it("revokes existing grants when newStatus is completed", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await testDb.db.insert(benefitGrants).values([
         {
            teamId,
            subscriptionId: sub.id,
            benefitId: benefitA.id,
            status: "active",
         },
      ]);

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "completed",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.status).toBe("revoked");
      expect(grants[0]?.revokedAt).not.toBeNull();

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(billingPublisherSpy).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED,
         }),
      );
   });

   it("upgrades trialing → active by revoking and re-granting", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      const benefitB = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitB.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await testDb.db.insert(benefitGrants).values([
         {
            teamId,
            subscriptionId: sub.id,
            benefitId: benefitA.id,
            status: "active",
         },
         {
            teamId,
            subscriptionId: sub.id,
            benefitId: benefitB.id,
            status: "active",
         },
      ]);

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
         previousStatus: "trialing",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(2);
      expect(grants.every((g) => g.status === "active")).toBe(true);
      expect(grants.every((g) => g.revokedAt === null)).toBe(true);

      expect(billingPublisherSpy).toHaveBeenCalledTimes(2);
      const callTypes = billingPublisherSpy.mock.calls.map(
         (c) => (c[1] as { type: string }).type,
      );
      expect(callTypes).toContain(NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED);
      expect(callTypes).toContain(NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED);
   });

   it("is idempotent — running grant twice keeps row count = benefitIds.length", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      const benefitB = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitB.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
      });
      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(2);
      expect(grants.every((g) => g.status === "active")).toBe(true);
   });

   it("propagates WorkflowError when DB insert fails", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const benefitA = await makeBenefit(testDb.db, { teamId });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefitA.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });

      const insertSpy = vi
         .spyOn(testDb.db, "insert")
         .mockImplementationOnce(() => {
            throw new Error("simulated insert failure");
         });

      await expect(
         benefitLifecycleWorkflow({
            teamId,
            subscriptionId: sub.id,
            serviceId: service.id,
            newStatus: "active",
         }),
      ).rejects.toBeInstanceOf(WorkflowError);

      insertSpy.mockRestore();
   });
});
