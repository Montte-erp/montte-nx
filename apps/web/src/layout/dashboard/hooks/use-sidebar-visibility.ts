import { useCallback } from "react";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";

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

   const toggleItem = useStableHandler((itemId: string) => {
      setHiddenItems((prev) => {
         const current = prev ?? [];
         return current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
      });
   });

   return { hiddenItems, isVisible, toggleItem };
}
