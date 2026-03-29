import { createLocalStorageState } from "foxact/create-local-storage-state";

const [useHiddenItems] = createLocalStorageState<string[]>(
   "sidebar:hidden-items",
   [],
);

export function useSidebarVisibility() {
   const [hiddenItems, setHiddenItems] = useHiddenItems();

   const isVisible = (itemId: string) => !hiddenItems.includes(itemId);

   const toggleItem = (itemId: string) => {
      setHiddenItems((prev) => {
         const current = prev ?? [];
         return current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
      });
   };

   return { hiddenItems, isVisible, toggleItem };
}
