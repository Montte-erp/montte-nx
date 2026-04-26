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
   ssePublishSpy,
   billingResendSpies,
} from "../helpers/mock-billing-context";

import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { makeContact, makeSubscription } from "../helpers/billing-factories";

import {
   trialExpiryWorkflow,
   enqueueTrialExpiryWorkflow,
} from "../../src/workflows/trial-expiry-workflow";

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
   it("warning phase + expiry phase happy path with contactEmail sends both emails and publishes warning + completed", async () => {
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
         phase: "warning",
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "expiry",
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      const publishedTypes = ssePublishSpy.mock.calls.map((c) => c[2].type);
      expect(publishedTypes).toContain("billing.trial_expiring");
      expect(publishedTypes).toContain("billing.trial_completed");

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
         phase: "warning",
      });

      const expiringCalls = ssePublishSpy.mock.calls.filter(
         (c) => c[2].type === "billing.trial_expiring",
      );
      expect(expiringCalls).toHaveLength(1);
      expect(
         billingResendSpies.sendBillingTrialExpiryWarning,
      ).not.toHaveBeenCalled();
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("flips trialing subscription to active at expiry phase", async () => {
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
         phase: "expiry",
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("active");
   });

   it("expiry phase early-returns when subscription is already cancelled — no activation, no completed publish, no expired email", async () => {
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
         phase: "expiry",
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("cancelled");

      const completedCalls = ssePublishSpy.mock.calls.filter(
         (c) => c[2].type === "billing.trial_completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("expiry phase early-returns when subscription is already completed — no activation, no completed publish, no expired email", async () => {
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
         phase: "expiry",
         contactEmail: "cliente@example.com",
      });

      const [row] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(row?.status).toBe("completed");

      const completedCalls = ssePublishSpy.mock.calls.filter(
         (c) => c[2].type === "billing.trial_completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("expiry phase does not throw when subscription is missing — logs and early-returns", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const trialEndsAt = dayjs().add(5, "day").toISOString();
      const missingId = crypto.randomUUID();

      await expect(
         trialExpiryWorkflow({
            teamId,
            subscriptionId: missingId,
            trialEndsAt,
            phase: "expiry",
            contactEmail: "cliente@example.com",
         }),
      ).resolves.toBeUndefined();

      const completedCalls = ssePublishSpy.mock.calls.filter(
         (c) => c[2].type === "billing.trial_completed",
      );
      expect(completedCalls).toHaveLength(0);
      expect(billingResendSpies.sendBillingTrialExpired).not.toHaveBeenCalled();
   });

   it("past trialEndsAt: warning fires immediately and expiry activates the sub", async () => {
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

      mocks.startWorkflowSpy.mockClear();

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "warning",
         contactEmail: "cliente@example.com",
      });

      expect(mocks.sleepSpy).not.toHaveBeenCalled();
      expect(mocks.startWorkflowSpy).toHaveBeenCalledTimes(1);
      const [warningParams] = mocks.startWorkflowSpy.mock.calls[0] ?? [];
      expect(
         (warningParams as { enqueueOptions: { delaySeconds: number } })
            .enqueueOptions.delaySeconds,
      ).toBe(0);

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "expiry",
         contactEmail: "cliente@example.com",
      });

      const [persisted] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(persisted?.status).toBe("active");
   });

   it("warning phase enqueues expiry phase with delaySeconds≈7d (full trial at T0)", async () => {
      const T0 = dayjs("2026-05-01T00:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(T0.toDate());
      const trialEndsAt = T0.add(7, "day").toISOString();

      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         status: "trialing",
      });

      const mocks = await dbosMocks;
      mocks.startWorkflowSpy.mockClear();

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "warning",
      });

      expect(mocks.startWorkflowSpy).toHaveBeenCalledTimes(1);
      const [params, nextInput] = mocks.startWorkflowSpy.mock.calls[0] ?? [];
      expect(params).toMatchObject({
         workflowID: `trial-expiry-${sub.id}-expiry`,
         queueName: "workflow:trial-expiry",
         enqueueOptions: expect.objectContaining({
            delaySeconds: expect.any(Number),
         }),
      });
      expect(nextInput).toMatchObject({ phase: "expiry" });
      const delay = (params as { enqueueOptions: { delaySeconds: number } })
         .enqueueOptions.delaySeconds;
      const expected = 7 * 86400;
      expect(delay).toBeGreaterThanOrEqual(expected - 5);
      expect(delay).toBeLessThanOrEqual(expected);

      vi.useRealTimers();
   });

   it("enqueueTrialExpiryWorkflow computes delaySeconds = trialEndsAt - 3d - now (≈4d at T0)", async () => {
      const T0 = dayjs("2026-05-01T00:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(T0.toDate());
      const trialEndsAt = T0.add(7, "day").toISOString();

      const client = { enqueue: vi.fn().mockResolvedValue(undefined) };

      await enqueueTrialExpiryWorkflow(client as never, {
         teamId: crypto.randomUUID(),
         subscriptionId: crypto.randomUUID(),
         trialEndsAt,
      });

      expect(client.enqueue).toHaveBeenCalledTimes(1);
      const [params, payload] = client.enqueue.mock.calls[0] ?? [];
      expect(params).toMatchObject({
         workflowName: expect.any(String),
         queueName: "workflow:trial-expiry",
         enqueueOptions: expect.objectContaining({
            delaySeconds: expect.any(Number),
         }),
      });
      const delay = (params as { enqueueOptions: { delaySeconds: number } })
         .enqueueOptions.delaySeconds;
      const expected = 4 * 86400;
      expect(delay).toBeGreaterThanOrEqual(expected - 5);
      expect(delay).toBeLessThanOrEqual(expected);
      expect(payload).toMatchObject({ phase: "warning" });

      vi.useRealTimers();
   });

   it("enqueueTrialExpiryWorkflow clamps delaySeconds to 0 when trial already within 3 days", async () => {
      const T0 = dayjs("2026-05-01T00:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(T0.toDate());
      const trialEndsAt = T0.subtract(1, "hour").toISOString();

      const client = { enqueue: vi.fn().mockResolvedValue(undefined) };

      await enqueueTrialExpiryWorkflow(client as never, {
         teamId: crypto.randomUUID(),
         subscriptionId: crypto.randomUUID(),
         trialEndsAt,
      });

      const [params] = client.enqueue.mock.calls[0] ?? [];
      const delay = (params as { enqueueOptions: { delaySeconds: number } })
         .enqueueOptions.delaySeconds;
      expect(delay).toBe(0);

      vi.useRealTimers();
   });
});
