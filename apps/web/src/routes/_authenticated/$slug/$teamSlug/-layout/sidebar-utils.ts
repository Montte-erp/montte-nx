import type { NavItemDef } from "./sidebar-nav-items";

export function getOrderedItems(items: NavItemDef[], itemOrder: string[]) {
   const itemMap = new Map(items.map((item) => [item.id, item]));
   const orderedItems = itemOrder.flatMap((itemId) => {
      const item = itemMap.get(itemId);
      return item ? [item] : [];
   });
   const newItems = items.filter((item) => !itemOrder.includes(item.id));

   return [...orderedItems, ...newItems];
}
