import { createContext, useContext } from "react";
import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   Row,
   RowSelectionState,
   SortingState,
} from "@tanstack/react-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import type React from "react";

export type DataTablePersistedState = DataTableStoredState & {
   sorting?: SortingState;
   columnFilters?: ColumnFiltersState;
};

export interface DataTableContextValue<TData, TValue> {
   data: TData[];
   columns: ColumnDef<TData, TValue>[];
   getRowId: (row: TData) => string;
   sorting: SortingState;
   onSortingChange: OnChangeFn<SortingState>;
   columnFilters: ColumnFiltersState;
   onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
   tableState: DataTableStoredState | null;
   onTableStateChange: (state: DataTableStoredState) => void;
   hasEmptyState: boolean;
   registerEmptyState: () => void;
   unregisterEmptyState: () => void;
   rowSelection?: RowSelectionState;
   onRowSelectionChange?: (selection: RowSelectionState) => void;
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   getSubRows?: (row: TData) => TData[] | undefined;
}

export const DataTableContext = createContext<DataTableContextValue<
   unknown,
   unknown
> | null>(null);

export function useDataTableContext<
   TData,
   TValue = unknown,
>(): DataTableContextValue<TData, TValue> {
   const context = useContext(DataTableContext);
   if (!context) {
      throw new Error(
         "useDataTableContext must be used within a DataTableContext.Provider",
      );
   }
   return context as DataTableContextValue<TData, TValue>;
}
