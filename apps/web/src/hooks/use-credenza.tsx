import {
   Credenza,
   CredenzaContent,
} from "@packages/ui/components/credenza";
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";

const credenzaStore = new Store<{ stack: React.ReactNode[] }>({
   stack: [],
});

export const useCredenza = () => ({
   closeCredenza: () => credenzaStore.setState(() => ({ stack: [] })),
   closeTopCredenza: () =>
      credenzaStore.setState((s) => ({ stack: s.stack.slice(0, -1) })),
   openCredenza: (options: { children: React.ReactNode }) =>
      credenzaStore.setState((s) => ({ stack: [...s.stack, options.children] })),
});

export function GlobalCredenza() {
   const { stack } = useStore(credenzaStore, (s) => s);

   return (
      <>
         {stack.map((children, i) => (
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
               <CredenzaContent>{children}</CredenzaContent>
            </Credenza>
         ))}
      </>
   );
}
