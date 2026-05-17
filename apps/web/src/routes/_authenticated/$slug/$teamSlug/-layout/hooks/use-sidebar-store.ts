import { useStore } from "@tanstack/react-store";
import { createPersistedStore } from "@/lib/store";

interface SidebarPersistedState {
   isCollapsed: boolean;
   hiddenItems: string[];
   financeNavPrefs: string[];
   sectionOpen: Record<string, boolean>;
   itemOrder: Record<string, string[]>;
}

const sidebarStore = createPersistedStore<SidebarPersistedState>(
   "montte:sidebar",
   {
      isCollapsed: false,
      hiddenItems: [],
      financeNavPrefs: [],
      sectionOpen: {},
      itemOrder: {},
   },
);

export function setCollapsed(collapsed: boolean) {
   sidebarStore.setState((state) => ({ ...state, isCollapsed: collapsed }));
}

export function toggleHiddenItem(itemId: string) {
   sidebarStore.setState((state) => ({
      ...state,
      hiddenItems: state.hiddenItems.includes(itemId)
         ? state.hiddenItems.filter((id) => id !== itemId)
         : [...state.hiddenItems, itemId],
   }));
}

export function toggleFinanceNavPref(itemId: string) {
   sidebarStore.setState((state) => ({
      ...state,
      financeNavPrefs: state.financeNavPrefs.includes(itemId)
         ? state.financeNavPrefs.filter((id) => id !== itemId)
         : [...state.financeNavPrefs, itemId],
   }));
}

export function setSectionOpen(sectionId: string, open: boolean) {
   sidebarStore.setState((state) => ({
      ...state,
      sectionOpen: { ...(state.sectionOpen ?? {}), [sectionId]: open },
   }));
}

export function setSidebarItemOrder(groupId: string, itemIds: string[]) {
   sidebarStore.setState((state) => ({
      ...state,
      itemOrder: { ...(state.itemOrder ?? {}), [groupId]: itemIds },
   }));
}

export function useSidebarCollapsed() {
   return useStore(sidebarStore, (s) => s.isCollapsed);
}

export function useIsItemVisible() {
   const hiddenItems = useStore(sidebarStore, (s) => s.hiddenItems);
   return (itemId: string) => !hiddenItems.includes(itemId);
}

export function useIsFinanceItemWanted() {
   const wantedItems = useStore(sidebarStore, (s) => s.financeNavPrefs);
   return (itemId: string) => wantedItems.includes(itemId);
}

export function useIsSectionOpen(sectionId: string, defaultOpen: boolean) {
   const sectionOpen = useStore(sidebarStore, (s) => s.sectionOpen);
   return sectionOpen?.[sectionId] ?? defaultOpen;
}

export function useSidebarItemOrder(groupId: string) {
   return useStore(sidebarStore, (s) => s.itemOrder?.[groupId] ?? []);
}
