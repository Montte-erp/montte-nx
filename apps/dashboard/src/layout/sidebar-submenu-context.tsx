import type { LucideIcon } from "lucide-react";
import {
   createContext,
   type ReactNode,
   useCallback,
   useContext,
   useMemo,
   useState,
} from "react";
import type { SortDirection, SortOption } from "./hooks/use-submenu-data";

export type SubmenuId = "reports" | "planning" | "categorization";

export type SubmenuItem = {
   id: string;
   title: string;
   url: string;
   icon: LucideIcon;
};

export type SubmenuConfig = {
   id: SubmenuId;
   title: string;
   icon: LucideIcon;
   items: SubmenuItem[];
   isDynamic?: boolean;
};

export type SubmenuPanelState = {
   search: string;
   sortBy: SortOption;
   sortDirection: SortDirection;
   expandedSections: string[];
};

const DEFAULT_PANEL_STATE: SubmenuPanelState = {
   search: "",
   sortBy: "date_updated",
   sortDirection: "desc",
   // Default expanded sections for all panels:
   // - Reports: recents, dashboards, insights
   // - Planning: goals, budgets
   // - Categorization: categories, costCenters, tags
   expandedSections: [
      "recents",
      "dashboards",
      "insights",
      "goals",
      "budgets",
      "categories",
      "costCenters",
      "tags",
   ],
};

type SubmenuContextValue = {
   activeSubmenu: SubmenuId | null;
   submenuConfig: SubmenuConfig | null;
   triggerRect: DOMRect | null;
   panelState: SubmenuPanelState;
   toggleSubmenu: (config: SubmenuConfig, triggerElement: HTMLElement) => void;
   closeSubmenu: () => void;
   setSearch: (search: string) => void;
   setSort: (sortBy: SortOption, direction?: SortDirection) => void;
   toggleSection: (sectionId: string) => void;
   resetPanelState: () => void;
};

const SubmenuContext = createContext<SubmenuContextValue | null>(null);

export function SubmenuProvider({ children }: { children: ReactNode }) {
   const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);
   const [submenuConfig, setSubmenuConfig] = useState<SubmenuConfig | null>(
      null,
   );
   const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
   const [panelState, setPanelState] =
      useState<SubmenuPanelState>(DEFAULT_PANEL_STATE);

   const toggleSubmenu = useCallback(
      (config: SubmenuConfig, triggerElement: HTMLElement) => {
         if (activeSubmenu === config.id) {
            // Already open, close it
            setActiveSubmenu(null);
            setSubmenuConfig(null);
            setTriggerRect(null);
            // Reset panel state when closing
            setPanelState(DEFAULT_PANEL_STATE);
         } else {
            // Open this submenu
            const rect = triggerElement.getBoundingClientRect();
            setTriggerRect(rect);
            setSubmenuConfig(config);
            setActiveSubmenu(config.id);
            // Reset panel state when opening new submenu
            setPanelState(DEFAULT_PANEL_STATE);
         }
      },
      [activeSubmenu],
   );

   const closeSubmenu = useCallback(() => {
      setActiveSubmenu(null);
      setSubmenuConfig(null);
      setTriggerRect(null);
      setPanelState(DEFAULT_PANEL_STATE);
   }, []);

   const setSearch = useCallback((search: string) => {
      setPanelState((prev) => ({ ...prev, search }));
   }, []);

   const setSort = useCallback(
      (sortBy: SortOption, direction?: SortDirection) => {
         setPanelState((prev) => ({
            ...prev,
            sortBy,
            sortDirection: direction ?? prev.sortDirection,
         }));
      },
      [],
   );

   const toggleSection = useCallback((sectionId: string) => {
      setPanelState((prev) => ({
         ...prev,
         expandedSections: prev.expandedSections.includes(sectionId)
            ? prev.expandedSections.filter((id) => id !== sectionId)
            : [...prev.expandedSections, sectionId],
      }));
   }, []);

   const resetPanelState = useCallback(() => {
      setPanelState(DEFAULT_PANEL_STATE);
   }, []);

   const value = useMemo(
      () => ({
         activeSubmenu,
         submenuConfig,
         triggerRect,
         panelState,
         toggleSubmenu,
         closeSubmenu,
         setSearch,
         setSort,
         toggleSection,
         resetPanelState,
      }),
      [
         activeSubmenu,
         submenuConfig,
         triggerRect,
         panelState,
         toggleSubmenu,
         closeSubmenu,
         setSearch,
         setSort,
         toggleSection,
         resetPanelState,
      ],
   );

   return (
      <SubmenuContext.Provider value={value}>
         {children}
      </SubmenuContext.Provider>
   );
}

export function useSubmenu() {
   const context = useContext(SubmenuContext);
   if (!context) {
      throw new Error("useSubmenu must be used within a SubmenuProvider");
   }
   return context;
}
