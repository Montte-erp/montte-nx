import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import { createPersistedStore } from "@/lib/persisted-store";

export type SubSidebarSection = "dashboards" | "insights" | "data-management";

interface SidebarNavState {
   activeSection: SubSidebarSection | null;
   searchQuery: string;
   pinnedItems: string[];
}

const { store: sidebarNavStore, useStorePersistence } =
   createPersistedStore<SidebarNavState>("montte:sidebar-nav", {
      activeSection: null,
      searchQuery: "",
      pinnedItems: [],
   });

export function setActiveSection(section: SubSidebarSection | null) {
   sidebarNavStore.setState((state) => ({
      ...state,
      activeSection: section,
      searchQuery: "",
   }));
}

export function setSearchQuery(query: string) {
   sidebarNavStore.setState((state) => ({
      ...state,
      searchQuery: query,
   }));
}

export function togglePinnedItem(itemId: string) {
   sidebarNavStore.setState((state) => ({
      ...state,
      pinnedItems: state.pinnedItems.includes(itemId)
         ? state.pinnedItems.filter((id) => id !== itemId)
         : [...state.pinnedItems, itemId],
   }));
}

export function useSidebarNav() {
   useStorePersistence();
   const state = useStore(sidebarNavStore, (s) => s);

   return {
      activeSection: state.activeSection,
      searchQuery: state.searchQuery,
      pinnedItems: state.pinnedItems,
      setSearchQuery,
   };
}

export function useSidebarSection(section: SubSidebarSection) {
   useEffect(() => {
      setActiveSection(section);
      return () => {
         sidebarNavStore.setState((state) => ({
            ...state,
            activeSection:
               state.activeSection === section ? null : state.activeSection,
            searchQuery:
               state.activeSection === section ? "" : state.searchQuery,
         }));
      };
   }, [section]);
}
