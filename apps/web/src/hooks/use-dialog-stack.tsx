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
   bodyClassName: undefined as string | undefined,
});

export const openDialogStack = ({
   children,
   bodyClassName,
}: {
   children: React.ReactNode;
   bodyClassName?: string;
}) =>
   dialogStackStore.setState((state) => ({
      ...state,
      children,
      isOpen: true,
      bodyClassName,
   }));

export const closeDialogStack = () =>
   dialogStackStore.setState((state) => ({
      ...state,
      children: null,
      isOpen: false,
      bodyClassName: undefined,
   }));

export const useDialogStack = () => ({ openDialogStack, closeDialogStack });

export function GlobalDialogStack() {
   const { children, isOpen, bodyClassName } = useStore(
      dialogStackStore,
      (s) => s,
   );

   return (
      <DialogStack
         clickable
         onOpenChange={(open) => {
            dialogStackStore.setState((state) => ({ ...state, isOpen: open }));
         }}
         open={isOpen}
      >
         <DialogStackOverlay />
         <DialogStackBody className={bodyClassName}>
            {children as React.ReactElement<{ index?: number }>}
         </DialogStackBody>
      </DialogStack>
   );
}
