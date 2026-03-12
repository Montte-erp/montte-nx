import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/inventory-repository");
vi.mock("@core/database/repositories/transactions-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   archiveInventoryProduct,
   createInventoryMovement,
   createInventoryProduct,
   ensureProductOwnership,
   getInventorySettings,
   listInventoryMovements,
   listInventoryProducts,
   toBaseQty,
   updateInventoryProduct,
   upsertInventorySettings,
} from "@core/database/repositories/inventory-repository";
import { createTransaction } from "@core/database/repositories/transactions-repository";
import { AppError } from "@core/logging/errors";
import * as inventoryRouter from "@/integrations/orpc/router/inventory";

const PRODUCT_ID = "a0000000-0000-4000-8000-000000000010";
const SUPPLIER_ID = "a0000000-0000-4000-8000-000000000020";
const BANK_ACCOUNT_ID = "a0000000-0000-4000-8000-000000000030";

const mockProduct = {
   id: PRODUCT_ID,
   teamId: TEST_TEAM_ID,
   name: "Farinha de Trigo",
   description: null,
   baseUnit: "kg",
   purchaseUnit: "kg",
   purchaseUnitFactor: "1",
   sellingPrice: "5.00",
   initialStock: "100",
   currentStock: "100",
   archivedAt: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const mockMovement = {
   id: "a0000000-0000-4000-8000-000000000040",
   teamId: TEST_TEAM_ID,
   productId: PRODUCT_ID,
   type: "purchase" as const,
   qty: "10",
   unitPrice: "3.50",
   totalAmount: "35.00",
   supplierId: null,
   transactionId: null,
   notes: null,
   date: "2026-01-15",
   createdAt: new Date(),
};

const mockSettings = {
   teamId: TEST_TEAM_ID,
   purchaseBankAccountId: BANK_ACCOUNT_ID,
   purchaseCreditCardId: null,
   purchaseCategoryId: null,
   saleCategoryId: null,
   wasteCategoryId: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("getProducts", () => {
   it("lists products for team", async () => {
      vi.mocked(listInventoryProducts).mockResolvedValueOnce([mockProduct]);

      const result = await call(inventoryRouter.getProducts, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual([mockProduct]);
      expect(listInventoryProducts).toHaveBeenCalledWith(TEST_TEAM_ID);
   });
});

describe("createProduct", () => {
   it("creates a product", async () => {
      vi.mocked(createInventoryProduct).mockResolvedValueOnce(mockProduct);

      const result = await call(
         inventoryRouter.createProduct,
         {
            name: "Farinha de Trigo",
            baseUnit: "kg",
            purchaseUnit: "kg",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockProduct);
      expect(createInventoryProduct).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "Farinha de Trigo" }),
      );
   });
});

describe("updateProduct", () => {
   it("updates product after ownership check", async () => {
      vi.mocked(ensureProductOwnership).mockResolvedValueOnce(mockProduct);
      const updated = { ...mockProduct, name: "Farinha Integral" };
      vi.mocked(updateInventoryProduct).mockResolvedValueOnce(updated);

      const result = await call(
         inventoryRouter.updateProduct,
         { id: PRODUCT_ID, name: "Farinha Integral" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Farinha Integral");
      expect(ensureProductOwnership).toHaveBeenCalledWith(
         PRODUCT_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureProductOwnership).mockRejectedValueOnce(
         AppError.notFound("Produto não encontrado."),
      );

      await expect(
         call(
            inventoryRouter.updateProduct,
            { id: PRODUCT_ID, name: "X" },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("archiveProduct", () => {
   it("archives product after ownership check", async () => {
      vi.mocked(ensureProductOwnership).mockResolvedValueOnce(mockProduct);
      const archived = { ...mockProduct, archivedAt: new Date() };
      vi.mocked(archiveInventoryProduct).mockResolvedValueOnce(archived);

      const result = await call(
         inventoryRouter.archiveProduct,
         { id: PRODUCT_ID },
         { context: createTestContext() },
      );

      expect(result.archivedAt).toBeTruthy();
      expect(ensureProductOwnership).toHaveBeenCalledWith(
         PRODUCT_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureProductOwnership).mockRejectedValueOnce(
         AppError.notFound("Produto não encontrado."),
      );

      await expect(
         call(
            inventoryRouter.archiveProduct,
            { id: PRODUCT_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("registerMovement", () => {
   it("registers a purchase movement", async () => {
      vi.mocked(ensureProductOwnership).mockResolvedValueOnce(mockProduct);
      vi.mocked(getInventorySettings).mockResolvedValueOnce(null);
      vi.mocked(toBaseQty).mockReturnValueOnce(10);
      vi.mocked(createInventoryMovement).mockResolvedValueOnce(mockMovement);

      const result = await call(
         inventoryRouter.registerMovement,
         {
            type: "purchase",
            productId: PRODUCT_ID,
            purchasedQty: 10,
            totalAmount: 35,
            date: "2026-01-15",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockMovement);
      expect(ensureProductOwnership).toHaveBeenCalledWith(
         PRODUCT_ID,
         TEST_TEAM_ID,
      );
      expect(createInventoryMovement).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ type: "purchase", productId: PRODUCT_ID }),
      );
   });

   it("propagates NOT_FOUND for unknown product", async () => {
      vi.mocked(ensureProductOwnership).mockRejectedValueOnce(
         AppError.notFound("Produto não encontrado."),
      );

      await expect(
         call(
            inventoryRouter.registerMovement,
            {
               type: "purchase",
               productId: PRODUCT_ID,
               purchasedQty: 10,
               totalAmount: 35,
               date: "2026-01-15",
            },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Produto não encontrado.");
   });
});

describe("getMovements", () => {
   it("lists movements for a product", async () => {
      vi.mocked(listInventoryMovements).mockResolvedValueOnce([mockMovement]);

      const result = await call(
         inventoryRouter.getMovements,
         { productId: PRODUCT_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual([mockMovement]);
      expect(listInventoryMovements).toHaveBeenCalledWith(
         PRODUCT_ID,
         TEST_TEAM_ID,
      );
   });
});

describe("getSettings", () => {
   it("returns settings for team", async () => {
      vi.mocked(getInventorySettings).mockResolvedValueOnce(mockSettings);

      const result = await call(inventoryRouter.getSettings, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual(mockSettings);
      expect(getInventorySettings).toHaveBeenCalledWith(TEST_TEAM_ID);
   });

   it("returns null when no settings exist", async () => {
      vi.mocked(getInventorySettings).mockResolvedValueOnce(null);

      const result = await call(inventoryRouter.getSettings, undefined, {
         context: createTestContext(),
      });

      expect(result).toBeNull();
   });
});

describe("upsertSettings", () => {
   it("upserts settings for team", async () => {
      vi.mocked(upsertInventorySettings).mockResolvedValueOnce(mockSettings);

      const result = await call(
         inventoryRouter.upsertSettings,
         { purchaseBankAccountId: BANK_ACCOUNT_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockSettings);
      expect(upsertInventorySettings).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ purchaseBankAccountId: BANK_ACCOUNT_ID }),
      );
   });
});
