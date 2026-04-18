import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import type React from "react";
import { useDataTableContext } from "./context";

interface DataTableEmptyStateProps {
   children: React.ReactNode;
}

export function DataTableEmptyState({ children }: DataTableEmptyStateProps) {
   const { data, registerEmptyState, unregisterEmptyState } =
      useDataTableContext();

   useIsomorphicLayoutEffect(() => {
      registerEmptyState();
      return unregisterEmptyState;
   }, [registerEmptyState, unregisterEmptyState]);

   if (data.length > 0) return null;
   return <>{children}</>;
}
