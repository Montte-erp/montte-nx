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
import { Checkbox } from "@packages/ui/components/checkbox";
import { createStore, useSelector } from "@tanstack/react-store";
import type { Store } from "@tanstack/react-store";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createContextState } from "foxact/context-state";
import { useLocalStorage } from "foxact/use-local-storage";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useSingleton } from "foxact/use-singleton";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type React from "react";

export type DataTableStoredState = {
   columnOrder: string[];
   columnVisibility: VisibilityState;
   columnPinning?: ColumnPinningState;
};

export type DataTablePersistedState = DataTableStoredState & {
   sorting?: SortingState;
   columnFilters?: ColumnFiltersState;
};

export type DataTableStoreState<TData = unknown> = {
   data: TData[];
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

type DataTableContextValue<TData> = {
   store: Store<DataTableStoreState<TData>>;
   table: Table<TData>;
   onTableStateChange: (state: DataTableStoredState) => void;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
};

// oxlint-ignore no-explicit-any
const [DataTableCtxProvider, useDataTableCtxValue, useSetDataTableCtx] =
   createContextState<DataTableContextValue<any>>();

export function useDataTableContext<TData>(): DataTableContextValue<TData> {
   return useDataTableCtxValue() as DataTableContextValue<TData>;
}

export function useDataTableStore<T>(
   selector: (s: DataTableStoreState<unknown>) => T,
): T {
   const { store } = useDataTableContext();
   return useSelector(store, selector);
}

// oxlint-ignore no-explicit-any
function DataTableContextSync({
   value,
}: {
   value: DataTableContextValue<any>;
}) {
   const setCtx = useSetDataTableCtx();
   useIsomorphicLayoutEffect(() => {
      setCtx(value);
   }, [setCtx, value]);
   return null;
}

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

   const store = useSingleton(() =>
      createStore<DataTableStoreState<TData>>({
         data,
         sorting: externalSorting ?? persisted?.sorting ?? [],
         columnFilters: externalColumnFilters ?? persisted?.columnFilters ?? [],
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
   ).current;

   useEffect(() => {
      store.setState((s) => ({ ...s, data }));
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

   const persistDebounced = useDebouncedCallback(
      (update: Partial<DataTablePersistedState>) => {
         setPersisted((prev) => ({
            ...(prev ?? { columnOrder: [], columnVisibility: {} }),
            ...update,
         }));
      },
      { wait: 350 },
   );

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

   const effectiveColumnVisibility = useSelector(
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

   const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
      const selectCol: ColumnDef<TData, unknown> = {
         id: "__select",
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
               checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
               }
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
               }
            />
         ),
         cell: ({ row }) =>
            row.depth > 0 ? null : (
               <Checkbox
                  aria-label="Selecionar linha"
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            ),
         enableSorting: false,
         enableHiding: false,
      };
      if (!renderActions) return [selectCol, ...columns];
      const actionsCol: ColumnDef<TData, unknown> = {
         id: "__actions",
         header: () => <span className="sr-only">Ações</span>,
         cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2">
               {renderActions({ row })}
            </div>
         ),
         enableSorting: false,
         enableHiding: false,
      };
      return [selectCol, ...columns, actionsCol];
   }, [columns, renderActions]);

   const sorting = useSelector(store, (s) => s.sorting);
   const columnFilters = useSelector(store, (s) => s.columnFilters);
   const rowSelection = useSelector(store, (s) => s.rowSelection);
   const storeData = useSelector(store, (s) => s.data);

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
            left: ["__select"],
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
      <DataTableCtxProvider initialState={ctx}>
         <DataTableContextSync value={ctx} />
         {children}
      </DataTableCtxProvider>
   );
}
