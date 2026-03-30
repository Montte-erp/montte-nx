import {
   Credenza,
   CredenzaContent,
} from "@packages/ui/components/credenza";
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";

const credenzaStore = new Store<{
   isOpen: boolean;
   children: React.ReactNode | null;
}>({
   isOpen: false,
   children: null,
});

export const useCredenza = () => ({
   closeCredenza: () =>
      credenzaStore.setState(() => ({ isOpen: false, children: null })),
   openCredenza: (options: { children: React.ReactNode }) =>
      credenzaStore.setState(() => ({
         isOpen: true,
         children: options.children,
      })),
});

export function GlobalCredenza() {
   const { isOpen, children } = useStore(credenzaStore, (s) => s);

   return (
      <Credenza
         onOpenChange={(open) => {
            if (!open) credenzaStore.setState(() => ({ isOpen: false, children: null }));
         }}
         open={isOpen}
      >
         <CredenzaContent>{children}</CredenzaContent>
      </Credenza>
   );
}
