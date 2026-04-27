import {
   afterAll,
   afterEach,
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

import "../helpers/mock-billing-context";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import dayjs from "dayjs";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { invoices } from "@core/database/schemas/invoices";
import {
   makeContact,
   makePrice,
   makeService,
} from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";

import * as subscriptionsRouter from "../../src/router/subscriptions";
import { trialExpiryWorkflow } from "../../src/workflows/trial-expiry-workflow";
import { periodEndInvoiceWorkflow } from "../../src/workflows/period-end-invoice-workflow";

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

afterEach(() => {
   vi.useRealTimers();
});

type EnqueueOptions = { enqueueOptions: { delaySeconds: number } };

describe("trial → invoice handoff (E2E time-mocked)", () => {
   it("walks the full chain: trialing sub → warning → expiry → activation → first invoice → next invoice", async () => {
      const T0 = dayjs("2026-05-01T00:00:00Z");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(T0.toDate());

      const mocks = await dbosMocks;
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const price = await makePrice(testDb.db, {
         teamId,
         serviceId: service.id,
         basePrice: "20.00",
         type: "flat",
         interval: "monthly",
      });

      const ctx = createTestContext(testDb.db, {
         teamId,
         extras: { hyprpayClient: createHyprpayMock() },
      });

      const trialEndsAt = T0.add(7, "day").toISOString();

      const sub = await call(
         subscriptionsRouter.createSubscription,
         {
            contactId: contact.id,
            startDate: T0.format("YYYY-MM-DD"),
            status: "trialing",
            trialEndsAt,
            items: [{ priceId: price.id, quantity: 1 }],
         },
         { context: ctx },
      );

      await new Promise((r) => setImmediate(r));

      expect(sub.status).toBe("trialing");
      expect(ctx.workflowClient.enqueue).toHaveBeenCalledTimes(1);
      const trialEnqueueCall = ctx.workflowClient.enqueue.mock.calls[0];
      const trialEnqueueParams = trialEnqueueCall?.[0] as EnqueueOptions;
      const trialEnqueueDelay = trialEnqueueParams.enqueueOptions.delaySeconds;
      const expectedWarningDelay = 4 * 86400;
      expect(trialEnqueueDelay).toBeGreaterThanOrEqual(
         expectedWarningDelay - 5,
      );
      expect(trialEnqueueDelay).toBeLessThanOrEqual(expectedWarningDelay);

      vi.setSystemTime(T0.add(4, "day").toDate());
      mocks.startWorkflowSpy.mockClear();

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "warning",
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      expect(mocks.startWorkflowSpy).toHaveBeenCalledTimes(1);
      const [warningParams, warningInput] =
         mocks.startWorkflowSpy.mock.calls[0] ?? [];
      expect(warningParams).toMatchObject({
         workflowID: `trial-expiry-${sub.id}-expiry`,
         queueName: "workflow:trial-expiry",
         enqueueOptions: expect.objectContaining({
            delaySeconds: expect.any(Number),
         }),
      });
      expect(warningInput).toMatchObject({ phase: "expiry" });
      const expiryDelay = (warningParams as EnqueueOptions).enqueueOptions
         .delaySeconds;
      const expectedExpiryDelay = 3 * 86400;
      expect(expiryDelay).toBeGreaterThanOrEqual(expectedExpiryDelay - 5);
      expect(expiryDelay).toBeLessThanOrEqual(expectedExpiryDelay);

      const T_expiry = T0.add(7, "day");
      vi.setSystemTime(T_expiry.toDate());
      mocks.startWorkflowSpy.mockClear();

      await trialExpiryWorkflow({
         teamId,
         subscriptionId: sub.id,
         trialEndsAt,
         phase: "expiry",
         contactEmail: "cliente@example.com",
         contactName: "Cliente Teste",
      });

      const [activated] = await testDb.db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, sub.id));
      expect(activated?.status).toBe("active");

      expect(mocks.startWorkflowSpy).toHaveBeenCalledTimes(1);
      const [firstInvoiceParams, firstInvoiceInput] =
         mocks.startWorkflowSpy.mock.calls[0] ?? [];
      const expectedFirstPeriodEnd = T_expiry.add(1, "month");
      expect(firstInvoiceParams).toMatchObject({
         workflowID: `period-invoice-${sub.id}-${expectedFirstPeriodEnd.format("YYYY-MM-DD")}`,
         queueName: "workflow:period-end-invoice",
         enqueueOptions: expect.objectContaining({
            delaySeconds: expect.any(Number),
         }),
      });
      const firstInvoiceDelay = (firstInvoiceParams as EnqueueOptions)
         .enqueueOptions.delaySeconds;
      const expectedFirstInvoiceDelay = Math.floor(
         expectedFirstPeriodEnd.diff(T_expiry) / 1000,
      );
      expect(firstInvoiceDelay).toBeGreaterThan(expectedFirstInvoiceDelay - 5);
      expect(firstInvoiceDelay).toBeLessThanOrEqual(expectedFirstInvoiceDelay);

      const capturedInvoiceInput = firstInvoiceInput as {
         teamId: string;
         subscriptionId: string;
         periodStart: string;
         periodEnd: string;
         contactEmail?: string;
         contactName?: string;
      };
      expect(capturedInvoiceInput).toMatchObject({
         teamId,
         subscriptionId: sub.id,
         periodStart: T_expiry.toISOString(),
         periodEnd: expectedFirstPeriodEnd.toISOString(),
      });

      vi.setSystemTime(expectedFirstPeriodEnd.toDate());
      mocks.startWorkflowSpy.mockClear();

      await periodEndInvoiceWorkflow(capturedInvoiceInput);

      const [invoiceRow] = await testDb.db
         .select()
         .from(invoices)
         .where(eq(invoices.subscriptionId, sub.id));
      expect(invoiceRow).toBeDefined();
      expect(invoiceRow?.subtotal).toBe("20.00");
      expect(invoiceRow?.total).toBe("20.00");
      expect(invoiceRow?.lineItems).toHaveLength(1);

      expect(mocks.startWorkflowSpy).toHaveBeenCalledTimes(1);
      const [nextInvoiceParams, nextInvoiceInput] =
         mocks.startWorkflowSpy.mock.calls[0] ?? [];
      const expectedNextPeriodEnd = expectedFirstPeriodEnd.add(1, "month");
      expect(nextInvoiceParams).toMatchObject({
         workflowID: `period-invoice-${sub.id}-${expectedNextPeriodEnd.format("YYYY-MM-DD")}`,
         queueName: "workflow:period-end-invoice",
         enqueueOptions: expect.objectContaining({
            delaySeconds: expect.any(Number),
         }),
      });
      const nextInvoiceDelay = (nextInvoiceParams as EnqueueOptions)
         .enqueueOptions.delaySeconds;
      const expectedNextInvoiceDelay = Math.floor(
         expectedNextPeriodEnd.diff(expectedFirstPeriodEnd) / 1000,
      );
      expect(nextInvoiceDelay).toBeGreaterThan(expectedNextInvoiceDelay - 5);
      expect(nextInvoiceDelay).toBeLessThanOrEqual(expectedNextInvoiceDelay);
      expect(nextInvoiceInput).toMatchObject({
         teamId,
         subscriptionId: sub.id,
         periodStart: expectedFirstPeriodEnd.toISOString(),
         periodEnd: expectedNextPeriodEnd.toISOString(),
      });

      expect(mocks.sleepSpy).not.toHaveBeenCalled();
   });
});
