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
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { couponRedemptions } from "@core/database/schemas/coupons";
import { invoices } from "@core/database/schemas/invoices";
import { servicePrices } from "@core/database/schemas/services";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import { WorkflowError } from "@core/dbos/errors";
import {
   attachBenefit,
   makeBenefit,
   makeContact,
   makeCoupon,
   makeMeter,
   makePrice,
   makeService,
   makeSubscription,
   makeSubscriptionItem,
   makeUsageEvent,
} from "../helpers/billing-factories";

import { periodEndInvoiceWorkflow } from "../../src/workflows/period-end-invoice-workflow";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

const periodStart = dayjs().subtract(1, "month").startOf("month").toISOString();
const periodEnd = dayjs().subtract(1, "month").endOf("month").toISOString();
const inPeriodTimestamp = dayjs(periodStart).add(15, "day").toDate();

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

async function getInvoiceForSub(subscriptionId: string) {
   const [row] = await testDb.db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, subscriptionId));
   return row;
}

describe("periodEndInvoiceWorkflow", () => {
   it("throws notFound (code 404) when subscription is missing", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const missingId = crypto.randomUUID();

      const error = await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: missingId,
         periodStart,
         periodEnd,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(WorkflowError);
      expect((error as WorkflowError).code).toBe(404);
   });

   it("persists empty invoice when subscription has no items", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice).toBeDefined();
      expect(invoice?.subtotal).toBe("0.00");
      expect(invoice?.total).toBe("0.00");
      expect(invoice?.discountAmount).toBe("0.00");
      expect(invoice?.lineItems).toEqual([]);
      expect(invoice?.couponSnapshot).toBeNull();
      expect(invoice?.currency).toBe("BRL");
   });

   it("computes flat-price subtotal/total with quantity", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "150.00",
         type: "flat",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 2,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("300.00");
      expect(invoice?.total).toBe("300.00");
      expect(invoice?.lineItems).toHaveLength(1);
      expect(invoice?.lineItems[0]?.subtotal).toBe("300.00");
      expect(invoice?.lineItems[0]?.unitPrice).toBe("150.00");
   });

   it("metered price subtracts active credit benefit from usage", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const meter = await makeMeter(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "0.10",
         type: "metered",
         meterId: meter.id,
      });
      const benefit = await makeBenefit(testDb.db, {
         teamId,
         type: "credits",
         meterId: meter.id,
         creditAmount: 400,
      });
      await attachBenefit(testDb.db, {
         serviceId: service.id,
         benefitId: benefit.id,
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });
      await testDb.db.insert(benefitGrants).values({
         teamId,
         subscriptionId: sub.id,
         benefitId: benefit.id,
         status: "active",
      });
      await makeUsageEvent(testDb.db, {
         teamId,
         meterId: meter.id,
         quantity: "600",
         timestamp: inPeriodTimestamp,
      });
      await makeUsageEvent(testDb.db, {
         teamId,
         meterId: meter.id,
         quantity: "400",
         timestamp: inPeriodTimestamp,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.lineItems).toHaveLength(1);
      expect(invoice?.lineItems[0]?.quantity).toBe("600.00");
      expect(invoice?.lineItems[0]?.subtotal).toBe("60.00");
      expect(invoice?.subtotal).toBe("60.00");
      expect(invoice?.total).toBe("60.00");
   });

   it("clamps metered subtotal to priceCap when raw exceeds cap", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const meter = await makeMeter(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "0.10",
         type: "metered",
         meterId: meter.id,
         priceCap: "50.00",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });
      await makeUsageEvent(testDb.db, {
         teamId,
         meterId: meter.id,
         quantity: "1000",
         timestamp: inPeriodTimestamp,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.lineItems).toHaveLength(1);
      expect(invoice?.lineItems[0]?.subtotal).toBe("50.00");
      expect(invoice?.subtotal).toBe("50.00");
      expect(invoice?.total).toBe("50.00");
   });

   it("uses negotiatedPrice over basePrice when present", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "100.00",
         type: "flat",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
         negotiatedPrice: "80.00",
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("80.00");
      expect(invoice?.total).toBe("80.00");
      expect(invoice?.lineItems[0]?.unitPrice).toBe("80.00");
   });

   it("skips line items whose price is inactive", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const activePrice = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "100.00",
         type: "flat",
      });
      const inactivePrice = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "999.00",
         type: "flat",
      });
      await testDb.db
         .update(servicePrices)
         .set({ isActive: false })
         .where(eq(servicePrices.id, inactivePrice.id));
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: activePrice.id,
         quantity: 1,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: inactivePrice.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.lineItems).toHaveLength(1);
      expect(invoice?.subtotal).toBe("100.00");
      expect(invoice?.total).toBe("100.00");
   });

   it("applies coupon (duration=once) when no prior redemption", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "200.00",
         type: "flat",
      });
      const coupon = await makeCoupon(testDb.db, {
         teamId,
         type: "percent",
         amount: "10",
         duration: "once",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         couponId: coupon.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("200.00");
      expect(invoice?.discountAmount).toBe("20.00");
      expect(invoice?.total).toBe("180.00");
      expect(invoice?.couponSnapshot).toMatchObject({
         code: coupon.code,
         type: "percent",
         duration: "once",
      });
   });

   it("does NOT apply coupon (duration=once) when redemption count is 1", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "200.00",
         type: "flat",
      });
      const coupon = await makeCoupon(testDb.db, {
         teamId,
         type: "percent",
         amount: "10",
         duration: "once",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         couponId: coupon.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });
      await testDb.db.insert(couponRedemptions).values({
         teamId,
         couponId: coupon.id,
         subscriptionId: sub.id,
         contactId: contact.id,
         discountSnapshot: {
            code: coupon.code,
            type: coupon.type,
            amount: coupon.amount,
            duration: coupon.duration,
            durationMonths: coupon.durationMonths,
         },
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("200.00");
      expect(invoice?.discountAmount).toBe("0.00");
      expect(invoice?.total).toBe("200.00");
      expect(invoice?.couponSnapshot).toBeNull();
   });

   it("applies coupon (duration=repeating, durationMonths=3) at redemptionCount=2 but skips at redemptionCount=3", async () => {
      // Case A: redemption count = 2 (under cap) → applied
      const { teamId: teamIdA } = await seedTeam(testDb.db);
      const contactA = await makeContact(testDb.db, { teamId: teamIdA });
      const serviceA = await makeService(testDb.db, { teamId: teamIdA });
      const priceA = await makePrice(testDb.db, {
         teamId: teamIdA,
         serviceId: serviceA.id,
         basePrice: "100.00",
         type: "flat",
      });
      const couponA = await makeCoupon(testDb.db, {
         teamId: teamIdA,
         type: "percent",
         amount: "10",
         duration: "repeating",
         durationMonths: 3,
      });
      const subA = await makeSubscription(testDb.db, {
         teamId: teamIdA,
         contactId: contactA.id,
         couponId: couponA.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId: teamIdA,
         subscriptionId: subA.id,
         priceId: priceA.id,
         quantity: 1,
      });
      const snapshotA = {
         code: couponA.code,
         type: couponA.type,
         amount: couponA.amount,
         duration: couponA.duration,
         durationMonths: couponA.durationMonths,
      };
      await testDb.db.insert(couponRedemptions).values([
         {
            teamId: teamIdA,
            couponId: couponA.id,
            subscriptionId: subA.id,
            contactId: contactA.id,
            discountSnapshot: snapshotA,
         },
         {
            teamId: teamIdA,
            couponId: couponA.id,
            subscriptionId: subA.id,
            contactId: contactA.id,
            discountSnapshot: snapshotA,
         },
      ]);

      await periodEndInvoiceWorkflow({
         teamId: teamIdA,
         subscriptionId: subA.id,
         periodStart,
         periodEnd,
      });

      const invoiceA = await getInvoiceForSub(subA.id);
      expect(invoiceA?.discountAmount).toBe("10.00");
      expect(invoiceA?.total).toBe("90.00");
      expect(invoiceA?.couponSnapshot).not.toBeNull();

      // Case B: redemption count = 3 (at cap) → NOT applied
      const { teamId: teamIdB } = await seedTeam(testDb.db);
      const contactB = await makeContact(testDb.db, { teamId: teamIdB });
      const serviceB = await makeService(testDb.db, { teamId: teamIdB });
      const priceB = await makePrice(testDb.db, {
         teamId: teamIdB,
         serviceId: serviceB.id,
         basePrice: "100.00",
         type: "flat",
      });
      const couponB = await makeCoupon(testDb.db, {
         teamId: teamIdB,
         type: "percent",
         amount: "10",
         duration: "repeating",
         durationMonths: 3,
      });
      const subB = await makeSubscription(testDb.db, {
         teamId: teamIdB,
         contactId: contactB.id,
         couponId: couponB.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId: teamIdB,
         subscriptionId: subB.id,
         priceId: priceB.id,
         quantity: 1,
      });
      const snapshotB = {
         code: couponB.code,
         type: couponB.type,
         amount: couponB.amount,
         duration: couponB.duration,
         durationMonths: couponB.durationMonths,
      };
      await testDb.db.insert(couponRedemptions).values([
         {
            teamId: teamIdB,
            couponId: couponB.id,
            subscriptionId: subB.id,
            contactId: contactB.id,
            discountSnapshot: snapshotB,
         },
         {
            teamId: teamIdB,
            couponId: couponB.id,
            subscriptionId: subB.id,
            contactId: contactB.id,
            discountSnapshot: snapshotB,
         },
         {
            teamId: teamIdB,
            couponId: couponB.id,
            subscriptionId: subB.id,
            contactId: contactB.id,
            discountSnapshot: snapshotB,
         },
      ]);

      await periodEndInvoiceWorkflow({
         teamId: teamIdB,
         subscriptionId: subB.id,
         periodStart,
         periodEnd,
      });

      const invoiceB = await getInvoiceForSub(subB.id);
      expect(invoiceB?.discountAmount).toBe("0.00");
      expect(invoiceB?.total).toBe("100.00");
      expect(invoiceB?.couponSnapshot).toBeNull();
   });

   it("applies coupon (duration=forever) regardless of redemption count", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "100.00",
         type: "flat",
      });
      const coupon = await makeCoupon(testDb.db, {
         teamId,
         type: "percent",
         amount: "10",
         duration: "forever",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         couponId: coupon.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });
      const snapshot = {
         code: coupon.code,
         type: coupon.type,
         amount: coupon.amount,
         duration: coupon.duration,
         durationMonths: coupon.durationMonths,
      };
      await testDb.db.insert(couponRedemptions).values([
         {
            teamId,
            couponId: coupon.id,
            subscriptionId: sub.id,
            contactId: contact.id,
            discountSnapshot: snapshot,
         },
         {
            teamId,
            couponId: coupon.id,
            subscriptionId: sub.id,
            contactId: contact.id,
            discountSnapshot: snapshot,
         },
         {
            teamId,
            couponId: coupon.id,
            subscriptionId: sub.id,
            contactId: contact.id,
            discountSnapshot: snapshot,
         },
      ]);

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.discountAmount).toBe("10.00");
      expect(invoice?.total).toBe("90.00");
      expect(invoice?.couponSnapshot).not.toBeNull();
   });

   it("applies percent coupon math: 10% off 500.00 → discount 50.00 total 450.00", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "500.00",
         type: "flat",
      });
      const coupon = await makeCoupon(testDb.db, {
         teamId,
         type: "percent",
         amount: "10",
         duration: "once",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         couponId: coupon.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("500.00");
      expect(invoice?.discountAmount).toBe("50.00");
      expect(invoice?.total).toBe("450.00");
   });

   it("clamps total to 0.00 when fixed coupon exceeds subtotal", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "500.00",
         type: "flat",
      });
      const coupon = await makeCoupon(testDb.db, {
         teamId,
         type: "fixed",
         amount: "600.00",
         duration: "once",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
         couponId: coupon.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice?.subtotal).toBe("500.00");
      expect(invoice?.discountAmount).toBe("600.00");
      expect(invoice?.total).toBe("0.00");
   });

   it("publishes BILLING_INVOICE_GENERATED notification and sends email when contactEmail provided", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "120.00",
         type: "flat",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      const invoice = await getInvoiceForSub(sub.id);
      expect(invoice).toBeDefined();

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(billingPublisherSpy).toHaveBeenCalledWith(
         "job.notification",
         expect.objectContaining({
            type: NOTIFICATION_TYPES.BILLING_INVOICE_GENERATED,
            status: "completed",
            teamId,
            payload: {
               invoiceId: invoice?.id,
               subscriptionId: sub.id,
               total: "120.00",
               currency: "BRL",
            },
         }),
      );

      expect(
         billingResendSpies.sendBillingInvoiceGenerated,
      ).toHaveBeenCalledTimes(1);
   });

   it("formats both periodStart and periodEnd as DD/MM/YYYY in the email", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "10.00",
         type: "flat",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
         contactEmail: "cliente@example.com",
      });

      expect(
         billingResendSpies.sendBillingInvoiceGenerated,
      ).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            periodStart: dayjs(periodStart).format("DD/MM/YYYY"),
            periodEnd: dayjs(periodEnd).format("DD/MM/YYYY"),
         }),
      );
   });

   it("does not send email when contactEmail is absent (publish still fires)", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "75.00",
         type: "flat",
      });
      const sub = await makeSubscription(testDb.db, {
         teamId,
         contactId: contact.id,
      });
      await makeSubscriptionItem(testDb.db, {
         teamId,
         subscriptionId: sub.id,
         priceId: price.id,
         quantity: 1,
      });

      await periodEndInvoiceWorkflow({
         teamId,
         subscriptionId: sub.id,
         periodStart,
         periodEnd,
      });

      expect(billingPublisherSpy).toHaveBeenCalledTimes(1);
      expect(
         billingResendSpies.sendBillingInvoiceGenerated,
      ).not.toHaveBeenCalled();
   });
});
