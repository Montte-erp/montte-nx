import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/services-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validServiceInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Consultoria Financeira",
      ...overrides,
   };
}

function validPriceInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Hora",
      basePrice: "150.00",
      type: "flat" as const,
      interval: "one_time" as const,
      ...overrides,
   };
}

describe("services-repository", () => {
   describe("createService", () => {
      it("creates a service with correct fields", async () => {
         const teamId = randomTeamId();
         const result = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = result._unsafeUnwrap();

         expect(service).toMatchObject({
            teamId,
            name: "Consultoria Financeira",
            isActive: true,
         });
         expect(service.id).toBeDefined();
         expect(service.createdAt).toBeInstanceOf(Date);
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         const result = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput({ name: "A" }),
         );
         expect(result.isErr()).toBe(true);
      });
   });

   describe("listServices", () => {
      it("lists services for a team", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            testDb.db,
            teamId,
            validServiceInput({ name: "Serviço A" }),
         );
         await repo.createService(
            testDb.db,
            teamId,
            validServiceInput({ name: "Serviço B" }),
         );

         const listResult = await repo.listServices(testDb.db, teamId);
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(2);
      });

      it("filters by search term", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            testDb.db,
            teamId,
            validServiceInput({ name: "Consultoria" }),
         );
         await repo.createService(
            testDb.db,
            teamId,
            validServiceInput({ name: "Auditoria" }),
         );

         const listResult = await repo.listServices(testDb.db, teamId, {
            search: "consul",
         });
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Consultoria");
      });
   });

   describe("getService", () => {
      it("returns service by id", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const created = createdResult._unsafeUnwrap();

         const foundResult = await repo.getService(testDb.db, created.id);
         const found = foundResult._unsafeUnwrap();
         expect(found).toMatchObject({
            id: created.id,
            name: "Consultoria Financeira",
         });
      });

      it("returns null for non-existent id", async () => {
         const result = await repo.getService(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });

   describe("updateService", () => {
      it("updates service fields", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const created = createdResult._unsafeUnwrap();

         const updatedResult = await repo.updateService(testDb.db, created.id, {
            name: "Assessoria Contábil",
         });
         const updated = updatedResult._unsafeUnwrap();

         expect(updated.name).toBe("Assessoria Contábil");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("deleteService", () => {
      it("deletes a service", async () => {
         const teamId = randomTeamId();
         const createdResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const created = createdResult._unsafeUnwrap();

         await repo.deleteService(testDb.db, created.id);
         const foundResult = await repo.getService(testDb.db, created.id);
         expect(foundResult._unsafeUnwrap()).toBeNull();
      });
   });

   describe("prices", () => {
      it("creates a price linked to a service", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();

         const priceResult = await repo.createPrice(
            testDb.db,
            teamId,
            service.id,
            validPriceInput(),
         );
         const price = priceResult._unsafeUnwrap();

         expect(price).toMatchObject({
            serviceId: service.id,
            teamId,
            name: "Hora",
            basePrice: "150.00",
            interval: "one_time",
         });
         expect(price.id).toBeDefined();
      });

      it("lists prices by service", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         await repo.createPrice(
            testDb.db,
            teamId,
            service.id,
            validPriceInput({ name: "Hora" }),
         );
         await repo.createPrice(
            testDb.db,
            teamId,
            service.id,
            validPriceInput({ name: "Mensal" }),
         );

         const listResult = await repo.listPricesByService(
            testDb.db,
            service.id,
         );
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(2);
      });

      it("updates a price", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         const priceResult = await repo.createPrice(
            testDb.db,
            teamId,
            service.id,
            validPriceInput(),
         );
         const price = priceResult._unsafeUnwrap();

         const updatedResult = await repo.updatePrice(testDb.db, price.id, {
            name: "Diária",
         });
         const updated = updatedResult._unsafeUnwrap();

         expect(updated.name).toBe("Diária");
      });

      it("deletes a price", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         const priceResult = await repo.createPrice(
            testDb.db,
            teamId,
            service.id,
            validPriceInput(),
         );
         const price = priceResult._unsafeUnwrap();

         await repo.deletePrice(testDb.db, price.id);
         const foundResult = await repo.getPrice(testDb.db, price.id);
         expect(foundResult._unsafeUnwrap()).toBeNull();
      });

      it("getPrice returns null for non-existent id", async () => {
         const result = await repo.getPrice(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });
});
