"use client";

import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   Row,
   RowSelectionState,
   SortingState,
} from "@tanstack/react-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { useLocalStorage } from "foxact/use-local-storage";
import { useCallback, useMemo, useState } from "react";
import type React from "react";
import {
   DataTableContext,
   type DataTableContextValue,
   type DataTablePersistedState,
} from "./context";

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
   rowSelection,
   onRowSelectionChange,
   renderActions,
   groupBy,
   renderGroupHeader,
   getSubRows,
}: DataTableRootProps<TData, TValue>) {
   const [persisted, setPersisted] =
      useLocalStorage<DataTablePersistedState | null>(storageKey, null);

   const [hasEmptyState, setHasEmptyState] = useState(false);

   const sorting = useMemo<SortingState>(
      () => externalSorting ?? persisted?.sorting ?? [],
      [externalSorting, persisted?.sorting],
   );

   const columnFilters = useMemo<ColumnFiltersState>(
      () => externalColumnFilters ?? persisted?.columnFilters ?? [],
      [externalColumnFilters, persisted?.columnFilters],
   );

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         setPersisted((prev) => ({
            ...(prev ?? { columnOrder: [], columnVisibility: {} }),
            sorting: next,
         }));
      },
      [sorting, setPersisted],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            setPersisted((prev) => ({
               ...(prev ?? { columnOrder: [], columnVisibility: {} }),
               columnFilters: next,
            }));
         },
         [columnFilters, setPersisted],
      );

   const onSortingChange = useMemo(
      () => externalOnSortingChange ?? handleSortingChange,
      [externalOnSortingChange, handleSortingChange],
   );

   const onColumnFiltersChange = useMemo(
      () => externalOnColumnFiltersChange ?? handleColumnFiltersChange,
      [externalOnColumnFiltersChange, handleColumnFiltersChange],
   );

   const tableState: DataTableStoredState | null = persisted
      ? {
           columnOrder: persisted.columnOrder ?? [],
           columnVisibility: persisted.columnVisibility ?? {},
           columnPinning: persisted.columnPinning,
        }
      : null;

   const onTableStateChange = useCallback(
      (state: DataTableStoredState) => {
         setPersisted((prev) => ({ ...(prev ?? {}), ...state }));
      },
      [setPersisted],
   );

   const registerEmptyState = useCallback(() => setHasEmptyState(true), []);
   const unregisterEmptyState = useCallback(() => setHasEmptyState(false), []);

   const value = useMemo<DataTableContextValue<TData, TValue>>(
      () => ({
         data,
         columns,
         getRowId,
         sorting,
         onSortingChange,
         columnFilters,
         onColumnFiltersChange,
         tableState,
         onTableStateChange,
         hasEmptyState,
         registerEmptyState,
         unregisterEmptyState,
         rowSelection,
         onRowSelectionChange,
         renderActions,
         groupBy,
         renderGroupHeader,
         getSubRows,
      }),
      [
         data,
         columns,
         getRowId,
         sorting,
         onSortingChange,
         columnFilters,
         onColumnFiltersChange,
         tableState,
         onTableStateChange,
         hasEmptyState,
         registerEmptyState,
         unregisterEmptyState,
         rowSelection,
         onRowSelectionChange,
         renderActions,
         groupBy,
         renderGroupHeader,
         getSubRows,
      ],
   );

   return (
      <DataTableContext.Provider value={value}>
         {children}
      </DataTableContext.Provider>
   );
}
