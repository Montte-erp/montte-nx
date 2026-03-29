import { useCallback } from "react";
import { createLocalStorageState } from "foxact/create-local-storage-state";

const [useHiddenItems] = createLocalStorageState<string[]>(
   "montte:sidebar:hidden-items",
   [],
);

export function useSidebarVisibility() {
   const [hiddenItems, setHiddenItems] = useHiddenItems();

   const isVisible = useCallback(
      (itemId: string) => !(hiddenItems ?? []).includes(itemId),
      [hiddenItems],
   );

   const toggleItem = useCallback((itemId: string) => {
      setHiddenItems((prev) => {
         const current = prev ?? [];
         return current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
      });
   }, [setHiddenItems]);

   return { hiddenItems, isVisible, toggleItem };
}
