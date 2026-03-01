import { useSafeLocalStorage } from "@/hooks/use-local-storage";

export function useSidebarVisibility() {
   const [hiddenItems, setHiddenItems] = useSafeLocalStorage<string[]>(
      "sidebar:hidden-items",
      [],
   );

   const isVisible = (itemId: string) => !hiddenItems.includes(itemId);

   const toggleItem = (itemId: string) => {
      setHiddenItems((prev) =>
         prev.includes(itemId)
            ? prev.filter((id) => id !== itemId)
            : [...prev, itemId],
      );
   };

   return { hiddenItems, isVisible, toggleItem };
}
