import type { RowData, Table } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import type React from "react";

declare module "@tanstack/react-table" {
   // oxlint-ignore @typescript-eslint/no-unused-vars
   interface ColumnMeta<TData extends RowData, TValue> {
      resizable?: boolean;
      pinnable?: boolean;
      reorderable?: boolean;
   }
}

interface DataTableContextValue<TData> {
   table: Table<TData>;
   scrollContainerId?: string;
   enableReorder?: boolean;
}

// oxlint-ignore no-explicit-any
const DataTableContext = createContext<DataTableContextValue<any> | null>(null);

interface DataTableRootProps<TData> {
   children: React.ReactNode;
   table: Table<TData>;
   scrollContainerId?: string;
   enableReorder?: boolean;
}

export function DataTableRoot<TData>({
   children,
   table,
   scrollContainerId,
   enableReorder,
}: DataTableRootProps<TData>) {
   const value = useMemo(
      () => ({ table, scrollContainerId, enableReorder }),
      [table, scrollContainerId, enableReorder],
   );
   return (
      <DataTableContext.Provider value={value}>
         <div className="flex flex-col gap-4">{children}</div>
      </DataTableContext.Provider>
   );
}

export function useDataTableContext<TData>(): DataTableContextValue<TData> {
   const ctx = useContext(DataTableContext);
   if (!ctx) throw new Error("useDataTableContext outside DataTableRoot");
   return ctx as DataTableContextValue<TData>;
}
