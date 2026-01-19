import {
   getDateRangeForPeriod,
   type TimePeriod,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import type React from "react";
import {
   createContext,
   useCallback,
   useContext,
   useMemo,
   useState,
} from "react";

export type OrderByField = "name" | "createdAt" | "updatedAt";

export interface ListContextType {
   selectedItems: Set<string>;
   handleSelectionChange: (id: string, selected: boolean) => void;
   clearSelection: () => void;
   selectAll: (ids: string[]) => void;
   toggleAll: (ids: string[]) => void;
   selectedCount: number;

   nameFilter: string;
   setNameFilter: (value: string) => void;
   orderBy: OrderByField;
   setOrderBy: (value: OrderByField) => void;
   orderDirection: "asc" | "desc";
   setOrderDirection: (value: "asc" | "desc") => void;
   currentPage: number;
   setCurrentPage: (page: number) => void;
   pageSize: number;
   setPageSize: (size: number) => void;

   typeFilter: string;
   setTypeFilter: (value: string) => void;

   timePeriod: TimePeriod | null;
   customDateRange: { startDate: Date | null; endDate: Date | null };
   handleTimePeriodChange: (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => void;
   setCustomDateRange: (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => void;

   startDate: Date | null;
   endDate: Date | null;

   clearFilters: () => void;
   hasActiveFilters: boolean;
}

type ListContextConfig = {
   displayName: string;
   defaultOrderBy?: OrderByField;
   defaultOrderDirection?: "asc" | "desc";
   defaultTimePeriod?: TimePeriod | null;
   defaultPageSize?: number;
};

export function createListContext(config: ListContextConfig) {
   const {
      displayName,
      defaultOrderBy = "name",
      defaultOrderDirection = "asc",
      defaultTimePeriod = "this-month",
      defaultPageSize = 10,
   } = config;

   const ListContext = createContext<ListContextType | undefined>(undefined);
   ListContext.displayName = `${displayName}ListContext`;

   function ListProvider({ children }: { children: React.ReactNode }) {
      const [selectedItems, setSelectedItems] = useState<Set<string>>(
         new Set(),
      );
      const [nameFilter, setNameFilter] = useState("");
      const [orderBy, setOrderBy] = useState<OrderByField>(defaultOrderBy);
      const [orderDirection, setOrderDirection] = useState<"asc" | "desc">(
         defaultOrderDirection,
      );
      const [currentPage, setCurrentPage] = useState(1);
      const [pageSize, setPageSize] = useState(defaultPageSize);

      const [typeFilter, setTypeFilter] = useState("");

      const [timePeriod, setTimePeriod] = useState<TimePeriod | null>(
         defaultTimePeriod,
      );
      const [customDateRange, setCustomDateRange] = useState<{
         startDate: Date | null;
         endDate: Date | null;
      }>({ endDate: null, startDate: null });

      const effectiveDateRange = useMemo(() => {
         if (timePeriod === "custom") {
            return customDateRange;
         }
         if (timePeriod) {
            const range = getDateRangeForPeriod(timePeriod);
            return { endDate: range.endDate, startDate: range.startDate };
         }
         return { endDate: null, startDate: null };
      }, [timePeriod, customDateRange]);

      const hasActiveFilters = useMemo(() => {
         return (
            (timePeriod !== defaultTimePeriod && timePeriod !== null) ||
            typeFilter !== "" ||
            orderBy !== defaultOrderBy ||
            orderDirection !== defaultOrderDirection
         );
      }, [timePeriod, typeFilter, orderBy, orderDirection]);

      const handleSelectionChange = useCallback(
         (id: string, selected: boolean) => {
            setSelectedItems((prev) => {
               const newSet = new Set(prev);
               if (selected) {
                  newSet.add(id);
               } else {
                  newSet.delete(id);
               }
               return newSet;
            });
         },
         [],
      );

      const clearSelection = useCallback(() => {
         setSelectedItems(new Set());
      }, []);

      const selectAll = useCallback((ids: string[]) => {
         setSelectedItems(new Set(ids));
      }, []);

      const toggleAll = useCallback((ids: string[]) => {
         setSelectedItems((prev) => {
            const allSelected = ids.every((id) => prev.has(id));
            return allSelected ? new Set() : new Set(ids);
         });
      }, []);

      const handleTimePeriodChange = useCallback(
         (period: TimePeriod | null, range: TimePeriodDateRange) => {
            setTimePeriod(period);
            if (period === "custom") {
               setCustomDateRange({
                  endDate: range.endDate,
                  startDate: range.startDate,
               });
            }
         },
         [],
      );

      const clearFilters = useCallback(() => {
         setTimePeriod(defaultTimePeriod);
         setCustomDateRange({ endDate: null, startDate: null });
         setTypeFilter("");
         setOrderBy(defaultOrderBy);
         setOrderDirection(defaultOrderDirection);
      }, []);

      const value: ListContextType = {
         clearFilters,
         clearSelection,
         currentPage,
         customDateRange,
         endDate: effectiveDateRange.endDate,
         handleSelectionChange,
         handleTimePeriodChange,
         hasActiveFilters,
         nameFilter,
         orderBy,
         orderDirection,
         pageSize,
         selectAll,
         selectedCount: selectedItems.size,
         selectedItems,
         setCurrentPage,
         setCustomDateRange,
         setNameFilter,
         setOrderBy,
         setOrderDirection,
         setPageSize,
         setTypeFilter,
         startDate: effectiveDateRange.startDate,
         timePeriod,
         toggleAll,
         typeFilter,
      };

      return (
         <ListContext.Provider value={value}>{children}</ListContext.Provider>
      );
   }
   ListProvider.displayName = `${displayName}ListProvider`;

   function useList(): ListContextType {
      const context = useContext(ListContext);
      if (context === undefined) {
         throw new Error(
            `use${displayName}List must be used within a ${displayName}ListProvider`,
         );
      }
      return context;
   }

   return {
      ListContext,
      ListProvider,
      useList,
   };
}
