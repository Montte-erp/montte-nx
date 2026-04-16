import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/react-store";
import { useCallback, useEffect } from "react";
import { createPersistedStore } from "@/lib/persisted-store";

export type SubSidebarSection = "dashboards" | "insights" | "data-management";

interface SidebarPersistedState {
   isCollapsed: boolean;
   hiddenItems: string[];
   financeNavPrefs: string[];
   pinnedItems: string[];
}

interface SidebarTransientState {
   activeSection: SubSidebarSection | null;
   searchQuery: string;
}

const { store: sidebarStore, useStorePersistence } =
   createPersistedStore<SidebarPersistedState>("montte:sidebar", {
      isCollapsed: false,
      hiddenItems: [],
      financeNavPrefs: [],
      pinnedItems: [],
   });

const transientStore = new Store<SidebarTransientState>({
   activeSection: null,
   searchQuery: "",
});

export function setActiveSection(section: SubSidebarSection | null) {
   transientStore.setState((state) => ({
      ...state,
      activeSection: section,
      searchQuery: "",
   }));
}

export function setSearchQuery(query: string) {
   transientStore.setState((state) => ({ ...state, searchQuery: query }));
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
   useStorePersistence();
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

   return { activeSection, searchQuery, pinnedItems, setSearchQuery };
}

export function useSidebarSection(section: SubSidebarSection) {
   useEffect(() => {
      setActiveSection(section);
      return () => {
         transientStore.setState((state) => ({
            ...state,
            activeSection:
               state.activeSection === section ? null : state.activeSection,
            searchQuery:
               state.activeSection === section ? "" : state.searchQuery,
         }));
      };
   }, [section]);
}
