import { Credenza, CredenzaContent } from "@packages/ui/components/credenza";
import { createStore, useStore } from "@tanstack/react-store";
import type React from "react";

type CredenzaOptions = {
   renderChildren: () => React.ReactNode;
   className?: string;
};

const credenzaStore = createStore<{ stack: CredenzaOptions[] }>({
   stack: [],
});

export const closeCredenza = () =>
   credenzaStore.setState(() => ({ stack: [] }));

export const openCredenza = (options: {
   renderChildren: () => React.ReactNode;
   className?: string;
}) => credenzaStore.setState((s) => ({ stack: [...s.stack, options] }));

export const useCredenza = () => ({
   closeCredenza,
   closeTopCredenza: () =>
      credenzaStore.setState((s) => ({ stack: s.stack.slice(0, -1) })),
   openCredenza,
});

export function GlobalCredenza() {
   const stack = useStore(credenzaStore, (s) => s.stack);

   return (
      <>
         {stack.map(({ renderChildren, className }, i) => (
            <Credenza
               key={`credenza-${i + 1}`}
               onOpenChange={(open) => {
                  if (!open) {
                     credenzaStore.setState((s) => ({
                        stack: s.stack.slice(0, i),
                     }));
                  }
               }}
               open
            >
               <CredenzaContent className={className}>
                  {renderChildren()}
               </CredenzaContent>
            </Credenza>
         ))}
      </>
   );
}
