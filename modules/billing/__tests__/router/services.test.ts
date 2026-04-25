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
import { servicePrices, services } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { categories } from "@core/database/schemas/categories";
import {
   makeContact,
   makeMeter,
   makePrice,
   makeService,
   makeSubscription,
   makeSubscriptionItem,
} from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";

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

      it.skip("createSubscription with status=trialing enqueues trialExpiryWorkflow", async () => {
         // TODO(bug-hunt): createSubscriptionWithItemsInputSchema only picks
         // { contactId, startDate, endDate, notes } — `status` and
         // `trialEndsAt` cannot be set via the router input. The branch
         // `if (sub.status === "trialing" && sub.trialEndsAt)` is
         // unreachable from the public API. Either expand the contract to
         // allow trialing subscriptions, or remove the dead enqueue branch.
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
         expect(ctx.workflowClient.enqueue).toHaveBeenCalledTimes(1);
         const call0 = ctx.workflowClient.enqueue.mock.calls[0];
         expect(call0?.[1]).toMatchObject({
            teamId,
            subscriptionId: result.id,
            serviceId: service.id,
            newStatus: "active",
         });
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

      it("cancelSubscription rejects asaas-sourced subscription with BAD_REQUEST", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const contact = await makeContact(testDb.db, { teamId });
         const sub = await makeSubscription(testDb.db, {
            teamId,
            contactId: contact.id,
            status: "active",
            source: "asaas",
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
});
