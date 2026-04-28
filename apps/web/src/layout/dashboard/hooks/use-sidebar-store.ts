import { createStore, useStore } from "@tanstack/react-store";
import { useCallback, useEffect } from "react";
import { createPersistedStore, createStoreEffect } from "@/lib/store";

export type SubSidebarSection = "dashboards" | "insights";

interface SidebarPersistedState {
   isCollapsed: boolean;
   hiddenItems: string[];
   financeNavPrefs: string[];
   pinnedItems: string[];
}

interface SidebarTransientState {
   activeSection: SubSidebarSection | null;
   searchQuery: string;
   isEditingNav: boolean;
}

const sidebarStore = createPersistedStore<SidebarPersistedState>(
   "montte:sidebar",
   {
      isCollapsed: false,
      hiddenItems: [],
      financeNavPrefs: [],
      pinnedItems: [],
   },
);

const transientStore = createStore<SidebarTransientState>({
   activeSection: null,
   searchQuery: "",
   isEditingNav: false,
});

createStoreEffect(transientStore, (next, prev) => {
   if (
      prev.activeSection !== null &&
      next.activeSection === null &&
      next.searchQuery !== ""
   ) {
      transientStore.setState((s) => ({ ...s, searchQuery: "" }));
   }
});

export function setActiveSection(section: SubSidebarSection | null) {
   transientStore.setState((state) => ({ ...state, activeSection: section }));
}

export function setSearchQuery(query: string) {
   transientStore.setState((state) => ({ ...state, searchQuery: query }));
}

export function setNavEditing(value: boolean) {
   transientStore.setState((state) => ({ ...state, isEditingNav: value }));
}

export function togglePinnedItem(itemId: string) {
   sidebarStore.setState((state) => ({
      ...state,
      pinnedItems: state.pinnedItems.includes(itemId)
         ? state.pinnedItems.filter((id) => id !== itemId)
         : [...state.pinnedItems, itemId],
   }));
}

export function useSidebarCollapsed() {
   const isCollapsed = useStore(sidebarStore, (s) => s.isCollapsed);
   const setCollapsed = useCallback((collapsed: boolean) => {
      sidebarStore.setState((s) => ({ ...s, isCollapsed: collapsed }));
   }, []);
   return { isCollapsed, setCollapsed };
}

export function useSidebarVisibility() {
   const hiddenItems = useStore(sidebarStore, (s) => s.hiddenItems);

   const isVisible = useCallback(
      (itemId: string) => !hiddenItems.includes(itemId),
      [hiddenItems],
   );

   const toggleItem = useCallback((itemId: string) => {
      sidebarStore.setState((state) => ({
         ...state,
         hiddenItems: state.hiddenItems.includes(itemId)
            ? state.hiddenItems.filter((id) => id !== itemId)
            : [...state.hiddenItems, itemId],
      }));
   }, []);

   return { hiddenItems, isVisible, toggleItem };
}

export function useFinanceNavPreferences() {
   const wantedItems = useStore(sidebarStore, (s) => s.financeNavPrefs);

   const isWanted = useCallback(
      (itemId: string) => wantedItems.includes(itemId),
      [wantedItems],
   );

   const toggleItem = useCallback((itemId: string) => {
      sidebarStore.setState((state) => ({
         ...state,
         financeNavPrefs: state.financeNavPrefs.includes(itemId)
            ? state.financeNavPrefs.filter((id) => id !== itemId)
            : [...state.financeNavPrefs, itemId],
      }));
   }, []);

   return { wantedItems, isWanted, toggleItem };
}

export function useSidebarNav() {
   const activeSection = useStore(transientStore, (s) => s.activeSection);
   const searchQuery = useStore(transientStore, (s) => s.searchQuery);
   const pinnedItems = useStore(sidebarStore, (s) => s.pinnedItems);
   const isEditingNav = useStore(transientStore, (s) => s.isEditingNav);

   return {
      activeSection,
      searchQuery,
      pinnedItems,
      setSearchQuery,
      isEditingNav,
   };
}

export function useSidebarSection(section: SubSidebarSection) {
   useEffect(() => {
      setActiveSection(section);
      return () => {
         if (transientStore.state.activeSection === section) {
            setActiveSection(null);
         }
      };
   }, [section]);
}
