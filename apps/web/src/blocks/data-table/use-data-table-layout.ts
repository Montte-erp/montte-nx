import type {
   ColumnOrderState,
   ColumnPinningState,
   ColumnSizingState,
   OnChangeFn,
   VisibilityState,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useCallback, useMemo } from "react";

interface DataTableLayoutState {
   columnSizing: ColumnSizingState;
   columnOrder: ColumnOrderState;
   columnVisibility: VisibilityState;
   columnPinning: ColumnPinningState;
}

const EMPTY_LAYOUT: DataTableLayoutState = {
   columnSizing: {},
   columnOrder: [],
   columnVisibility: {},
   columnPinning: { left: [], right: [] },
};

type LayoutHook = () => readonly [
   DataTableLayoutState,
   React.Dispatch<React.SetStateAction<DataTableLayoutState | null>>,
];

const cache = new Map<string, LayoutHook>();

function getHook(storageKey: string): LayoutHook {
   const key = `montte:datatable:${storageKey}:layout`;
   const existing = cache.get(key);
   if (existing) return existing;
   const [hook] = createLocalStorageState<DataTableLayoutState>(
      key,
      EMPTY_LAYOUT,
   );
   cache.set(key, hook);
   return hook;
}

export interface UseDataTableLayoutResult {
   initialState: DataTableLayoutState;
   onColumnSizingChange: OnChangeFn<ColumnSizingState>;
   onColumnOrderChange: OnChangeFn<ColumnOrderState>;
   onColumnVisibilityChange: OnChangeFn<VisibilityState>;
   onColumnPinningChange: OnChangeFn<ColumnPinningState>;
}

export function useDataTableLayout(
   storageKey: string,
): UseDataTableLayoutResult {
   const useLayout = useMemo(() => getHook(storageKey), [storageKey]);
   const [layout, setLayout] = useLayout();

   const current = layout ?? EMPTY_LAYOUT;

   const onColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
      (updater) => {
         setLayout((prev) => {
            const base = prev ?? EMPTY_LAYOUT;
            const next =
               typeof updater === "function"
                  ? updater(base.columnSizing)
                  : updater;
            return { ...base, columnSizing: next };
         });
      },
      [setLayout],
   );

   const onColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
      (updater) => {
         setLayout((prev) => {
            const base = prev ?? EMPTY_LAYOUT;
            const next =
               typeof updater === "function"
                  ? updater(base.columnOrder)
                  : updater;
            return { ...base, columnOrder: next };
         });
      },
      [setLayout],
   );

   const onColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
      (updater) => {
         setLayout((prev) => {
            const base = prev ?? EMPTY_LAYOUT;
            const next =
               typeof updater === "function"
                  ? updater(base.columnVisibility)
                  : updater;
            return { ...base, columnVisibility: next };
         });
      },
      [setLayout],
   );

   const onColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
      (updater) => {
         setLayout((prev) => {
            const base = prev ?? EMPTY_LAYOUT;
            const next =
               typeof updater === "function"
                  ? updater(base.columnPinning)
                  : updater;
            return { ...base, columnPinning: next };
         });
      },
      [setLayout],
   );

   return {
      initialState: current,
      onColumnSizingChange,
      onColumnOrderChange,
      onColumnVisibilityChange,
      onColumnPinningChange,
   };
}
