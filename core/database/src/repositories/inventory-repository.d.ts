import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateInventoryMovementInput,
   type CreateInventoryProductInput,
   type UpdateInventoryProductInput,
   inventorySettings,
} from "@core/database/schemas/inventory";
export declare function createInventoryProduct(
   db: DatabaseInstance,
   teamId: string,
   data: CreateInventoryProductInput,
): Promise<{
   archivedAt: Date | null;
   baseUnit: string;
   createdAt: Date;
   currentStock: string;
   description: string | null;
   id: string;
   initialStock: string;
   name: string;
   purchaseUnit: string;
   purchaseUnitFactor: string;
   sellingPrice: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function listInventoryProducts(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      includeArchived?: boolean;
   },
): Promise<
   {
      id: string;
      teamId: string;
      name: string;
      description: string | null;
      baseUnit: string;
      purchaseUnit: string;
      purchaseUnitFactor: string;
      sellingPrice: string | null;
      initialStock: string;
      currentStock: string;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getInventoryProduct(
   db: DatabaseInstance,
   id: string,
): Promise<{
   archivedAt: Date | null;
   baseUnit: string;
   createdAt: Date;
   currentStock: string;
   description: string | null;
   id: string;
   initialStock: string;
   name: string;
   purchaseUnit: string;
   purchaseUnitFactor: string;
   sellingPrice: string | null;
   teamId: string;
   updatedAt: Date;
} | null>;
export declare function ensureProductOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   archivedAt: Date | null;
   baseUnit: string;
   createdAt: Date;
   currentStock: string;
   description: string | null;
   id: string;
   initialStock: string;
   name: string;
   purchaseUnit: string;
   purchaseUnitFactor: string;
   sellingPrice: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function updateInventoryProduct(
   db: DatabaseInstance,
   id: string,
   data: UpdateInventoryProductInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   description: string | null;
   baseUnit: string;
   purchaseUnit: string;
   purchaseUnitFactor: string;
   sellingPrice: string | null;
   initialStock: string;
   currentStock: string;
   archivedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function archiveInventoryProduct(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   description: string | null;
   baseUnit: string;
   purchaseUnit: string;
   purchaseUnitFactor: string;
   sellingPrice: string | null;
   initialStock: string;
   currentStock: string;
   archivedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function toBaseQty(
   purchasedQty: number,
   purchaseUnit: string,
   baseUnit: string,
   factor: number,
): number;
export declare function createInventoryMovement(
   db: DatabaseInstance,
   teamId: string,
   data: CreateInventoryMovementInput,
): Promise<{
   createdAt: Date;
   date: string;
   id: string;
   notes: string | null;
   productId: string;
   qty: string;
   supplierId: string | null;
   teamId: string;
   totalAmount: string | null;
   transactionId: string | null;
   type: "purchase" | "sale" | "waste";
   unitPrice: string | null;
}>;
export declare function listInventoryMovements(
   db: DatabaseInstance,
   productId: string,
   teamId: string,
): Promise<
   {
      id: string;
      teamId: string;
      productId: string;
      type: "purchase" | "sale" | "waste";
      qty: string;
      unitPrice: string | null;
      totalAmount: string | null;
      supplierId: string | null;
      transactionId: string | null;
      notes: string | null;
      date: string;
      createdAt: Date;
   }[]
>;
export declare function deleteInventoryMovement(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   productId: string;
   type: "purchase" | "sale" | "waste";
   qty: string;
   unitPrice: string | null;
   totalAmount: string | null;
   supplierId: string | null;
   transactionId: string | null;
   notes: string | null;
   date: string;
   createdAt: Date;
}>;
export declare function getInventorySettings(
   db: DatabaseInstance,
   teamId: string,
): Promise<{
   teamId: string;
   purchaseBankAccountId: string | null;
   purchaseCreditCardId: string | null;
   purchaseCategoryId: string | null;
   saleCategoryId: string | null;
   wasteCategoryId: string | null;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function upsertInventorySettings(
   db: DatabaseInstance,
   teamId: string,
   data: Omit<
      typeof inventorySettings.$inferInsert,
      "teamId" | "createdAt" | "updatedAt"
   >,
): Promise<{
   createdAt: Date;
   purchaseBankAccountId: string | null;
   purchaseCategoryId: string | null;
   purchaseCreditCardId: string | null;
   saleCategoryId: string | null;
   teamId: string;
   updatedAt: Date;
   wasteCategoryId: string | null;
}>;
//# sourceMappingURL=inventory-repository.d.ts.map
