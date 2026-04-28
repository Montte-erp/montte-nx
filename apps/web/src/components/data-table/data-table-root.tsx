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
import { useCallback, useEffect, useEffectEvent, useMemo } from "react";
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

export type ExternalFilter = {
   id: string;
   label: string;
   group: string;
   active: boolean;
   renderIcon?: () => React.ReactNode;
   onToggle: (active: boolean) => void;
};

export type DataTableImportState = {
   rawHeaders: string[];
   rawRows: string[][];
   mapping: Record<string, string>;
   importRows: Record<string, unknown>[];
   onSave: (rows: Record<string, unknown>[]) => Promise<void>;
};

export type DataTableStoreState = {
   sorting: SortingState;
   columnFilters: ColumnFiltersState;
   tableState: DataTableStoredState | null;
   rowSelection: RowSelectionState;
   hasEmptyState: boolean;
   externalFilters: Record<string, ExternalFilter>;
   importState: DataTableImportState | null;
};

declare module "@tanstack/react-table" {
   // oxlint-ignore @typescript-eslint/no-unused-vars
   interface ColumnMeta<TData extends RowData, TValue> {
      label?: string;
      filterVariant?: "text" | "select" | "range" | "date";
      align?: "left" | "center" | "right";
      exportable?: boolean;
      exportIgnore?: boolean;
      importIgnore?: boolean;
      isEditable?: boolean;
      cellComponent?:
         | "text"
         | "textarea"
         | "select"
         | "tags"
         | "money"
         | "date"
         | "combobox"
         | "toggle"
         | "numeric";
      editMode?: "inline" | "popover";
      editOptions?: Array<{ label: string; value: string }>;
      // oxlint-ignore no-explicit-any
      editSchema?: any;
      // oxlint-ignore no-explicit-any
      isEditableForRow?: (row: TData) => boolean;
      onSave?: (rowId: string, value: unknown) => Promise<void>;
      onCreateOption?: (name: string) => Promise<string>;
   }
}

type DataTableContextValue<TData> = {
   store: Store<DataTableStoreState>;
   table: Table<TData>;
   storageKey: string;
   onTableStateChange: (state: DataTableStoredState) => void;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
   isDraftRowActive?: boolean;
   onAddRow?: (data: Record<string, string | string[]>) => Promise<void>;
   onDiscardAddRow?: () => void;
   draftRowDefaults?: Record<string, string>;
};

// oxlint-ignore no-explicit-any
const [DataTableCtxProvider, useDataTableCtxValue, useSetDataTableCtx] =
   createContextState<DataTableContextValue<any>>();

export function useDataTableContext<TData>(): DataTableContextValue<TData> {
   return useDataTableCtxValue() as DataTableContextValue<TData>;
}

export function useDataTableStore<T>(
   selector: (s: DataTableStoreState) => T,
): T {
   const { store } = useDataTableContext();
   return useSelector(store, selector);
}

