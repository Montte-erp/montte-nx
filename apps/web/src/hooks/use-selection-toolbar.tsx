import { createStore, useStore, shallow } from "@tanstack/react-store";
import type React from "react";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useCallback, useRef } from "react";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

type ToolbarState = {
   selectedIndices: Set<number>;
   renderActions:
      | ((ctx: {
           selectedIndices: Set<number>;
           clear: () => void;
        }) => React.ReactNode)
      | null;
};

const toolbarStore = createStore<ToolbarState>({
   selectedIndices: new Set<number>(),
   renderActions: null,
});

export const clearSelectionToolbar = () =>
   toolbarStore.setState(() => ({
      selectedIndices: new Set<number>(),
      renderActions: null,
   }));

const addToSelection = (i: number) =>
   toolbarStore.setState((s) => ({
      ...s,
      selectedIndices: new Set([...s.selectedIndices, i]),
   }));

const removeFromSelection = (i: number) =>
   toolbarStore.setState((s) => {
      const next = new Set(s.selectedIndices);
      next.delete(i);
      return { ...s, selectedIndices: next };
   });

const replaceSelection = (next: Set<number>) =>
   toolbarStore.setState((s) => ({ ...s, selectedIndices: next }));

export function useSelectionToolbar(
   renderActions: (ctx: {
      selectedIndices: Set<number>;
      clear: () => void;
   }) => React.ReactNode,
) {
   const selectedIndices = useStore(toolbarStore, (s) => s.selectedIndices);
   const renderActionsRef = useRef(renderActions);
   renderActionsRef.current = renderActions;

   const stableRenderActions = useCallback(
      (ctx: { selectedIndices: Set<number>; clear: () => void }) =>
         renderActionsRef.current(ctx),
      [],
   );

   useIsomorphicLayoutEffect(() => {
      toolbarStore.setState((s) => ({
         ...s,
         renderActions: stableRenderActions,
      }));
      return () => {
         toolbarStore.setState(() => ({
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

export function GlobalSelectionToolbar() {
   const { selectedIndices, renderActions } = useStore(
      toolbarStore,
      (s) => s,
      shallow,
   );
   if (!renderActions) return null;
   return (
      <SelectionActionBar
         selectedCount={selectedIndices.size}
         onClear={clearSelectionToolbar}
      >
         {renderActions({ selectedIndices, clear: clearSelectionToolbar })}
      </SelectionActionBar>
   );
}
