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
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import {
   makeContact,
   makePrice,
   makeService,
   makeSubscription,
   makeSubscriptionItem,
} from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";
import "../helpers/mock-billing-context";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as subscriptionsRouter from "../../src/router/subscriptions";
import * as subscriptionItemsRouter from "../../src/router/subscription-items";

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

describe("subscriptions router", () => {
   describe("subscriptions", () => {
      it("getAllSubscriptions returns only current team's subscriptions", async () => {
         const { teamId: teamA } = await seedTeam(testDb.db);
         const { teamId: teamB } = await seedTeam(testDb.db);
         const contactA = await makeContact(testDb.db, { teamId: teamA });
         const contactB = await makeContact(testDb.db, { teamId: teamB });
         await makeSubscription(testDb.db, {
            teamId: teamA,
            contactId: contactA.id,
         });
         await makeSubscription(testDb.db, {
            teamId: teamA,
            contactId: contactA.id,
         });
         await makeSubscription(testDb.db, {
            teamId: teamB,
            contactId: contactB.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId: teamA,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.getAllSubscriptions,
            undefined,
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         for (const row of result) expect(row.teamId).toBe(teamA);
      });

      it("getAllSubscriptions filters by status", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "cancelled",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.getAllSubscriptions,
            { status: "active" },
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         for (const row of result) expect(row.status).toBe("active");
      });

      it("getContactSubscriptions lists subs for contact ordered desc by createdAt", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const first = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });
         await new Promise((r) => setTimeout(r, 10));
         const second = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.getContactSubscriptions,
            { contactId: contact.id },
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         expect(result[0]?.id).toBe(second.id);
         expect(result[1]?.id).toBe(first.id);
      });

      it("getContactSubscriptions throws NOT_FOUND for cross-team contact", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionsRouter.getContactSubscriptions,
               { contactId: otherContact.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("createSubscription without items defaults to active and does not enqueue trial workflow", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.createSubscription,
            {
               contactId: contact.id,
               startDate: dayjs().format("YYYY-MM-DD"),
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.contactId).toBe(contact.id);
         expect(result.status).toBe("active");
         expect(ctx.workflowClient.enqueue).not.toHaveBeenCalled();
      });

      it("createSubscription with status=trialing enqueues trialExpiryWorkflow", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const trialEndsAt = dayjs().add(7, "day").toISOString();
         const result = await call(
            subscriptionsRouter.createSubscription,
            {
               contactId: contact.id,
               startDate: dayjs().format("YYYY-MM-DD"),
               status: "trialing",
               trialEndsAt,
            },
            { context: ctx },
         );

         await new Promise((r) => setImmediate(r));

         expect(result.status).toBe("trialing");
         expect(ctx.workflowClient.enqueue).toHaveBeenCalledTimes(1);
         const call0 = ctx.workflowClient.enqueue.mock.calls[0];
         expect(call0?.[1]).toMatchObject({
            teamId,
            subscriptionId: result.id,
            trialEndsAt: dayjs(trialEndsAt).toISOString(),
         });
      });

      it("createSubscription with single item enqueues benefitLifecycleWorkflow", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.createSubscription,
            {
               contactId: contact.id,
               startDate: dayjs().format("YYYY-MM-DD"),
               items: [{ priceId: price.id, quantity: 1 }],
            },
            { context: ctx },
         );

         await new Promise((r) => setImmediate(r));

         expect(result.status).toBe("active");
         expect(ctx.workflowClient.enqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
               teamId,
               subscriptionId: result.id,
               serviceId: service.id,
               newStatus: "active",
            }),
         );
      });

      it("createSubscription enqueues benefit-lifecycle for each unique item service", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const serviceA = await makeService(testDb.db, { teamId });
         const priceA = await makePrice(testDb.db, {
            teamId,
            serviceId: serviceA.id,
         });
         const serviceB = await makeService(testDb.db, { teamId });
         const priceB = await makePrice(testDb.db, {
            teamId,
            serviceId: serviceB.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });

         const result = await call(
            subscriptionsRouter.createSubscription,
            {
               contactId: contact.id,
               startDate: dayjs().format("YYYY-MM-DD"),
               items: [
                  { priceId: priceA.id, quantity: 1 },
                  { priceId: priceB.id, quantity: 1 },
               ],
            },
            { context: ctx },
         );
         await new Promise((r) => setImmediate(r));

         expect(ctx.workflowClient.enqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
               teamId,
               subscriptionId: result.id,
               serviceId: serviceA.id,
               newStatus: "active",
            }),
         );
         expect(ctx.workflowClient.enqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
               teamId,
               subscriptionId: result.id,
               serviceId: serviceB.id,
               newStatus: "active",
            }),
         );
         expect(result.status).toBe("active");
      });

      it("createSubscription throws NOT_FOUND for cross-team contact", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionsRouter.createSubscription,
               {
                  contactId: otherContact.id,
                  startDate: dayjs().format("YYYY-MM-DD"),
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("cancelSubscription transitions trialing to cancelled and enqueues benefit lifecycle", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "trialing",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: sub.id,
            priceId: price.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.cancelSubscription,
            { id: sub.id },
            { context: ctx },
         );
         expect(result.status).toBe("cancelled");

         const [persisted] = await testDb.db
            .select()
            .from(contactSubscriptions)
            .where(eq(contactSubscriptions.id, sub.id));
         expect(persisted?.status).toBe("cancelled");

         await new Promise((r) => setImmediate(r));

         expect(ctx.workflowClient.enqueue).toHaveBeenCalledTimes(1);
         const call0 = ctx.workflowClient.enqueue.mock.calls[0];
         expect(call0?.[1]).toMatchObject({
            teamId,
            subscriptionId: sub.id,
            serviceId: service.id,
            newStatus: "cancelled",
            previousStatus: "trialing",
         });
      });

      it("cancelSubscription rejects status=completed with BAD_REQUEST", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "completed",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionsRouter.cancelSubscription,
               { id: sub.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
         );
      });

      it("cancelSubscription throws NOT_FOUND for cross-team subscription", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const otherSub = await makeSubscription(testDb.db, {
            teamId: otherTeamId,
            contactId: otherContact.id,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionsRouter.cancelSubscription,
               { id: otherSub.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("getExpiringSoon returns subs ending within 30 days", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const today = dayjs().format("YYYY-MM-DD");
         const inTen = dayjs().add(10, "day").format("YYYY-MM-DD");
         const inForty = dayjs().add(40, "day").format("YYYY-MM-DD");
         const subToday = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            endDate: today,
         });
         const subTen = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            endDate: inTen,
         });
         await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            endDate: inForty,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.getExpiringSoon,
            undefined,
            {
               context: ctx,
            },
         );
         const ids = result.map((r) => r.id).sort();
         expect(ids).toEqual([subToday.id, subTen.id].sort());
      });
   });
   describe("aggregates", () => {
      it("getMrr sums monthly + annual/12 across active subscriptions and excludes cancelled", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });

         const monthlyPriceA = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            basePrice: "100.00",
            interval: "monthly",
         });
         const monthlyPriceB = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            basePrice: "50.00",
            interval: "monthly",
         });
         const annualPrice = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            basePrice: "1200.00",
            interval: "annual",
         });

         const subActiveA = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subActiveA.id,
            priceId: monthlyPriceA.id,
            quantity: 2,
         });

         const subActiveB = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subActiveB.id,
            priceId: monthlyPriceB.id,
            quantity: 1,
         });

         const subAnnual = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subAnnual.id,
            priceId: annualPrice.id,
            quantity: 1,
         });

         const subCancelled = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "cancelled",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subCancelled.id,
            priceId: monthlyPriceA.id,
            quantity: 5,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(subscriptionsRouter.getMrr, undefined, {
            context: ctx,
         });
         expect(Number(result.mrr)).toBe(350);
      });

      it("getMrr returns '0' when there are no active subscription items", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(subscriptionsRouter.getMrr, undefined, {
            context: ctx,
         });
         expect(Number(result.mrr)).toBe(0);
      });

      it("getActiveCountByPrice counts only items on active subscriptions", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });

         const subActiveA = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subActiveA.id,
            priceId: price.id,
         });
         const subActiveB = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subActiveB.id,
            priceId: price.id,
         });
         const subCancelled = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "cancelled",
         });
         await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: subCancelled.id,
            priceId: price.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionsRouter.getActiveCountByPrice,
            { priceId: price.id },
            { context: ctx },
         );
         expect(result.count).toBe(2);
      });
   });
   describe("subscriptionItems", () => {
      it("addItem inserts row with teamId on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionItemsRouter.add,
            {
               subscriptionId: sub.id,
               priceId: price.id,
               quantity: 3,
               negotiatedPrice: "75.00",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.subscriptionId).toBe(sub.id);
         expect(result.priceId).toBe(price.id);
         expect(result.quantity).toBe(3);
         expect(result.negotiatedPrice).toBe("75.00");
      });

      it("addItem rejects with BAD_REQUEST when MAX_ITEMS_PER_SUBSCRIPTION is reached", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });

         for (let i = 0; i < 20; i++) {
            await makeSubscriptionItem(testDb.db, {
               teamId,
               subscriptionId: sub.id,
               priceId: price.id,
            });
         }

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionItemsRouter.add,
               {
                  subscriptionId: sub.id,
                  priceId: price.id,
                  quantity: 1,
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
         );
      });

      it("addItem throws NOT_FOUND for cross-team subscription", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const otherSub = await makeSubscription(testDb.db, {
            teamId: otherTeamId,
            contactId: otherContact.id,
         });
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionItemsRouter.add,
               {
                  subscriptionId: otherSub.id,
                  priceId: price.id,
                  quantity: 1,
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("updateItem changes quantity and returns updated row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });
         const item = await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: sub.id,
            priceId: price.id,
            quantity: 1,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionItemsRouter.update,
            { id: item.id, quantity: 7 },
            { context: ctx },
         );
         expect(result.id).toBe(item.id);
         expect(result.quantity).toBe(7);
      });

      it("updateItem throws NOT_FOUND for cross-team item", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const otherService = await makeService(testDb.db, {
            teamId: otherTeamId,
         });
         const otherPrice = await makePrice(testDb.db, {
            teamId: otherTeamId,
            serviceId: otherService.id,
         });
         const otherSub = await makeSubscription(testDb.db, {
            teamId: otherTeamId,
            contactId: otherContact.id,
         });
         const otherItem = await makeSubscriptionItem(testDb.db, {
            teamId: otherTeamId,
            subscriptionId: otherSub.id,
            priceId: otherPrice.id,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionItemsRouter.update,
               { id: otherItem.id, quantity: 99 },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("removeItem deletes the subscription item row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });
         const item = await makeSubscriptionItem(testDb.db, {
            teamId,
            subscriptionId: sub.id,
            priceId: price.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionItemsRouter.remove,
            { id: item.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(subscriptionItems)
            .where(eq(subscriptionItems.id, item.id));
         expect(rows).toHaveLength(0);
      });

      it("removeItem throws NOT_FOUND for cross-team item", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherContact = await makeContact(testDb.db, {
            teamId: otherTeamId,
         });
         const otherService = await makeService(testDb.db, {
            teamId: otherTeamId,
         });
         const otherPrice = await makePrice(testDb.db, {
            teamId: otherTeamId,
            serviceId: otherService.id,
         });
         const otherSub = await makeSubscription(testDb.db, {
            teamId: otherTeamId,
            contactId: otherContact.id,
         });
         const otherItem = await makeSubscriptionItem(testDb.db, {
            teamId: otherTeamId,
            subscriptionId: otherSub.id,
            priceId: otherPrice.id,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               subscriptionItemsRouter.remove,
               { id: otherItem.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("listItems returns subscription items ordered ASC by createdAt", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const service = await makeService(testDb.db, { teamId });
         const priceA = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "PriceA",
         });
         const priceB = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "PriceB",
         });
         const priceC = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "PriceC",
         });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
         });

         const inserted = await testDb.db
            .insert(subscriptionItems)
            .values([
               {
                  teamId,
                  subscriptionId: sub.id,
                  priceId: priceA.id,
                  quantity: 1,
                  createdAt: dayjs().subtract(2, "minute").toDate(),
               },
               {
                  teamId,
                  subscriptionId: sub.id,
                  priceId: priceB.id,
                  quantity: 2,
                  createdAt: dayjs().subtract(1, "minute").toDate(),
               },
               {
                  teamId,
                  subscriptionId: sub.id,
                  priceId: priceC.id,
                  quantity: 3,
                  createdAt: dayjs().toDate(),
               },
            ])
            .returning();
         const [first, second, third] = inserted;

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            subscriptionItemsRouter.list,
            { subscriptionId: sub.id },
            { context: ctx },
         );
         expect(result.map((r) => r.id)).toEqual([
            first?.id,
            second?.id,
            third?.id,
         ]);
      });
   });
});
