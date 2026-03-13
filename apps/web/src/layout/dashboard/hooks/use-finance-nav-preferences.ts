import { Store, useStore } from "@tanstack/react-store";

const STORAGE_KEY = "sidebar:finance-nav-prefs";

function loadWantedItems(): string[] {
   if (typeof window === "undefined") return [];
   try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
   } catch {
      return [];
   }
}

function saveWantedItems(items: string[]) {
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
   } catch {
      // silently fail
   }
}

const financeNavPrefsStore = new Store<{ wantedItems: string[] }>({
   wantedItems: loadWantedItems(),
});

export function toggleFinanceNavItem(itemId: string) {
   financeNavPrefsStore.setState((state) => {
      const next = state.wantedItems.includes(itemId)
         ? state.wantedItems.filter((id) => id !== itemId)
         : [...state.wantedItems, itemId];
      saveWantedItems(next);
      return { wantedItems: next };
   });
}

export function useFinanceNavPreferences() {
   const { wantedItems } = useStore(financeNavPrefsStore, (s) => s);

   const isWanted = (itemId: string) => wantedItems.includes(itemId);

   return { wantedItems, isWanted, toggleItem: toggleFinanceNavItem };
}
