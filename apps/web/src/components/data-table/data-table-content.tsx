import { DataTable } from "@packages/ui/components/data-table";
import { useDataTableContext } from "./context";

export function DataTableContent<TData, TValue = unknown>() {
   const ctx = useDataTableContext<TData, TValue>();

   if (ctx.data.length === 0 && ctx.hasEmptyState) return null;

   return (
      <DataTable
         columns={ctx.columns}
         data={ctx.data}
         getRowId={ctx.getRowId}
         sorting={ctx.sorting}
         onSortingChange={ctx.onSortingChange}
         columnFilters={ctx.columnFilters}
         onColumnFiltersChange={ctx.onColumnFiltersChange}
         tableState={ctx.tableState}
         onTableStateChange={ctx.onTableStateChange}
         rowSelection={ctx.rowSelection}
         onRowSelectionChange={ctx.onRowSelectionChange}
         renderActions={ctx.renderActions}
         groupBy={ctx.groupBy}
         renderGroupHeader={ctx.renderGroupHeader}
         getSubRows={ctx.getSubRows}
      />
   );
}
