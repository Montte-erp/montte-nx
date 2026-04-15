import { Credenza, CredenzaContent } from "@packages/ui/components/credenza";
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";

type CredenzaOptions = { children: React.ReactNode; className?: string };

const credenzaStore = new Store<{ stack: CredenzaOptions[] }>({
   stack: [],
});

export const closeCredenza = () =>
   credenzaStore.setState(() => ({ stack: [] }));

export const openCredenza = (options: {
   children: React.ReactNode;
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
         {stack.map(({ children, className }, i) => (
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
                  {children}
               </CredenzaContent>
            </Credenza>
         ))}
      </>
   );
}
