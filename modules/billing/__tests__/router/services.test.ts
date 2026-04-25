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
import { and, count, eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { servicePrices, services } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { categories } from "@core/database/schemas/categories";
import { meters } from "@core/database/schemas/meters";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { usageEvents } from "@core/database/schemas/usage-events";
import {
   attachBenefit,
   makeBenefit,
   makeContact,
   makeMeter,
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

import * as servicesRouter from "../../src/router/services";

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

async function makeCategory(
   db: Awaited<ReturnType<typeof setupTestDb>>["db"],
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(categories)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Categoria ${crypto.randomUUID()}`,
         type: "expense",
      })
      .returning();
   if (!row) throw new Error("makeCategory: insert returned no row");
   return row;
}

describe("services router", () => {
   describe("services", () => {
      it("getAll returns only current team's services", async () => {
         const { teamId: teamA } = await seedTeam(testDb.db);
         const { teamId: teamB } = await seedTeam(testDb.db);
         await makeService(testDb.db, { teamId: teamA, name: "A1" });
         await makeService(testDb.db, { teamId: teamA, name: "A2" });
         await makeService(testDb.db, { teamId: teamA, name: "A3" });
         await makeService(testDb.db, { teamId: teamB, name: "B1" });

         const ctx = createTestContext(testDb.db, {
            teamId: teamA,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(servicesRouter.getAll, undefined, {
            context: ctx,
         });
         expect(result).toHaveLength(3);
         expect(result.map((s) => s.name).sort()).toEqual(["A1", "A2", "A3"]);
      });

      it("getAll filters by case-insensitive search across name", async () => {
         const { teamId } = await seedTeam(testDb.db);
         await makeService(testDb.db, { teamId, name: "Alpha" });
         await makeService(testDb.db, { teamId, name: "Beta" });
         await makeService(testDb.db, { teamId, name: "Gamma" });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.getAll,
            { search: "alp" },
            { context: ctx },
         );
         expect(result.map((s) => s.name)).toEqual(["Alpha"]);
      });

      it("getAll search matches against description as well", async () => {
         const { teamId } = await seedTeam(testDb.db);
         await makeService(testDb.db, { teamId, name: "Alpha" });
         await makeService(testDb.db, { teamId, name: "Beta" });
         await testDb.db.insert(services).values({
            teamId,
            name: "Zeta",
            description: "blah alphabet blah",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.getAll,
            { search: "alpha" },
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         expect(result.map((s) => s.name).sort()).toEqual(["Alpha", "Zeta"]);
      });

      it("getAll filters by categoryId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const catA = await makeCategory(testDb.db, {
            teamId,
            name: "Cat A",
         });
         const catB = await makeCategory(testDb.db, {
            teamId,
            name: "Cat B",
         });
         await testDb.db.insert(services).values([
            { teamId, name: "S-A", categoryId: catA.id },
            { teamId, name: "S-B", categoryId: catB.id },
         ]);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.getAll,
            { categoryId: catA.id },
            { context: ctx },
         );
         expect(result).toHaveLength(1);
         expect(result[0]?.name).toBe("S-A");
      });

      it("create inserts row with teamId matching context on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.create,
            { name: "Novo Serviço" },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.name).toBe("Novo Serviço");
      });

      it("create throws zod failure when name is empty", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(servicesRouter.create, { name: "" }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) =>
               e.code === "INPUT_VALIDATION_FAILED" || e.code === "BAD_REQUEST",
         );
      });

      it("bulkCreate inserts all items with teamId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.bulkCreate,
            {
               items: [
                  { name: "Bulk 1" },
                  { name: "Bulk 2" },
                  { name: "Bulk 3" },
               ],
            },
            { context: ctx },
         );
         expect(result).toHaveLength(3);
         for (const row of result) {
            expect(row.teamId).toBe(teamId);
         }
         expect(result.map((r) => r.name).sort()).toEqual([
            "Bulk 1",
            "Bulk 2",
            "Bulk 3",
         ]);
      });

      it("bulkCreate throws zod failure on empty items array", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(servicesRouter.bulkCreate, { items: [] }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) =>
               e.code === "INPUT_VALIDATION_FAILED" || e.code === "BAD_REQUEST",
         );
      });

      it("update changes name and returns updated row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, {
            teamId,
            name: "Antigo",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.update,
            { id: service.id, name: "Novo Nome" },
            { context: ctx },
         );
         expect(result.id).toBe(service.id);
         expect(result.name).toBe("Novo Nome");

         const [persisted] = await testDb.db
            .select()
            .from(services)
            .where(eq(services.id, service.id));
         expect(persisted?.name).toBe("Novo Nome");
      });

      it("update throws NOT_FOUND for cross-team service", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId: otherTeamId });
         const { teamId: callerTeamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId: callerTeamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.update,
               { id: service.id, name: "Hack" },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("remove deletes the service row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.remove,
            { id: service.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(services)
            .where(eq(services.id, service.id));
         expect(rows).toHaveLength(0);
      });

      it("remove throws NOT_FOUND for cross-team service", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId: otherTeamId });
         const { teamId: callerTeamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId: callerTeamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(servicesRouter.remove, { id: service.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("exportAll returns services with joined category", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const category = await makeCategory(testDb.db, {
            teamId,
            name: "Cat Export",
         });
         await testDb.db
            .insert(services)
            .values({ teamId, name: "Exp", categoryId: category.id });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(servicesRouter.exportAll, undefined, {
            context: ctx,
         });
         expect(result).toHaveLength(1);
         const [row] = result;
         expect(row?.name).toBe("Exp");
         expect(row?.category?.id).toBe(category.id);
         expect(row?.category?.name).toBe("Cat Export");
      });
   });

   describe("prices", () => {
      it("getVariants returns service's prices ordered by name asc", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "Beta",
         });
         await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "Alpha",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.getVariants,
            { serviceId: service.id },
            { context: ctx },
         );
         expect(result).toHaveLength(2);
         expect(result.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
      });

      it("getVariants throws NOT_FOUND when service belongs to another team", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.getVariants,
               { serviceId: service.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("createVariant inserts a flat price row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.createVariant,
            {
               serviceId: service.id,
               name: "Plano Flat",
               type: "flat",
               basePrice: "100.00",
               interval: "monthly",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.serviceId).toBe(service.id);
         expect(result.name).toBe("Plano Flat");
         expect(result.type).toBe("flat");
         expect(result.basePrice).toBe("100.00");
         expect(result.interval).toBe("monthly");
      });

      it("createVariant rejects metered type without meterId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.createVariant,
               {
                  serviceId: service.id,
                  name: "Metered",
                  type: "metered",
                  basePrice: "0",
                  interval: "monthly",
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
         );
      });

      it("createVariant rejects metered type with non-zero basePrice", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.createVariant,
               {
                  serviceId: service.id,
                  name: "Metered",
                  type: "metered",
                  basePrice: "50.00",
                  interval: "monthly",
                  meterId: meter.id,
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
         );
      });

      it("createVariant inserts a metered price with meterId and basePrice 0", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.createVariant,
            {
               serviceId: service.id,
               name: "Plano Medido",
               type: "metered",
               basePrice: "0",
               interval: "monthly",
               meterId: meter.id,
            },
            { context: ctx },
         );
         expect(result.type).toBe("metered");
         expect(result.meterId).toBe(meter.id);
         expect(Number(result.basePrice)).toBe(0);
      });

      it("updateVariant changes name and returns updated row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            name: "Antigo",
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.updateVariant,
            { id: price.id, name: "Novo Nome" },
            { context: ctx },
         );
         expect(result.id).toBe(price.id);
         expect(result.name).toBe("Novo Nome");

         const [persisted] = await testDb.db
            .select()
            .from(servicePrices)
            .where(eq(servicePrices.id, price.id));
         expect(persisted?.name).toBe("Novo Nome");
      });

      it("updateVariant rejects metered type with meterId set to null", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const service = await makeService(testDb.db, { teamId });
         const meter = await makeMeter(testDb.db, { teamId });
         const price = await makePrice(testDb.db, {
            teamId,
            serviceId: service.id,
            type: "metered",
            basePrice: "0",
            meterId: meter.id,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.updateVariant,
               { id: price.id, type: "metered", meterId: null },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "BAD_REQUEST",
         );
      });

      it("updateVariant throws NOT_FOUND for cross-team price", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherService = await makeService(testDb.db, {
            teamId: otherTeamId,
         });
         const price = await makePrice(testDb.db, {
            teamId: otherTeamId,
            serviceId: otherService.id,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.updateVariant,
               { id: price.id, name: "Hack" },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("removeVariant deletes the price row", async () => {
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
         const result = await call(
            servicesRouter.removeVariant,
            { id: price.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(servicePrices)
            .where(eq(servicePrices.id, price.id));
         expect(rows).toHaveLength(0);
      });

      it("removeVariant throws NOT_FOUND for cross-team price", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherService = await makeService(testDb.db, {
            teamId: otherTeamId,
         });
         const price = await makePrice(testDb.db, {
            teamId: otherTeamId,
            serviceId: otherService.id,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.removeVariant,
               { id: price.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });

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
            servicesRouter.getAllSubscriptions,
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
            servicesRouter.getAllSubscriptions,
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
            servicesRouter.getContactSubscriptions,
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
               servicesRouter.getContactSubscriptions,
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
            servicesRouter.createSubscription,
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
            servicesRouter.createSubscription,
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
            servicesRouter.createSubscription,
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
            servicesRouter.createSubscription,
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
               servicesRouter.createSubscription,
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
            servicesRouter.cancelSubscription,
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
               servicesRouter.cancelSubscription,
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
               servicesRouter.cancelSubscription,
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
         const result = await call(servicesRouter.getExpiringSoon, undefined, {
            context: ctx,
         });
         const ids = result.map((r) => r.id).sort();
         expect(ids).toEqual([subToday.id, subTen.id].sort());
      });
   });

   describe("meters", () => {
      it("createMeter inserts row with teamId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.createMeter,
            {
               name: "Medidor Novo",
               eventName: "billing.test_event",
               aggregation: "sum",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.name).toBe("Medidor Novo");
         expect(result.eventName).toBe("billing.test_event");
      });

      it("getMeters returns only current team's meters ordered by name asc", async () => {
         const { teamId: teamA } = await seedTeam(testDb.db);
         const { teamId: teamB } = await seedTeam(testDb.db);
         await makeMeter(testDb.db, { teamId: teamA, name: "Beta" });
         await makeMeter(testDb.db, { teamId: teamA, name: "Alpha" });
         await makeMeter(testDb.db, { teamId: teamB, name: "OutroTime" });

         const ctx = createTestContext(testDb.db, {
            teamId: teamA,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(servicesRouter.getMeters, undefined, {
            context: ctx,
         });
         expect(result).toHaveLength(2);
         expect(result.map((m) => m.name)).toEqual(["Alpha", "Beta"]);
      });

      it("getMeterById returns meter on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.getMeterById,
            { id: meter.id },
            { context: ctx },
         );
         expect(result.id).toBe(meter.id);
      });

      it("getMeterById throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.getMeterById,
               { id: meter.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("updateMeterById flips isActive and persists", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.updateMeterById,
            { id: meter.id, isActive: false },
            { context: ctx },
         );
         expect(result.isActive).toBe(false);

         const [persisted] = await testDb.db
            .select()
            .from(meters)
            .where(eq(meters.id, meter.id));
         expect(persisted?.isActive).toBe(false);
      });

      it("updateMeterById throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.updateMeterById,
               { id: meter.id, isActive: false },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("removeMeter deletes the meter row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.removeMeter,
            { id: meter.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(meters)
            .where(eq(meters.id, meter.id));
         expect(rows).toHaveLength(0);
      });

      it("removeMeter throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.removeMeter,
               { id: meter.id },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });

   describe("benefits", () => {
      it("createBenefit inserts row with teamId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.createBenefit,
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
         const result = await call(servicesRouter.getBenefits, undefined, {
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
            servicesRouter.getBenefitById,
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
               servicesRouter.getBenefitById,
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
            servicesRouter.updateBenefitById,
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
               servicesRouter.updateBenefitById,
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
            servicesRouter.removeBenefit,
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
               servicesRouter.removeBenefit,
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
            servicesRouter.attachBenefit,
            { serviceId: service.id, benefitId: benefit.id },
            { context: ctx },
         );
         expect(first).toEqual({ success: true });

         // Idempotent re-attach (onConflictDoNothing)
         const second = await call(
            servicesRouter.attachBenefit,
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
            servicesRouter.detachBenefit,
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
               servicesRouter.attachBenefit,
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
               servicesRouter.attachBenefit,
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
            servicesRouter.getServiceBenefits,
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

   describe("usage", () => {
      it("ingestUsage inserts a usage event row on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });
         const idempotencyKey = crypto.randomUUID();

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            servicesRouter.ingestUsage,
            {
               teamId,
               meterId: meter.id,
               quantity: "5",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(usageEvents)
            .where(
               and(
                  eq(usageEvents.teamId, teamId),
                  eq(usageEvents.idempotencyKey, idempotencyKey),
               ),
            );
         expect(rows).toHaveLength(1);
         expect(rows[0]?.meterId).toBe(meter.id);
         expect(Number(rows[0]?.quantity)).toBe(5);
      });

      it("ingestUsage rejects with FORBIDDEN when input.teamId !== context.teamId", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const otherMeter = await makeMeter(testDb.db, {
            teamId: otherTeamId,
         });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               servicesRouter.ingestUsage,
               {
                  teamId: otherTeamId,
                  meterId: otherMeter.id,
                  quantity: "1",
                  idempotencyKey: crypto.randomUUID(),
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "FORBIDDEN",
         );
      });

      it("ingestUsage is idempotent — same idempotencyKey twice yields a single row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });
         const idempotencyKey = crypto.randomUUID();

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const first = await call(
            servicesRouter.ingestUsage,
            {
               teamId,
               meterId: meter.id,
               quantity: "1",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(first).toEqual({ success: true });

         const second = await call(
            servicesRouter.ingestUsage,
            {
               teamId,
               meterId: meter.id,
               quantity: "9",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(second).toEqual({ success: true });

         const [row] = await testDb.db
            .select({ count: count() })
            .from(usageEvents)
            .where(
               and(
                  eq(usageEvents.teamId, teamId),
                  eq(usageEvents.idempotencyKey, idempotencyKey),
               ),
            );
         expect(row?.count).toBe(1);
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
         const result = await call(servicesRouter.getMrr, undefined, {
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
         const result = await call(servicesRouter.getMrr, undefined, {
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
            servicesRouter.getActiveCountByPrice,
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
            servicesRouter.addItem,
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
               servicesRouter.addItem,
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
               servicesRouter.addItem,
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
            servicesRouter.updateItem,
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
               servicesRouter.updateItem,
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
            servicesRouter.removeItem,
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
               servicesRouter.removeItem,
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
            servicesRouter.listItems,
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
