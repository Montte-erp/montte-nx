import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";

const [useWantedItems] = createLocalStorageState<string[]>(
   "montte:sidebar:finance-nav-prefs",
   [],
);

export function useFinanceNavPreferences() {
   const [wantedItems, setWantedItems] = useWantedItems();

   const isWanted = useStableHandler((itemId: string) =>
      (wantedItems ?? []).includes(itemId),
   );

   const toggleItem = useStableHandler((itemId: string) => {
      setWantedItems((prev) => {
         const current = prev ?? [];
         return current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
      });
   });

   return { wantedItems, isWanted, toggleItem };
}
