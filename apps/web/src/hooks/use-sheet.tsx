import { Sheet, SheetContent } from "@packages/ui/components/sheet";
import { createStore, useStore } from "@tanstack/react-store";
import type React from "react";

type SheetOptions = {
   renderChildren: () => React.ReactNode;
   className?: string;
   side?: "top" | "right" | "bottom" | "left";
};

const sheetStore = createStore<{ stack: SheetOptions[] }>({ stack: [] });

export const closeSheet = () => sheetStore.setState(() => ({ stack: [] }));

export const openSheet = (options: SheetOptions) =>
   sheetStore.setState((s) => ({ stack: [...s.stack, options] }));

export const useSheet = () => ({
   closeSheet,
   closeTopSheet: () =>
      sheetStore.setState((s) => ({ stack: s.stack.slice(0, -1) })),
   openSheet,
});

export function GlobalSheet() {
   const stack = useStore(sheetStore, (s) => s.stack);

   return (
      <>
         {stack.map(({ renderChildren, className, side }, i) => (
            <Sheet
               key={`sheet-${i + 1}`}
               onOpenChange={(open) => {
                  if (!open) {
                     sheetStore.setState((s) => ({
                        stack: s.stack.slice(0, i),
                     }));
                  }
               }}
               open
            >
               <SheetContent className={className} side={side}>
                  {renderChildren()}
               </SheetContent>
            </Sheet>
         ))}
      </>
   );
}
