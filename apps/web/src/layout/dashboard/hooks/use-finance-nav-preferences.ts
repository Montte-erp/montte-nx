import { createLocalStorageState } from "foxact/create-local-storage-state";

const [useWantedItems] = createLocalStorageState<string[]>(
   "sidebar:finance-nav-prefs",
   [],
);

export function useFinanceNavPreferences() {
   const [wantedItems, setWantedItems] = useWantedItems();

   const isWanted = (itemId: string) => wantedItems.includes(itemId);

   const toggleItem = (itemId: string) => {
      setWantedItems((prev) => {
         const current = prev ?? [];
         return current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
      });
   };

   return { wantedItems, isWanted, toggleItem };
}
