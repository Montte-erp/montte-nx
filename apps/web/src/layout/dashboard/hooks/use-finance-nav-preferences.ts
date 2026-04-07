import { useCallback } from "react";
import { createLocalStorageState } from "foxact/create-local-storage-state";

const [useWantedItems] = createLocalStorageState<string[]>(
   "montte:sidebar:finance-nav-prefs",
   [],
);

export function useFinanceNavPreferences() {
   const [wantedItems, setWantedItems] = useWantedItems();

   const isWanted = useCallback(
      (itemId: string) => (wantedItems ?? []).includes(itemId),
      [wantedItems],
   );

   const toggleItem = useCallback(
      (itemId: string) => {
         setWantedItems((prev) => {
            const current = prev ?? [];
            return current.includes(itemId)
               ? current.filter((id) => id !== itemId)
               : [...current, itemId];
         });
      },
      [setWantedItems],
   );

   return { wantedItems, isWanted, toggleItem };
}
