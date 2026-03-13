import {
   type ColumnDef,
   type Row,
   type RowSelectionState,
} from "@tanstack/react-table";
interface DataTablePaginationProps {
   currentPage: number;
   totalPages: number;
   totalCount: number;
   pageSize: number;
   onPageChange: (page: number) => void;
   onPageSizeChange?: (size: number) => void;
   pageSizeOptions?: number[];
}
interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   pagination?: DataTablePaginationProps;
   enableRowSelection?: boolean;
   rowSelection?: RowSelectionState;
   onRowSelectionChange?: (selection: RowSelectionState) => void;
   getRowId?: (row: TData) => string;
   /** When provided, enables column visibility toggle persisted in localStorage under this key. */
   columnVisibilityKey?: string;
   /** Render row actions in the last column. The header shows the column visibility config icon. */
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   /** Controls layout: 'table' (default) or 'card' (dynamic cards from column definitions). */
   view?: "table" | "card";
}
export declare function DataTable<TData, TValue>({
   columns,
   data,
   pagination,
   enableRowSelection,
   rowSelection: controlledRowSelection,
   onRowSelectionChange,
   getRowId,
   columnVisibilityKey,
   renderActions,
   view,
}: DataTableProps<TData, TValue>): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=data-table.d.ts.map
