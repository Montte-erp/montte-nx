import { Store, useStore } from "@tanstack/react-store";

const STORAGE_KEY = "sidebar:hidden-items";

function loadHiddenItems(): string[] {
   if (typeof window === "undefined") return [];
   try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
   } catch {
      return [];
   }
}

function saveHiddenItems(items: string[]) {
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
   } catch {
      // silently fail
   }
}

const sidebarVisibilityStore = new Store<{ hiddenItems: string[] }>({
   hiddenItems: loadHiddenItems(),
});

export function useSidebarVisibility() {
   const { hiddenItems } = useStore(sidebarVisibilityStore, (s) => s);

   const isVisible = (itemId: string) => !hiddenItems.includes(itemId);

   const toggleItem = (itemId: string) => {
      sidebarVisibilityStore.setState((state) => {
         const next = state.hiddenItems.includes(itemId)
            ? state.hiddenItems.filter((id) => id !== itemId)
            : [...state.hiddenItems, itemId];
         saveHiddenItems(next);
         return { hiddenItems: next };
      });
   };

   return { hiddenItems, isVisible, toggleItem };
}
