import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as inventoryRouter from "@/integrations/orpc/router/inventory";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM inventory_movements`);
   await ctx.db.execute(sql`DELETE FROM inventory_products`);
   await ctx.db.execute(sql`DELETE FROM inventory_settings`);
});

describe("createProduct", () => {
   it("creates a product and persists it", async () => {
      const result = await call(
         inventoryRouter.createProduct,
         {
            name: "Farinha de Trigo",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "10",
         },
         { context: ctx },
      );

      expect(result.name).toBe("Farinha de Trigo");
      expect(result.baseUnit).toBe("kg");
      expect(result.currentStock).toBe("10.0000");

      const rows = await ctx.db.query.inventoryProducts.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });
});

describe("getProducts", () => {
   it("lists products for team", async () => {
      await call(
         inventoryRouter.createProduct,
         { name: "Produto A", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );
      await call(
         inventoryRouter.createProduct,
         { name: "Produto B", baseUnit: "un", purchaseUnit: "un" },
         { context: ctx },
      );

      const result = await call(inventoryRouter.getProducts, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("does not list products from another team", async () => {
      await call(
         inventoryRouter.createProduct,
         { name: "Produto Privado", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );

      const result = await call(inventoryRouter.getProducts, undefined, {
         context: ctx2,
      });

      expect(result).toHaveLength(0);
   });
});

describe("updateProduct", () => {
   it("updates product after ownership check", async () => {
      const created = await call(
         inventoryRouter.createProduct,
         { name: "Farinha", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );

      const updated = await call(
         inventoryRouter.updateProduct,
         { id: created.id, name: "Farinha Integral" },
         { context: ctx },
      );

      expect(updated.name).toBe("Farinha Integral");

      const fromDb = await ctx.db.query.inventoryProducts.findFirst({
         where: (fields, { eq }) => eq(fields.id, created.id),
      });
      expect(fromDb!.name).toBe("Farinha Integral");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         inventoryRouter.createProduct,
         { name: "Privado", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );

      await expect(
         call(
            inventoryRouter.updateProduct,
            { id: created.id, name: "Hack" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("archiveProduct", () => {
   it("archives product and sets archivedAt", async () => {
      const created = await call(
         inventoryRouter.createProduct,
         { name: "Arquivar", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );

      const archived = await call(
         inventoryRouter.archiveProduct,
         { id: created.id },
         { context: ctx },
      );

      expect(archived.archivedAt).toBeTruthy();

      const listed = await call(inventoryRouter.getProducts, undefined, {
         context: ctx,
      });
      expect(listed).toHaveLength(0);
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         inventoryRouter.createProduct,
         { name: "Privado", baseUnit: "kg", purchaseUnit: "kg" },
         { context: ctx },
      );

      await expect(
         call(
            inventoryRouter.archiveProduct,
            { id: created.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("registerMovement", () => {
   it("registers a purchase and increases stock", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Açúcar",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "0",
         },
         { context: ctx },
      );

      const movement = await call(
         inventoryRouter.registerMovement,
         {
            type: "purchase",
            productId: product.id,
            purchasedQty: 10,
            totalAmount: 50,
            date: "2026-01-15",
         },
         { context: ctx },
      );

      expect(movement.type).toBe("purchase");
      expect(movement.productId).toBe(product.id);

      const updated = await ctx.db.query.inventoryProducts.findFirst({
         where: (fields, { eq }) => eq(fields.id, product.id),
      });
      expect(Number(updated!.currentStock)).toBe(10);
   });

   it("registers a sale and decreases stock", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Café",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "20",
         },
         { context: ctx },
      );

      const movement = await call(
         inventoryRouter.registerMovement,
         {
            type: "sale",
            productId: product.id,
            qty: 5,
            totalAmount: 75,
            date: "2026-01-15",
         },
         { context: ctx },
      );

      expect(movement.type).toBe("sale");

      const updated = await ctx.db.query.inventoryProducts.findFirst({
         where: (fields, { eq }) => eq(fields.id, product.id),
      });
      expect(Number(updated!.currentStock)).toBe(15);
   });

   it("registers waste and decreases stock", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Leite",
            baseUnit: "L",
            purchaseUnit: "L",
            initialStock: "10",
         },
         { context: ctx },
      );

      const movement = await call(
         inventoryRouter.registerMovement,
         {
            type: "waste",
            productId: product.id,
            qty: 3,
            date: "2026-01-15",
         },
         { context: ctx },
      );

      expect(movement.type).toBe("waste");

      const updated = await ctx.db.query.inventoryProducts.findFirst({
         where: (fields, { eq }) => eq(fields.id, product.id),
      });
      expect(Number(updated!.currentStock)).toBe(7);
   });

   it("rejects sale when stock is insufficient", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Manteiga",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "2",
         },
         { context: ctx },
      );

      await expect(
         call(
            inventoryRouter.registerMovement,
            {
               type: "sale",
               productId: product.id,
               qty: 10,
               totalAmount: 100,
               date: "2026-01-15",
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Quantidade maior que o estoque disponível");
   });

   it("rejects movement for product from another team", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Privado",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "10",
         },
         { context: ctx },
      );

      await expect(
         call(
            inventoryRouter.registerMovement,
            {
               type: "purchase",
               productId: product.id,
               purchasedQty: 5,
               totalAmount: 25,
               date: "2026-01-15",
            },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("getMovements", () => {
   it("lists movements for a product", async () => {
      const product = await call(
         inventoryRouter.createProduct,
         {
            name: "Arroz",
            baseUnit: "kg",
            purchaseUnit: "kg",
            initialStock: "0",
         },
         { context: ctx },
      );

      await call(
         inventoryRouter.registerMovement,
         {
            type: "purchase",
            productId: product.id,
            purchasedQty: 10,
            totalAmount: 30,
            date: "2026-01-10",
         },
         { context: ctx },
      );
      await call(
         inventoryRouter.registerMovement,
         {
            type: "purchase",
            productId: product.id,
            purchasedQty: 5,
            totalAmount: 15,
            date: "2026-01-12",
         },
         { context: ctx },
      );

      const movements = await call(
         inventoryRouter.getMovements,
         { productId: product.id },
         { context: ctx },
      );

      expect(movements).toHaveLength(2);
   });
});

describe("getSettings", () => {
   it("returns null when no settings exist", async () => {
      const result = await call(inventoryRouter.getSettings, undefined, {
         context: ctx,
      });

      expect(result).toBeNull();
   });
});

describe("upsertSettings", () => {
   it("creates settings and returns them", async () => {
      const result = await call(
         inventoryRouter.upsertSettings,
         {},
         { context: ctx },
      );

      expect(result).toBeTruthy();
      expect(result.teamId).toBe(ctx.session!.session.activeTeamId);
   });

   it("updates settings on second call", async () => {
      await call(inventoryRouter.upsertSettings, {}, { context: ctx });

      const updated = await call(
         inventoryRouter.upsertSettings,
         {},
         { context: ctx },
      );

      expect(updated).toBeTruthy();

      const result = await call(inventoryRouter.getSettings, undefined, {
         context: ctx,
      });
      expect(result).toBeTruthy();
   });
});
