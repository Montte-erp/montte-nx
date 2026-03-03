import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const INVENTORY_EVENTS = {
   "inventory.item_created": "inventory.item_created",
   "inventory.item_updated": "inventory.item_updated",
   "inventory.item_deleted": "inventory.item_deleted",
} as const;

export type InventoryEventName =
   (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS];

export const inventoryItemCreatedSchema = z.object({
   itemId: z.string().uuid(),
   sku: z.string().optional(),
   type: z.enum(["product", "service", "raw_material"]).optional(),
});
export type InventoryItemCreatedEvent = z.infer<
   typeof inventoryItemCreatedSchema
>;
export function emitInventoryItemCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_created"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}

export const inventoryItemUpdatedSchema = z.object({
   itemId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type InventoryItemUpdatedEvent = z.infer<
   typeof inventoryItemUpdatedSchema
>;
export function emitInventoryItemUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_updated"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}

export const inventoryItemDeletedSchema = z.object({
   itemId: z.string().uuid(),
});
export type InventoryItemDeletedEvent = z.infer<
   typeof inventoryItemDeletedSchema
>;
export function emitInventoryItemDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_deleted"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}