export function useDataTable<TData>() {
   const ctx = useDataTableContext<TData>();
   const sorting = useSelector(ctx.store, (s) => s.sorting);
   const columnFilters = useSelector(ctx.store, (s) => s.columnFilters);
   const rowSelection = useSelector(ctx.store, (s) => s.rowSelection);
   const hasEmptyState = useSelector(ctx.store, (s) => s.hasEmptyState);
   return {
      table: ctx.table,
      store: ctx.store,
      storageKey: ctx.storageKey,
      onTableStateChange: ctx.onTableStateChange,
      groupBy: ctx.groupBy,
      renderGroupHeader: ctx.renderGroupHeader,
      isDraftRowActive: ctx.isDraftRowActive,
      onAddRow: ctx.onAddRow,
      onDiscardAddRow: ctx.onDiscardAddRow,
      draftRowDefaults: ctx.draftRowDefaults,
      renderExpandedRow: ctx.renderExpandedRow,
      sorting,
      columnFilters,
      rowSelection,
      hasEmptyState,
   };
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

interface DataTableRootProps<TData> {
   children: React.ReactNode;
   storageKey: string;
   columns: ColumnDef<TData, unknown>[];
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
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
   getSubRows?: (row: TData) => TData[] | undefined;
   isDraftRowActive?: boolean;
   onAddRow?: (data: Record<string, string | string[]>) => Promise<void>;
   onDiscardAddRow?: () => void;
   draftRowDefaults?: Record<string, string>;
}

function useDataTableRoot<TData>({
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
   renderExpandedRow,
   getSubRows,
   isDraftRowActive,
   onAddRow,
   onDiscardAddRow,
   draftRowDefaults,
}: Omit<DataTableRootProps<TData>, "children">): DataTableContextValue<TData> {
   const [persisted, setPersisted] =
      useLocalStorage<DataTablePersistedState | null>(storageKey, null);

   const store = useSingleton(() =>
      createStore<DataTableStoreState>({
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
         externalFilters: {},
         importState: null,
      }),
   ).current;

   const applySorting = useEffectEvent((sorting: SortingState) => {
      store.setState((s) => ({ ...s, sorting }));
   });

   const applyColumnFilters = useEffectEvent(
      (columnFilters: ColumnFiltersState) => {
         store.setState((s) => ({ ...s, columnFilters }));
      },
   );

   const applyRowSelection = useEffectEvent(
      (rowSelection: RowSelectionState) => {
         store.setState((s) => ({ ...s, rowSelection }));
      },
   );

   useEffect(() => {
      if (externalSorting !== undefined) applySorting(externalSorting);
   }, [externalSorting]);

   useEffect(() => {
      if (externalColumnFilters !== undefined)
         applyColumnFilters(externalColumnFilters);
   }, [externalColumnFilters]);

   useEffect(() => {
      if (externalRowSelection !== undefined)
         applyRowSelection(externalRowSelection);
   }, [externalRowSelection]);

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
            onRowSelectionChange?.(next);
            return { ...s, rowSelection: next };
         });
      },
      [store, onRowSelectionChange],
   );

   const effectiveColumnVisibility = useSelector(
      store,
      (s) => s.tableState?.columnVisibility ?? {},
   );

   const onTableStateChange = useCallback(
      (state: DataTableStoredState) => {
         store.setState((s) => ({ ...s, tableState: state }));
         setPersisted((prev) => ({ ...(prev ?? {}), ...state }));
      },
      [store, setPersisted],
   );

   const handleColumnVisibilityChange = useCallback(
      (
         updater: VisibilityState | ((old: VisibilityState) => VisibilityState),
      ) => {
         const current = store.state.tableState?.columnVisibility ?? {};
         const next =
            typeof updater === "function" ? updater(current) : updater;
         onTableStateChange({
            columnOrder: store.state.tableState?.columnOrder ?? [],
            columnVisibility: next,
            columnPinning: store.state.tableState?.columnPinning,
         });
      },
      [store, onTableStateChange],
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

   const table = useReactTable({
      columns: allColumns,
      data,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: getFacetedUniqueValues(),
      getFacetedMinMaxValues: getFacetedMinMaxValues(),
      getRowId: (originalRow) => getRowId(originalRow),
      getRowCanExpand: renderExpandedRow ? () => true : undefined,
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
         expanded: getSubRows ? true : undefined,
         columnPinning: {
            left: ["__select"],
            right: renderActions ? ["__actions"] : [],
         },
      },
   });

   return useMemo<DataTableContextValue<TData>>(
      () => ({
         store,
         table,
         storageKey,
         onTableStateChange,
         groupBy,
         renderGroupHeader,
         renderExpandedRow,
         isDraftRowActive,
         onAddRow,
         onDiscardAddRow,
         draftRowDefaults,
      }),
      [
         store,
         table,
         storageKey,
         onTableStateChange,
         groupBy,
         renderGroupHeader,
         renderExpandedRow,
         isDraftRowActive,
         onAddRow,
         onDiscardAddRow,
         draftRowDefaults,
      ],
   );
}

export function DataTableExternalFilter(config: ExternalFilter) {
   useRegisterDataTableFilter(config);
   return null;
}

export function useRegisterDataTableFilter(config: ExternalFilter) {
   const { store } = useDataTableContext();

   // No deps — runs after every render to stay in sync with latest config.
   // Using a layout effect (vs render-time setState) ensures React Strict Mode's
   // simulated unmount/remount cycle correctly removes and re-adds the filter.
   useIsomorphicLayoutEffect(() => {
      store.setState((s) => ({
         ...s,
         externalFilters: { ...s.externalFilters, [config.id]: config },
      }));
      return () => {
         store.setState((s) => {
            const { [config.id]: _, ...rest } = s.externalFilters;
            return { ...s, externalFilters: rest };
         });
      };
   });
}

export function DataTableRoot<TData>({
   children,
   ...props
}: DataTableRootProps<TData>) {
   const ctx = useDataTableRoot(props);
   return (
      <DataTableCtxProvider initialState={ctx}>
         <DataTableContextSync value={ctx} />
         {children}
      </DataTableCtxProvider>
   );
}
