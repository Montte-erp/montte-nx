import { Credenza, CredenzaContent } from "@packages/ui/components/credenza";
import { Store, useStore } from "@tanstack/react-store";

type CredenzaState = {
   children: React.ReactNode | null;
   isOpen: boolean;
   className?: string;
};

const credenzaStore = new Store<CredenzaState>({
   children: null,
   isOpen: false,
   className: undefined,
});

export const openCredenza = ({
   children,
   className,
}: {
   children: React.ReactNode;
   className?: string;
}) =>
   credenzaStore.setState((state) => ({
      ...state,
      children,
      className,
      isOpen: true,
   }));

export const closeCredenza = () =>
   credenzaStore.setState((state) => ({
      ...state,
      children: null,
      className: undefined,
      isOpen: false,
   }));

export const useCredenza = () => {
   return {
      closeCredenza,
      openCredenza,
   };
};

export function GlobalCredenza() {
   const { children, isOpen, className } = useStore(credenzaStore);

   return (
      <Credenza
         onOpenChange={(open) => {
            credenzaStore.setState((state) => ({ ...state, isOpen: open }));
         }}
         open={isOpen}
      >
         <CredenzaContent className={className}>{children}</CredenzaContent>
      </Credenza>
   );
}
