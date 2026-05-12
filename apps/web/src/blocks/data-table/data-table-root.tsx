import type { RowData, Table } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import type React from "react";

declare module "@tanstack/react-table" {
   interface ColumnMeta<TData extends RowData, TValue> {
      resizable?: boolean;
      pinnable?: boolean;
      reorderable?: boolean;
      exportValue?: (row: TData, value: TValue) => string;
      exportIgnore?: boolean;
   }
}

// `unknown` here is type-erasure at the context boundary: each callsite reifies
// `TData` via `useDataTableContext<MyRow>()`. There's no safe way to encode an
// existential generic in React.createContext, so the read site narrows.
interface DataTableContextValue {
   table: Table<unknown>;
   scrollContainerId?: string;
   enableReorder?: boolean;
}

const DataTableContext = createContext<DataTableContextValue | null>(null);

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
   const value = useMemo<DataTableContextValue>(
      () => ({
         table: table as unknown as Table<unknown>,
         scrollContainerId,
         enableReorder,
      }),
      [table, scrollContainerId, enableReorder],
   );
   return (
      <DataTableContext.Provider value={value}>
         <div className="flex flex-col gap-4">{children}</div>
      </DataTableContext.Provider>
   );
}

export function useDataTableContext<TData>(): {
   table: Table<TData>;
   scrollContainerId?: string;
   enableReorder?: boolean;
} {
   const ctx = useContext(DataTableContext);
   if (!ctx) throw new Error("useDataTableContext outside DataTableRoot");
   return {
      table: ctx.table as unknown as Table<TData>,
      scrollContainerId: ctx.scrollContainerId,
      enableReorder: ctx.enableReorder,
   };
}
