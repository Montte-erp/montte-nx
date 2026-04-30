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
import * as pricesRouter from "../../src/router/prices";
import * as subscriptionsRouter from "../../src/router/subscriptions";
import * as metersRouter from "../../src/router/meters";
import * as benefitsRouter from "../../src/router/benefits";
import * as usageRouter from "../../src/router/usage";

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
            pricesRouter.list,
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
               pricesRouter.list,
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
            pricesRouter.create,
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
               pricesRouter.create,
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
               pricesRouter.create,
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
            pricesRouter.create,
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
            pricesRouter.update,
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
               pricesRouter.update,
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
               pricesRouter.update,
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
            pricesRouter.remove,
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
            call(pricesRouter.remove, { id: price.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });
});
