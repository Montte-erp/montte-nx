import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import type React from "react";
import { useDataTable } from "./data-table-root";

export { SelectionActionButton };

interface DataTableBulkActionsProps<TData> {
   children: (props: {
      selectedRows: TData[];
      clearSelection: () => void;
   }) => React.ReactNode;
   summary?: React.ReactNode;
}

export function DataTableBulkActions<TData>({
   children,
   summary,
}: DataTableBulkActionsProps<TData>) {
   const { table } = useDataTable<TData>();
   const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
   const selectedCount = selectedRows.length;
   const clearSelection = () => table.resetRowSelection();

   return (
      <SelectionActionBar
         selectedCount={selectedCount}
         summary={summary}
         onClear={clearSelection}
      >
         {children({ selectedRows, clearSelection })}
      </SelectionActionBar>
   );
}
