import type {
   ColumnFiltersState,
   ExpandedState,
   GroupingState,
   OnChangeFn,
   PaginationState,
   RowSelectionState,
   SortingState,
} from "@tanstack/react-table";
import { startTransition, useCallback, useState } from "react";

export interface TableUrlSearch {
   sorting: SortingState;
   columnFilters: ColumnFiltersState;
   page: number;
   pageSize: number;
   grouping?: GroupingState;
}

interface UseTableUrlStateOptions {
   search: TableUrlSearch;
   onUpdate: (next: Partial<TableUrlSearch>) => void;
   totalRows: number;
}

export interface UseTableUrlStateResult {
   state: {
      sorting: SortingState;
      columnFilters: ColumnFiltersState;
      pagination: PaginationState;
      rowSelection: RowSelectionState;
      grouping: GroupingState;
      expanded: ExpandedState;
   };
   onSortingChange: OnChangeFn<SortingState>;
   onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
   onPaginationChange: OnChangeFn<PaginationState>;
   onRowSelectionChange: OnChangeFn<RowSelectionState>;
   onGroupingChange: OnChangeFn<GroupingState>;
   onExpandedChange: OnChangeFn<ExpandedState>;
   pageCount: number;
}

export function useTableUrlState({
   search,
   onUpdate,
   totalRows,
}: UseTableUrlStateOptions): UseTableUrlStateResult {
   const { sorting, columnFilters, page, pageSize } = search;
   const grouping = search.grouping ?? [];
   const pagination: PaginationState = { pageIndex: page - 1, pageSize };

   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
   const [expanded, setExpanded] = useState<ExpandedState>(true);

   const onSortingChange = useCallback<OnChangeFn<SortingState>>(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         startTransition(() => onUpdate({ sorting: next, page: 1 }));
      },
      [onUpdate, sorting],
   );

   const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(columnFilters) : updater;
         startTransition(() => onUpdate({ columnFilters: next, page: 1 }));
      },
      [onUpdate, columnFilters],
   );

   const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(pagination) : updater;
         startTransition(() =>
            onUpdate({ page: next.pageIndex + 1, pageSize: next.pageSize }),
         );
      },
      [onUpdate, pagination],
   );

   const onGroupingChange = useCallback<OnChangeFn<GroupingState>>(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(grouping) : updater;
         startTransition(() => onUpdate({ grouping: next, page: 1 }));
      },
      [onUpdate, grouping],
   );

   return {
      state: {
         sorting,
         columnFilters,
         pagination,
         rowSelection,
         grouping,
         expanded,
      },
      onSortingChange,
      onColumnFiltersChange,
      onPaginationChange,
      onRowSelectionChange: setRowSelection,
      onGroupingChange,
      onExpandedChange: setExpanded,
      pageCount: Math.max(1, Math.ceil(totalRows / pageSize)),
   };
}
