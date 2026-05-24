import { createStore, useStore, shallow } from "@tanstack/react-store";
import type React from "react";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useCallback, useRef } from "react";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

interface InternalState {
   selectedIndices: Set<number>;
   renderActions:
      | ((ctx: {
           selectedIndices: Set<number>;
           clear: () => void;
        }) => React.ReactNode)
      | null;
}

interface ExternalState {
   selectedCount: number;
   onClear: (() => void) | null;
   renderActions: (() => React.ReactNode) | null;
}

const internalStore = createStore<InternalState>({
   selectedIndices: new Set<number>(),
   renderActions: null,
});

const externalStore = createStore<ExternalState>({
   selectedCount: 0,
   onClear: null,
   renderActions: null,
});

export const clearSelectionToolbar = () =>
   internalStore.setState((s) => ({
      ...s,
      selectedIndices: new Set<number>(),
   }));

const addToSelection = (i: number) =>
   internalStore.setState((s) => ({
      ...s,
      selectedIndices: new Set([...s.selectedIndices, i]),
   }));

const removeFromSelection = (i: number) =>
   internalStore.setState((s) => {
      const next = new Set(s.selectedIndices);
      next.delete(i);
      return { ...s, selectedIndices: next };
   });

const replaceSelection = (next: Set<number>) =>
   internalStore.setState((s) => ({ ...s, selectedIndices: next }));

export function useSelectionToolbar(
   renderActions: (ctx: {
      selectedIndices: Set<number>;
      clear: () => void;
   }) => React.ReactNode,
) {
   const selectedIndices = useStore(internalStore, (s) => s.selectedIndices);
   const renderActionsRef = useRef(renderActions);
   renderActionsRef.current = renderActions;

   const stableRenderActions = useCallback(
      (ctx: { selectedIndices: Set<number>; clear: () => void }) =>
         renderActionsRef.current(ctx),
      [],
   );

   useIsomorphicLayoutEffect(() => {
      internalStore.setState((s) => ({
         ...s,
         renderActions: stableRenderActions,
      }));
      return () => {
         internalStore.setState(() => ({
            selectedIndices: new Set<number>(),
            renderActions: null,
         }));
      };
   }, [stableRenderActions]);

   function toggle(index: number) {
      if (selectedIndices.has(index)) removeFromSelection(index);
      else addToSelection(index);
   }

   return {
      selectedIndices,
      toggle,
      add: addToSelection,
      remove: removeFromSelection,
      clear: clearSelectionToolbar,
      replace: replaceSelection,
   };
}

interface UseTableBulkActionsOptions {
   selectedCount: number;
   onClear: () => void;
   children: React.ReactNode;
}

export function useTableBulkActions({
   selectedCount,
   onClear,
   children,
}: UseTableBulkActionsOptions) {
   const onClearRef = useRef(onClear);
   onClearRef.current = onClear;
   const childrenRef = useRef(children);
   childrenRef.current = children;

   const stableClear = useCallback(() => onClearRef.current(), []);
   const stableRender = useCallback(() => childrenRef.current, []);

   useIsomorphicLayoutEffect(() => {
      externalStore.setState(() => ({
         selectedCount,
         onClear: stableClear,
         renderActions: stableRender,
      }));
      return () => {
         externalStore.setState(() => ({
            selectedCount: 0,
            onClear: null,
            renderActions: null,
         }));
      };
   }, [selectedCount, stableClear, stableRender]);
}

export function GlobalSelectionToolbar() {
   const external = useStore(externalStore, (s) => s, shallow);
   const internal = useStore(internalStore, (s) => s, shallow);

   if (
      external.selectedCount > 0 &&
      external.onClear &&
      external.renderActions
   ) {
      return (
         <SelectionActionBar
            selectedCount={external.selectedCount}
            onClear={external.onClear}
         >
            {external.renderActions()}
         </SelectionActionBar>
      );
   }

   if (internal.selectedIndices.size > 0 && internal.renderActions) {
      return (
         <SelectionActionBar
            selectedCount={internal.selectedIndices.size}
            onClear={clearSelectionToolbar}
         >
            {internal.renderActions({
               selectedIndices: internal.selectedIndices,
               clear: clearSelectionToolbar,
            })}
         </SelectionActionBar>
      );
   }

   return null;
}
