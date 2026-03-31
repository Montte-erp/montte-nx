import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@packages/ui/components/alert-dialog";
import { useStore } from "@tanstack/react-store";
import { closeErrorModal, errorModalStore } from "./error-modal-store";

export function GlobalAuthErrorModal() {
   const { isOpen, message, code } = useStore(errorModalStore, (s) => s);

   return (
      <AlertDialog onOpenChange={(open) => !open && closeErrorModal()} open={isOpen}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Erro de autenticação</AlertDialogTitle>
               <AlertDialogDescription>
                  {message}
                  {code && (
                     <span className="block mt-1 text-xs text-muted-foreground">
                        Código: {code}
                     </span>
                  )}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogAction onClick={closeErrorModal}>
                  Fechar
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
