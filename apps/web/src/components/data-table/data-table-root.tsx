import type {
   ColumnDef,
   ColumnFiltersState,
   ColumnPinningState,
   OnChangeFn,
   Row,
   RowData,
   RowSelectionState,
   SortingState,
   Table,
   VisibilityState,
} from "@tanstack/react-table";
import {
   getCoreRowModel,
   getExpandedRowModel,
   getFacetedMinMaxValues,
   getFacetedRowModel,
   getFacetedUniqueValues,
   useReactTable,
} from "@tanstack/react-table";
import { Store, useStore } from "@tanstack/react-store";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useLocalStorage } from "foxact/use-local-storage";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
} from "react";
import type React from "react";

// =============================================================================
// Types
// =============================================================================

export type DataTableStoredState = {
   columnOrder: string[];
   columnVisibility: VisibilityState;
   columnPinning?: ColumnPinningState;
};

export type DataTablePersistedState = DataTableStoredState & {
   sorting?: SortingState;
   columnFilters?: ColumnFiltersState;
};

export type DataTableStoreState = {
   data: unknown[];
   sorting: SortingState;
   columnFilters: ColumnFiltersState;
   tableState: DataTableStoredState | null;
   rowSelection: RowSelectionState;
   hasEmptyState: boolean;
};

declare module "@tanstack/react-table" {
   // oxlint-ignore @typescript-eslint/no-unused-vars
   interface ColumnMeta<TData extends RowData, TValue> {
      label?: string;
      filterVariant?: "text" | "select" | "range" | "date";
      align?: "left" | "center" | "right";
      exportable?: boolean;
   }
}

// =============================================================================
// Context
// =============================================================================

type DataTableContextValue<TData> = {
   store: Store<DataTableStoreState>;
   table: Table<TData>;
   onTableStateChange: (state: DataTableStoredState) => void;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
};

// oxlint-ignore no-explicit-any
const DataTableContext = createContext<DataTableContextValue<any> | null>(null);

export function useDataTableContext<TData>(): DataTableContextValue<TData> {
   const ctx = useContext(DataTableContext);
   if (!ctx)
      throw new Error("useDataTableContext must be used within DataTableRoot");
   return ctx as DataTableContextValue<TData>;
}

export function useDataTableStore<T>(
   selector: (s: DataTableStoreState) => T,
): T {
   const { store } = useDataTableContext();
   return useStore(store, selector);
}

// =============================================================================
// DataTableRoot
// =============================================================================

interface DataTableRootProps<TData, TValue> {
   children: React.ReactNode;
   storageKey: string;
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   getRowId: (row: TData) => string;
   sorting?: SortingState;
   onSortingChange?: OnChangeFn<SortingState>;
   columnFilters?: ColumnFiltersState;
   onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
   rowSelection?: RowSelectionState;
   onRowSelectionChange?: (selection: RowSelectionState) => void;
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   getSubRows?: (row: TData) => TData[] | undefined;
}

