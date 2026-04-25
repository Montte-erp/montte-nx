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

import {
   billingPublisherSpy,
   billingResendSpies,
} from "../helpers/mock-billing-context";

import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import { makeContact, makeSubscription } from "../helpers/billing-factories";

import { trialExpiryWorkflow } from "../../src/workflows/trial-expiry-workflow";

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

describe("trialExpiryWorkflow", () => {
   it("warning + expiry happy path with contactEmail sends both emails and publishes warning + completed", async () => {
      const mocks = await dbosMocks;
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      expect(mocks.sleepSpy).toHaveBeenCalledTimes(2);
      const sleepArgs = mocks.sleepSpy.mock.calls.map((c) => c[0] as number);
      expect(sleepArgs.every((ms) => ms > 0)).toBe(true);

      const publishCalls = billingPublisherSpy.mock.calls;
      const types = publishCalls.map(
         (c) => c[1] as { type: string; status: string },
      );
      expect(types).toContainEqual(
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
            status: "started",
         }),
      );
      expect(types).toContainEqual(
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
            status: "completed",
         }),
      );

      expect(
         billingResendSpies.sendBillingTrialExpiryWarning,
      ).toHaveBeenCalledTimes(1);
      expect(billingResendSpies.sendBillingTrialExpired).toHaveBeenCalledTimes(
         1,
      );
   });

   it("warning publish runs but warning email is skipped when contactEmail is missing", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
      });

      const startedCalls = billingPublisherSpy.mock.calls.filter(
         (c) =>
            (c[1] as { type: string; status: string }).type ===
               NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING &&
            (c[1] as { type: string; status: string }).status === "started",
      );
      expect(startedCalls).toHaveLength(1);
      expect(
         billingResendSpies.sendBillingTrialExpiryWarning,
      ).not.toHaveBeenCalled();
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("flips trialing subscription to active at expiry", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("active");
   });

   it("early-returns when subscription is already cancelled — no activation, no completed publish, no expired email", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "cancelled",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("cancelled");

      const completedCalls = billingPublisherSpy.mock.calls.filter(
         (c) =>
            (c[1] as { type: string; status: string }).type ===
               NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING &&
            (c[1] as { type: string; status: string }).status === "completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("early-returns when subscription is already completed — no activation, no completed publish, no expired email", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "completed",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("completed");

      const completedCalls = billingPublisherSpy.mock.calls.filter(
         (c) =>
            (c[1] as { type: string; status: string }).type ===
               NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING &&
            (c[1] as { type: string; status: string }).status === "completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("does not throw when subscription is missing — logs and early-returns", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const missingId = crypto.randomUUID();

      await expect(
         trialExpiryWorkflow({
            teamId,
            subscriptionId: missingId,
            trialEndsAt,
            contactEmail: "cliente@example.com",
         }),
      ).resolves.toBeUndefined();

      const completedCalls = billingPublisherSpy.mock.calls.filter(
         (c) =>
            (c[1] as { type: string; status: string }).type ===
               NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING &&
            (c[1] as { type: string; status: string }).status === "completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("does not call sleepms with negative values when trialEndsAt is in the past", async () => {
      const mocks = await dbosMocks;
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const trialEndsAt = dayjs().subtract(2, "day").toISOString();
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
         trialEndsAt: dayjs(trialEndsAt).toDate(),
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         contactEmail: "cliente@example.com",
      });

      const sleepArgs = mocks.sleepSpy.mock.calls.map((c) => c[0] as number);
      expect(sleepArgs.every((ms) => ms > 0)).toBe(true);

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("active");

      const completedCalls = billingPublisherSpy.mock.calls.filter(
         (c) =>
            (c[1] as { type: string; status: string }).type ===
               NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING &&
            (c[1] as { type: string; status: string }).status === "completed",
      );
      expect(completedCalls).toHaveLength(1);
   });
});
