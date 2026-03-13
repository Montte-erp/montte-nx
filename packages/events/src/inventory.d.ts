import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const INVENTORY_EVENTS: {
   readonly "inventory.item_created": "inventory.item_created";
   readonly "inventory.item_updated": "inventory.item_updated";
   readonly "inventory.item_deleted": "inventory.item_deleted";
};
export type InventoryEventName =
   (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS];
export declare const inventoryItemCreatedSchema: z.ZodObject<
   {
      itemId: z.ZodString;
      sku: z.ZodOptional<z.ZodString>;
      type: z.ZodOptional<
         z.ZodEnum<{
            product: "product";
            raw_material: "raw_material";
            service: "service";
         }>
      >;
   },
   z.core.$strip
>;
export type InventoryItemCreatedEvent = z.infer<
   typeof inventoryItemCreatedSchema
>;
export declare function emitInventoryItemCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InventoryItemCreatedEvent,
): Promise<void>;
export declare const inventoryItemUpdatedSchema: z.ZodObject<
   {
      itemId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type InventoryItemUpdatedEvent = z.infer<
   typeof inventoryItemUpdatedSchema
>;
export declare function emitInventoryItemUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InventoryItemUpdatedEvent,
): Promise<void>;
export declare const inventoryItemDeletedSchema: z.ZodObject<
   {
      itemId: z.ZodString;
   },
   z.core.$strip
>;
export type InventoryItemDeletedEvent = z.infer<
   typeof inventoryItemDeletedSchema
>;
export declare function emitInventoryItemDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: InventoryItemDeletedEvent,
): Promise<void>;
//# sourceMappingURL=inventory.d.ts.map