export function DataTableRoot<TData, TValue>({
   children,
   storageKey,
   columns,
   data,
   getRowId,
   sorting: externalSorting,
   onSortingChange: externalOnSortingChange,
   columnFilters: externalColumnFilters,
   onColumnFiltersChange: externalOnColumnFiltersChange,
   rowSelection: externalRowSelection,
   onRowSelectionChange,
   renderActions,
   groupBy,
   renderGroupHeader,
   getSubRows,
}: DataTableRootProps<TData, TValue>) {
   const [persisted, setPersisted] =
      useLocalStorage<DataTablePersistedState | null>(storageKey, null);

   const [store] = useState(
      () =>
         new Store<DataTableStoreState>({
            data: data as unknown[],
            sorting: externalSorting ?? persisted?.sorting ?? [],
            columnFilters:
               externalColumnFilters ?? persisted?.columnFilters ?? [],
            tableState: persisted
               ? {
                    columnOrder: persisted.columnOrder ?? [],
                    columnVisibility: persisted.columnVisibility ?? {},
                    columnPinning: persisted.columnPinning,
                 }
               : null,
            rowSelection: externalRowSelection ?? {},
            hasEmptyState: false,
         }),
   );

   // Sync props into store
   useEffect(() => {
      store.setState((s) => ({ ...s, data: data as unknown[] }));
   }, [data, store]);

   useEffect(() => {
      if (externalSorting !== undefined)
         store.setState((s) => ({ ...s, sorting: externalSorting }));
   }, [externalSorting, store]);

   useEffect(() => {
      if (externalColumnFilters !== undefined)
         store.setState((s) => ({
            ...s,
            columnFilters: externalColumnFilters,
         }));
   }, [externalColumnFilters, store]);

   useEffect(() => {
      if (externalRowSelection !== undefined)
         store.setState((s) => ({ ...s, rowSelection: externalRowSelection }));
   }, [externalRowSelection, store]);

   // Debounced persistence
   const persistDebounced = useDebouncedCallback(
      (update: Partial<DataTablePersistedState>) => {
         setPersisted((prev) => ({
            ...(prev ?? { columnOrder: [], columnVisibility: {} }),
            ...update,
         }));
      },
      { wait: 350 },
   );

   // Sorting handlers
   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function"
               ? updater(store.state.sorting)
               : updater;
         store.setState((s) => ({ ...s, sorting: next }));
         persistDebounced({ sorting: next });
      },
      [store, persistDebounced],
   );

   // Column filter handlers
   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function"
                  ? updater(store.state.columnFilters)
                  : updater;
            store.setState((s) => ({ ...s, columnFilters: next }));
            persistDebounced({ columnFilters: next });
         },
         [store, persistDebounced],
      );

   // Row selection handler
   const onRowSelectionChangeRef = useRef(onRowSelectionChange);
   useIsomorphicLayoutEffect(() => {
      onRowSelectionChangeRef.current = onRowSelectionChange;
   });

   const handleRowSelectionChange = useCallback(
      (
         updater:
            | RowSelectionState
            | ((old: RowSelectionState) => RowSelectionState),
      ) => {
         store.setState((s) => {
            const next =
               typeof updater === "function"
                  ? updater(s.rowSelection)
                  : updater;
            onRowSelectionChangeRef.current?.(next);
            return { ...s, rowSelection: next };
         });
      },
      [store],
   );

   // Column visibility / table state
   const effectiveColumnVisibility = useStore(
      store,
      (s) => s.tableState?.columnVisibility ?? {},
   );

   const effectiveColumnVisibilityRef = useRef(effectiveColumnVisibility);
   useIsomorphicLayoutEffect(() => {
      effectiveColumnVisibilityRef.current = effectiveColumnVisibility;
   });

   const onTableStateChangeRef = useRef<
      ((s: DataTableStoredState) => void) | undefined
   >(undefined);

   const onTableStateChange = useCallback(
      (state: DataTableStoredState) => {
         store.setState((s) => ({ ...s, tableState: state }));
         setPersisted((prev) => ({ ...(prev ?? {}), ...state }));
      },
      [store, setPersisted],
   );

   useIsomorphicLayoutEffect(() => {
      onTableStateChangeRef.current = onTableStateChange;
   });

   const handleColumnVisibilityChange = useCallback(
      (
         updater: VisibilityState | ((old: VisibilityState) => VisibilityState),
      ) => {
         const next =
            typeof updater === "function"
               ? updater(effectiveColumnVisibilityRef.current)
               : updater;
         onTableStateChangeRef.current?.({
            columnOrder: store.state.tableState?.columnOrder ?? [],
            columnVisibility: next,
            columnPinning: store.state.tableState?.columnPinning,
         });
      },
      [store],
   );

   // Build columns (inject __actions)
   const allColumns = useMemo<ColumnDef<TData, TValue>[]>(() => {
      const actionsCol: ColumnDef<TData, unknown> = {
         id: "__actions",
         header: () => null,
         cell: renderActions
            ? ({ row }) => (
                 <div className="flex items-center justify-end gap-1">
                    {renderActions({ row })}
                 </div>
              )
            : undefined,
         enableSorting: false,
         enableHiding: false,
      };
      return [...columns, actionsCol as ColumnDef<TData, TValue>];
   }, [columns, renderActions]);

   // Reactive store values for table
   const sorting = useStore(store, (s) => s.sorting);
   const columnFilters = useStore(store, (s) => s.columnFilters);
   const rowSelection = useStore(store, (s) => s.rowSelection);
   const storeData = useStore(store, (s) => s.data) as TData[];

   const table = useReactTable({
      columns: allColumns,
      data: storeData,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: getFacetedUniqueValues(),
      getFacetedMinMaxValues: getFacetedMinMaxValues(),
      getRowId: (originalRow) => getRowId(originalRow),
      getSubRows,
      manualFiltering: true,
      manualSorting: true,
      onColumnFiltersChange:
         externalOnColumnFiltersChange ?? handleColumnFiltersChange,
      onColumnVisibilityChange: handleColumnVisibilityChange,
      onRowSelectionChange: handleRowSelectionChange,
      onSortingChange: externalOnSortingChange ?? handleSortingChange,
      state: {
         columnFilters,
         columnVisibility: effectiveColumnVisibility,
         rowSelection,
         sorting,
         columnPinning: {
            right: ["__actions"],
         },
      },
   });

   const ctx = useMemo<DataTableContextValue<TData>>(
      () => ({
         store,
         table,
         onTableStateChange,
         groupBy,
         renderGroupHeader,
      }),
      [store, table, onTableStateChange, groupBy, renderGroupHeader],
   );

   return (
      <DataTableContext.Provider value={ctx}>
         {children}
      </DataTableContext.Provider>
   );
}
