import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../../src/testing/setup-test-db";
import * as repo from "../../src/repositories/inventory-repository";

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

function validProductInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Café Especial",
      baseUnit: "kg",
      purchaseUnit: "kg",
      purchaseUnitFactor: "1",
      sellingPrice: "45.00",
      initialStock: "100.0000",
      ...overrides,
   };
}

describe("inventory-repository", () => {
   describe("createInventoryProduct", () => {
      it("creates product with currentStock equal to initialStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput(),
         );

         expect(product).toMatchObject({
            teamId,
            name: "Café Especial",
            initialStock: "100.0000",
            currentStock: "100.0000",
         });
         expect(product.id).toBeDefined();
         expect(product.createdAt).toBeInstanceOf(Date);
      });

      it("defaults initialStock and currentStock to '0' when not provided", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(testDb.db, teamId, {
            name: "Produto Sem Estoque",
            baseUnit: "un",
            purchaseUnit: "un",
            purchaseUnitFactor: "1",
         });

         expect(product.initialStock).toBe("0.0000");
         expect(product.currentStock).toBe("0.0000");
      });

      it("rejects negative initialStock", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createInventoryProduct(
               testDb.db,
               teamId,
               validProductInput({ initialStock: "-5" }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("listInventoryProducts", () => {
      it("lists active products only by default", async () => {
         const teamId = randomTeamId();
         await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ name: "Active" }),
         );
         const archived = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ name: "Archived" }),
         );
         await repo.archiveInventoryProduct(testDb.db, archived.id);

         const list = await repo.listInventoryProducts(testDb.db, teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all when includeArchived true", async () => {
         const teamId = randomTeamId();
         await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ name: "Produto A" }),
         );
         const b = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ name: "Produto B" }),
         );
         await repo.archiveInventoryProduct(testDb.db, b.id);

         const list = await repo.listInventoryProducts(testDb.db, teamId, {
            includeArchived: true,
         });
         expect(list).toHaveLength(2);
      });
   });

   describe("getInventoryProduct", () => {
      it("returns product by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput(),
         );

         const found = await repo.getInventoryProduct(testDb.db, created.id);
         expect(found).toMatchObject({
            id: created.id,
            name: "Café Especial",
         });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getInventoryProduct(
            testDb.db,
            crypto.randomUUID(),
         );
         expect(found).toBeNull();
      });
   });

   describe("updateInventoryProduct", () => {
      it("updates product fields", async () => {
         const teamId = randomTeamId();
         const created = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput(),
         );

         const updated = await repo.updateInventoryProduct(
            testDb.db,
            created.id,
            {
               name: "Café Premium",
            },
         );

         expect(updated.name).toBe("Café Premium");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("createInventoryMovement", () => {
      it("purchase: creates movement and increments currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "purchase",
               productId: product.id,
               qty: "5.0000",
               unitPrice: "20.00",
               date: "2026-01-15",
            },
         );

         expect(movement.type).toBe("purchase");
         expect(movement.qty).toBe("5.0000");

         const updated = await repo.getInventoryProduct(testDb.db, product.id);
         expect(updated!.currentStock).toBe("15.0000");
      });

      it("sale: creates movement and decrements currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "sale",
               productId: product.id,
               qty: "3.0000",
               unitPrice: "50.00",
               date: "2026-01-15",
            },
         );

         expect(movement.type).toBe("sale");

         const updated = await repo.getInventoryProduct(testDb.db, product.id);
         expect(updated!.currentStock).toBe("7.0000");
      });

      it("sale: blocks when qty > currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "5.0000" }),
         );

         await expect(
            repo.createInventoryMovement(testDb.db, teamId, {
               type: "sale",
               productId: product.id,
               qty: "10.0000",
               unitPrice: "50.00",
               date: "2026-01-15",
            }),
         ).rejects.toThrow(/estoque disponível/);
      });

      it("waste: creates movement without unitPrice, decrements stock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "20.0000" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "waste",
               productId: product.id,
               qty: "2.0000",
               date: "2026-01-15",
            },
         );

         expect(movement.type).toBe("waste");
         expect(movement.totalAmount).toBeNull();

         const updated = await repo.getInventoryProduct(testDb.db, product.id);
         expect(updated!.currentStock).toBe("18.0000");
      });

      it("waste: blocks when qty > currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "3.0000" }),
         );

         await expect(
            repo.createInventoryMovement(testDb.db, teamId, {
               type: "waste",
               productId: product.id,
               qty: "5.0000",
               date: "2026-01-15",
            }),
         ).rejects.toThrow(/estoque disponível/);
      });

      it("purchase: totalAmount is calculated correctly (qty * unitPrice)", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "0" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "purchase",
               productId: product.id,
               qty: "3.0000",
               unitPrice: "25.50",
               date: "2026-01-15",
            },
         );

         expect(movement.totalAmount).toBe("76.50");
      });
   });

   describe("deleteInventoryMovement", () => {
      it("reverts purchase delta on deletion", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "purchase",
               productId: product.id,
               qty: "5.0000",
               unitPrice: "20.00",
               date: "2026-01-15",
            },
         );

         await repo.deleteInventoryMovement(testDb.db, movement.id);

         const updated = await repo.getInventoryProduct(testDb.db, product.id);
         expect(updated!.currentStock).toBe("10.0000");
      });

      it("reverts sale delta on deletion", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            testDb.db,
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(
            testDb.db,
            teamId,
            {
               type: "sale",
               productId: product.id,
               qty: "4.0000",
               unitPrice: "50.00",
               date: "2026-01-15",
            },
         );

         await repo.deleteInventoryMovement(testDb.db, movement.id);

         const updated = await repo.getInventoryProduct(testDb.db, product.id);
         expect(updated!.currentStock).toBe("10.0000");
      });
   });

   describe("toBaseQty", () => {
      it("returns same qty when units match", () => {
         const result = repo.toBaseQty(5, "kg", "kg", 1);
         expect(result).toBe(5);
      });

      it("falls back to factor for custom units", () => {
         const result = repo.toBaseQty(2, "caixa", "un", 12);
         expect(result).toBe(24);
      });
   });
});
