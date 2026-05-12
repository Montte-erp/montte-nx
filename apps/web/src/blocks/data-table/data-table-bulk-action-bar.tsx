import { SelectionActionBar } from "@packages/ui/components/selection-action-bar";
import type { Row } from "@tanstack/react-table";
import type React from "react";
import { useDataTableContext } from "./data-table-root";

interface BulkActionBarApi<TData> {
   rows: Row<TData>[];
   clear: () => void;
   count: number;
}

interface DataTableBulkActionBarProps<TData> {
   children: (api: BulkActionBarApi<TData>) => React.ReactNode;
}

export function DataTableBulkActionBar<TData>({
   children,
}: DataTableBulkActionBarProps<TData>) {
   const { table } = useDataTableContext<TData>();
   const rows = table.getSelectedRowModel().rows;
   const count = rows.length;

   const clear = () => table.resetRowSelection();

   if (count === 0) return null;

   return (
      <SelectionActionBar selectedCount={count} onClear={clear}>
         {children({ rows, clear, count })}
      </SelectionActionBar>
   );
}
