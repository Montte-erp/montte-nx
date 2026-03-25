import {
   DialogStack,
   DialogStackBody,
   DialogStackOverlay,
} from "@packages/ui/components/dialog-stack";
import { Store, useStore } from "@tanstack/react-store";
import type React from "react";

const dialogStackStore = new Store({
   children: null as React.ReactNode | null,
   isOpen: false,
});

export const openDialogStack = ({ children }: { children: React.ReactNode }) =>
   dialogStackStore.setState((state) => ({ ...state, children, isOpen: true }));

export const closeDialogStack = () =>
   dialogStackStore.setState((state) => ({
      ...state,
      children: null,
      isOpen: false,
   }));

export const useDialogStack = () => ({ openDialogStack, closeDialogStack });

export function GlobalDialogStack() {
   const { children, isOpen } = useStore(dialogStackStore, (s) => s);

   return (
      <DialogStack
         clickable
         onOpenChange={(open) => {
            dialogStackStore.setState((state) => ({ ...state, isOpen: open }));
         }}
         open={isOpen}
      >
         <DialogStackOverlay />
         <DialogStackBody>
            {children as React.ReactElement<{ index?: number }>}
         </DialogStackBody>
      </DialogStack>
   );
}
