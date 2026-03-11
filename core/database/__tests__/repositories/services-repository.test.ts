import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/services-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

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
         const service = await repo.createService(teamId, validServiceInput());

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
         await expect(
            repo.createService(teamId, validServiceInput({ name: "A" })),
         ).rejects.toThrow();
      });
   });

   describe("listServices", () => {
      it("lists services for a team", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            teamId,
            validServiceInput({ name: "Serviço A" }),
         );
         await repo.createService(
            teamId,
            validServiceInput({ name: "Serviço B" }),
         );

         const list = await repo.listServices(teamId);
         expect(list).toHaveLength(2);
      });

      it("filters by search term", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            teamId,
            validServiceInput({ name: "Consultoria" }),
         );
         await repo.createService(
            teamId,
            validServiceInput({ name: "Auditoria" }),
         );

         const list = await repo.listServices(teamId, { search: "consul" });
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Consultoria");
      });
   });

   describe("getService", () => {
      it("returns service by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         const found = await repo.getService(created.id);
         expect(found).toMatchObject({
            id: created.id,
            name: "Consultoria Financeira",
         });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getService(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateService", () => {
      it("updates service fields", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         const updated = await repo.updateService(created.id, {
            name: "Assessoria Contábil",
            basePrice: "200.00",
         });

         expect(updated!.name).toBe("Assessoria Contábil");
         expect(updated!.basePrice).toBe("200.00");
         expect(updated!.id).toBe(created.id);
      });
   });

   describe("deleteService", () => {
      it("deletes a service", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         await repo.deleteService(created.id);
         const found = await repo.getService(created.id);
         expect(found).toBeNull();
      });
   });

   describe("variants", () => {
      it("creates a variant linked to a service", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());

         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

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
         const service = await repo.createService(teamId, validServiceInput());
         await repo.createVariant(
            teamId,
            service.id,
            validVariantInput({ name: "Hora" }),
         );
         await repo.createVariant(
            teamId,
            service.id,
            validVariantInput({ name: "Mensal" }),
         );

         const list = await repo.listVariantsByService(service.id);
         expect(list).toHaveLength(2);
      });

      it("updates a variant", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());
         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

         const updated = await repo.updateVariant(variant.id, {
            name: "Diária",
            basePrice: "300.00",
         });

         expect(updated!.name).toBe("Diária");
         expect(updated!.basePrice).toBe("300.00");
      });

      it("deletes a variant", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());
         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

         await repo.deleteVariant(variant.id);
         const found = await repo.getVariant(variant.id);
         expect(found).toBeNull();
      });

      it("getVariant returns null for non-existent id", async () => {
         const found = await repo.getVariant(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });
});
