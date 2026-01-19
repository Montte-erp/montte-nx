import { useEffect } from "react";
import { updateActiveTabName } from "./use-dashboard-tabs";

/**
 * Hook for detail pages to update the active tab's name once data is loaded.
 *
 * @param name - The entity name to display in the tab (e.g., transaction.description, bill.description)
 *
 * @example
 * ```tsx
 * function TransactionContent() {
 *    const { data: transaction } = useSuspenseQuery(...);
 *    useDetailTabName(transaction?.description);
 *    // ...
 * }
 * ```
 */
export function useDetailTabName(name: string | null | undefined) {
   useEffect(() => {
      if (name) {
         updateActiveTabName(name);
      }
   }, [name]);
}
