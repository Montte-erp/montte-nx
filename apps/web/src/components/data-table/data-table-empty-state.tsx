import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import type React from "react";
import { useDataTableContext, useDataTableStore } from "./data-table-root";

interface DataTableEmptyStateProps {
   children: React.ReactNode;
}

export function DataTableEmptyState({ children }: DataTableEmptyStateProps) {
   const { store } = useDataTableContext();
   const dataLength = useDataTableStore((s) => s.data.length);

   useIsomorphicLayoutEffect(() => {
      store.setState((s) => ({ ...s, hasEmptyState: true }));
      return () => store.setState((s) => ({ ...s, hasEmptyState: false }));
   }, [store]);

   if (dataLength > 0) return null;
   return <>{children}</>;
}
