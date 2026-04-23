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
      basePrice: "150.00",
      ...overrides,
   };
}

function validVariantInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Hora",
      basePrice: "150.00",
      billingCycle: "one_time" as const,
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
            basePrice: "150.00",
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
            basePrice: "200.00",
         });
         const updated = updatedResult._unsafeUnwrap();

         expect(updated.name).toBe("Assessoria Contábil");
         expect(updated.basePrice).toBe("200.00");
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

   describe("variants", () => {
      it("creates a variant linked to a service", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();

         const variantResult = await repo.createVariant(
            testDb.db,
            teamId,
            service.id,
            validVariantInput(),
         );
         const variant = variantResult._unsafeUnwrap();

         expect(variant).toMatchObject({
            serviceId: service.id,
            teamId,
            name: "Hora",
            basePrice: "150.00",
            billingCycle: "one_time",
         });
         expect(variant.id).toBeDefined();
      });

      it("lists variants by service", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         await repo.createVariant(
            testDb.db,
            teamId,
            service.id,
            validVariantInput({ name: "Hora" }),
         );
         await repo.createVariant(
            testDb.db,
            teamId,
            service.id,
            validVariantInput({ name: "Mensal" }),
         );

         const listResult = await repo.listVariantsByService(
            testDb.db,
            service.id,
         );
         const list = listResult._unsafeUnwrap();
         expect(list).toHaveLength(2);
      });

      it("updates a variant", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         const variantResult = await repo.createVariant(
            testDb.db,
            teamId,
            service.id,
            validVariantInput(),
         );
         const variant = variantResult._unsafeUnwrap();

         const updatedResult = await repo.updateVariant(testDb.db, variant.id, {
            name: "Diária",
            basePrice: "300.00",
         });
         const updated = updatedResult._unsafeUnwrap();

         expect(updated.name).toBe("Diária");
         expect(updated.basePrice).toBe("300.00");
      });

      it("deletes a variant", async () => {
         const teamId = randomTeamId();
         const serviceResult = await repo.createService(
            testDb.db,
            teamId,
            validServiceInput(),
         );
         const service = serviceResult._unsafeUnwrap();
         const variantResult = await repo.createVariant(
            testDb.db,
            teamId,
            service.id,
            validVariantInput(),
         );
         const variant = variantResult._unsafeUnwrap();

         await repo.deleteVariant(testDb.db, variant.id);
         const foundResult = await repo.getVariant(testDb.db, variant.id);
         expect(foundResult._unsafeUnwrap()).toBeNull();
      });

      it("getVariant returns null for non-existent id", async () => {
         const result = await repo.getVariant(testDb.db, crypto.randomUUID());
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });
});
