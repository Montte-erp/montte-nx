import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import type React from "react";
import { useDataTable } from "./data-table-root";

interface DataTableEmptyStateProps {
   children: React.ReactNode;
}

export function DataTableEmptyState({ children }: DataTableEmptyStateProps) {
   const { store, table } = useDataTable();

   useIsomorphicLayoutEffect(() => {
      store.setState((s) => ({ ...s, hasEmptyState: true }));
      return () => store.setState((s) => ({ ...s, hasEmptyState: false }));
   }, [store]);

   if (table.getCoreRowModel().rows.length > 0) return null;
   return <>{children}</>;
}
