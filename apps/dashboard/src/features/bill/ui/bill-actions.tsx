import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { Button } from "@packages/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
   CalendarDays,
   Copy,
   Eye,
   FolderOpen,
   Layers,
   Paperclip,
   Pencil,
   Repeat,
   Split,
   Trash2,
   Wallet,
} from "lucide-react";
import { useBillActions } from "../lib/use-bill-actions";
import { CompleteBillDialog } from "./complete-bill-dialog";

type Bill = BillWithRelations;

type BillActionsProps = {
   bill: Bill;
   onDeleteSuccess?: () => void;
   variant?: "full" | "compact";
   showViewDetails?: boolean;
   slug?: string;
};

export function BillActions({
   bill,
   onDeleteSuccess,
   showViewDetails = false,
   slug,
}: BillActionsProps) {
   const {
      handleChangeCategory,
      handleCreateInstallments,
      handleDelete,
      handleDuplicate,
      handleEdit,
      handleEditMetadata,
      handleLinkFile,
      handleManageRecurrence,
      handleMarkAsRecurrent,
      handleViewInstallments,
   } = useBillActions(bill, { onDeleteSuccess });

   const isCompleted = !!bill.completionDate;
   const isSingleBill = !bill.isRecurring && !bill.installmentGroupId;

   return (
      <div className="flex flex-wrap items-center gap-2">
         {/* Primary Actions */}
         {!isCompleted ? (
            <>
               <CompleteBillDialog bill={bill}>
                  <Button size="sm" variant="outline">
                     <Wallet className="size-4" />
                     {bill.type === "expense" ? "Pagar" : "Receber"}
                  </Button>
               </CompleteBillDialog>
               <Button onClick={handleEdit} size="sm" variant="outline">
                  <Pencil className="size-4" />
                  Editar
               </Button>
            </>
         ) : (
            <Button onClick={handleEditMetadata} size="sm" variant="outline">
               <Pencil className="size-4" />
               Editar
            </Button>
         )}

         {/* Management Actions */}
         {showViewDetails && slug && (
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ billId: bill.id, slug }}
                  to="/$slug/bills/$billId"
               >
                  <Eye className="size-4" />
                  Ver Detalhes
               </Link>
            </Button>
         )}

         <Button onClick={handleDuplicate} size="sm" variant="outline">
            <Copy className="size-4" />
            Duplicar
         </Button>

         <Button onClick={handleLinkFile} size="sm" variant="outline">
            <Paperclip className="size-4" />
            Anexar Arquivo
         </Button>

         <Button onClick={handleChangeCategory} size="sm" variant="outline">
            <FolderOpen className="size-4" />
            Categorizar
         </Button>

         {/* Separator */}
         <div className="h-4 w-px bg-border" />

         {/* Bill-specific Actions (only for single bills) */}
         {isSingleBill && (
            <>
               <Button
                  onClick={handleMarkAsRecurrent}
                  size="sm"
                  variant="outline"
               >
                  <CalendarDays className="size-4" />
                  Tornar Recorrente
               </Button>
               <Button
                  onClick={handleCreateInstallments}
                  size="sm"
                  variant="outline"
               >
                  <Split className="size-4" />
                  Criar Parcelas
               </Button>
               {/* Separator */}
               <div className="h-4 w-px bg-border" />
            </>
         )}

         {/* Recurring bill actions */}
         {bill.isRecurring && (
            <>
               <Button
                  onClick={handleManageRecurrence}
                  size="sm"
                  variant="outline"
               >
                  <Repeat className="size-4" />
                  Gerenciar Recorrência
               </Button>
               {/* Separator */}
               <div className="h-4 w-px bg-border" />
            </>
         )}

         {/* Installment bill actions */}
         {bill.installmentGroupId && (
            <>
               <Button
                  onClick={handleViewInstallments}
                  size="sm"
                  variant="outline"
               >
                  <Layers className="size-4" />
                  Ver Parcelas
               </Button>
               {/* Separator */}
               <div className="h-4 w-px bg-border" />
            </>
         )}

         {/* Destructive Action */}
         <Button onClick={handleDelete} size="sm" variant="destructive">
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );
}
