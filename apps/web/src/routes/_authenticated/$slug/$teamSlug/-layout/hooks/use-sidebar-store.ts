import { createStore, useStore } from "@tanstack/react-store";
import { createPersistedStore } from "@/lib/store";

export type SubSidebarSection = "dashboards" | "insights";

interface SidebarPersistedState {
   isCollapsed: boolean;
   hiddenItems: string[];
   financeNavPrefs: string[];
   sectionOpen: Record<string, boolean>;
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
      sectionOpen: {},
   },
);

const transientStore = createStore<SidebarTransientState>({
   activeSection: null,
   searchQuery: "",
   isEditingNav: false,
});

export function setActiveSection(section: SubSidebarSection | null) {
   transientStore.setState((state) => ({
      ...state,
      activeSection: section,
      searchQuery: section === null ? "" : state.searchQuery,
   }));
}

export function setSearchQuery(query: string) {
   transientStore.setState((state) => ({ ...state, searchQuery: query }));
}

export function setNavEditing(value: boolean) {
   transientStore.setState((state) => ({ ...state, isEditingNav: value }));
}

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

export function useActiveSection() {
   return useStore(transientStore, (s) => s.activeSection);
}

export function useSearchQuery() {
   return useStore(transientStore, (s) => s.searchQuery);
}

export function useIsEditingNav() {
   return useStore(transientStore, (s) => s.isEditingNav);
}
