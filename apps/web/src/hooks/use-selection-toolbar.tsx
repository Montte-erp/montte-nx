import { useSet } from "foxact/use-set";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useState } from "react";
import { createPortal } from "react-dom";
import type * as React from "react";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";

export { SelectionActionButton };

export function useSelectionToolbar(
   renderActions: (ctx: {
      selectedIndices: Set<number>;
      clear: () => void;
   }) => React.ReactNode,
) {
   const [mounted, setMounted] = useState(false);
   useIsomorphicLayoutEffect(() => {
      setMounted(true);
   }, []);

   const [
      selectedIndices,
      addIndex,
      removeIndex,
      clearIndices,
      replaceIndices,
   ] = useSet<number>();

   function toggle(index: number) {
      if (selectedIndices.has(index)) {
         removeIndex(index);
      } else {
         addIndex(index);
      }
   }

   const toolbar = mounted
      ? createPortal(
           <SelectionActionBar
              selectedCount={selectedIndices.size}
              onClear={clearIndices}
           >
              {renderActions({ selectedIndices, clear: clearIndices })}
           </SelectionActionBar>,
           document.body,
        )
      : null;

   return {
      selectedIndices,
      toggle,
      add: addIndex,
      remove: removeIndex,
      clear: clearIndices,
      replace: replaceIndices,
      toolbar,
   };
}
